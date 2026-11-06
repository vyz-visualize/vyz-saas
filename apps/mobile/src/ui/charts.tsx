// Gráficos do app em SVG: a sparkline dos cartões e o gráfico grande, que se
// lê com o dedo (arrastar mostra o dia e o valor, com um toque de vibração).

import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { Platform, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "./theme";

type Pt = { x: number; y: number };

function points(values: (number | null)[], w: number, h: number, pad = 4): (Pt | null)[] {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return values.map(() => null);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => (v === null ? null : { x: pad + i * step, y: pad + (h - pad * 2) * (1 - (v - min) / span) }));
}

/** Curva suave (Catmull-Rom → Bézier) pelos pontos com dado. */
function smooth(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function Sparkline({ values, width = 96, height = 32, color }: { values: (number | null)[]; width?: number; height?: number; color?: string }) {
  const t = useTheme();
  const pts = points(values, width, height, 2).filter((p): p is Pt => !!p);
  if (pts.length < 2) return <View style={{ width, height }} />;
  const line = smooth(pts);
  const area = `${line} L${pts[pts.length - 1].x},${height} L${pts[0].x},${height} Z`;
  const c = color ?? t.chart;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c} stopOpacity={0.28} />
          <Stop offset="1" stopColor={c} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#sf)" />
      <Path d={line} stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

type AreaChartProps = {
  values: (number | null)[];
  labels: string[];
  height?: number;
  /** Dias em maturação (tracejado no fim). */
  maturingFrom?: number | null;
  onScrub?: (index: number | null) => void;
};

/** Gráfico grande: arraste o dedo para ler cada dia. */
export function AreaChart({ values, labels, height = 170, maturingFrom = null, onScrub }: AreaChartProps) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const pts = useMemo(() => (w ? points(values, w, height, 10) : []), [values, w, height]);
  const solid = pts.filter((p, i): p is Pt => !!p && (maturingFrom === null || i <= maturingFrom));
  const dashed = maturingFrom === null ? [] : pts.filter((p, i): p is Pt => !!p && i >= maturingFrom);
  const line = smooth(solid);
  const area = solid.length > 1 ? `${line} L${solid[solid.length - 1].x},${height} L${solid[0].x},${height} Z` : "";

  function pick(x: number) {
    if (!w || values.length === 0) return;
    const i = Math.max(0, Math.min(values.length - 1, Math.round(((x - 10) / (w - 20)) * (values.length - 1))));
    if (i !== active) {
      if (Platform.OS !== "web") void Haptics.selectionAsync();
      setActive(i);
      onScrub?.(i);
    }
  }
  function release() {
    setActive(null);
    onScrub?.(null);
  }

  const a = active !== null ? pts[active] : null;
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={{ height }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
      onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      onResponderRelease={release}
      onResponderTerminate={release}
      accessibilityLabel={`Gráfico de ${labels[0] ?? ""} a ${labels[labels.length - 1] ?? ""}`}
    >
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="af" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.chart} stopOpacity={0.35} />
              <Stop offset="1" stopColor={t.chart} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <Line key={f} x1={0} x2={w} y1={height * f} y2={height * f} stroke={t.line} strokeWidth={1} strokeDasharray="2 6" />
          ))}
          {area ? <Path d={area} fill="url(#af)" /> : null}
          <Path d={line} stroke={t.chart} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {dashed.length > 1 && <Path d={smooth(dashed)} stroke={t.chart} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="4 5" fill="none" />}
          {a && (
            <>
              <Rect x={a.x - 0.5} y={0} width={1} height={height} fill={t.fg2} opacity={0.5} />
              <Circle cx={a.x} cy={a.y} r={9} fill={t.glow} />
              <Circle cx={a.x} cy={a.y} r={4.5} fill={t.chart} stroke={t.bg} strokeWidth={2} />
            </>
          )}
        </Svg>
      )}
    </View>
  );
}

/** Barra horizontal fina (fatia de 0 a 1). */
export function ShareBar({ share, color }: { share: number; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: t.surface2, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(2, Math.min(100, share * 100))}%`, height: "100%", borderRadius: 3, backgroundColor: color ?? t.accent }} />
    </View>
  );
}
