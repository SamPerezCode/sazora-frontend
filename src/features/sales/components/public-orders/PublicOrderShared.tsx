import { Button } from "../../../../components/ui/Button";
import { usePresentation } from "../../hooks/usePublicOrdersPresentation";
import type { RequestDetail } from "../../schemas/public-orders.schema";
import { labels } from "../../utils/public-orders.utils";
import { Bike } from "lucide-react";
import { Copy } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { MapPin } from "lucide-react";
import { Store } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

export function Badge({ value }: { value: string }) {
  return (
    <span className="por-badge" data-status={value}>
      {labels[value] ?? value}
    </span>
  );
}

export function Service({ delivery }: { delivery: boolean }) {
  const Icon = delivery ? Bike : Store;

  return (
    <span className="por-inline">
      <Icon size={16} aria-hidden="true" />
      {delivery ? "A domicilio" : "Para recoger"}
    </span>
  );
}

export function External({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      className="por-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

export function Feedback({
  loading,
  error,
}: {
  loading: boolean;
  error?: string;
}) {
  return (
    <>
      {loading && <p role="status">Cargando…</p>}
      {error && (
        <p className="por-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function Pager({
  page,
  total,
  change,
}: {
  page: number;
  total: number;
  change: (value: number) => void;
}) {
  if (total <= 20) return null;

  return (
    <div className="por-toolbar">
      <Button
        variant="secondary"
        disabled={page === 1}
        onClick={() => change(page - 1)}
      >
        Anterior
      </Button>

      <span>
        Página {page} de {Math.ceil(total / 20)}
      </span>

      <Button
        variant="secondary"
        disabled={page * 20 >= total}
        onClick={() => change(page + 1)}
      >
        Siguiente
      </Button>
    </div>
  );
}

export function Items({ items }: { items: RequestDetail["items"] }) {
  const { price } = usePresentation();

  return (
    <div className="por-items">
      {items.map((item, index) => (
        <div key={index}>
          <div>
            <strong>
              {item.quantity} × {item.productName}
            </strong>
            <small>{price(item.unitPrice)} c/u</small>

            {item.notes && (
              <small className="por-notes">{item.notes}</small>
            )}
          </div>

          <strong>{price(item.lineTotal)}</strong>
        </div>
      ))}
    </div>
  );
}

export function Address({ value }: { value: string }) {
  const [notice, setNotice] = useState("");

  return (
    <div className="por-address">
      <strong className="por-inline">
        <MapPin size={17} />
        Información de entrega
      </strong>

      <p>{value}</p>

      <div className="por-actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (!navigator.clipboard) {
              setNotice("Selecciona y copia la dirección.");
              return;
            }

            void navigator.clipboard
              .writeText(value)
              .then(() => setNotice("Dirección copiada."))
              .catch(() =>
                setNotice(
                  "No se pudo copiar. Selecciona y copia la dirección."
                )
              );
          }}
        >
          <Copy size={15} />
          Copiar dirección
        </Button>

        <External
          href={
            "https://www.google.com/maps/search/?api=1&query=" +
            encodeURIComponent(value)
          }
        >
          <ExternalLink size={15} />
          Abrir en mapas
        </External>
      </div>

      {notice && <small role="status">{notice}</small>}
    </div>
  );
}
