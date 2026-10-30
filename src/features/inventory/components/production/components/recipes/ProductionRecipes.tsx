import { useCallback, useState } from "react";
import { FilterX, Plus } from "lucide-react";
import { useAppShell } from "../../../../../../app/layout/shell-context";
import { Pagination } from "../../../../../../components/ui/Pagination";
import type { AuthSession } from "../../../../../auth/types/auth.types";
import { useInventoryQuery } from "../../../../hooks/useInventoryQuery";
import { searchKey } from "../../../../utils/inventory-format";
import { Button } from "../../../InventoryButton";
import { Choice } from "../../../InventoryLocationUI";
import {
  listManagedRecipes,
  loadRecipePage,
} from "../../services/recipe.service";
import {
  isAdmin,
  plantScope,
  productionRoles,
} from "../../utils/production.access";
import type {
  Recipe,
  RecipeAction,
} from "../../schemas/recipe.schemas";
import { ProductionListState } from "../shared/ProductionListState";
import { RecipeList } from "./RecipeList";
import { RecipeForm } from "./RecipeForm";
import { RecipeActionDialog } from "./RecipeActionDialog";

export function ProductionRecipes({
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
  const { session } = useAppShell();
  const admin = isAdmin(session);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [notice, setNotice] = useState("");

  const [selection, setSelection] = useState<
    "new" | { id: string; action: RecipeAction } | null
  >(null);

  const listLoader = useCallback(
    (current: AuthSession, signal: AbortSignal) => {
      plantScope(current, locationId);
      return listManagedRecipes(current, signal);
    },
    [locationId]
  );

  const query = useInventoryQuery(
    "managed-recipes:" + locationId,
    listLoader,
    revision,
    productionRoles
  );

  const filtered = (query.data ?? []).filter(
    (row) =>
      (!status || row.isActive === (status === "active")) &&
      searchKey(row.code + " " + row.name).includes(searchKey(search))
  );

  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / size))
  );

  const visible = filtered.slice(
    (current - 1) * size,
    current * size
  );

  const detailKey = JSON.stringify(
    visible.map((row) => [row.id, row.updatedAt])
  );

  const detailLoader = useCallback(
    (currentSession: AuthSession, signal: AbortSignal) => {
      const pairs = JSON.parse(detailKey) as [string, string][];

      return loadRecipePage(
        currentSession,
        signal,
        pairs.map(([id]) => id)
      );
    },
    [detailKey]
  );

  const details = useInventoryQuery(
    "recipe-page:" + detailKey,
    detailLoader,
    revision,
    productionRoles
  );

  const loading =
    query.pending ||
    (!query.error && visible.length > 0 && details.pending);

  const error =
    query.error || (visible.length > 0 ? details.error : null);

  function close() {
    setSelection(null);
    query.refresh();
    details.refresh();
  }

  function saved(recipe: Recipe) {
    setSelection(null);
    setNotice("Receta " + recipe.code + " guardada correctamente.");
    query.refresh();
    details.refresh();
    onChanged();
  }

  return (
    <div className="grid min-w-0 gap-5">
      {notice && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            Recetas de producción
          </h3>

          <p className="mt-1 text-xs leading-5 text-muted">
            Insumos y rendimientos estándar de productos recurrentes.
          </p>
        </div>

        {admin && (
          <Button
            size="compact"
            onClick={() => {
              setNotice("");
              setSelection("new");
            }}
          >
            <Plus size={16} aria-hidden />
            Nueva receta
          </Button>
        )}
      </div>

      <div className="grid min-w-0 gap-3 border-b border-outline pb-4">
        <div className="grid min-w-0 items-end gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid min-w-0 gap-2 text-xs">
            Buscar
            <input
              type="search"
              value={search}
              placeholder="Código o nombre de receta"
              className="h-9 min-w-0 rounded-xl border border-outline bg-surface px-3 text-sm text-heading shadow-sm outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <Button
            size="compact"
            variant="ghost"
            className="justify-self-end"
            onClick={() => {
              setSearch("");
              setStatus("");
              setPage(1);
            }}
          >
            <FilterX size={16} aria-hidden />
            Limpiar filtros
          </Button>
        </div>

        <div className="min-w-0 md:max-w-[340px]">
          <Choice
            label="Estado de receta"
            value={admin ? status : "active"}
            disabled={!admin}
            className="[&_.select-field-label]:text-xs! [&_.select-field-trigger]:h-9! [&_.select-field-trigger]:min-h-9!"
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={
              admin
                ? [
                    {
                      value: "",
                      label: "Activas e inactivas",
                    },
                    {
                      value: "active",
                      label: "Activas",
                    },
                    {
                      value: "inactive",
                      label: "Inactivas",
                    },
                  ]
                : [
                    {
                      value: "active",
                      label: "Activas",
                    },
                  ]
            }
          />
        </div>
      </div>

      {loading ? (
        <ProductionListState state="loading" />
      ) : error ? (
        <ProductionListState
          state="error"
          message={error}
          onRetry={query.error ? query.refresh : details.refresh}
        />
      ) : !filtered.length ? (
        <ProductionListState state="empty" />
      ) : (
        <>
          <RecipeList
            rows={details.data ?? []}
            zone={zone}
            canEdit={admin}
            onAction={(id, action) => {
              setNotice("");
              setSelection({ id, action });
            }}
          />

          <Pagination
            page={current}
            pageSize={size}
            totalItems={filtered.length}
            itemLabel="recetas"
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setSize(value);
              setPage(1);
            }}
          />
        </>
      )}

      {selection === "new" && admin && (
        <RecipeForm
          locationId={locationId}
          currency={currency}
          onClose={close}
          onSaved={saved}
        />
      )}

      {selection && selection !== "new" && (
        <RecipeActionDialog
          key={selection.id + ":" + selection.action}
          {...selection}
          locationId={locationId}
          currency={currency}
          onClose={close}
          onSaved={saved}
        />
      )}
    </div>
  );
}
