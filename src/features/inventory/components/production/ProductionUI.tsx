import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Modal } from "../InventoryLocationUI";
import { statusLabels } from "./production.utils";
import type { Status, FormContext } from "./production.types";

export function StatusBadge({ status }: { status: Status }) {
  const tones: Record<Status, string> = {
    DRAFT: "bg-secondary text-muted",
    PLANNED: "bg-violet-500/10 text-violet-700 dark:text-violet-200",
    IN_PROGRESS:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    COMPLETED:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    CANCELLED: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  return (
    <span
      className={
        "inline-flex rounded-xl px-2 py-1 text-xs font-medium " +
        tones[status]
      }
    >
      {statusLabels[status]}
    </span>
  );
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div
      role="note"
      className="flex gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm leading-6 text-heading"
    >
      <CircleAlert
        size={18}
        aria-hidden
        className="mt-1 shrink-0 text-orange-600 dark:text-orange-400"
      />
      <div>{children}</div>
    </div>
  );
}

export function Metrics({
  rows,
}: {
  rows: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="min-w-0 rounded-2xl border border-outline bg-surface p-4"
        >
          <dt className="text-sm text-muted">{row.label}</dt>
          <dd className="m-0 mt-2 text-xl font-bold text-heading [overflow-wrap:anywhere]">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Frame({
  context: c,
  title,
  footer,
  children,
}: {
  context: FormContext;
  title: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <Modal
      title={title}
      wide
      busy={c.busy}
      onClose={c.onClose}
      footer={footer}
    >
      <div className="grid min-w-0 gap-5">
        <p className="text-sm text-muted">
          {c.data.order.recipe.code} · {c.data.order.recipe.name}
          {" · "}
          {c.data.order.location.name}
          {" · "}Versión {c.data.order.version}
        </p>

        {c.error && (
          <div
            role="alert"
            className="whitespace-pre-line rounded-xl border border-red-500/30 p-3 text-sm text-red-600 dark:text-red-400"
          >
            {c.error}
          </div>
        )}

        <fieldset
          disabled={c.busy || c.locked}
          className="m-0 grid min-w-0 gap-5 border-0 p-0"
        >
          {children}
        </fieldset>
      </div>
    </Modal>
  );
}
