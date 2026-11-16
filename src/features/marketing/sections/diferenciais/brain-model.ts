// O "cérebro de dados" da dobra Diferenciais: uma nuvem de pontos com a silhueta de um cérebro
// (visto de lado, a frente à esquerda) e as conexões entre vizinhos. Gerado com semente fixa:
// o servidor e o navegador desenham exatamente o mesmo (sem descompasso na hidratação).
//
// Três regiões, da esquerda para a direita, com os rótulos do desenho:
// 0 = entrada, 1 = núcleo, 2 = saída.

export type Region = 0 | 1 | 2;
export type BrainNode = { x: number; y: number; z: number; region: Region; r: number };
export type Brain = {
  nodes: BrainNode[];
  edges: [number, number][];
  /** Nós de entrada (um por plataforma, de cima para baixo) e o nó de saída. */
  entries: number[];
  exit: number;
  /** Caminho mais curto de cada entrada até a saída (índices dos nós). */
  paths: number[][];
  /** Contorno da silhueta (path SVG, no espaço do cérebro). */
  outline: string;
  /** Sulcos (giros) para recortar dentro do contorno: dá a leitura de "cérebro". */
  gyri: string[];
};

/** PRNG pequeno e determinístico (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/**
 * Silhueta no espaço 0..400 × 0..290: cérebro (lobos frontal, parietal e occipital), cerebelo
 * e tronco. Uma união de elipses dá um contorno orgânico sem desenho à mão.
 */
function insideBrain(x: number, y: number): boolean {
  const cerebrum =
    (inEllipse(x, y, 200, 120, 165, 100) && y < 205) || inEllipse(x, y, 95, 140, 70, 78) || inEllipse(x, y, 305, 125, 80, 92) || inEllipse(x, y, 200, 70, 120, 55);
  const cerebellum = inEllipse(x, y, 290, 220, 62, 36);
  const stem = x > 228 && x < 262 && y > 190 && y < 282 - Math.abs(x - 245) * 0.6;
  return cerebrum || cerebellum || stem;
}

/** Profundidade (z) na casca: os pontos ficam perto da superfície, como um cérebro de verdade. */
function depthFor(x: number, y: number, rand: () => number): number {
  const nx = (x - 200) / 180;
  const ny = (y - 130) / 120;
  const shell = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const side = rand() < 0.5 ? -1 : 1;
  return side * shell * (0.7 + rand() * 0.3) * 110;
}

export function buildBrain({ seed = 7, count = 170, minDist = 17, neighbors = 3, maxEdge = 46 } = {}): Brain {
  const rand = rng(seed);
  const nodes: BrainNode[] = [];
  let tries = 0;
  while (nodes.length < count && tries < 20_000) {
    tries++;
    const x = 20 + rand() * 360;
    const y = 15 + rand() * 270;
    if (!insideBrain(x, y)) continue;
    if (nodes.some((n) => (n.x - x) ** 2 + (n.y - y) ** 2 < minDist * minDist)) continue;
    const region: Region = x < 145 ? 0 : x < 265 ? 1 : 2;
    nodes.push({ x, y, z: depthFor(x, y, rand), region, r: rand() < 0.18 ? 3 : 2 });
  }

  // conexões: cada nó com os vizinhos mais próximos (sem duplicar)
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  const adj: number[][] = nodes.map(() => []);
  nodes.forEach((n, i) => {
    const near = nodes
      .map((m, j) => ({ j, d: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 }))
      .filter((o) => o.j !== i && o.d <= maxEdge * maxEdge)
      .sort((a, b) => a.d - b.d)
      .slice(0, neighbors);
    for (const { j } of near) {
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push([i, j]);
      adj[i].push(j);
      adj[j].push(i);
    }
  });

  // entradas: os nós mais à esquerda perto de 4 alturas; saída: o mais à direita no meio
  const pick = (score: (n: BrainNode) => number, skip: Set<number>) => {
    let best = -1;
    nodes.forEach((n, i) => {
      if (skip.has(i) || adj[i].length === 0) return;
      if (best < 0 || score(n) < score(nodes[best])) best = i;
    });
    return best;
  };
  const used = new Set<number>();
  const entries = [80, 120, 160, 200].map((y) => {
    const i = pick((n) => n.x + Math.abs(n.y - y) * 1.6, used);
    used.add(i);
    return i;
  });
  const exit = pick((n) => -n.x + Math.abs(n.y - 130) * 1.2, used);

  // caminho mais curto (em saltos) de cada entrada até a saída
  const bfs = (from: number): number[] => {
    const prev = new Array<number>(nodes.length).fill(-1);
    const queue = [from];
    prev[from] = from;
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === exit) break;
      for (const nx of adj[cur]) {
        if (prev[nx] >= 0) continue;
        prev[nx] = cur;
        queue.push(nx);
      }
    }
    if (prev[exit] < 0) return [from, exit];
    const path = [exit];
    while (path[0] !== from) path.unshift(prev[path[0]]);
    return path;
  };
  const paths = entries.map(bfs);
  return { nodes, edges, entries, exit, paths, outline: outlinePath(), gyri: gyriPaths(rand) };
}

/**
 * Contorno: de um centro, o raio máximo dentro da silhueta em cada ângulo, alisado com
 * curvas quadráticas pelos pontos médios.
 */
function outlinePath(steps = 120): string {
  const cx = 200;
  const cy = 135;
  const pts: [number, number][] = [];
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    let r = 0;
    for (let d = 0; d < 260; d += 1.5) if (insideBrain(cx + Math.cos(a) * d, cy + Math.sin(a) * d)) r = d;
    pts.push([cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6)]);
  }
  const mid = (i: number) => {
    const [x1, y1] = pts[i % steps];
    const [x2, y2] = pts[(i + 1) % steps];
    return [(x1 + x2) / 2, (y1 + y2) / 2];
  };
  let d = `M${mid(0)[0].toFixed(1)},${mid(0)[1].toFixed(1)}`;
  for (let i = 1; i <= steps; i++) {
    const [x, y] = pts[i % steps];
    const [mx, my] = mid(i);
    d += ` Q${x.toFixed(1)},${y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  return d + " Z";
}

/** Sulcos: curvas onduladas e quase horizontais, recortadas pelo contorno ao desenhar. */
function gyriPaths(rand: () => number): string[] {
  const out: string[] = [];
  for (let k = 0; k < 7; k++) {
    const y0 = 35 + k * 27 + rand() * 8;
    const amp = 6 + rand() * 7;
    const freq = 0.035 + rand() * 0.02;
    const phase = rand() * Math.PI * 2;
    let d = "";
    for (let x = 10; x <= 395; x += 6) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase) * (amp / 3);
      d += `${x === 10 ? "M" : "L"}${x},${y.toFixed(1)} `;
    }
    out.push(d.trim());
  }
  return out;
}

/** O mesmo cérebro para todos (o cálculo roda uma vez por carga do módulo). */
export const BRAIN = buildBrain();
