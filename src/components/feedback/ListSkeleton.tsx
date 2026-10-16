import "./list-skeleton.css";

interface ListSkeletonProps {
  variant: "products" | "categories";
}

export function ListSkeleton({ variant }: ListSkeletonProps) {
  const products = variant === "products";

  return (
    <div
      className={`list-skeleton list-skeleton--${variant}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="sr-only">
        {products ? "Cargando productos…" : "Cargando categorías…"}
      </span>

      <div className="list-skeleton-layout" aria-hidden="true">
        <div className="list-skeleton-toolbar">
          <div className="list-skeleton-field">
            <div className="list-skeleton-block list-skeleton-label" />
            <div className="list-skeleton-block list-skeleton-control" />
          </div>

          {products && (
            <div className="list-skeleton-field">
              <div className="list-skeleton-block list-skeleton-label" />
              <div className="list-skeleton-block list-skeleton-control" />
            </div>
          )}

          <div className="list-skeleton-block list-skeleton-control" />
        </div>

        <div className="list-skeleton-table">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="list-skeleton-block list-skeleton-row"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
