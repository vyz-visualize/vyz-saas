// Cores e medidas do app. Escuro primeiro (é o modo de análise), com o claro
// equivalente. A cor de destaque é o sálvia da marca VYZ (globals.css do site).

import { useColorScheme } from "react-native";

const palette = {
  light: {
    bg: "#F2F3EE",
    card: "#FFFFFF",
    surface: "#FFFFFF",
    surface2: "#EBEDE5",
    fg: "#161714",
    fg2: "#5E6157",
    fg3: "#8C8F84",
    line: "#E0E2D9",
    accent: "#4B5320",
    accentSoft: "rgba(75,83,32,0.10)",
    accentFg: "#FFFFFF",
    glow: "rgba(75,83,32,0.18)",
    danger: "#B42318",
    dangerSoft: "rgba(180,35,24,0.10)",
    good: "#2F7D32",
    goodSoft: "rgba(47,125,50,0.10)",
    chart: "#4B5320",
    chartFill: "rgba(75,83,32,0.16)",
    scheme: "light" as "light" | "dark",
  },
  dark: {
    bg: "#0E0F0D",
    card: "#171915",
    surface: "#171915",
    surface2: "#20231D",
    fg: "#F2F3EE",
    fg2: "#A7AA9F",
    fg3: "#6E7168",
    line: "#262923",
    accent: "#B5C477",
    accentSoft: "rgba(181,196,119,0.12)",
    accentFg: "#12130F",
    glow: "rgba(181,196,119,0.22)",
    danger: "#F97066",
    dangerSoft: "rgba(249,112,102,0.12)",
    good: "#8FD18F",
    goodSoft: "rgba(143,209,143,0.12)",
    chart: "#C3D27F",
    chartFill: "rgba(195,210,127,0.18)",
    scheme: "dark" as "light" | "dark",
  },
};

export type Theme = typeof palette.light;

export function useTheme(): Theme {
  return palette[useColorScheme() === "light" ? "light" : "dark"];
}

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
