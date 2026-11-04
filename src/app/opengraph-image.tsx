import { ImageResponse } from "next/og";
import { LETTER_STEP, V_POLYS, Y_POLY, Z_BOTTOM, Z_TOP } from "@/components/brand/geometry";

export const alt = "VYZ · Dashboards para gestores de tráfego";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Off-black + sálvia (Brand Showcase, pág. 10): o wordmark sozinho. */
export default function OpengraphImage() {
  const polys = [
    ...V_POLYS.map((p) => ({ p, dx: 0 })),
    { p: Y_POLY, dx: LETTER_STEP },
    { p: Z_TOP, dx: LETTER_STEP * 2 },
    { p: Z_BOTTOM, dx: LETTER_STEP * 2 },
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1E1E1E" }}>
        <svg width="680" height="200" viewBox="0 0 34 10">
          {polys.map(({ p, dx }) => (
            <polygon key={`${dx}-${p}`} points={p} fill="#8A9A5B" transform={`translate(${dx} 0)`} />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
