import { money } from "../../../lib/money";
import { buildWhatsAppUrl } from "../../../lib/whatsapp";
import type { PublicBusiness } from "../schemas/public-menu.schema";
import type { PublicTracking } from "../schemas/public-menu.schema";
import { publicWhatsAppStateSchema } from "../schemas/public-menu.schema";
import { getPublicMenu } from "../services/public-menu.service";
import { getPublicTracking } from "../services/public-menu.service";
import { themeFor } from "../utils/public-menu-theme";
import { statusOf } from "../utils/public-order-status";
import { buildWhatsAppOrderMessage } from "../utils/public-order-whatsapp";
import { MenuImage } from "./MenuImage";
import { Check } from "lucide-react";
import { Copy } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { useLocation } from "react-router";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";

export function TrackingContent({
  slug,
  code,
}: {
  slug: string;
  code: string;
}) {
  const route = useLocation();
  const navigate = useNavigate();

  const parsed = publicWhatsAppStateSchema.safeParse(route.state);

  const checkout =
    parsed.success &&
    parsed.data.publicCode === code &&
    parsed.data.business.slug === slug
      ? parsed.data
      : undefined;

  const automaticOpen = useRef(false);
  const summaryDetails = useRef<HTMLDetailsElement>(null);

  const [business, setBusiness] = useState<
    PublicBusiness | undefined
  >(() => checkout?.business);
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

  const whatsappMessage = tracking
    ? buildWhatsAppOrderMessage(tracking, checkout?.customer)
    : "";

  const whatsappUrl = whatsappMessage
    ? buildWhatsAppUrl(business?.phone, whatsappMessage)
    : null;

  useEffect(() => {
    if (
      !checkout?.openWhatsApp ||
      !tracking ||
      automaticOpen.current
    ) {
      return;
    }

    automaticOpen.current = true;

    // Evita repetir la apertura al recargar o consultar el estado.
    void navigate(route.pathname + route.search, {
      replace: true,
      state: {
        ...checkout,
        openWhatsApp: false,
      },
    });

    if (!whatsappUrl) return;

    try {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } catch {
      // El botón manual permanece disponible si falla la apertura.
    }
  }, [
    checkout,
    tracking,
    whatsappUrl,
    navigate,
    route.pathname,
    route.search,
  ]);

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
            <h1>Solicitud enviada</h1>
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
              <h2>Enviar por WhatsApp</h2>

              <p className="pm-muted">
                Recibimos tu solicitud. Envíala también por WhatsApp
                para que el negocio pueda confirmar disponibilidad,
                domicilio y forma de pago.
              </p>

              {whatsappUrl ? (
                <a
                  className="pm-primary pm-inline"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Enviar solicitud por WhatsApp"
                >
                  <MessageCircle size={18} aria-hidden="true" />
                  Enviar pedido por WhatsApp
                </a>
              ) : (
                <p className="pm-notice" role="status">
                  {business
                    ? "El negocio no tiene un número de WhatsApp configurado."
                    : "No pudimos obtener el teléfono del negocio. Puedes copiar el resumen y consultar el estado."}
                </p>
              )}

              <button
                type="button"
                className="pm-secondary pm-inline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      whatsappMessage
                    );

                    setToast("Resumen copiado");
                  } catch {
                    if (summaryDetails.current) {
                      summaryDetails.current.open = true;
                    }

                    setToast(
                      "Selecciona el resumen para copiarlo manualmente."
                    );
                  }
                }}
              >
                <Copy size={16} aria-hidden="true" />
                Copiar resumen
              </button>

              <details
                ref={summaryDetails}
                className="pm-whatsapp-summary"
              >
                <summary>Ver resumen del pedido</summary>

                <textarea
                  aria-label="Resumen del pedido para WhatsApp"
                  readOnly
                  value={whatsappMessage}
                  rows={12}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </details>

              {!checkout && (
                <p className="pm-muted">
                  Este enlace de seguimiento no incluye tus datos de
                  contacto en el resumen. Puedes añadirlos en
                  WhatsApp.
                </p>
              )}

              {tracking.requestStatus === "NEW" ||
              tracking.requestStatus === "CONTACTED" ? (
                <p className="pm-muted">
                  Tu pedido todavía no está confirmado. El negocio lo
                  aceptará después de verificar los datos y el pago.
                </p>
              ) : null}

              <p className="pm-muted">
                Si WhatsApp no se abrió automáticamente, usa el botón.
                Revisa el mensaje y pulsa Enviar dentro de WhatsApp.
              </p>
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
