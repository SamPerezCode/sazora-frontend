import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Check, Copy, RefreshCw } from "lucide-react";
import { z } from "zod";
import {
  getPublicMenu,
  getPublicTracking,
  money,
  slugSchema,
  themeFor,
} from "./public-menu.api";
import type {
  PublicBusiness,
  PublicTracking,
} from "./public-menu.api";
import { MenuImage } from "./PublicMenuDialogs";
import "./public-menu.css";

function statusOf(tracking: PublicTracking) {
  const delivery = tracking.serviceType === "DELIVERY";
  const labels = [
    "Solicitud recibida",
    "Solicitud aceptada",
    "En preparación",
    "Listo",
    ...(delivery ? ["En camino"] : []),
    "Entregado",
  ];

  if (tracking.requestStatus === "REJECTED") {
    return {
      labels,
      index: 0,
      text: "Solicitud rechazada",
      stopped: true,
    };
  }

  if (
    tracking.requestStatus === "CANCELLED" ||
    tracking.orderStatus === "CANCELLED" ||
    tracking.fulfillmentStatus === "CANCELLED"
  ) {
    return {
      labels,
      index: 0,
      text: "Pedido cancelado",
      stopped: true,
    };
  }

  let index = 0;
  let text = "Solicitud recibida";

  if (tracking.requestStatus === "CONTACTED") {
    text = "Contacto del negocio";
  }

  if (tracking.requestStatus === "ACCEPTED") {
    index = 1;
    text = "Solicitud aceptada";
  }

  if (tracking.orderStatus === "CONFIRMED") {
    index = 1;
    text = "Pedido confirmado";
  }

  if (tracking.preparationStatus === "IN_PREPARATION") {
    index = 2;
    text = "En preparación";
  }

  if (
    tracking.preparationStatus === "READY" ||
    tracking.preparationStatus === "DELIVERED"
  ) {
    index = 3;
    text = "Listo";
  }

  if (
    delivery &&
    (tracking.fulfillmentStatus === "PICKED_UP" ||
      tracking.fulfillmentStatus === "OUT_FOR_DELIVERY")
  ) {
    index = 4;
    text =
      tracking.fulfillmentStatus === "PICKED_UP"
        ? "Recogido por el domiciliario"
        : "En camino";
  }

  if (
    tracking.fulfillmentStatus === "DELIVERED" ||
    tracking.orderStatus === "DELIVERED"
  ) {
    index = labels.length - 1;
    text = "Entregado";
  }

  if (tracking.orderStatus === "CLOSED") {
    text = "Pedido cerrado";
  }

  return { labels, index, text, stopped: false };
}

export function PublicOrderTrackingPage() {
  const { businessSlug = "", publicCode = "" } = useParams();

  if (
    !slugSchema.safeParse(businessSlug).success ||
    !z.string().uuid().safeParse(publicCode).success
  ) {
    return (
      <main className="pm-root pm-loading">
        El enlace de seguimiento no es válido.
      </main>
    );
  }

  return (
    <TrackingContent
      key={businessSlug + ":" + publicCode}
      slug={businessSlug}
      code={publicCode}
    />
  );
}

