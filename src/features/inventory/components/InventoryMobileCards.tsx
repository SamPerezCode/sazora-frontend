import type { ReactNode } from "react";

interface MobileRecord {
  id: string;
  fields: {
    label: string;
    value: ReactNode;
  }[];
}

export function InventoryMobileCards({
  label,
  rows,
}: {
  label: string;
  rows: MobileRecord[];
}) {
  if (!rows.length) return null;

  return (
    <ul
      aria-label={label}
      className="m-0 grid min-w-0 list-none gap-3 p-0 md:hidden"
    >
      {rows.map((row) => (
        <li
          key={row.id}
          className="min-w-0 rounded-2xl border border-outline bg-surface p-4 even:bg-secondary"
        >
          <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3">
            {row.fields.map((field, index) => (
              <div
                key={field.label}
                className={
                  "min-w-0 " + (index === 0 ? "col-span-2" : "")
                }
              >
                <dt className="text-xs leading-5 text-muted">
                  {field.label}
                </dt>

                <dd className="m-0 mt-1 min-w-0 whitespace-normal text-sm leading-5 text-heading [overflow-wrap:anywhere]">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
