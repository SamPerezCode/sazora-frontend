import { DataTable } from "./InventoryLocationUI";
import { InventoryMobileCards } from "./InventoryMobileCards";

type Rows = Parameters<typeof InventoryMobileCards>[0]["rows"];

export function InventoryResponsiveRecords({
  label,
  rows,
  wide = false,
}: {
  label: string;
  rows: Rows;
  wide?: boolean;
}) {
  if (!rows.length) return null;

  return (
    <>
      <InventoryMobileCards label={label} rows={rows} />

      <div
        className={
          "hidden min-w-0 md:block [&_table]:bg-surface [&_td]:align-top " +
          (wide
            ? "[&_table]:min-w-[76rem]"
            : "[&_table]:min-w-[44rem]")
        }
      >
        <DataTable
          headers={rows[0].fields.map((field) => field.label)}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              {row.fields.map((field) => (
                <td key={field.label}>{field.value}</td>
              ))}
            </tr>
          ))}
        </DataTable>
      </div>
    </>
  );
}
