"use client";

// Duas direções de visual para o primeiro acesso, só na bancada (/dev/primeiro-acesso?tela=direcoes).
// Não mexem no fluxo real: são para escolher. Tudo em CSS e SVG, sem biblioteca nova.
//   ?direcao=agente|palco  &passo=welcome|project|connect|setup|building  &conectado=1
// Com "reduzir movimento", nada se mexe: as telas aparecem no estado final.

import { ArrowLeft, ArrowRight, Check, FolderPlus, LayoutTemplate, PlugZap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Odometer } from "@/components/ui/Odometer";
import { btn } from "@/components/ui/styles";
import { Mascot } from "@/features/agent/Mascot";
import { TemplatePreview } from "@/features/dashboards/TemplatePreview";
import { dashboardTemplate } from "@/features/templates/dashboards";

type Step = "welcome" | "project" | "connect" | "setup" | "building";
const STEPS: Step[] = ["welcome", "project", "connect", "setup", "building"];
const ACTION: Step[] = ["project", "connect", "setup"];
const LABEL: Record<Step, string> = { welcome: "Boas-vindas", project: "Projeto", connect: "Conectar", setup: "Contas e modelo", building: "Montando" };
const TEMPLATE = dashboardTemplate("vyz-ecommerce")!;

/** O que o agente diz em cada passo. */
const SPEECH: Record<Step, string> = {
  welcome: "Oi, Pedro! Eu sou o VYZ. Em três passos, seu cliente recebe um dashboard com os números reais dele.",
  project: "Primeiro, me diz quem é o cliente. Tudo o que você conectar fica dentro desse projeto.",
  connect: "Agora o login do Meta Ads e do Google Ads. Eu só leio os relatórios até você pedir para aplicar.",
  setup: "Estou trazendo os últimos 90 dias das contas que você marcar. Escolha também o visual.",
  building: "Montando o seu primeiro dashboard. Em segundos ele abre com os números de verdade.",
};
const SPEECH_CONNECTED = "Pronto! Meta Ads conectado. Quer conectar o Google Ads também?";

function useReduced() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Texto que aparece letra a letra (fala do agente); com "reduzir movimento", inteiro. */
function useTyped(text: string, reduced: boolean, speed = 18) {
  const [typed, setTyped] = useState({ text, n: 0 });
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setTyped((s) => (s.text !== text ? { text, n: 1 } : s.n >= text.length ? s : { text, n: s.n + 1 })), speed);
    return () => window.clearInterval(id);
  }, [text, reduced, speed]);
  const n = reduced ? text.length : typed.text === text ? typed.n : 0;
  return { shown: text.slice(0, n), done: n >= text.length };
}

/** Contagem viva de 0 até o alvo (importação dos 90 dias). */
function useCount(target: number, reduced: boolean, ms = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, ms]);
  return reduced ? target : v;
}

const CSS = `
@keyframes d-pop { 0% { opacity: 0; transform: translateY(14px) scale(.96) } 100% { opacity: 1; transform: none } }
@keyframes d-bubble { 0% { opacity: 0; transform: translateY(6px) scale(.9); transform-origin: 0 100% } 100% { opacity: 1; transform: none } }
@keyframes d-draw { to { stroke-dashoffset: 0 } }
@keyframes d-confetti { 0% { opacity: 1; transform: translate(0,0) rotate(0) } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--r)) } }
@keyframes d-grow { from { transform: scaleY(0) } }
@keyframes d-growx { from { transform: scaleX(0) } }
@keyframes d-pulse { 0%, 100% { opacity: .35 } 50% { opacity: 1 } }
@keyframes d-dash { to { stroke-dashoffset: -24 } }
@keyframes d-stage-in { 0% { opacity: 0; transform: translateX(24px) } 100% { opacity: 1; transform: none } }
@keyframes d-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes d-glow { 0%, 100% { opacity: .55 } 50% { opacity: .9 } }
.d-pop { animation: d-pop 520ms var(--ease) both }
.d-bubble { animation: d-bubble 380ms var(--ease) both }
.d-in { animation: d-stage-in 420ms var(--ease) both }
.d-float { animation: d-float 5s ease-in-out infinite }
.d-glow { animation: d-glow 4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) {
  .d-pop, .d-bubble, .d-in, .d-float, .d-glow, .d-anim, .d-anim * { animation: none !important; transition: none !important }
  .d-confetti { display: none }
}
`;

// ---- peças compartilhadas -----------------------------------------------------------

