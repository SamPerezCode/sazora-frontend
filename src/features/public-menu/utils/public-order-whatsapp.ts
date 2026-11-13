import { money } from "../../../lib/money";
import type { CheckoutDraft } from "../schemas/public-menu.schema";
import type { PublicTracking } from "../schemas/public-menu.schema";

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
