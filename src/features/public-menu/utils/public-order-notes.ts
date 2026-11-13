

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
