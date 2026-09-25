import { loginDataSchema } from "../schemas/auth.schema";
import type { LoginData } from "../types/auth.types";

const SESSION_KEY = "sazora.auth.v1";
const BUSINESS_KEY = "sazora.business-slug";

let memorySession: LoginData | null | undefined;

export function readStoredSession(): LoginData | null {
  if (memorySession !== undefined) {
    return memorySession;
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);

    if (!raw) {
      memorySession = null;
      return null;
    }

    const value: unknown = JSON.parse(raw);
    const result = loginDataSchema.safeParse(value);

    if (!result.success) {
      clearStoredSession();
      return null;
    }

    memorySession = result.data;
    return result.data;
  } catch {
    memorySession = null;
    return null;
  }
}

export function writeStoredSession(session: LoginData): void {
  const data = loginDataSchema.parse(session);
  memorySession = data;

  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // La sesión puede seguir funcionando en memoria durante esta visita.
  }
}

export function clearStoredSession(): void {
  memorySession = null;

  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // El estado en memoria ya quedó limpio.
  }
}

export function readRememberedBusiness(): string {
  try {
    return window.localStorage.getItem(BUSINESS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberBusiness(slug: string | null): void {
  try {
    if (slug) {
      window.localStorage.setItem(BUSINESS_KEY, slug);
    } else {
      window.localStorage.removeItem(BUSINESS_KEY);
    }
  } catch {
    // Esta preferencia no impide iniciar sesión.
  }
}
