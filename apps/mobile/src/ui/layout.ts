// Medidas que dependem da tela: margem lateral, largura máxima do conteúdo
// (telas grandes e tablet), colunas das grades e o espaço que a barra de abas
// flutuante ocupa embaixo.

import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Altura da barra de abas flutuante (sem a margem de baixo). */
export const TAB_BAR_HEIGHT = 64;
/** Largura máxima da barra de abas (em tablet ela não estica). */
export const TAB_BAR_MAX = 460;
/** Largura máxima do conteúdo das telas. */
export const CONTENT_MAX = 680;

/** Distância da barra de abas até a borda de baixo (acima do indicador de início). */
export const tabBarBottom = (insetBottom: number) => Math.max(insetBottom - 6, 12);

export function useLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const gutter = width < 360 ? 14 : width >= 430 ? 20 : 16;
  const contentWidth = Math.min(width, CONTENT_MAX) - gutter * 2;
  return {
    width,
    insets,
    /** Margem lateral: 14 em telas estreitas, 16 no padrão, 20 nas grandes. */
    gutter,
    /** Largura útil do conteúdo (já sem as margens). */
    contentWidth,
    /** Telas estreitas (iPhone SE, Android compacto). */
    small: width < 360,
    /** Telas largas (tablet, celular deitado): listas em duas colunas. */
    wide: contentWidth >= 600,
    /** Colunas das grades de cartões de número. */
    statColumns: contentWidth >= 560 ? 3 : 2,
    /** Respiro do topo, abaixo da barra de status. */
    top: insets.top + 10,
    /** Espaço embaixo das telas que têm a barra de abas por cima. */
    tabBarSpace: tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + 20,
    /** Espaço embaixo das telas sem barra de abas. */
    bottom: insets.bottom + 28,
    /** Para o contentContainerStyle: centralizado, com largura máxima e margem lateral. */
    content: { width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center", paddingHorizontal: gutter } as const,
  };
}