/** Check que se desenha (conectou). */
function CheckDraw({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden className="d-anim">
      <circle cx="22" cy="22" r="20" fill="var(--accent)" style={{ animation: "d-pop 380ms var(--ease) both" }} />
      <path d="M13 22.5 19.5 29 31 16" fill="none" stroke="var(--on-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset="30" style={{ animation: "d-draw 420ms 260ms var(--ease) forwards" }} />
    </svg>
  );
}

/** Confete leve: 14 pedaços em tons de oliva, uma vez. */
function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const d = 60 + (i % 3) * 22;
        return { dx: `${Math.cos(a) * d}px`, dy: `${Math.sin(a) * d - 20}px`, r: `${(i % 2 ? 1 : -1) * (120 + i * 17)}deg`, c: ["var(--accent)", "#d6e0aa", "#8a9a5b", "#f2f0e6"][i % 4], w: i % 3 ? 6 : 9 };
      }),
    [],
  );
  return (
    <span aria-hidden className="d-confetti pointer-events-none absolute inset-0 grid place-items-center">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-[2px]"
          style={{ width: b.w, height: 4, background: b.c, ["--dx" as string]: b.dx, ["--dy" as string]: b.dy, ["--r" as string]: b.r, animation: `d-confetti 900ms ${i * 18}ms cubic-bezier(.2,.7,.3,1) both` } as CSSProperties}
        />
      ))}
    </span>
  );
}

