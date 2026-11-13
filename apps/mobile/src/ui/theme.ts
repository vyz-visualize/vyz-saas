// Cores e medidas do app. Escuro primeiro (é o modo de análise), com o claro
// equivalente. Mesma paleta do painel do site (tokens [data-ui="app"] do
// globals.css): fundo neutro, cartão, linha fina e o oliva/sálvia da marca só
// como destaque. Aqui também moram a escala de espaços, os raios, a tipografia
// com tamanhos nomeados e a elevação por tema.

import { useColorScheme, type TextStyle, type ViewStyle } from "react-native";

const palette = {
  light: {
    bg: "#F2F3EE",
    card: "#FFFFFF",
    surface: "#FFFFFF",
    surface2: "#EBEDE5",
    fg: "#161714",
    fg2: "#5E6157",
    fg3: "#767A6E",
    line: "#E0E2D9",
    accent: "#4B5320",
    accentSoft: "rgba(75,83,32,0.10)",
    accentFg: "#FBFCF7",
    glow: "rgba(75,83,32,0.18)",
    danger: "#B42318",
    dangerSoft: "rgba(180,35,24,0.10)",
    good: "#2F7D32",
    goodSoft: "rgba(47,125,50,0.10)",
    warn: "#8A5A00",
    warnSoft: "rgba(217,164,65,0.20)",
    chart: "#4B5320",
    chartFill: "rgba(75,83,32,0.16)",
    /** Fundo escurecido atrás das folhas que sobem. */
    scrim: "rgba(22,23,20,0.45)",
    /** Barra de abas flutuante (levemente translúcida). */
    tabBar: "rgba(255,255,255,0.96)",
    /** Faixa da marca (saudação do Início, entrar): sempre oliva, nos dois temas. */
    heroFrom: "#4B5320",
    heroTo: "#1F2612",
    heroFg: "#F2F3EE",
    heroFg2: "rgba(242,243,238,0.72)",
    heroLine: "rgba(242,243,238,0.18)",
    scheme: "light" as "light" | "dark",
  },
  dark: {
    bg: "#0E0F0D",
    card: "#171915",
    surface: "#171915",
    surface2: "#20231D",
    fg: "#F2F3EE",
    fg2: "#A7AA9F",
    fg3: "#858980",
    line: "#272A24",
    accent: "#B5C477",
    accentSoft: "rgba(181,196,119,0.12)",
    accentFg: "#12130F",
    glow: "rgba(181,196,119,0.22)",
    danger: "#F97066",
    dangerSoft: "rgba(249,112,102,0.12)",
    good: "#8FD18F",
    goodSoft: "rgba(143,209,143,0.12)",
    warn: "#E3B45A",
    warnSoft: "rgba(227,180,90,0.14)",
    chart: "#C3D27F",
    chartFill: "rgba(195,210,127,0.18)",
    scrim: "rgba(0,0,0,0.62)",
    tabBar: "rgba(23,25,21,0.96)",
    heroFrom: "#434A1D",
    heroTo: "#1A1F0E",
    heroFg: "#F2F3EE",
    heroFg2: "rgba(242,243,238,0.72)",
    heroLine: "rgba(242,243,238,0.16)",
    scheme: "dark" as "light" | "dark",
  },
};

export type Theme = typeof palette.light;

export function useTheme(): Theme {
  return palette[useColorScheme() === "light" ? "light" : "dark"];
}

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Menor alvo de toque (Apple pede 44 pt, o Material 48 dp). */
export const HIT = 44;

/** Tipografia com tamanhos nomeados (a cor entra em quem usa). */
export const type = {
  /** Título da tela. */
  display: { fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -0.9 },
  /** Título de bloco grande (estado vazio, chamada). */
  title: { fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.5 },
  /** Título de seção. */
  section: { fontSize: 19, lineHeight: 24, fontWeight: "800", letterSpacing: -0.3 },
  /** Título de cartão ou linha. */
  heading: { fontSize: 16, lineHeight: 21, fontWeight: "700", letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  label: { fontSize: 13.5, lineHeight: 18, fontWeight: "500" },
  caption: { fontSize: 12.5, lineHeight: 17, fontWeight: "500" },
  /** Rótulo em caixa alta (nome do indicador). */
  overline: { fontSize: 11.5, lineHeight: 15, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  /** Número grande do cartão principal. */
  hero: { fontSize: 38, lineHeight: 44, fontWeight: "800", letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
  /** Número de cartão. */
  stat: { fontSize: 22, lineHeight: 27, fontWeight: "800", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
} as const satisfies Record<string, TextStyle>;

/** Algarismos de largura fixa (colunas de número não dançam). */
export const tnum: TextStyle = { fontVariant: ["tabular-nums"] };

/**
 * Elevação por tema. No claro, sombra suave; no escuro a borda já separa os
 * planos, então só o nível mais alto (folhas, barra de abas) ganha sombra.
 */
export function elevation(t: Theme, level: 1 | 2 | 3 = 1): ViewStyle {
  if (t.scheme === "dark") return level === 3 ? { boxShadow: "0 16px 40px rgba(0,0,0,0.55)" } : {};
  if (level === 1) return { boxShadow: "0 1px 2px rgba(22,23,20,0.05)" };
  if (level === 2) return { boxShadow: "0 6px 16px rgba(22,23,20,0.08)" };
  return { boxShadow: "0 16px 36px rgba(22,23,20,0.16)" };
}
