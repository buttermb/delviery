import { logger } from '@/lib/logger';
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { safeStorage } from "@/utils/safeStorage";
import { STORAGE_KEYS } from "@/constants/storageKeys";

type Theme = "light" | "dark";
type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setMode: (mode: ThemeMode) => void;
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(mode: ThemeMode): Theme {
  if (mode === "system") return getSystemTheme();
  return mode;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const storedMode = localStorage.getItem(STORAGE_KEYS.THEME_MODE);
    if (storedMode === "light" || storedMode === "dark" || storedMode === "system") {
      return storedMode;
    }
    // Migrate from legacy THEME key
    const stored = localStorage.getItem(STORAGE_KEYS.THEME);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return "system";
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    const resolved = resolveTheme(mode);

    // Apply theme IMMEDIATELY before React renders
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);

    logger.debug('Theme initialized', { theme: resolved, mode, component: 'ThemeContext' });
    return resolved;
  });

  // Apply theme class and persist whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    safeStorage.setItem(STORAGE_KEYS.THEME, theme);
    logger.debug('Theme applied', { theme, mode, component: 'ThemeContext' });
  }, [theme, mode]);

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setThemeState(getSystemTheme());
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mode]);

  const toggleTheme = useCallback(() => {
    const newTheme: Theme = theme === "light" ? "dark" : "light";
    setModeState(newTheme);
    setThemeState(newTheme);
    safeStorage.setItem(STORAGE_KEYS.THEME_MODE, newTheme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setModeState(newTheme);
    setThemeState(newTheme);
    safeStorage.setItem(STORAGE_KEYS.THEME_MODE, newTheme);
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    setThemeState(resolveTheme(newMode));
    safeStorage.setItem(STORAGE_KEYS.THEME_MODE, newMode);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme, setTheme, setMode }}>
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
