

export const labels: Record<string, string> = {
  NEW: "Nueva",
  CONTACTED: "Contactada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  PENDING_ASSIGNMENT: "Pendiente de asignación",
  ASSIGNED: "Asignado",
  PICKED_UP: "Recogido",
  OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  OPEN: "Pendiente de preparación",
  CONFIRMED: "En preparación",
  CLOSED: "Cerrado",
  PENDING: "Pendiente de preparación",
  IN_PREPARATION: "En preparación",
  READY: "Listo",
};

export const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: labels[value] }));

export const allLocations = {
  value: "ALL",
  label: "Todos los puntos",
};

export const text = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

export const pending = (status: string) =>
  status === "NEW" || status === "CONTACTED";

export const active = (status: string) =>
  status !== "DELIVERED" && status !== "CANCELLED";
