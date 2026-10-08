import { useEffect, useRef, useState } from "react";
import { useAppShell } from "../../../app/layout/shell-context";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import type { InventoryItem } from "../schemas/inventory.schema";
import {
  errorText,
  readItem,
  readItems,
  readLinks,
  saveItem,
  saveMovement,
  saveStatus,
  uncertain,
} from "../services/inventory-operations";
import type {
  InventoryLink,
  ItemEdit,
  ManualType,
  MovementInput,
  SavedMovement,
} from "../services/inventory-operations";
import { validTimeZone } from "../utils/inventory-format";
import {
  InventoryItemDetail,
  InventoryItemEditor,
} from "./InventoryItemPanel";
import {
  InventoryMovementForm,
  InventoryMovementReceipt,
} from "./InventoryMovementForm";

export type InventoryDialogAction =
  | {
      kind: "detail" | "edit" | "status";
      id: string;
    }
  | {
      kind: "movement";
      id?: string;
      initialType?: ManualType;
    };

type View = InventoryDialogAction["kind"];

interface Loaded {
  view: View;
  item: InventoryItem | null;
  items: InventoryItem[];
  links: InventoryLink[];
  linksError: string;
}

export function InventoryDialog({
  action,
  onClose,
  onChanged,
}: {
  action: InventoryDialogAction;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const { session, settings } = useAppShell();

  const [view, setView] = useState<View>(action.kind);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [readError, setReadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [discardAndClose, setDiscardAndClose] = useState(false);
  const [receipt, setReceipt] = useState<SavedMovement | null>(null);

  const write = useRef<AbortController | null>(null);
  const blocked = useRef(false);
  const id = action.id;

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      if (view === "movement") {
        const items = await readItems(session, controller.signal);

        controller.signal.throwIfAborted();

        setLoaded({
          view,
          item: null,
          items,
          links: [],
          linksError: "",
        });

        return;
      }

      if (!id) {
        throw new Error("No se seleccionó un artículo.");
      }

      const [itemResult, linksResult] = await Promise.allSettled([
        readItem(id, session, controller.signal),
        view === "detail"
          ? readLinks(id, session, controller.signal)
          : Promise.resolve([]),
      ]);

      controller.signal.throwIfAborted();

      if (itemResult.status === "rejected") {
        throw itemResult.reason;
      }

      setLoaded({
        view,
        item: itemResult.value,
        items: [],
        links:
          linksResult.status === "fulfilled" ? linksResult.value : [],
        linksError:
          linksResult.status === "rejected"
            ? errorText(linksResult.reason)
            : "",
      });
    })().catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setReadError(errorText(cause));
      }
    });

    return () => controller.abort();
  }, [view, id, session, attempt]);

  useEffect(
    () => () => {
      write.current?.abort();
    },
    []
  );

  useEffect(() => {
    if (!dirty && !busy) return;

    function preventExit(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", preventExit);

    return () =>
      window.removeEventListener("beforeunload", preventExit);
  }, [dirty, busy]);

  // Primero desmonta la confirmación, después el modal
  // principal, para restaurar correctamente el scroll.
  useEffect(() => {
    if (discardAndClose && !discard) {
      onClose();
    }
  }, [discardAndClose, discard, onClose]);

  function close() {
    if (write.current) return;

    if (dirty && !unknown && !receipt) {
      setDiscard(true);
    } else {
      onClose();
    }
  }

  function changeView(next: View) {
    if (next === view) return;

    setReadError("");
    setLoaded(null);
    setError("");
    setDirty(false);
    setView(next);
  }

  function retryRead() {
    setReadError("");
    setLoaded(null);
    setAttempt((value) => value + 1);
  }

  async function run(
    operation: (
      signal: AbortSignal
    ) => Promise<InventoryItem | SavedMovement>
  ) {
    if (write.current || blocked.current) return;

    const controller = new AbortController();

    write.current = controller;
    setBusy(true);
    setError("");

    try {
      const result = await operation(controller.signal);

      controller.signal.throwIfAborted();

      blocked.current = true;
      setDirty(false);

      onChanged(
        view === "movement"
          ? "Movimiento registrado correctamente."
          : "Artículo actualizado correctamente."
      );

      if ("lines" in result) {
        setReceipt(result);
      } else {
        onClose();
      }
    } catch (cause: unknown) {
      if (!controller.signal.aborted) {
        if (uncertain(cause)) {
          blocked.current = true;
          setUnknown(true);

          setError(
            "No pudimos confirmar el resultado. No vuelvas a registrar la operación sin verificarla. Se actualizarán las existencias y los movimientos."
          );

          onChanged(
            "Resultado sin confirmar. Verifica el registro antes de reintentar."
          );
        } else {
          setError(errorText(cause));
        }
      }
    } finally {
      if (write.current === controller) {
        write.current = null;
      }

      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  const data = loaded?.view === view ? loaded : null;
  const item = data?.item;

  const title = receipt
    ? "Movimiento registrado"
    : view === "movement"
      ? "Registrar movimiento"
      : view === "edit"
        ? "Editar información"
        : view === "status"
          ? item?.isActive
            ? "Desactivar artículo"
            : "Activar artículo"
          : (item?.name ?? "Detalle del artículo");

  return (
    <>
      <BottomSheet
        id="inventory-operation"
        open
        variant="modal"
        title={title}
        onClose={close}
        busy={busy}
        className={[
          "inv-dialog",
          view === "detail" && !receipt ? "inv-drawer" : "",
          view === "movement" || receipt ? "inv-dialog-wide" : "",
        ].join(" ")}
      >
        {error && (
          <p className="inv-error inv-server-error" role="alert">
            {error}
          </p>
        )}

        {receipt ? (
          <>
            <InventoryMovementReceipt movement={receipt} />

            <footer className="inv-dialog-footer">
              <Button size="sm" onClick={onClose}>
                Cerrar
              </Button>
            </footer>
          </>
        ) : readError ? (
          <div className="inv-dialog-body">
            <p className="inv-error" role="alert">
              {readError}
            </p>

            <Button variant="secondary" size="sm" onClick={retryRead}>
              Reintentar consulta
            </Button>
          </div>
        ) : !data ? (
          <p className="inv-dialog-body" role="status">
            Cargando información…
          </p>
        ) : (
          <fieldset disabled={unknown} className="inv-dialog-content">
            {view === "detail" && item && (
              <InventoryItemDetail
                item={item}
                links={data.links}
                linksError={data.linksError}
                timezone={validTimeZone(settings.data?.timezone)}
                onAction={changeView}
              />
            )}

            {view === "edit" && item && (
              <InventoryItemEditor
                item={item}
                busy={busy}
                onDirty={setDirty}
                onCancel={close}
                onSave={(body: ItemEdit) =>
                  void run((signal) =>
                    saveItem(item.id, body, session, signal)
                  )
                }
              />
            )}

            {view === "movement" && (
              <InventoryMovementForm
                items={data.items}
                initialItemId={id}
                initialType={
                  action.kind === "movement"
                    ? action.initialType
                    : undefined
                }
                busy={busy}
                onDirty={setDirty}
                onCancel={close}
                onSave={(body: MovementInput) =>
                  void run((signal) =>
                    saveMovement(body, session, signal)
                  )
                }
              />
            )}

            {view === "status" && item && (
              <>
                <div className="inv-dialog-body">
                  <strong>{item.name}</strong>

                  <p>
                    {item.isActive
                      ? "El artículo quedará inactivo. Su información histórica se conservará."
                      : "El artículo volverá a estar activo."}
                  </p>
                </div>

                <footer className="inv-dialog-footer">
                  <Button
                    variant="cancel"
                    size="sm"
                    disabled={busy}
                    onClick={close}
                  >
                    Cancelar
                  </Button>

                  <Button
                    variant={item.isActive ? "danger" : "primary"}
                    size="sm"
                    loading={busy}
                    onClick={() =>
                      void run((signal) =>
                        saveStatus(
                          item.id,
                          !item.isActive,
                          session,
                          signal
                        )
                      )
                    }
                  >
                    {item.isActive ? "Desactivar" : "Activar"}
                  </Button>
                </footer>
              </>
            )}
          </fieldset>
        )}

        {unknown && (
          <footer className="inv-dialog-footer">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Volver al listado para verificar
            </Button>
          </footer>
        )}
      </BottomSheet>

      {discard && (
        <BottomSheet
          id="inventory-discard"
          open
          variant="modal"
          title="Hay cambios sin guardar"
          onClose={() => setDiscard(false)}
          className="inv-dialog inv-discard"
        >
          <div className="inv-dialog-body">
            <p>¿Deseas descartar los cambios ingresados?</p>
          </div>

          <footer className="inv-dialog-footer">
            <Button
              size="sm"
              variant="secondary"
              data-dialog-initial-focus
              onClick={() => setDiscard(false)}
            >
              Continuar editando
            </Button>

            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setDiscard(false);
                setDiscardAndClose(true);
              }}
            >
              Descartar cambios
            </Button>
          </footer>
        </BottomSheet>
      )}
    </>
  );
}
