// Ícones de traço (SVG), no mesmo peso em todo o app.

import Svg, { Circle, Path } from "react-native-svg";

type P = { color: string; size?: number; strokeWidth?: number };
const S = ({ size = 24, color, strokeWidth = 1.9, children }: P & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
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
export const IconChevronDown = (p: P) => (
  <S {...p}>
    <Path d="M6 9l6 6 6-6" />
  </S>
);
export const IconBell = (p: P) => (
  <S {...p}>
    <Path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
  </S>
);
export const IconCheck = (p: P) => (
  <S {...p}>
    <Path d="M5 12.5l4.5 4.5L19 7" />
  </S>
);
export const IconAlert = (p: P) => (
  <S {...p}>
    <Path d="M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.1v.2" />
  </S>
);
export const IconInfo = (p: P) => (
  <S {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 11v5M12 7.7v.2" />
  </S>
);
export const IconRefresh = (p: P) => (
  <S {...p}>
    <Path d="M20 11a8 8 0 0 0-14.5-4.2L3 9M3 4v5h5M4 13a8 8 0 0 0 14.5 4.2L21 15M21 20v-5h-5" />
  </S>
);
export const IconLogout = (p: P) => (
  <S {...p}>
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </S>
);
export const IconTrash = (p: P) => (
  <S {...p}>
    <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </S>
);
export const IconDoc = (p: P) => (
  <S {...p}>
    <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6" />
  </S>
);
export const IconShield = (p: P) => (
  <S {...p}>
    <Path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" />
  </S>
);
export const IconMail = (p: P) => (
  <S {...p}>
    <Path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6.5 12 13l8.5-6.5" />
  </S>
);
export const IconListChecks = (p: P) => (
  <S {...p}>
    <Path d="M3 6.5l1.8 1.8L8 5M3 16.5l1.8 1.8L8 15M12 7h9M12 17h9" />
  </S>
);
export const IconChart = (p: P) => (
  <S {...p}>
    <Path d="M4 4v16h16M8 16v-5M12 16V8M16 16v-3" />
  </S>
);
export const IconEye = (p: P) => (
  <S {...p}>
    <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <Circle cx={12} cy={12} r={3} />
  </S>
);
export const IconEyeOff = (p: P) => (
  <S {...p}>
    <Path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </S>
);
export const IconLayers = (p: P) => (
  <S {...p}>
    <Path d="M12 3 3 7.5 12 12l9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
  </S>
);
export const IconClock = (p: P) => (
  <S {...p}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </S>
);
export const IconBolt = (p: P) => (
  <S {...p}>
    <Path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />
  </S>
);
export const IconUndo = (p: P) => (
  <S {...p}>
    <Path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
  </S>
);
export const IconCoins = (p: P) => (
  <S {...p}>
    <Circle cx={9} cy={9} r={6} />
    <Path d="M18.1 10.4A6 6 0 1 1 10.4 18" />
  </S>
);
