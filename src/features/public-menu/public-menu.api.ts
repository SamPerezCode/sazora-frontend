import { z } from "zod";
import type { CSSProperties } from "react";
import { request } from "../../lib/http/client";

const idSchema = z.string().regex(/^[1-9]\d*$/);
const amountSchema = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
const dateSchema = z.iso.datetime({ offset: true });

export const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const requestStatusSchema = z.enum([
  "NEW",
  "CONTACTED",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
]);

const serviceSchema = z.enum(["TAKEAWAY", "DELIVERY"]);

export const businessSchema = z.object({
  name: z.string(),
  slug: slugSchema,
  timezone: z.string(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  tagline: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  openingHoursText: z.string().nullable(),
  instagram: z.string().nullable(),
  logoUrl: z.string().nullable(),
  primaryColor: z.string(),
  accentColor: z.string(),
  publicMenuDescription: z.string().nullable(),
  publicOrderingEnabled: z.boolean(),
});

const locationSchema = z.object({
  id: idSchema,
  code: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
});

const productSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  currentPrice: amountSchema,
  isOrderable: z.boolean(),
  availableLocationIds: z.array(idSchema),
});

const menuSchema = z.object({
  business: businessSchema,
  locations: z.array(locationSchema),
  categories: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      description: z.string().nullable(),
      imageUrl: z.string().nullable(),
      displayOrder: z.number().int(),
      products: z.array(productSchema),
    })
  ),
});

const menuResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ menu: menuSchema }),
});