/** Importação dos 90 dias com contagem viva. */
function ImportLive({ reduced }: { reduced: boolean }) {
  const days = useCount(90, reduced, 1800);
  const campaigns = useCount(37, reduced, 1800);
  const rows = useCount(12480, reduced, 2000);
  return (
    <div className="rounded-card border border-accent/50 bg-accent-soft/30 p-4" aria-live="off">
      <p className="flex items-center justify-between text-[13px] text-fg-2">
        <span>Importando os últimos 90 dias</span>
        <span className="tnum font-semibold text-fg">{Math.round((days / 90) * 100)}%</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${(days / 90) * 100}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["dias", days],
          ["campanhas", campaigns],
          ["linhas de dados", rows],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-control bg-bg/60 px-2 py-2">
            <dd className="text-[19px] font-bold tnum text-fg">
              <Odometer value={(v as number).toLocaleString("pt-BR")} />
            </dd>
            <dt className="text-[11.5px] text-fg-2">{k}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A prévia do dashboard se montando ao vivo: cards, linha e funil. */
function LiveBuild({ big = false }: { big?: boolean }) {
  const kpis = [
    ["Investimento", "R$ 61,0 mil"],
    ["Receita", "R$ 163 mil"],
    ["ROAS", "2,7"],
    ["Vendas", "997"],
  ];
  const line = "M0,70 C30,62 50,40 80,46 C110,52 130,30 160,26 C190,22 210,38 240,30 C270,22 290,12 320,10";
  return (
    <div className={`d-anim rounded-[18px] border border-line bg-card ${big ? "p-5" : "p-3.5"}`} aria-hidden>
      <div className="flex items-center justify-between">
        <span className="w-12 text-accent">
          <Wordmark />
        </span>
        <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[10.5px] text-fg">Loja da Ana · Visão geral</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 @[420px]:grid-cols-4">
        {kpis.map(([k, v], i) => (
          <div key={k} className={`rounded-[10px] border p-2.5 ${i === 2 ? "border-transparent bg-accent text-on-accent" : "border-line bg-bg/50"}`} style={{ animation: `d-pop 460ms ${300 + i * 220}ms var(--ease) both` }}>
            <p className={`text-[9.5px] tracking-[0.08em] uppercase ${i === 2 ? "" : "text-fg-2"}`}>{k}</p>
            <p className={`mt-1 font-bold tnum ${big ? "text-[20px]" : "text-[16px]"}`}>{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[2fr_1fr] gap-2">
        <div className="rounded-[10px] border border-line bg-bg/50 p-2.5" style={{ animation: "d-pop 460ms 1200ms var(--ease) both" }}>
          <p className="text-[10px] text-fg-2">Custo por venda · média móvel 7 dias</p>
          <svg viewBox="0 0 320 80" className="mt-1 h-[70px] w-full" preserveAspectRatio="none">
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="420" strokeDashoffset="420" style={{ animation: "d-draw 1100ms 1350ms var(--ease) forwards" }} />
          </svg>
        </div>
        <div className="space-y-1.5 rounded-[10px] border border-line bg-bg/50 p-2.5" style={{ animation: "d-pop 460ms 1400ms var(--ease) both" }}>
          <p className="text-[10px] text-fg-2">Funil</p>
          {[100, 62, 38, 21].map((w, i) => (
            <span key={w} className="block h-2 origin-left rounded-full bg-accent" style={{ width: `${w}%`, opacity: 1 - i * 0.18, animation: `d-growx 600ms ${1550 + i * 150}ms var(--ease) both` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- estado da bancada ----------------------------------------------------------------

function useDemo() {
  const params = useSearchParams();
  const router = useRouter();
  const direcao = params.get("direcao") === "palco" ? "palco" : "agente";
  const passo = (STEPS as string[]).includes(params.get("passo") ?? "") ? (params.get("passo") as Step) : "welcome";
  const conectado = params.get("conectado") === "1";
  const go = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    router.replace(`?${q.toString()}`, { scroll: false });
  };
  return { direcao, passo, conectado, go };
}

/** Barra da bancada: escolher direção e passo (fica fora dos prints de cada direção, no topo). */
function DemoBar({ direcao, passo, go }: ReturnType<typeof useDemo>) {
  return (
    <div data-demo-bar className="fixed inset-x-0 top-0 z-[90] flex flex-wrap items-center gap-2 border-b border-line bg-bg/90 px-3 py-2 text-[12.5px] backdrop-blur">
      <span className="font-semibold text-fg">Direção</span>
      {(["agente", "palco"] as const).map((d) => (
        <button key={d} type="button" onClick={() => go({ direcao: d })} aria-pressed={direcao === d} className={`rounded-chip px-2.5 py-1 ${direcao === d ? "bg-accent font-semibold text-on-accent" : "border border-line text-fg-2"}`}>
          {d === "agente" ? "1 · Agente VYZ" : "2 · Palco"}
        </button>
      ))}
      <span className="ml-2 font-semibold text-fg">Passo</span>
      {STEPS.map((s) => (
        <button key={s} type="button" onClick={() => go({ passo: s, conectado: null })} aria-pressed={passo === s} className={`rounded-chip px-2.5 py-1 ${passo === s ? "bg-accent-soft font-semibold text-fg" : "text-fg-2"}`}>
          {LABEL[s]}
        </button>
      ))}
    </div>
  );
}

function nextOf(s: Step): Step {
  return STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(s) + 1)];
}
function prevOf(s: Step): Step | null {
  const i = STEPS.indexOf(s);
  return i > 0 ? STEPS[i - 1] : null;
}
const primaryLabel: Record<Step, string> = { welcome: "Começar", project: "Continuar", connect: "Continuar", setup: "Montar dashboard", building: "Abrindo…" };

// ---- conteúdo de cada passo (igual nas duas direções; muda a moldura) ------------------

function StepContent({ passo, conectado, onConnect, reduced, compact = false }: { passo: Step; conectado: boolean; onConnect: () => void; reduced: boolean; compact?: boolean }) {
  const [name, setName] = useState("Loja da Ana");
  if (passo === "welcome") {
    const items = [
      { icon: FolderPlus, text: "Crie o projeto do seu cliente" },
      { icon: PlugZap, text: "Conecte o Meta Ads e o Google Ads" },
      { icon: LayoutTemplate, text: "Escolha as contas e o modelo" },
    ];
    return (
      <ol className="space-y-2.5">
        {items.map(({ icon: Icon, text }, i) => (
          <li key={text} className="d-pop flex items-center gap-3 rounded-card border border-line bg-card/80 p-3.5" style={{ animationDelay: `${200 + i * 120}ms` }}>
            <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-accent-soft text-fg">
              <Icon size={18} />
            </span>
            <span className="text-[15px] text-fg">
              <span className="tnum mr-1.5 font-semibold text-fg-2">{i + 1}.</span>
              {text}
            </span>
          </li>
        ))}
      </ol>
    );
  }
  if (passo === "project") {
    return (
      <div className="space-y-4">
        <label className="block">
          <span className="text-[14px] font-medium text-fg">Nome do cliente</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Loja da Ana" className="mt-1.5 h-12 w-full rounded-control border border-line bg-field px-3.5 text-[16px] outline-none focus:border-accent" />
        </label>
        <div role="radiogroup" aria-label="Segmento" className="flex flex-wrap gap-2">
          {["E-commerce", "Geração de leads", "Imobiliário", "Negócio local", "Infoproduto"].map((b, i) => (
            <span key={b} role="radio" aria-checked={i === 0} className={`rounded-chip px-3 py-1.5 text-[13.5px] ${i === 0 ? "bg-accent font-semibold text-on-accent" : "border border-line text-fg-2"}`}>
              {b}
            </span>
          ))}
        </div>
        {!compact && (
          <div className="d-pop flex items-center gap-3 rounded-card border border-dashed border-accent/50 p-3 text-[13px] text-fg-2" style={{ animationDelay: "250ms" }}>
            <FolderPlus size={16} aria-hidden className="text-accent" /> O projeto <strong className="text-fg">{name || "…"}</strong> vai guardar as contas e os dashboards desse cliente.
          </div>
        )}
      </div>
    );
  }
  if (passo === "connect") {
    return (
      <ul className="space-y-3">
        {[
          { id: "meta", name: "Meta Ads", login: "Entre com o login do Facebook (Meta Business)." },
          { id: "google", name: "Google Ads", login: "Entre com a conta do Google." },
        ].map((p) => {
          const done = conectado && p.id === "meta";
          return (
            <li key={p.id} className={`relative flex items-center justify-between gap-3 overflow-visible rounded-card border p-4 transition-colors duration-300 ${done ? "border-accent bg-accent-soft/30" : "border-line bg-card/80"}`}>
              <div className="min-w-0">
                <p className="title text-[17px] text-fg">{p.name}</p>
                <p className="mt-0.5 text-[13px] text-fg-2">{done ? "Login: Pedro · 2 contas encontradas" : p.login}</p>
              </div>
              {done ? (
                <span className="relative grid size-11 shrink-0 place-items-center">
                  {!reduced && <Confetti />}
                  <CheckDraw />
                </span>
              ) : (
                <button type="button" onClick={p.id === "meta" ? onConnect : undefined} className={btn.small}>
                  <PlugZap size={15} aria-hidden /> Conectar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  }
  if (passo === "setup") {
    return (
      <div className="space-y-3">
        <ul className="space-y-2 rounded-card border border-line bg-card/80 p-3.5">
          {["Loja da Ana · Vendas", "Loja da Ana · Remarketing", "@lojadaana (Instagram)"].map((a, i) => (
            <li key={a}>
              <label className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" defaultChecked={i !== 1} /> {a}
              </label>
            </li>
          ))}
        </ul>
        <ImportLive reduced={reduced} />
      </div>
    );
  }
  return <LiveBuild />;
}

// ---- direção 1: Agente VYZ ------------------------------------------------------------

function Agente({ passo, conectado, go, reduced }: { passo: Step; conectado: boolean; go: (p: Record<string, string | null>) => void; reduced: boolean }) {
  const speech = passo === "connect" && conectado ? SPEECH_CONNECTED : SPEECH[passo];
  const typed = useTyped(speech, reduced);
  const n = ACTION.indexOf(passo) + 1;
  const prev = prevOf(passo);
  return (
    <div data-demo-pad className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-3 pt-14 pb-6">
      <div aria-hidden className="d-glow pointer-events-none absolute -top-40 left-1/2 size-[680px] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 28%, transparent), transparent)" }} />
      <section aria-labelledby="dir-titulo" data-direcao="agente" data-passo={passo} className="d-pop relative w-full max-w-[680px] overflow-hidden rounded-[28px] border border-line bg-[color-mix(in_srgb,var(--card)_88%,var(--accent)_12%)] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3 px-5 pt-5 sm:gap-4 sm:px-7 sm:pt-7">
          <span className="shrink-0">
            <Mascot size={58} state={typed.done ? "idle" : "speaking"} />
          </span>
          <div key={speech} className="d-bubble relative min-h-[64px] flex-1 rounded-[18px] rounded-tl-[6px] border border-line bg-bg/80 px-4 py-3 text-[15px] leading-snug text-fg">
            <span aria-hidden>{typed.shown}</span>
            {!typed.done && <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-accent" style={{ animation: "d-pulse 800ms infinite" }} />}
            <span className="sr-only">{speech}</span>
          </div>
        </div>
        <div className="px-5 pt-4 sm:px-7">
          <div className="flex items-center gap-2">
            {ACTION.map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${n > i || passo === "building" ? "bg-accent" : "bg-line"}`} />
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-fg-2">{passo === "welcome" ? "Boas-vindas · 3 passos" : passo === "building" ? "Quase lá" : `Passo ${n} de 3 · ${LABEL[passo]}`}</p>
        </div>
        <div key={passo} className="d-in px-5 py-5 sm:px-7">
          <h2 id="dir-titulo" className="sr-only">
            {LABEL[passo]}
          </h2>
          <StepContent passo={passo} conectado={conectado} onConnect={() => go({ conectado: "1" })} reduced={reduced} />
        </div>
        {passo !== "building" && (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-4 sm:px-7">
            <button type="button" className="px-2 text-[14px] font-medium text-fg-2 hover:text-fg">
              Pular por agora
            </button>
            <div className="flex gap-2">
              {prev && (
                <button type="button" onClick={() => go({ passo: prev, conectado: null })} className={btn.ghost}>
                  <ArrowLeft size={16} aria-hidden /> Voltar
                </button>
              )}
              <button type="button" onClick={() => go({ passo: nextOf(passo), conectado: null })} className={btn.primary}>
                {primaryLabel[passo]} <ArrowRight size={18} aria-hidden />
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}

// ---- direção 2: Palco -----------------------------------------------------------------

function HubArt({ conectado, reduced }: { conectado: boolean; reduced: boolean }) {
  const nodes = [
    { id: "meta", label: "Meta Ads", x: 70, y: 70, on: conectado },
    { id: "google", label: "Google Ads", x: 70, y: 230, on: false },
    { id: "ga4", label: "GA4", x: 330, y: 70, on: false },
    { id: "crm", label: "CRM", x: 330, y: 230, on: false },
  ];
  return (
    <svg viewBox="0 0 400 300" className="w-full max-w-[520px]" aria-hidden>
      {nodes.map((n) => (
        <path key={n.id} d={`M${n.x},${n.y} L200,150`} stroke={n.on ? "var(--accent)" : "color-mix(in srgb, var(--fg) 20%, transparent)"} strokeWidth={n.on ? 3 : 1.5} strokeDasharray={n.on ? "6 6" : "3 6"} style={n.on && !reduced ? { animation: "d-dash 700ms linear infinite" } : undefined} />
      ))}
      <circle cx="200" cy="150" r="46" fill="var(--accent)" className="d-glow" opacity=".18" />
      <circle cx="200" cy="150" r="34" fill="var(--card)" stroke="var(--accent)" strokeWidth="2" />
      <text x="200" y="156" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--accent)">
        VYZ
      </text>
      {nodes.map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r="26" fill={n.on ? "var(--accent)" : "var(--card)"} stroke={n.on ? "var(--accent)" : "var(--line)"} strokeWidth="2" />
          {n.on && <path d={`M${n.x - 8},${n.y} l5,6 l11,-12`} fill="none" stroke="var(--on-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset={reduced ? 0 : 30} style={reduced ? undefined : { animation: "d-draw 420ms 200ms var(--ease) forwards" }} />}
          <text x={n.x} y={n.y + 44} textAnchor="middle" fontSize="12.5" fill="var(--fg)">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function StageVisual({ passo, conectado, reduced }: { passo: Step; conectado: boolean; reduced: boolean }) {
  if (passo === "welcome")
    return (
      <div className="w-full max-w-[560px] text-center">
        <span className="mx-auto block w-40 text-accent">
          <Wordmark />
        </span>
        <p className="display mt-6 text-[clamp(1.6rem,3.2vw,2.6rem)] leading-[1.05] text-fg">O mês do seu cliente, num link que ele entende.</p>
        <div className="d-float mx-auto mt-8 max-w-[460px] @container">
          <LiveBuild />
        </div>
      </div>
    );
  if (passo === "project")
    return (
      <div className="d-float w-full max-w-[420px] rounded-[22px] border border-line bg-card p-6 shadow-[0_30px_70px_rgba(0,0,0,0.35)]">
        <p className="label-caps text-fg-2">Projeto</p>
        <p className="display mt-2 text-[34px] text-fg">Loja da Ana</p>
        <div className="mt-5 space-y-2">
          {["Contas de anúncio", "Dashboards", "Links para o cliente"].map((k, i) => (
            <div key={k} className="flex items-center justify-between rounded-control border border-dashed border-line px-3 py-2.5 text-[13.5px] text-fg-2">
              {k}
              <span className="text-[12px]">{i === 0 ? "no próximo passo" : "em seguida"}</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (passo === "connect") return <HubArt conectado={conectado} reduced={reduced} />;
  if (passo === "setup")
    return (
      <div className="d-float w-full max-w-[640px] overflow-hidden rounded-[18px] border border-line bg-card shadow-[0_30px_70px_rgba(0,0,0,0.35)]">
        <div style={{ width: 760, transform: "scale(var(--s, .82))", transformOrigin: "0 0", height: 430 }} className="[--s:.5] sm:[--s:.82]">
          <TemplatePreview t={TEMPLATE} page={TEMPLATE.pages[0]} variant="full" />
        </div>
      </div>
    );
  return (
    <div className="@container w-full max-w-[620px]">
      <LiveBuild big />
    </div>
  );
}

function Palco({ passo, conectado, go, reduced }: { passo: Step; conectado: boolean; go: (p: Record<string, string | null>) => void; reduced: boolean }) {
  const n = ACTION.indexOf(passo) + 1;
  const prev = prevOf(passo);
  const title: Record<Step, string> = {
    welcome: "Boas-vindas, Pedro.",
    project: "Qual é o primeiro cliente?",
    connect: conectado ? "Meta Ads conectado." : "Conecte as contas de anúncio",
    setup: "Escolha as contas e o modelo",
    building: "Montando seu dashboard…",
  };
  return (
    <section aria-labelledby="dir-titulo" data-direcao="palco" data-passo={passo} data-demo-pad className="grid min-h-dvh overflow-x-clip bg-bg pt-11 lg:grid-cols-[1.15fr_1fr]">
      {/* o palco: a prévia grande de cada passo */}
      <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden px-6 py-8 lg:min-h-0" style={{ background: "radial-gradient(120% 90% at 30% 20%, color-mix(in srgb, var(--accent) 30%, var(--bg)), var(--bg) 70%)" }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(var(--fg) 1px, transparent 1px), linear-gradient(90deg, var(--fg) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
        <div key={passo} className="d-in relative flex w-full justify-center">
          <StageVisual passo={passo} conectado={conectado} reduced={reduced} />
        </div>
      </div>
      {/* o conteúdo */}
      <div className="flex flex-col border-line px-5 py-8 sm:px-10 lg:border-l lg:py-12">
        <ol aria-label="Passos" className="flex gap-4 text-[13px]">
          {ACTION.map((s, i) => {
            const done = n > i + 1 || passo === "building";
            const on = n === i + 1;
            return (
              <li key={s} className={`flex items-center gap-2 ${on ? "font-semibold text-fg" : done ? "text-fg" : "text-fg-2"}`}>
                <span className={`grid size-6 place-items-center rounded-full text-[11.5px] ${done ? "bg-accent text-on-accent" : on ? "border-2 border-accent text-fg" : "border border-line"}`}>{done ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
                <span className="hidden sm:inline">{LABEL[s]}</span>
              </li>
            );
          })}
        </ol>
        <div key={passo} className="d-in mt-8 flex-1">
          <h2 id="dir-titulo" className="display text-[clamp(1.8rem,3.4vw,2.6rem)] leading-[1.05] text-fg">
            {title[passo]}
          </h2>
          <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-fg-2">{passo === "connect" && conectado ? SPEECH_CONNECTED : SPEECH[passo]}</p>
          <div className="mt-6">
            <StepContent passo={passo} conectado={conectado} onConnect={() => go({ conectado: "1" })} reduced={reduced} compact />
          </div>
        </div>
        {passo !== "building" && (
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="px-2 text-[14px] font-medium text-fg-2 hover:text-fg">
              Pular por agora
            </button>
            <div className="flex gap-2">
              {prev && (
                <button type="button" onClick={() => go({ passo: prev, conectado: null })} className={btn.ghost}>
                  <ArrowLeft size={16} aria-hidden /> Voltar
                </button>
              )}
              <button type="button" onClick={() => go({ passo: nextOf(passo), conectado: null })} className={btn.primary}>
                {primaryLabel[passo]} <ArrowRight size={18} aria-hidden />
              </button>
            </div>
          </footer>
        )}
      </div>
    </section>
  );
}

export function Direcoes() {
  const demo = useDemo();
  const reduced = useReduced();
  const view: ReactNode = demo.direcao === "palco" ? <Palco {...demo} reduced={reduced} /> : <Agente {...demo} reduced={reduced} />;
  return (
    <>
      <style>{CSS}</style>
      <DemoBar {...demo} />
      {view}
    </>
  );
}
