import { logger } from '@/lib/logger';
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { safeStorage } from "@/utils/safeStorage";
import { STORAGE_KEYS } from "@/constants/storageKeys";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Get stored theme or default to light
    const stored = safeStorage.getItem("theme");
    const initialTheme: Theme = (stored === "light" || stored === "dark") ? stored : "light";

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
