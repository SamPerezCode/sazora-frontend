import type { PublicTracking } from "../schemas/public-menu.schema";

export function statusOf(tracking: PublicTracking) {
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
  let text = "Pendiente de confirmación";

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
