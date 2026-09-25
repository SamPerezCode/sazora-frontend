export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "sazora.theme";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function initializeTheme(): Theme {
  let theme: Theme = window.matchMedia("(prefers-color-scheme: dark)")
    .matches
    ? "dark"
    : "light";

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (isTheme(savedTheme)) {
      theme = savedTheme;
    }
  } catch {
    // Si el almacenamiento no está disponible, usamos el tema del sistema.
  }

  applyTheme(theme);

  return theme;
}

export function saveTheme(theme: Theme): void {
  applyTheme(theme);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // El cambio sigue funcionando durante esta visita.
  }
}
