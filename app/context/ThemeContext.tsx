import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  colors: {
    background: string;
    card: string;
    text: string;
    textMuted: string;
    border: string;
    primary: string;
    accent: string;
    greenBg: string;
    greenText: string;
    yellowBg: string;
    yellowText: string;
    inputBg: string;
  };
  statusBarTheme: "dark-content" | "light-content";
  toggleTheme: () => void;
}

const lightColors = {
  background: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#64748B",
  border: "#E2E8F0",
  primary: "#2563EB",
  accent: "#EFF6FF",
  greenBg: "#ECFDF5",
  greenText: "#047857",
  yellowBg: "#FFFBEB",
  yellowText: "#D97706",
  inputBg: "#FFFFFF",
};

const darkColors = {
  background: "#090D16",
  card: "#151F30",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "#202E44",
  primary: "#3B82F6",
  accent: "#1A2638",
  greenBg: "#064E3B",
  greenText: "#34D399",
  yellowBg: "#78350F",
  yellowText: "#FBBF24",
  inputBg: "#1C2A3E",
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>("light");

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem("autotrack_theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
      }
    } catch (e) {
      console.error("Error loading theme:", e);
    }
  };

  useEffect(() => {
    loadTheme();
  }, []);

  // Poll for theme changes (in case changed from settings screen and we are on another screen)
  useEffect(() => {
    const interval = setInterval(loadTheme, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = async () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    await AsyncStorage.setItem("autotrack_theme", next);
  };

  const colors = theme === "light" ? lightColors : darkColors;
  const statusBarTheme = theme === "light" ? "dark-content" : "light-content";

  return (
    <ThemeContext.Provider value={{ theme, colors, statusBarTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