function TrackingContent({
  slug,
  code,
}: {
  slug: string;
  code: string;
}) {
  const [business, setBusiness] = useState<PublicBusiness>();
  const [tracking, setTracking] = useState<PublicTracking>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [checkedAt, setCheckedAt] = useState<Date>();
  const [toast, setToast] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    void getPublicMenu(slug, controller.signal)
      .then((menu) => {
        if (!controller.signal.aborted) setBusiness(menu.business);
      })
      .catch(() => {
        // El seguimiento sigue funcionando aunque el menú esté deshabilitado.
      });

    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;

    async function refresh() {
      if (running || document.hidden || controller.signal.aborted)
        return;

      running = true;

      try {
        const data = await getPublicTracking(
          slug,
          code,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setTracking(data);
          setCheckedAt(new Date());
          setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos consultar el estado."
          );
        }
      } finally {
        running = false;
      }
    }

    void refresh();

    const timer = window.setInterval(() => void refresh(), 15_000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, code, attempt]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const status = tracking ? statusOf(tracking) : undefined;
  const name =
    business?.name ?? tracking?.businessName ?? "Tu solicitud";
  const menuPath = "/menu/" + encodeURIComponent(slug);

  function formatDate(value: string | Date) {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: business?.timezone ?? "UTC",
    }).format(new Date(value));
  }

  return (
    <div className="pm-root" style={themeFor(business)}>
      <header className="pm-header pm-tracking-header">
        <div className="pm-tracking-width pm-brand">
          {business?.logoUrl && (
            <MenuImage
              src={business.logoUrl}
              alt=""
              className="pm-logo"
            />
          )}
          <div>
            <p>{name}</p>
            <h1>Tu solicitud</h1>
          </div>
        </div>
      </header>

      <main className="pm-tracking-width pm-tracking-main pm-stack">
        {error && (
          <div className="pm-panel pm-stack" role="alert">
            <p>{error}</p>
            {tracking && (
              <p className="pm-muted">
                Se muestra el último estado consultado.
              </p>
            )}
            <button
              className="pm-secondary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Reintentar consulta
            </button>
          </div>
        )}

        {!tracking && !error && (
          <p role="status">Consultando tu solicitud…</p>
        )}

        {tracking && status && (
          <>
            <section className="pm-panel pm-stack">
              <h2>{status.text}</h2>

              {tracking.requestStatus === "NEW" && (
                <p className="pm-muted">
                  El negocio revisará tu solicitud antes de
                  convertirla en un pedido.
                </p>
              )}

              <dl className="pm-review pm-review-grid">
                <div>
                  <dt>Punto de venta</dt>
                  <dd>{tracking.locationName}</dd>
                </div>

                <div>
                  <dt>Tipo de servicio</dt>
                  <dd>
                    {tracking.serviceType === "DELIVERY"
                      ? "Domicilio"
                      : "Recoger en el punto de venta"}
                  </dd>
                </div>

                <div>
                  <dt>Subtotal</dt>
                  <dd>
                    {money(tracking.subtotal, business?.currencyCode)}
                  </dd>
                </div>

                <div>
                  <dt>Fecha{!business ? " (UTC)" : ""}</dt>
                  <dd>{formatDate(tracking.createdAt)}</dd>
                </div>
              </dl>
            </section>

            <section className="pm-panel pm-stack">
              <div className="pm-between">
                <h2>Estado de la solicitud</h2>
                <button
                  type="button"
                  className="pm-secondary pm-inline"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  <RefreshCw size={16} />
                  Consultar estado
                </button>
              </div>

              {status.stopped ? (
                <p className="pm-notice" role="status">
                  {status.text}
                  {tracking.rejectionReason &&
                    ": " + tracking.rejectionReason}
                </p>
              ) : (
                <ol className="pm-timeline">
                  {status.labels.map((label, index) => (
                    <li
                      key={label}
                      data-done={index <= status.index}
                      aria-current={
                        index === status.index ? "step" : undefined
                      }
                    >
                      <span>
                        {index <= status.index ? (
                          <Check size={16} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      {label}
                    </li>
                  ))}
                </ol>
              )}

              {checkedAt && (
                <small className="pm-muted">
                  Última consulta: {formatDate(checkedAt)}
                  {!business && " UTC"} · Se actualiza cada 15
                  segundos.
                </small>
              )}
            </section>

            <section className="pm-panel pm-stack">
              <dl className="pm-review pm-review-grid">
                <div>
                  <dt>Negocio</dt>
                  <dd>{tracking.businessName}</dd>
                </div>
                <div>
                  <dt>Punto de venta</dt>
                  <dd>{tracking.locationName}</dd>
                </div>
              </dl>

              <div>
                <p className="pm-field-label">
                  Código de seguimiento
                </p>
                <div className="pm-between">
                  <code className="pm-public-code">
                    {tracking.publicCode}
                  </code>
                  <button
                    type="button"
                    className="pm-icon-button"
                    aria-label="Copiar código de seguimiento"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          tracking.publicCode
                        );
                        setToast("Código copiado");
                      } catch {
                        setToast(
                          "Selecciona el código para copiarlo manualmente."
                        );
                      }
                    }}
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>

              <ul className="pm-summary-list">
                {tracking.items.map((item, index) => (
                  <li key={index}>
                    <div>
                      {item.quantity} × {item.productName}
                      {item.notes && (
                        <small className="pm-muted">
                          {item.notes}
                        </small>
                      )}
                    </div>
                    <strong>
                      {money(item.lineTotal, business?.currencyCode)}
                    </strong>
                  </li>
                ))}
              </ul>

              <p className="pm-between">
                <strong>Subtotal</strong>
                <strong>
                  {money(tracking.subtotal, business?.currencyCode)}
                </strong>
              </p>
            </section>
          </>
        )}

        <Link className="pm-primary" to={menuPath}>
          Volver al menú
        </Link>
      </main>

      {toast && (
        <div className="pm-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
