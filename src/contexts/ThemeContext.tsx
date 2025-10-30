import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Get stored theme or determine default
    const stored = localStorage.getItem("theme");
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
    
    console.log('[Theme] Initialized:', initialTheme);
    return initialTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
    console.log('[Theme] Applied:', theme);
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
