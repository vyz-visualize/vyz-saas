// Wordmark VYZ em SVG, na mesma construção do site (src/components/brand/geometry.ts):
// malha de 10 unidades de altura, letras de 10 × 10 com 2 de vão e o corte
// horizontal entre 4,2 e 5,3 no V e na diagonal do Z. O VyzMark é o "V" do
// logo num círculo: o rosto do assistente no app.

import Svg, { Polygon } from "react-native-svg";
import { View } from "react-native";
import { useTheme } from "./theme";

const CUT_TOP = 4.2;
const CUT_BOTTOM = 5.3;
const vOuter = (y: number) => 0.32 * y;
const vInner = (y: number) => 3.8 + (1.2 / 5.2) * y;
const V = [
  `0,0 3.8,0 ${vInner(CUT_TOP)},${CUT_TOP} ${vOuter(CUT_TOP)},${CUT_TOP}`,
  `10,0 6.2,0 ${10 - vInner(CUT_TOP)},${CUT_TOP} ${10 - vOuter(CUT_TOP)},${CUT_TOP}`,
  `${vOuter(CUT_BOTTOM)},${CUT_BOTTOM} ${10 - vOuter(CUT_BOTTOM)},${CUT_BOTTOM} 6.8,10 3.2,10`,
];
const Y = "0,0 3.8,0 5,3.4 6.2,0 10,0 6.8,5.6 6.8,10 3.2,10 3.2,5.6";
const zLeft = (y: number) => 4.8 - 1.5 * (y - 3.4);
const zRight = (y: number) => 10 - 1.5 * (y - 3.4);
const Z = [
  `0,0 10,0 10,3.4 ${zRight(CUT_TOP)},${CUT_TOP} ${zLeft(CUT_TOP)},${CUT_TOP} 4.8,3.4 0,3.4`,
  `${zLeft(CUT_BOTTOM)},${CUT_BOTTOM} ${zRight(CUT_BOTTOM)},${CUT_BOTTOM} 5.2,6.6 10,6.6 10,10 0,10 0,6.6`,
];
const WIDTH = 34;
const STEP = 12;

const shift = (points: string, dx: number) =>
  points
    .split(" ")
    .map((p) => {
      const [x, y] = p.split(",").map(Number);
      return `${x + dx},${y}`;
    })
    .join(" ");

/** Wordmark "VYZ". width define o tamanho; a altura segue a proporção (34 × 10). */
export function Wordmark({ width = 68, color }: { width?: number; color?: string }) {
  const t = useTheme();
  const fill = color ?? t.accent;
  return (
    <Svg width={width} height={(width * 10) / WIDTH} viewBox={`0 0 ${WIDTH} 10`} accessibilityLabel="VYZ" accessibilityRole="image">
      {V.map((p) => (
        <Polygon key={p} points={p} fill={fill} />
      ))}
      <Polygon points={shift(Y, STEP)} fill={fill} />
      {Z.map((p) => (
        <Polygon key={p} points={shift(p, STEP * 2)} fill={fill} />
      ))}
    </Svg>
  );
}

/** O "V" do logo num círculo: marca do assistente VYZ. */
export function VyzMark({ size = 44, tone = "soft" }: { size?: number; tone?: "soft" | "solid" }) {
  const t = useTheme();
  const fill = tone === "solid" ? t.accentFg : t.accent;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone === "solid" ? t.accent : t.accentSoft, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size * 0.46} height={size * 0.46} viewBox="0 0 10 10">
        {V.map((p) => (
          <Polygon key={p} points={p} fill={fill} />
        ))}
      </Svg>
    </View>
  );
}
