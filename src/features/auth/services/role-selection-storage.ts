import { pendingRoleSelectionSchema } from "../schemas/auth.schema";
import type { PendingRoleSelection } from "../types/auth.types";

const KEY = "sazora.auth.role-selection.v1";

let memory: PendingRoleSelection | null | undefined;

export function readPendingRoleSelection(): PendingRoleSelection | null {
  if (memory !== undefined) return memory;

  try {
    const raw = window.sessionStorage.getItem(KEY);

    if (!raw) {
      memory = null;
      return null;
    }

    const result = pendingRoleSelectionSchema.safeParse(
      JSON.parse(raw)
    );

    if (!result.success) {
      clearPendingRoleSelection();
      return null;
    }

    memory = result.data;
    return memory;
  } catch {
    clearPendingRoleSelection();
    return null;
  }
}

export function writePendingRoleSelection(
  pending: PendingRoleSelection
): void {
  const checked = pendingRoleSelectionSchema.parse(pending);
  memory = checked;

  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(checked));
  } catch {
    // Puede continuar en memoria durante esta visita.
  }
}

export function clearPendingRoleSelection(): void {
  memory = null;

  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // El estado en memoria ya está limpio.
  }
}
