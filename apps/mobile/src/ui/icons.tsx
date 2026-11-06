// Ícones de traço (SVG), no mesmo peso em todo o app.

import Svg, { Circle, Path } from "react-native-svg";

type P = { color: string; size?: number };
const S = ({ size = 24, color, children }: P & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const IconHome = (p: P) => (
  <S {...p}>
    <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </S>
);
export const IconPulse = (p: P) => (
  <S {...p}>
    <Path d="M3 12h4l3-8 4 16 3-8h4" />
  </S>
);
export const IconSpark = (p: P) => (
  <S {...p}>
    <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </S>
);
export const IconUser = (p: P) => (
  <S {...p}>
    <Circle cx={12} cy={8} r={4} />
    <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </S>
);
export const IconShare = (p: P) => (
  <S {...p}>
    <Path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </S>
);
export const IconBack = (p: P) => (
  <S {...p}>
    <Path d="M15 5l-7 7 7 7" />
  </S>
);
export const IconSend = (p: P) => (
  <S {...p}>
    <Path d="M4 12 20 4l-6 16-3-7z" />
  </S>
);
export const IconClose = (p: P) => (
  <S {...p}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </S>
);
export const IconChevron = (p: P) => (
  <S {...p}>
    <Path d="M9 5l7 7-7 7" />
  </S>
);
export const IconBell = (p: P) => (
  <S {...p}>
    <Path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
  </S>
);
