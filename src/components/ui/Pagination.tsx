import { ChevronLeft, ChevronRight } from "lucide-react";
import { SelectField } from "../forms/SelectField";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  itemLabel?: string;
  totalLabel?: string;
  pageSizeOptions?: readonly number[];
  disabled?: boolean;
  controlsId?: string;
  summaryId?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  itemLabel = "elementos",
  totalLabel,
  pageSizeOptions = [10, 20, 50],
  disabled = false,
  controlsId,
  summaryId,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));

  const current = Math.max(1, Math.min(page, pageCount));

  const first = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;

  const last = Math.min(current * pageSize, totalItems);

  const windowSize = Math.min(5, pageCount);

  const windowStart = Math.max(
    1,
    Math.min(current - 2, pageCount - windowSize + 1)
  );

  const pages = Array.from(
    { length: windowSize },
    (_, index) => windowStart + index
  );

  return (
    <div className="pagination">
      <div className="pagination-layout">
        <div
          id={summaryId}
          className="pagination-summary"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <p>
            Mostrando{" "}
            <strong>{first === 0 ? "0" : `${first}–${last}`}</strong>
            {" de "}
            <strong>{totalItems}</strong> {itemLabel}
          </p>

          {totalLabel && (
            <p className="pagination-total">{totalLabel}</p>
          )}
        </div>

        <div className="pagination-controls-row">
          <nav className="pagination-nav" aria-label="Paginación">
            <button
              type="button"
              className="pagination-arrow"
              aria-label="Página anterior"
              title="Página anterior"
              aria-controls={controlsId}
              disabled={disabled || current === 1}
              onClick={() => onPageChange(current - 1)}
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </button>

            <span
              className="pagination-compact"
              aria-label={`Página ${current} de ${pageCount}`}
            >
              <strong>{current}</strong>

              <span
                aria-hidden="true"
                className="pagination-divider"
              />

              <span>{pageCount}</span>
            </span>

            <div className="pagination-pages">
              {pages.map((number) => (
                <button
                  key={number}
                  type="button"
                  className="pagination-page"
                  aria-label={`Ir a la página ${number}`}
                  aria-current={
                    number === current ? "page" : undefined
                  }
                  aria-controls={controlsId}
                  disabled={disabled}
                  onClick={() => onPageChange(number)}
                >
                  {number}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="pagination-arrow"
              aria-label="Página siguiente"
              title="Página siguiente"
              aria-controls={controlsId}
              disabled={disabled || current === pageCount}
              onClick={() => onPageChange(current + 1)}
            >
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </nav>

          <div className="pagination-size">
            <span
              className="pagination-size-label"
              aria-hidden="true"
            >
              Por página
            </span>

            <SelectField
              label="Elementos por página"
              hideLabel
              value={String(pageSize)}
              disabled={disabled}
              options={pageSizeOptions.map((size) => ({
                value: String(size),
                label: String(size),
              }))}
              onValueChange={(value) => {
                onPageSizeChange(Number(value));
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
