import { useState } from "react";
import type { ReactNode } from "react";
import { saveTheme } from "../../lib/theme";
import type { Theme } from "../../lib/theme";
import { ThemeContext } from "./theme-context";

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme: Theme;
}

export function ThemeProvider({
  children,
  initialTheme,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  function changeTheme(nextTheme: Theme): void {
    saveTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
