// Ilustração padrão da capa do Fachada: uma torre vista da esquina, de baixo para cima,
// com a faixa de varandas na cor de destaque do visual (segue a cor da marca). É o que a
// pessoa vê enquanto não sobe a imagem do empreendimento. Desenho em perspectiva de dois
// pontos calculada aqui mesmo: cada janela é um quadrilátero projetado.

const W = 480;
const H = 680;
const CX = 212; // a quina do prédio
const TOP = 26;
const BASE = 664;
const HORIZON = 652; // quase no chão: quem olha está na calçada
const VL = -720; // pontos de fuga
const VR = 1160;
const S_LEFT = 0.205; // até onde cada face vai na direção do ponto de fuga
const S_RIGHT = 0.262;
const FORE = 0.5; // o quanto os vãos do fundo encurtam

type Face = "L" | "R";

/** Ponto da face: `t` de 0 (quina) a 1 (fim da face), `y` a altura medida na quina. */
function pt(face: Face, t: number, y: number): [number, number] {
  const max = face === "L" ? S_LEFT : S_RIGHT;
  const s = (max * t * (1 + FORE)) / (1 + FORE * t);
  const vx = face === "L" ? VL : VR;
  return [CX + s * (vx - CX), y + s * (HORIZON - y)];
}

function quad(face: Face, t0: number, t1: number, y0: number, y1: number): string {
  return [pt(face, t0, y0), pt(face, t1, y0), pt(face, t1, y1), pt(face, t0, y1)].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

const FLOORS = 11;
const CORNICE = 20;
const GROUND = 56;
const FLOOR_H = (BASE - GROUND - TOP - CORNICE) / FLOORS;
const floorTop = (i: number) => TOP + CORNICE + i * FLOOR_H;

/** Janela acesa ou não, sempre igual (sem sorteio no render). */
const lit = (a: number, b: number) => ((a * 7 + b * 13 + a * b * 3) % 11) < 3;

const STONE_LIT = "#d9d7d2";
const STONE_SHADE = "#bcbab5";
const JOINT = "rgb(0 0 0 / 0.07)";
const GLASS = "#434952";
const GLASS_SKY = "#6d7682";
const GLOW = "#f1cf9a";

const LEFT_BAYS: [number, number][] = [
  [0.1, 0.27],
  [0.36, 0.53],
  [0.75, 0.87],
];
const RIGHT_BAYS: [number, number][] = [
  [0.07, 0.25],
  [0.77, 0.93],
];
const RECESS: [number, number] = [0.33, 0.69];

export function Tower({ className = "" }: { className?: string }) {
  const floors = Array.from({ length: FLOORS }, (_, i) => i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="xMidYMax meet" role="img" aria-label="Ilustração de um edifício residencial">
      {/* as duas faces */}
      <polygon points={quad("L", 0, 1, TOP, BASE)} fill={STONE_SHADE} />
      <polygon points={quad("R", 0, 1, TOP, BASE)} fill={STONE_LIT} />

      {/* juntas do revestimento */}
      {floors.map((i) => (
        <g key={i} stroke={JOINT} strokeWidth={1}>
          <line x1={pt("L", 0, floorTop(i))[0]} y1={pt("L", 0, floorTop(i))[1]} x2={pt("L", 1, floorTop(i))[0]} y2={pt("L", 1, floorTop(i))[1]} />
          <line x1={pt("R", 0, floorTop(i))[0]} y1={pt("R", 0, floorTop(i))[1]} x2={pt("R", 1, floorTop(i))[0]} y2={pt("R", 1, floorTop(i))[1]} />
        </g>
      ))}

      {/* janelas da face da esquerda (na sombra) */}
      {floors.map((i) =>
        LEFT_BAYS.map(([a, b], k) => {
          const y0 = floorTop(i) + FLOOR_H * 0.24;
          const y1 = floorTop(i) + FLOOR_H * 0.84;
          return (
            <g key={`${i}-${k}`}>
              <polygon points={quad("L", a, b, y0, y1)} fill={lit(i, k) ? GLOW : GLASS} />
              {!lit(i, k) && <polygon points={quad("L", a, a + (b - a) * 0.46, y0, y1)} fill={GLASS_SKY} opacity={0.5} />}
            </g>
          );
        }),
      )}

      {/* face da direita: o recuo das varandas, na cor de destaque */}
      <polygon points={quad("R", RECESS[0], RECESS[1], TOP + CORNICE + 4, BASE - GROUND)} fill="var(--accent, #dd4c38)" />
      <polygon points={quad("R", RECESS[0], RECESS[1], TOP + CORNICE + 4, BASE - GROUND)} fill="#000" opacity={0.16} />
      {floors.map((i) => {
        const y = floorTop(i);
        return (
          <g key={i}>
            {/* porta de vidro da varanda */}
            <polygon points={quad("R", RECESS[0] + 0.035, RECESS[1] - 0.035, y + FLOOR_H * 0.16, y + FLOOR_H * 0.82)} fill={lit(i + 2, 5) ? GLOW : GLASS} />
            <polygon points={quad("R", RECESS[0] + 0.035, RECESS[0] + 0.17, y + FLOOR_H * 0.16, y + FLOOR_H * 0.82)} fill={GLASS_SKY} opacity={lit(i + 2, 5) ? 0 : 0.45} />
            {/* a laje da varanda, que avança um pouco além do recuo, e a sombra embaixo dela */}
            <polygon points={quad("R", RECESS[0] - 0.02, RECESS[1] + 0.02, y + FLOOR_H * 0.8, y + FLOOR_H * 1.02)} fill="var(--accent, #dd4c38)" />
            <polygon points={quad("R", RECESS[0] - 0.02, RECESS[1] + 0.02, y + FLOOR_H * 0.8, y + FLOOR_H * 0.86)} fill="#fff" opacity={0.22} />
            <polygon points={quad("R", RECESS[0], RECESS[1], y + FLOOR_H * 1.02, y + FLOOR_H * 1.1)} fill="#000" opacity={0.2} />
          </g>
        );
      })}

      {/* janelas da face da direita (no sol) */}
      {floors.map((i) =>
        RIGHT_BAYS.map(([a, b], k) => {
          const y0 = floorTop(i) + FLOOR_H * 0.22;
          const y1 = floorTop(i) + FLOOR_H * 0.82;
          const on = lit(i + 1, k + 3);
          return (
            <g key={`${i}-${k}`}>
              <polygon points={quad("R", a, b, y0, y1)} fill={on ? GLOW : GLASS} />
              {!on && <polygon points={quad("R", a + (b - a) * 0.5, b, y0, y1)} fill={GLASS_SKY} opacity={0.55} />}
              <line x1={pt("R", (a + b) / 2, y0)[0]} y1={pt("R", (a + b) / 2, y0)[1]} x2={pt("R", (a + b) / 2, y1)[0]} y2={pt("R", (a + b) / 2, y1)[1]} stroke={STONE_LIT} strokeWidth={1.4} />
            </g>
          );
        }),
      )}

      {/* térreo: embasamento mais escuro e a entrada */}
      <polygon points={quad("L", 0, 1, BASE - GROUND, BASE)} fill="#000" opacity={0.12} />
      <polygon points={quad("R", 0, 1, BASE - GROUND, BASE)} fill="#000" opacity={0.07} />
      <polygon points={quad("R", RECESS[0], RECESS[1], BASE - GROUND + 10, BASE)} fill={GLASS} />
      <polygon points={quad("R", RECESS[0] - 0.03, RECESS[1] + 0.03, BASE - GROUND + 2, BASE - GROUND + 10)} fill="var(--accent, #dd4c38)" />

      {/* cornija e a aresta da quina */}
      <polygon points={quad("L", 0, 1, TOP, TOP + CORNICE)} fill="#9b9994" />
      <polygon points={quad("R", 0, 1, TOP, TOP + CORNICE)} fill="#b3b1ac" />
      <polygon points={quad("L", 0, 1, TOP, TOP + 5)} fill="#fff" opacity={0.35} />
      <polygon points={quad("R", 0, 1, TOP, TOP + 5)} fill="#fff" opacity={0.5} />
      <line x1={CX} y1={TOP} x2={CX} y2={BASE} stroke="#fff" strokeWidth={1.2} opacity={0.55} />
    </svg>
  );
}
