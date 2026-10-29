import type { ReactNode } from "react";

interface Props {
  label: string;
  rows: {
    id: string;
    fields: {
      label: string;
      value: ReactNode;
    }[];
  }[];
}

export function ProductionReviewRecords({ label, rows }: Props) {
  if (!rows.length) return null;

  return (
    <div className="min-w-0">
      <ul
        aria-label={label}
        className="grid list-none gap-3 p-0 md:hidden"
      >
        {rows.map((row) => (
          <li
            key={row.id}
            className="min-w-0 rounded-2xl border border-outline bg-surface p-4"
          >
            <p className="mb-3 text-sm font-semibold [overflow-wrap:anywhere]">
              {row.fields[0]?.value}
            </p>

            <dl className="grid grid-cols-2 gap-3 text-xs leading-5">
              {row.fields.slice(1).map((field) => (
                <div key={field.label} className="min-w-0">
                  <dt className="text-muted">{field.label}</dt>

                  <dd className="m-0 font-medium [overflow-wrap:anywhere]">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="hidden min-w-0 overflow-x-auto rounded-xl border border-outline focus-visible:outline-2 focus-visible:outline-accent md:block"
      >
        <table className="w-full min-w-[600px] table-fixed text-left text-xs leading-4">
          <thead className="bg-secondary/40 text-muted">
            <tr>
              {rows[0].fields.map((field) => (
                <th
                  key={field.label}
                  scope="col"
                  className="p-3 font-normal"
                >
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="h-16 border-t border-outline"
              >
                {row.fields.map((field) => (
                  <td
                    key={field.label}
                    className="p-3 [overflow-wrap:anywhere]"
                  >
                    {field.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
