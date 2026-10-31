import { useState } from "react";
import {
  Eye,
  Pencil,
  CalendarCheck,
  Play,
  Trash2,
  CircleCheck,
  ChartNoAxesCombined,
  History,
} from "lucide-react";

import { useAppShell } from "../../../../../../app/layout/shell-context";
import { ActionMenu } from "../../../../../../components/ui/ActionMenu";
import { dayKey } from "../../../../utils/inventory-format";
import { quantity } from "../../../../utils/inventory-value";

import { useOrderPage } from "../../hooks/useOrderPage";
import { allowedActions } from "../../utils/production.access";
import { cash, actionLabels } from "../../utils/production.utils";

import type { Action, Order } from "../../types/production.types";

import { ProductionListState } from "../shared/ProductionListState";
import { ProductionOrderRecords } from "./ProductionOrderRecords";
import { ProductionOrderDialog } from "./ProductionOrderDialog";

const icons = {
  detail: Eye,
  edit: Pencil,
  plan: CalendarCheck,
  start: Play,
  cancel: Trash2,
  complete: CircleCheck,
  waste: Trash2,
  performance: ChartNoAxesCombined,
  movement: History,
};

export function ProductionOrderResults({
  ids,
  currency,
  zone,
  revision,
  onChanged,
  onSaved,
  pending = false,
  error,
  onRetry,
}: {
  ids: string[];
  pending?: boolean;
  error?: string | null;
  onRetry?: () => void;
  currency: string;
  zone: string;
  revision: number;
  onChanged: () => void;
  onSaved?: (order: Order) => void;
}) {
  const { session } = useAppShell();

  const query = useOrderPage(JSON.stringify(ids), revision);

  const [selection, setSelection] = useState<{
    id: string;
    action: Action;
  } | null>(null);

  const rows = (query.data ?? []).map(({ order, value }) => ({
    id: order.id,
    number: "OP-" + order.id,
    recipeName: order.recipe.name,
    recipeCode: order.recipe.code,
    plantName: order.location.name,
    plantCode: order.location.code,
    status: order.status,

    plannedDate: order.plannedFor
      ? dayKey(order.plannedFor, zone)
      : "Sin fecha",

    responsible:
      order.completedByName ??
      order.startedByName ??
      order.createdByName,

    products: order.outputs
      .map(
        (line) =>
          line.inventoryItemName +
          " · " +
          quantity(line.plannedQuantity, line.baseUnit)
      )
      .join("; "),

    producedValue:
      order.status === "COMPLETED"
        ? cash(value, currency)
        : "No aplicado",

    actions: (
      <ActionMenu
        appearance="compact"
        label={"Acciones de OP-" + order.id}
        actions={allowedActions(session, order).map((action) => {
          const Icon = icons[action];

          return {
            id: action,
            label: actionLabels[action],
            icon: <Icon size={18} aria-hidden />,
            danger: action === "cancel",
            separatorBefore: action === "cancel",
            onSelect: () =>
              setSelection({
                id: order.id,
                action,
              }),
          };
        })}
      />
    ),
  }));

  return (
    <>
      {pending ? (
        <ProductionListState state="loading" />
      ) : error ? (
        <ProductionListState
          state="error"
          message={error}
          onRetry={onRetry}
        />
      ) : query.pending ? (
        <ProductionListState state="loading" />
      ) : query.error ? (
        <ProductionListState
          state="error"
          message={query.error}
          onRetry={query.refresh}
        />
      ) : !rows.length ? (
        <ProductionListState state="empty" />
      ) : (
        <ProductionOrderRecords
          rows={rows}
          onOpen={(id) =>
            setSelection({
              id,
              action: "detail",
            })
          }
        />
      )}

      {selection && (
        <ProductionOrderDialog
          key={selection.id + ":" + selection.action}
          {...selection}
          currency={currency}
          zone={zone}
          onClose={() => setSelection(null)}
          onSaved={(order) => {
            setSelection(null);
            query.refresh();
            onSaved?.(order);
            onChanged();
          }}
          onStale={() => {
            query.refresh();
            onChanged();
          }}
        />
      )}
    </>
  );
}
