import { useEffect, useId, useRef, useState } from "react";
import { DiningTableIcon } from "../../../components/ui/DiningTableIcon";
import { useAppShell } from "../../../app/layout/shell-context";
import { Alert } from "../../../components/feedback/Alert";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { BottomSheet } from "../../../components/layout/BottomSheet";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ApiError } from "../../../lib/http/client";
import type { AuthSession } from "../../auth/types/auth.types";
import { tableChanges } from "../schemas/restaurant-table.schema";
import type {
  RestaurantTable,
  TableInput,
} from "../schemas/restaurant-table.schema";
import { useRestaurantTables } from "../hooks/useRestaurantTables";
import { RestaurantTableForm } from "./RestaurantTableForm";
import { RestaurantTableList } from "./RestaurantTableList";

export function RestaurantTablesPanel() {
  const { session } = useAppShell();

  return (
    <TablesContent
      session={session}
      key={[
        session.business.id,
        session.membership.id,
        session.accessToken,
      ].join(":")}
    />
  );
}

function TablesContent({ session }: { session: AuthSession }) {
  const resource = useRestaurantTables(session);

  // undefined: cerrado; null: crear; objeto: editar.
  const [editing, setEditing] = useState<
    RestaurantTable | null | undefined
  >();

  const [notice, setNotice] = useState({
    message: "",
    error: false,
  });

  const modalId = useId();
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!notice.message) return;

    const timer = window.setTimeout(() => {
      setNotice({ message: "", error: false });
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  async function save(values: TableInput) {
    const input = editing ? tableChanges(editing, values) : values;

    if (!Object.keys(input).length) {
      setEditing(undefined);
      return;
    }

    await resource.mutate(
      editing
        ? { kind: "update", id: editing.id, input }
        : { kind: "create", input: values }
    );

    if (!alive.current) return;

    setNotice({
      message: editing ? "Mesa actualizada." : "Mesa creada.",
      error: false,
    });
    setEditing(undefined);
  }

  async function toggle(table: RestaurantTable) {
    if (resource.busy || editing !== undefined) return;

    setNotice({ message: "", error: false });

    try {
      const saved = await resource.mutate({
        kind: "status",
        id: table.id,
        isActive: !table.isActive,
      });

      if (alive.current) {
        setNotice({
          message: saved.isActive
            ? "Mesa activada."
            : "Mesa desactivada.",
          error: false,
        });
      }
    } catch (error: unknown) {
      if (alive.current) {
        setNotice({
          message:
            error instanceof ApiError
              ? error.message
              : "No pudimos cambiar el estado.",
          error: true,
        });
      }
    }
  }

  return (
    <>
      <Card>
        <h2 className="flex items-center gap-2 text-base font-bold text-heading">
          <DiningTableIcon
            aria-hidden="true"
            size={18}
            className="text-accent"
          />
          Mesas
        </h2>

        <p className="mt-1 text-xs leading-relaxed text-muted">
          Administra los espacios de atención de tu negocio.
        </p>

        {resource.loading ? (
          <div className="py-8">
            <LoadingState message="Cargando mesas…" />
          </div>
        ) : resource.error ? (
          <Alert className="mt-4">
            <p>{resource.error}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={resource.retry}
            >
              Reintentar
            </Button>
          </Alert>
        ) : (
          <RestaurantTableList
            tables={resource.tables}
            disabled={resource.busy || editing !== undefined}
            onCreate={() => {
              setNotice({ message: "", error: false });
              setEditing(null);
            }}
            onEdit={(table) => {
              setNotice({ message: "", error: false });
              setEditing(table);
            }}
            onToggle={(table) => {
              void toggle(table);
            }}
          />
        )}

        <p className="mt-5 text-xs leading-relaxed text-muted">
          Una mesa inactiva no admite órdenes nuevas. Sus órdenes
          existentes y su historial se conservan.
        </p>
      </Card>

      {notice.message && (
        <div className="fixed inset-x-4 bottom-24 z-40 sm:left-auto sm:bottom-6 sm:w-96">
          <Alert variant={notice.error ? "error" : "success"}>
            {notice.message}
          </Alert>
        </div>
      )}

      {editing !== undefined && (
        <BottomSheet
          id={modalId}
          open
          variant="modal"
          busy={resource.busy}
          title={editing ? "Editar mesa" : "Nueva mesa"}
          onClose={() => setEditing(undefined)}
        >
          <RestaurantTableForm
            key={editing?.id ?? "new"}
            table={editing ?? undefined}
            busy={resource.busy}
            onSave={save}
            onCancel={() => setEditing(undefined)}
          />
        </BottomSheet>
      )}
    </>
  );
}
