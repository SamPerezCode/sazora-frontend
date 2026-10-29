import { useState } from "react";
import { Info, Plus } from "lucide-react";

import { Pagination } from "../../../../../../components/ui/Pagination";
import { Button } from "../../../InventoryButton";

import { useQuickProductions } from "../../hooks/useQuickProductions";
import { ProductionCreateDialog } from "../forms/ProductionCreateDialog";
import { ProductionListState } from "../shared/ProductionListState";

import { QuickProductionList } from "./QuickProductionList";
import { QuickProductionDetail } from "./QuickProductionDetail";

export function QuickProductions({
  locationId,
  currency,
  zone,
  revision,
  onChanged,
}: {
  locationId: string;
  currency: string;
  zone: string;
  revision: number;
  onChanged: () => void;
}) {
  const model = useQuickProductions(locationId, revision);

  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const loading =
    model.query.pending ||
    (!model.query.error && model.total > 0 && model.details.pending);

  const error =
    model.query.error ||
    (model.total > 0 ? model.details.error : null);

  return (
    <div className="grid min-w-0 gap-5">
      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          Producciones rápidas
        </h3>

        <Button
          size="compact"
          onClick={() => {
            setNotice("");
            setCreating(true);
          }}
        >
          <Plus size={16} aria-hidden />
          Registrar producción rápida
        </Button>
      </div>

      {!loading && (
        <div className="flex items-start gap-2 rounded-xl border border-outline bg-secondary/30 p-3 text-xs leading-5 text-muted">
          <Info size={16} aria-hidden className="mt-0.5 shrink-0" />

          <p>
            Transformaciones aplicadas sin receta y sin orden. No
            tienen estados de planificación.
          </p>
        </div>
      )}

      {loading ? (
        <ProductionListState state="loading" />
      ) : error ? (
        <ProductionListState
          state="error"
          message={
            "No fue posible cargar la producción. Intenta de nuevo.\n" +
            error
          }
          onRetry={
            model.query.error
              ? model.query.refresh
              : model.details.refresh
          }
        />
      ) : !model.total ? (
        <ProductionListState state="empty" />
      ) : (
        <>
          <QuickProductionList
            rows={model.visible}
            details={model.details.data ?? []}
            pending={false}
            currency={currency}
            zone={zone}
            onOpen={setSelected}
          />

          <Pagination
            page={model.current}
            pageSize={model.pageSize}
            totalItems={model.total}
            itemLabel="producciones"
            onPageChange={model.setPage}
            onPageSizeChange={model.changePageSize}
          />
        </>
      )}

      {creating && (
        <ProductionCreateDialog
          kind="quick"
          initialLocationId={locationId}
          currency={currency}
          zone={zone}
          onClose={() => setCreating(false)}
          onRefresh={onChanged}
          onOrderSaved={onChanged}
          onQuickSaved={() => {
            setCreating(false);
            model.setPage(1);
            setNotice("Operación registrada correctamente.");
            onChanged();
          }}
        />
      )}

      {selected && (
        <QuickProductionDetail
          key={selected}
          productionId={selected}
          locationId={locationId}
          currency={currency}
          zone={zone}
          revision={revision}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
