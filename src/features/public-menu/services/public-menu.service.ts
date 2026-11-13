import { request } from "../../../lib/http/client";
import type { CartLine } from "../schemas/public-menu.schema";
import type { CheckoutDraft } from "../schemas/public-menu.schema";
import { checkoutSchema } from "../schemas/public-menu.schema";
import { idSchema } from "../schemas/public-menu.schema";
import { itemsSchema } from "../schemas/public-menu.schema";
import { menuResponseSchema } from "../schemas/public-menu.schema";
import type { PublicMenu } from "../schemas/public-menu.schema";
import type { PublicTracking } from "../schemas/public-menu.schema";
import { slugSchema } from "../schemas/public-menu.schema";
import { submittedResponseSchema } from "../schemas/public-menu.schema";
import { trackingResponseSchema } from "../schemas/public-menu.schema";
import { publicOrderNotes } from "../utils/public-order-notes";
import { z } from "zod";

export function basePath(slug: string) {
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
