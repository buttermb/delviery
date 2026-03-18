import { logger } from '@/lib/logger';
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { safeStorage } from "@/utils/safeStorage";
import { STORAGE_KEYS } from "@/constants/storageKeys";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Get stored theme or determine default
    const stored = localStorage.getItem(STORAGE_KEYS.THEME);
    let initialTheme: Theme = "light"; // Default to light mode

    if (stored === "light" || stored === "dark") {
      initialTheme = stored;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      initialTheme = "dark";
    }

    // Apply theme IMMEDIATELY before React renders
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(initialTheme);

    logger.debug('Theme initialized', { theme: initialTheme, component: 'ThemeContext' });
    return initialTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    safeStorage.setItem(STORAGE_KEYS.THEME, theme);
    logger.debug('Theme applied', { theme, component: 'ThemeContext' });
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
