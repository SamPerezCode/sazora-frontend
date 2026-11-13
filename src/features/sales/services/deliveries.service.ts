import { request } from "../../../lib/http/client";
import type { PublicTracking } from "../../public-menu/schemas/public-menu.schema";
import { getPublicTracking } from "../../public-menu/services/public-menu.service";
import type { Assignment } from "../schemas/public-orders.schema";
import type { Delivery } from "../schemas/public-orders.schema";
import type { DeliveryAction } from "../schemas/public-orders.schema";
import { deliveryResponse } from "../schemas/public-orders.schema";
import { deliverySchema } from "../schemas/public-orders.schema";
import { id } from "../schemas/public-orders.schema";
import { z } from "zod";

export async function listDeliveries(
  accessToken: string,
  slug: string,
  signal: AbortSignal
) {
  const result = await request(
    "/deliveries",
    z.object({
      status: z.literal("success"),
      data: z.object({ deliveries: z.array(deliverySchema) }),
    }),
    { accessToken, signal, cache: "no-store" }
  );

  const rows: Delivery[] = result.data.deliveries.map((row) => ({
    ...row,
    tracking: null,
  }));

  // El seguimiento aporta punto de venta, productos y preparación.
  // Un fallo individual no oculta el domicilio.
  let index = 0;

  await Promise.all(
    Array.from({ length: Math.min(4, rows.length) }, async () => {
      while (index < rows.length && !signal.aborted) {
        const row = rows[index++];

        try {
          row.tracking = await getPublicTracking(
            slug,
            row.publicCode,
            signal
          );
        } catch (error) {
          if (signal.aborted) throw error;
        }
      }
    })
  );

  return rows;
}

export async function readDelivery(
  value: string,
  accessToken: string,
  slug: string,
  signal: AbortSignal
): Promise<Delivery> {
  const result = await request(
    "/deliveries/" + id.parse(value),
    deliveryResponse,
    { accessToken, signal, cache: "no-store" }
  );

  if (result.data.delivery.id !== value) {
    throw new Error("El domicilio recibido no corresponde.");
  }

  let tracking: PublicTracking | null = null;

  try {
    tracking = await getPublicTracking(
      slug,
      result.data.delivery.publicCode,
      signal
    );
  } catch (error) {
    if (signal.aborted) throw error;
  }

  return { ...result.data.delivery, tracking };
}

export function assignDelivery(
  value: string,
  body: Assignment,
  accessToken: string,
  signal: AbortSignal
) {
  const input =
    body.deliveryMode === "INTERNAL"
      ? {
          deliveryMode: body.deliveryMode,
          driverMembershipId: id.parse(body.driverMembershipId),
        }
      : {
          deliveryMode: body.deliveryMode,
          externalProviderName: z
            .string()
            .trim()
            .min(1)
            .max(150)
            .parse(body.externalProviderName),
        };

  return request(
    "/deliveries/public-order-requests/" +
      id.parse(value) +
      "/configure",
    deliveryResponse,
    { method: "POST", body: input, accessToken, signal }
  );
}

export function advanceDelivery(
  value: string,
  action: DeliveryAction,
  accessToken: string,
  signal: AbortSignal
) {
  return request(
    "/deliveries/" + id.parse(value) + "/" + action,
    deliveryResponse,
    { method: "POST", accessToken, signal }
  );
}
