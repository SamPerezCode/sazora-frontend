import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { ApiError } from "../../../lib/http/client";
import { cents } from "../../../lib/money";
import { money } from "../../../lib/money";
import type { CartLine } from "../schemas/public-menu.schema";
import type { CartRow } from "../schemas/public-menu.schema";
import type { CheckoutDraft } from "../schemas/public-menu.schema";
import type { PublicMenu } from "../schemas/public-menu.schema";
import type { PublicProduct } from "../schemas/public-menu.schema";
import { sendPublicOrder } from "../services/public-menu.service";
import { themeFor } from "../utils/public-menu-theme";
import { getInstagramHandle } from "../utils/public-menu.utils";
import { normalize } from "../utils/public-menu.utils";
import { CartDialog } from "./CartDialog";
import { CheckoutDialog } from "./CheckoutDialog";
import { MenuImage } from "./MenuImage";
import { ProductDialog } from "./ProductDialog";
import { Check } from "lucide-react";
import { Clock } from "lucide-react";
import { MapPin } from "lucide-react";
import { Pencil } from "lucide-react";
import { Phone } from "lucide-react";
import { Plus } from "lucide-react";
import { Search } from "lucide-react";
import { ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";

export type Dialog =
  | { kind: "cart" }
  | { kind: "checkout" }
  | { kind: "product"; product: PublicProduct }
  | null;

export function MenuContent({
  menu,
  refreshing,
  loadError,
  onRefresh,
}: {
  menu: PublicMenu;
  refreshing: boolean;
  loadError: string;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const business = menu.business;
  const theme = themeFor(business);

  const instagramHandle = getInstagramHandle(business.instagram);

  const instagramUrl = instagramHandle
    ? `https://www.instagram.com/${encodeURIComponent(instagramHandle)}`
    : null;

  const [locationId, setLocationId] = useState(
    menu.locations.length === 1 ? menu.locations[0].id : ""
  );
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    menu.categories[0]?.id ?? ""
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [draft, setDraft] = useState<CheckoutDraft>({
    serviceType: "TAKEAWAY",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deliveryAddress: "",
    deliveryInstructions: "",
    notes: "",
  });

  const alive = useRef(false);
  const submission = useRef<AbortController | null>(null);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
      submission.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(
      "[data-public-category]"
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) =>
              first.boundingClientRect.top -
              second.boundingClientRect.top
          )[0];

        if (visible) {
          const id = (visible.target as HTMLElement).dataset
            .publicCategory;
          if (id) setActiveCategory(id);
        }
      },
      { rootMargin: "-90px 0px -55% 0px" }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [menu, query]);

  const location = menu.locations.find(
    (item) => item.id === locationId
  );
  const products = menu.categories.flatMap(
    (category) => category.products
  );
  const productMap = new Map(
    products.map((product) => [product.id, product])
  );

  function available(product: PublicProduct) {
    return (
      business.publicOrderingEnabled &&
      !!location &&
      product.isOrderable &&
      product.availableLocationIds.includes(location.id)
    );
  }

  const rows: CartRow[] = cart.map((line) => {
    const current = productMap.get(line.product.id);

    return {
      ...line,
      product: current ?? line.product,
      available: !!current && available(current),
    };
  });

  const count = rows.reduce((sum, row) => sum + row.quantity, 0);
  const total = rows.reduce(
    (sum, row) =>
      sum + cents(row.product.currentPrice) * BigInt(row.quantity),
    0n
  );

  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const categories = menu.categories
    .map((category) => ({
      ...category,
      products: category.products.filter((product) => {
        const text = normalize(
          [
            category.name,
            product.name,
            product.description ?? "",
          ].join(" ")
        );
        return terms.every((term) => text.includes(term));
      }),
    }))
    .filter((category) => category.products.length > 0);

  const contactAddress = location
    ? location.address
    : business.address;
  const contactPhone = location ? location.phone : business.phone;

  function openProduct(product: PublicProduct) {
    setToast("");
    setDialog({ kind: "product", product });
  }

  function chooseLocation(id: string) {
    setLocationId(id);

    if (cart.length) {
      setToast(
        "Punto actualizado. Revisa la disponibilidad de tu pedido."
      );
    }
  }

  function focusLocation() {
    setDialog(null);

    window.requestAnimationFrame(() => {
      const trigger = document.getElementById("pm-location");
      trigger?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
      trigger?.focus({ preventScroll: true });
    });
  }

  async function submit(customer: CheckoutDraft) {
    if (submission.current || uncertain) return;

    if (
      !location ||
      !rows.length ||
      rows.some((row) => !row.available)
    ) {
      setSubmitError(
        "Revisa el punto de venta y los productos disponibles antes de enviar."
      );
      return;
    }

    const controller = new AbortController();
    submission.current = controller;
    setBusy(true);
    setSubmitError("");

    try {
      const result = await sendPublicOrder(
        business.slug,
        location.id,
        customer,
        rows,
        controller.signal
      );

      if (!alive.current) return;

      setCart([]);

      navigate(
        "/menu/" +
          encodeURIComponent(business.slug) +
          "/pedido/" +
          encodeURIComponent(result.publicCode),
        {
          state: {
            business,
            customer,
            publicCode: result.publicCode,
            openWhatsApp: true,
          },
        }
      );
    } catch (cause) {
      if (!alive.current || controller.signal.aborted) return;

      if (
        cause instanceof ApiError &&
        (cause.status === 0 || cause.status >= 500)
      ) {
        setUncertain(true);
        setSubmitError(
          "No pudimos confirmar si la solicitud fue recibida. " +
            "Contacta al negocio antes de volver a enviarla para evitar duplicarla."
        );
      } else {
        const details =
          cause instanceof ApiError
            ? cause.errors.map((item) => item.message).join(" ")
            : "";

        setSubmitError(
          (cause instanceof Error
            ? cause.message
            : "No pudimos enviar la solicitud.") +
            (details ? " " + details : "")
        );

        if (cause instanceof ApiError && cause.status === 409) {
          onRefresh();
        }
      }
    } finally {
      if (submission.current === controller) {
        submission.current = null;
        if (alive.current) setBusy(false);
      }
    }
  }

  const selectedProduct =
    dialog?.kind === "product"
      ? (productMap.get(dialog.product.id) ?? dialog.product)
      : null;

  return (
    <div
      className="pm-root"
      style={theme}
      data-has-cart={count > 0 && business.publicOrderingEnabled}
    >
      <header className="pm-header">
        <div className="pm-wide">
          <div className="pm-between pm-align-start">
            <div className="pm-brand">
              <MenuImage
                src={business.logoUrl}
                alt={business.name}
                className="pm-logo"
              />
              <div>
                <h1>{business.name}</h1>
                {business.tagline && <p>{business.tagline}</p>}
                {location && <small>{location.name}</small>}
              </div>
            </div>

            {business.publicOrderingEnabled && (
              <button
                type="button"
                className="pm-header-order"
                onClick={() => setDialog({ kind: "cart" })}
              >
                <ShoppingBag size={18} aria-hidden="true" />
                Mi pedido{count > 0 ? " · " + count : ""}
              </button>
            )}
          </div>

          <p className="pm-description">
            {business.publicMenuDescription ||
              (business.publicOrderingEnabled
                ? "Pide para recoger o a domicilio. El negocio confirma tu solicitud antes de prepararla."
                : "Consulta los productos de nuestro menú.")}
          </p>

          <div className="pm-contact">
            {contactAddress && (
              <span>
                <MapPin size={16} />
                {contactAddress}
              </span>
            )}
            {business.openingHoursText && (
              <span>
                <Clock size={16} />
                {business.openingHoursText}
              </span>
            )}
            {instagramHandle && instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir Instagram de @${instagramHandle}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                  className="shrink-0"
                >
                  <rect x={3} y={3} width={18} height={18} rx={5} />
                  <circle cx={12} cy={12} r={4} />
                  <circle
                    cx={17.5}
                    cy={6.5}
                    r={1}
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
                <span>@{instagramHandle}</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {categories.length > 0 && (
        <nav
          className="pm-categories"
          aria-label="Categorías del menú"
        >
          {categories.map((category) => (
            <a
              key={category.id}
              href={"#pm-category-" + category.id}
              aria-current={
                activeCategory === category.id ? "true" : undefined
              }
              onClick={() => setActiveCategory(category.id)}
            >
              {category.name}
            </a>
          ))}
        </nav>
      )}

      <main className="pm-main">
        {loadError && (
          <div className="pm-notice pm-between" role="alert">
            <p>{loadError}</p>
            <button
              className="pm-secondary"
              disabled={refreshing}
              onClick={onRefresh}
            >
              Reintentar
            </button>
          </div>
        )}

        {menu.locations.length > 0 && (
          <section className="pm-location-panel">
            <h2>
              {business.publicOrderingEnabled
                ? "¿En qué punto quieres hacer tu pedido?"
                : "Selecciona un punto de venta"}
            </h2>

            <div className="pm-location-grid">
              <SelectField
                id="pm-location"
                label="Punto de venta"
                hideLabel
                placeholder="Selecciona un punto de venta"
                value={location?.id ?? ""}
                options={menu.locations.map((item) => ({
                  value: item.id,
                  label:
                    item.name +
                    (item.address ? " · " + item.address : ""),
                }))}
                onValueChange={chooseLocation}
                contentClassName="pm-select-content"
                contentStyle={theme}
              />

              {location && (
                <div className="pm-location-contact">
                  {location.address && (
                    <p>
                      <MapPin size={15} />
                      {location.address}
                    </p>
                  )}
                  {location.phone && (
                    <p>
                      <Phone size={15} />
                      <a
                        href={
                          "tel:" +
                          location.phone.replace(/[^\d+]/g, "")
                        }
                      >
                        {location.phone}
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {business.publicOrderingEnabled &&
          menu.locations.length === 0 && (
            <p className="pm-notice">
              No hay puntos de venta habilitados para recibir pedidos.
            </p>
          )}

        <div className="pm-search">
          <TextField
            label="Buscar productos"
            icon={Search}
            placeholder="Buscar productos, por ejemplo: café"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {categories.length === 0 && (
          <p className="pm-empty">
            {query
              ? "No encontramos productos con esa búsqueda."
              : "Este menú todavía no tiene productos publicados."}
          </p>
        )}

        {categories.map((category) => (
          <section
            key={category.id}
            id={"pm-category-" + category.id}
            className="pm-category"
            data-public-category={category.id}
          >
            <h2>{category.name}</h2>
            {category.description && (
              <p className="pm-muted">{category.description}</p>
            )}

            <div className="pm-products">
              {category.products.map((product) => {
                const line = rows.find(
                  (item) => item.product.id === product.id
                );
                const canOrder = available(product);

                return (
                  <article
                    key={product.id}
                    className="pm-product-card"
                    data-selected={!!line}
                  >
                    <button
                      type="button"
                      className="pm-image-button"
                      aria-label={"Ver " + product.name}
                      onClick={() => openProduct(product)}
                    >
                      <MenuImage
                        src={product.imageUrl}
                        alt={product.name}
                      />
                    </button>

                    <div className="pm-product-main">
                      <button
                        type="button"
                        className="pm-product-title"
                        onClick={() => openProduct(product)}
                      >
                        {product.name}
                      </button>

                      {product.description && (
                        <p className="pm-product-description">
                          {product.description}
                        </p>
                      )}

                      <div className="pm-product-end">
                        <div>
                          <strong className="pm-price">
                            {money(
                              product.currentPrice,
                              business.currencyCode
                            )}
                          </strong>

                          {line && (
                            <small>
                              En tu pedido · {line.quantity}
                            </small>
                          )}

                          {business.publicOrderingEnabled &&
                            !canOrder && (
                              <small>
                                {!location
                                  ? "Selecciona un punto de venta"
                                  : "No disponible en este punto"}
                              </small>
                            )}
                        </div>

                        {business.publicOrderingEnabled && (
                          <button
                            type="button"
                            className="pm-primary pm-add"
                            disabled={!canOrder}
                            onClick={() => openProduct(product)}
                          >
                            {line ? (
                              <Pencil size={16} />
                            ) : (
                              <Plus size={16} />
                            )}
                            {line ? "Editar" : "Agregar"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <footer className="pm-footer">
        <div className="pm-wide">
          <div className="pm-footer-grid">
            <div>
              <div className="pm-brand pm-brand--small">
                <MenuImage
                  src={business.logoUrl}
                  alt=""
                  className="pm-logo"
                />
                <strong>{business.name}</strong>
              </div>
              {business.tagline && <p>{business.tagline}</p>}
            </div>

            <div className="pm-stack">
              <h2>Contacto</h2>
              {location && <strong>{location.name}</strong>}
              {contactAddress && <p>{contactAddress}</p>}
              {contactPhone && (
                <a
                  href={"tel:" + contactPhone.replace(/[^\d+]/g, "")}
                >
                  {contactPhone}
                </a>
              )}
              {business.openingHoursText && (
                <p>{business.openingHoursText}</p>
              )}
              {business.instagram && <p>{business.instagram}</p>}
            </div>

            <div className="pm-stack">
              <h2>Puntos de venta</h2>
              {menu.locations.map((item) => (
                <div key={item.id}>
                  <strong>{item.name}</strong>
                  {item.address && <p>{item.address}</p>}
                  {item.phone && <p>{item.phone}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="pm-footer-bottom">
            <p>
              © {new Date().getFullYear()} {business.name}.
            </p>
            <p>
              Precios en {business.currencyCode}.
              {business.publicOrderingEnabled &&
                " Las solicitudes están sujetas a confirmación del negocio."}
            </p>
          </div>
        </div>
      </footer>

      {count > 0 && business.publicOrderingEnabled && (
        <div className="pm-mobile-order">
          <button
            type="button"
            className="pm-primary pm-between"
            onClick={() => setDialog({ kind: "cart" })}
          >
            <span className="pm-inline">
              <ShoppingBag size={20} />
              {count} {count === 1 ? "producto" : "productos"}
            </span>
            <span>
              Ver pedido · {money(total, business.currencyCode)}
            </span>
          </button>
        </div>
      )}

      {toast && (
        <div className="pm-toast" role="status" aria-live="polite">
          <Check size={18} aria-hidden="true" />
          <span>{toast}</span>
        </div>
      )}

      {dialog?.kind === "product" && selectedProduct && (
        <ProductDialog
          key={selectedProduct.id}
          product={selectedProduct}
          line={rows.find(
            (row) => row.product.id === selectedProduct.id
          )}
          available={
            productMap.has(selectedProduct.id) &&
            available(selectedProduct)
          }
          currency={business.currencyCode}
          onClose={() => setDialog(null)}
          onSave={(quantity, notes) => {
            const exists = cart.some(
              (line) => line.product.id === selectedProduct.id
            );

            if (!exists && cart.length >= 50) {
              setDialog(null);
              setToast(
                "El pedido admite hasta 50 productos diferentes."
              );
              return;
            }

            setCart((previous) => {
              const next = {
                product: selectedProduct,
                quantity,
                notes,
              };

              return exists
                ? previous.map((line) =>
                    line.product.id === selectedProduct.id
                      ? next
                      : line
                  )
                : [...previous, next];
            });

            setDialog(null);
            setToast(
              exists ? "Producto actualizado" : "Agregado a tu pedido"
            );
          }}
        />
      )}

      {dialog?.kind === "cart" && (
        <CartDialog
          rows={rows}
          location={location}
          currency={business.currencyCode}
          refreshing={refreshing}
          onClose={() => setDialog(null)}
          onRefresh={onRefresh}
          onQuantity={(id, quantity) =>
            setCart((previous) =>
              previous.map((line) =>
                line.product.id === id
                  ? {
                      ...line,
                      quantity: Math.max(1, Math.min(100, quantity)),
                    }
                  : line
              )
            )
          }
          onRemove={(id) =>
            setCart((previous) =>
              previous.filter((line) => line.product.id !== id)
            )
          }
          onEdit={openProduct}
          onContinue={() => {
            setSubmitError("");
            setDialog({ kind: "checkout" });
          }}
        />
      )}

      {dialog?.kind === "checkout" && location && (
        <CheckoutDialog
          draft={draft}
          rows={rows}
          location={location}
          currency={business.currencyCode}
          busy={busy}
          uncertain={uncertain}
          error={submitError}
          onDraft={setDraft}
          onClose={() => setDialog(null)}
          onChangeLocation={focusLocation}
          onSubmit={(customer) => void submit(customer)}
        />
      )}
    </div>
  );
}
