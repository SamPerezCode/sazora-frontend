const SIDEBAR_KEY = "sazora.sidebar-collapsed";

export function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  } catch {
    // La preferencia continúa activa en memoria.
  }
}