export function publicOrderNotes(
  serviceType: "TAKEAWAY" | "DELIVERY",
  notes: string,
  deliveryInstructions?: string
): string {
  return [
    notes.trim(),
    serviceType === "DELIVERY" && deliveryInstructions?.trim()
      ? `Indicaciones de entrega: ${deliveryInstructions.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const checkoutSchema = z
  .object({
    serviceType: serviceSchema,
    customerName: z
      .string()
      .trim()
      .min(1, "Escribe tu nombre.")
      .max(150, "Máximo 150 caracteres."),
    customerPhone: z
      .string()
      .trim()
      .min(7, "Escribe un teléfono válido.")
      .max(30, "Máximo 30 caracteres.")
      .regex(/^\+?[0-9\s()-]+$/, "Escribe un teléfono válido."),
    customerEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Máximo 254 caracteres.")
      .refine(
        (value) =>
          !value || z.string().email().safeParse(value).success,
        "Escribe un correo válido."
      ),
    deliveryAddress: z
      .string()
      .trim()
      .max(300, "Máximo 300 caracteres."),
    deliveryInstructions: z
      .string()
      .trim()
      .max(300, "Máximo 300 caracteres.")
      .optional(),
    notes: z.string().trim().max(500, "Máximo 500 caracteres."),
  })
  .superRefine((value, context) => {
    if (
      publicOrderNotes(
        value.serviceType,
        value.notes,
        value.deliveryInstructions
      ).length > 500
    ) {
      context.addIssue({
        code: "custom",
        path: ["notes"],
        message:
          "Las notas y las indicaciones de entrega juntas admiten máximo 500 caracteres.",
      });
    }

    if (value.serviceType === "DELIVERY" && !value.deliveryAddress) {
      context.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Escribe la dirección del domicilio.",
      });
    }
  });

const itemsSchema = z
  .array(
    z.object({
      productId: idSchema,
      quantity: z.number().int().min(1).max(100),
      notes: z.string().trim().max(500).nullable(),
    })
  )
  .min(1)
  .max(50)
  .refine(
    (items) =>
      new Set(items.map((item) => item.productId)).size ===
      items.length,
    "No repitas productos; modifica su cantidad."
  );

const submittedResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    request: z.object({
      publicCode: z.string().uuid(),
      status: requestStatusSchema,
      serviceType: serviceSchema,
      location: z.object({
        id: idSchema,
        name: z.string(),
      }),
      subtotal: amountSchema,
      createdAt: dateSchema,
    }),
  }),
});

const trackingSchema = z.object({
  businessName: z.string(),
  locationId: idSchema,
  locationName: z.string(),
  publicCode: z.string().uuid(),
  serviceType: serviceSchema,
  requestStatus: requestStatusSchema,
  orderStatus: z
    .enum(["OPEN", "CONFIRMED", "DELIVERED", "CLOSED", "CANCELLED"])
    .nullable(),
  preparationStatus: z
    .enum(["PENDING", "IN_PREPARATION", "READY", "DELIVERED"])
    .nullable(),
  fulfillmentStatus: z
    .enum([
      "PENDING_ASSIGNMENT",
      "ASSIGNED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
    ])
    .nullable(),
  subtotal: amountSchema,
  rejectionReason: z.string().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  items: z.array(
    z.object({
      productName: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: amountSchema,
      lineTotal: amountSchema,
      notes: z.string().nullable(),
    })
  ),
});

const trackingResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ tracking: trackingSchema }),
});

export type PublicBusiness = z.infer<typeof businessSchema>;
export type PublicMenu = z.infer<typeof menuSchema>;
export type PublicLocation = z.infer<typeof locationSchema>;
export type PublicProduct = z.infer<typeof productSchema>;
export type PublicTracking = z.infer<typeof trackingSchema>;
export type CheckoutDraft = z.input<typeof checkoutSchema>;

export interface CartLine {
  product: PublicProduct;
  quantity: number;
  notes: string;
}

export interface CartRow extends CartLine {
  available: boolean;
}

function basePath(slug: string) {
  return (
    "/public/businesses/" + encodeURIComponent(slugSchema.parse(slug))
  );
}

export async function getPublicMenu(
  slug: string,
  signal: AbortSignal
): Promise<PublicMenu> {
  const response = await request(
    basePath(slug) + "/menu",
    menuResponseSchema,
    { signal, cache: "no-store" }
  );

  if (response.data.menu.business.slug !== slug) {
    throw new Error("El menú recibido no corresponde al negocio.");
  }

  return response.data.menu;
}

export async function sendPublicOrder(
  slug: string,
  locationId: string,
  draft: CheckoutDraft,
  lines: readonly CartLine[],
  signal: AbortSignal
) {
  const customer = checkoutSchema.parse(draft);

  const items = itemsSchema.parse(
    lines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
      notes: line.notes.trim() || null,
    }))
  );

  const response = await request(
    basePath(slug) + "/order-requests",
    submittedResponseSchema,
    {
      method: "POST",
      signal,
      body: {
        locationId: idSchema.parse(locationId),
        serviceType: customer.serviceType,
        customerName: customer.customerName,
        customerPhone: customer.customerPhone,
        customerEmail: customer.customerEmail || null,
        deliveryAddress:
          customer.serviceType === "DELIVERY"
            ? customer.deliveryAddress
            : null,
        notes:
          publicOrderNotes(
            customer.serviceType,
            customer.notes,
            customer.deliveryInstructions
          ) || null,
        items,
      },
    }
  );

  return response.data.request;
}

export async function getPublicTracking(
  slug: string,
  publicCode: string,
  signal: AbortSignal
): Promise<PublicTracking> {
  const code = z.string().uuid().parse(publicCode);

  const response = await request(
    basePath(slug) + "/order-requests/" + encodeURIComponent(code),
    trackingResponseSchema,
    { signal, cache: "no-store" }
  );

  if (response.data.tracking.publicCode !== code) {
    throw new Error(
      "El seguimiento recibido no corresponde al pedido."
    );
  }

  return response.data.tracking;
}

export function cents(value: string): bigint {
  const [whole, decimals = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(decimals.padEnd(2, "0"));
}

export function money(
  value: string | bigint,
  currency?: string
): string {
  const amount = typeof value === "bigint" ? value : cents(value);
  const whole = amount / 100n;
  const decimals = String(amount % 100n).padStart(2, "0");

  const formatted =
    new Intl.NumberFormat("es-CO").format(whole) +
    (decimals === "00" ? "" : "," + decimals);

  if (!currency) return formatted;

  const symbol = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
  })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value;

  return (symbol ?? currency) + " " + formatted;
}

function safeColor(value: string | undefined, fallback: string) {
  if (!value) return fallback;

  if (/^#[0-9a-f]{6}$/i.test(value)) return value;

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return (
      "#" +
      value
        .slice(1)
        .split("")
        .map((part) => part + part)
        .join("")
    );
  }

  return fallback;
}

function contrastText(hex: string) {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;

    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  const luminance =
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722;

  return luminance > 0.179 ? "#111111" : "#ffffff";
}

export function themeFor(
  business?: Pick<PublicBusiness, "primaryColor" | "accentColor">
): CSSProperties {
  const primary = safeColor(business?.primaryColor, "#263831");
  const accent = safeColor(business?.accentColor, primary);
  const foreground = contrastText(primary);

  return {
    "--pm-brand": primary,
    "--pm-accent": accent,
    "--pm-on-brand": foreground,
    "--pm-ink": "color-mix(in srgb, " + primary + " 30%, #111111)",
    "--pm-muted": "color-mix(in srgb, " + primary + " 38%, #656565)",
    "--pm-border": "color-mix(in srgb, " + primary + " 22%, #ffffff)",
    "--sazora-accent": primary,
    "--sazora-on-accent": foreground,
    "--sazora-heading": "var(--pm-ink)",
    "--sazora-muted": "var(--pm-muted)",
    "--sazora-outline": "var(--pm-border)",
    "--sazora-input-border": "var(--pm-border)",
    "--sazora-surface": "#ffffff",
    "--sazora-popover": "#ffffff",
    "--sazora-secondary": "#f4f7fb",
  } as CSSProperties;
}

export const publicWhatsAppStateSchema = z.object({
  business: businessSchema,
  customer: checkoutSchema,
  publicCode: z.string().uuid(),
  openWhatsApp: z.boolean(),
});

export function normalizeWhatsAppPhone(
  phone: string | null | undefined
): string | null {
  const value = phone?.trim();

  if (!value || !/^\+?[\d\s().-]+$/.test(value)) {
    return null;
  }

  const international =
    value.startsWith("+") || value.startsWith("00");

  let digits = value.replace(/\D/g, "");

  if (value.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Los números nacionales admitidos aquí corresponden a Colombia.
  if (!international && digits.length === 10) {
    if (!/^(?:3\d{9}|60[1-8]\d{7})$/.test(digits)) {
      return null;
    }

    digits = "57" + digits;
  }

  return /^[1-9]\d{9,14}$/.test(digits) ? digits : null;
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): string | null {
  const number = normalizeWhatsAppPhone(phone);

  return number
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : null;
}

export function buildWhatsAppOrderMessage(
  tracking: PublicTracking,
  customer?: CheckoutDraft
): string {
  const delivery = tracking.serviceType === "DELIVERY";

  const sections = [
    "Hola, envié una solicitud de pedido desde el menú público.",
    "",
    `Negocio: ${tracking.businessName}`,
    `Solicitud: ${tracking.publicCode}`,
    `Tipo: ${delivery ? "A domicilio" : "Para recoger"}`,
    `Punto de venta: ${tracking.locationName}`,
  ];

  if (customer) {
    sections.push(
      "",
      `Cliente: ${customer.customerName.trim()}`,
      `Teléfono: ${customer.customerPhone.trim()}`
    );

    if (customer.customerEmail.trim()) {
      sections.push(`Correo: ${customer.customerEmail.trim()}`);
    }

    if (delivery && customer.deliveryAddress.trim()) {
      sections.push(`Dirección: ${customer.deliveryAddress.trim()}`);
    }

    if (delivery && customer.deliveryInstructions?.trim()) {
      sections.push(
        `Indicaciones de entrega: ${customer.deliveryInstructions.trim()}`
      );
    }
  }

  sections.push("", "Productos:");

  for (const item of tracking.items) {
    sections.push(
      `- ${item.quantity} × ${item.productName} — ${money(item.lineTotal, "COP")}`,
      `  Precio unitario: ${money(item.unitPrice, "COP")}`
    );

    if (item.notes?.trim()) {
      sections.push(`  Nota del producto: ${item.notes.trim()}`);
    }
  }

  sections.push(
    "",
    `Subtotal de productos: ${money(tracking.subtotal, "COP")}`
  );

  if (customer?.notes.trim()) {
    sections.push("", `Notas generales: ${customer.notes.trim()}`);
  }

  sections.push(
    "",
    "La disponibilidad, el domicilio y el pago están pendientes de confirmación.",
    "Quedo atento a la confirmación y las instrucciones de pago."
  );

  return sections.join("\n");
}
