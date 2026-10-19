import { Toggle } from "../../../components/forms/Toggle";
import type { ConsumptionLink } from "../services/inventory-workspace";
import { unitLabels } from "../utils/inventory-format";

type Props = {
  rows: ConsumptionLink[];
  disabled: boolean;
  busy: boolean;
  onAutomatic: (link: ConsumptionLink, checked: boolean) => void;
  onStatus: (link: ConsumptionLink) => void;
  onEdit: (link: ConsumptionLink) => void;
};

const buttonClass =
  "inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg border px-3 " +
  "text-[13px] font-medium leading-5 transition-colors cursor-pointer " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed motion-reduce:transition-none";

function StatusButton({
  link,
  disabled,
  onStatus,
}: Pick<Props, "disabled" | "onStatus"> & {
  link: ConsumptionLink;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={link.isActive}
      aria-label={
        "Relación activa: " +
        link.productName +
        " / " +
        link.inventoryItemName
      }
      title={
        link.isActive ? "Desactivar relación" : "Activar relación"
      }
      onClick={() => onStatus(link)}
      className={
        buttonClass +
        " h-10 min-w-[104px] whitespace-nowrap border-none bg-background text-heading enabled:hover:border-accent enabled:hover:bg-accent/15 enabled:hover:text-accent"
      }
    >
      {link.isActive ? "Activa" : "Inactiva"}
    </button>
  );
}

function AutomaticSwitch({
  link,
  disabled,
  busy,
  onAutomatic,
}: Pick<Props, "disabled" | "busy" | "onAutomatic"> & {
  link: ConsumptionLink;
}) {
  return (
    <Toggle
      label={<span className="sr-only">Descuento automático</span>}
      aria-label={
        "Descuento automático: " +
        link.productName +
        " / " +
        link.inventoryItemName
      }
      title={
        link.isActive
          ? "Cambiar descuento automático"
          : "La relación está inactiva. Actívala para modificar el descuento."
      }
      checked={link.autoDeduct}
      disabled={disabled || !link.isActive}
      className={
        "max-w-11 gap-0 [&>span:first-child]:sr-only" +
        (busy && link.isActive
          ? " [&_input:disabled~span]:opacity-100"
          : "")
      }
      onChange={(event) => onAutomatic(link, event.target.checked)}
    />
  );
}

export function InventoryConsumptionList({
  rows,
  disabled,
  busy,
  onAutomatic,
  onStatus,
  onEdit,
}: Props) {
  const edit = (link: ConsumptionLink) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onEdit(link)}
      className={
        buttonClass +
        " whitespace-nowrap border-transparent bg-transparent text-heading enabled:hover:border-outline enabled:hover:bg-secondary"
      }
    >
      Editar consumo
    </button>
  );

  return (
    <div className="min-w-0" aria-busy={busy}>
      {/* Tabla de escritorio */}
      <div className="hidden min-w-0 overflow-x-auto rounded-[14px] border border-outline bg-surface lg:block">
        <table className="w-full min-w-[1100px] table-fixed border-collapse text-left text-[13px] leading-5">
          <colgroup>
            <col style={{ width: "20%" }} />
            <col style={{ width: "19%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "13%" }} />
          </colgroup>{" "}
          <thead className="bg-secondary/50 text-muted">
            <tr>
              {[
                "Producto",
                "Artículo",
                "Cantidad por venta",
                "Unidad",
                "Descuento automático",
                "Estado",
                "Acción",
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-3 py-4 font-normal"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline [&_td]:break-words">
            {rows.map((link, index) => (
              <tr
                key={link.id}
                className={
                  index % 2 === 0 ? "bg-surface" : "bg-secondary/40"
                }
              >
                <td className="px-3 py-3">{link.productName}</td>

                <td className="px-3 py-3">
                  {link.inventoryItemName}
                </td>

                <td className="px-3 py-3 tabular-nums">
                  {link.quantityPerProduct}
                </td>

                <td className="px-3 py-3">
                  {unitLabels[link.baseUnit]}
                </td>

                <td className="px-3 py-3">
                  <AutomaticSwitch
                    link={link}
                    disabled={disabled}
                    busy={busy}
                    onAutomatic={onAutomatic}
                  />
                </td>

                <td className="px-3 py-3">
                  <StatusButton
                    link={link}
                    disabled={disabled}
                    onStatus={onStatus}
                  />
                </td>

                <td className="px-3 py-3">{edit(link)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tarjetas para móvil y tablet */}
      <div className="grid min-w-0 gap-3 lg:hidden">
        {rows.map((link, index) => (
          <article
            key={link.id}
            aria-label={
              "Consumo de " +
              link.productName +
              ": " +
              link.inventoryItemName
            }
            className={
              "min-w-0 rounded-[14px] border border-outline p-4 shadow-sm " +
              (index % 2 === 0 ? "bg-surface" : "bg-secondary/70")
            }
          >
            <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 [&_dt]:mb-1 [&_dt]:text-[12px] [&_dt]:leading-4 [&_dt]:text-muted [&_dd]:break-words [&_dd]:text-[13px] [&_dd]:leading-5 [&_dd]:text-heading">
              <div className="col-span-2 min-w-0">
                <dt>Producto</dt>
                <dd className="font-semibold">{link.productName}</dd>
              </div>

              <div className="min-w-0">
                <dt>Artículo</dt>
                <dd>{link.inventoryItemName}</dd>
              </div>

              <div className="min-w-0">
                <dt>Cantidad por venta</dt>
                <dd className="tabular-nums">
                  {link.quantityPerProduct}
                </dd>
              </div>

              <div className="min-w-0">
                <dt>Unidad</dt>
                <dd>{unitLabels[link.baseUnit]}</dd>
              </div>

              <div className="min-w-0">
                <dt>Descuento automático</dt>
                <dd>
                  <dd>
                    <AutomaticSwitch
                      link={link}
                      disabled={disabled}
                      busy={busy}
                      onAutomatic={onAutomatic}
                    />
                  </dd>
                </dd>
              </div>

              <div className="min-w-0 border-t border-outline pt-3">
                <dt>Estado</dt>
                <dd>
                  <StatusButton
                    link={link}
                    disabled={disabled}
                    onStatus={onStatus}
                  />
                </dd>
              </div>

              <div className="min-w-0 border-t border-outline pt-3">
                <dt>Acción</dt>
                <dd>{edit(link)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
