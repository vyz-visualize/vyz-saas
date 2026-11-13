"use client";

// Boas-vindas: os 4 passos como uma jornada, não uma lista. Cada painel tem o número grande,
// o tempo estimado e uma mini-animação do que acontece nele; acendem um depois do outro em
// loop suave (CSS: .fa-journey em globals.css). Com "reduzir movimento", todos acesos e parados.

import type { CSSProperties, ReactNode } from "react";

function ProjectMini() {
  return (
    <div className="rounded-[10px] border border-line bg-bg/60 p-2.5">
      <p className="text-[9.5px] tracking-[0.08em] text-fg-2 uppercase">Cliente</p>
      <p className="mt-0.5 h-[1.3em] overflow-hidden text-[14px] font-semibold text-fg">
        <span className="fa-type inline-block overflow-hidden align-top whitespace-nowrap">Seu cliente</span>
      </p>
      <span className="fa-chip mt-1.5 inline-block rounded-chip bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-on-accent">E-commerce</span>
    </div>
  );
}

function ConnectMini() {
  return (
    <svg viewBox="0 0 200 74" className="h-[74px] w-full" aria-hidden>
      <path className="fa-wire" d="M44,20 C80,20 90,37 100,37" fill="none" strokeWidth="2.5" />
      <path className="fa-wire" d="M44,54 C80,54 90,37 100,37" fill="none" strokeWidth="2.5" style={{ animationDelay: "calc(var(--fa-d, 0s) + 0.35s)" }} />
      <rect x="4" y="9" width="44" height="22" rx="11" fill="var(--card)" stroke="var(--line)" />
      <text x="26" y="24" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--fg)">
        Meta
      </text>
      <rect x="4" y="43" width="44" height="22" rx="11" fill="var(--card)" stroke="var(--line)" />
      <text x="26" y="58" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--fg)">
        Google
      </text>
      <circle cx="122" cy="37" r="22" fill="var(--accent)" />
      <text x="122" y="41.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--on-accent)">
        VYZ
      </text>
      <path d="M144,37 H196" stroke="var(--line)" strokeWidth="2" strokeDasharray="3 5" />
    </svg>
  );
}

function AccountsMini() {
  const rows = ["Loja · Meta Ads", "Instagram", "Página do Facebook"];
  return (
    <ul className="h-[74px] space-y-1.5 rounded-[10px] border border-line bg-bg/60 p-2">
      {rows.map((r, i) => (
        <li key={r} className="flex items-center gap-1.5 text-[10.5px] text-fg">
          <span className={`fa-chip grid size-3.5 shrink-0 place-items-center rounded-[4px] ${i < 2 ? "bg-accent text-on-accent" : "border border-line"}`} style={{ animationDelay: `calc(var(--fa-d, 0s) + ${i * 0.25}s)` }}>
            {i < 2 && (
              <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
                <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="truncate">{r}</span>
        </li>
      ))}
    </ul>
  );
}

function BuildMini() {
  const bars = [46, 70, 38, 88, 60, 74];
  return (
    <div className="grid h-[74px] grid-cols-[1fr_1.4fr] gap-2 rounded-[10px] border border-line bg-bg/60 p-2">
      <div className="space-y-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`block h-3.5 rounded-[4px] ${i === 1 ? "bg-accent" : "bg-fg-2/25"}`} />
        ))}
      </div>
      <div className="flex items-end gap-1">
        {bars.map((h, i) => (
          <span key={i} className="fa-bar flex-1 rounded-t-[3px] bg-accent" style={{ height: `${h}%`, ["--fa-b" as string]: `${i * 0.08}s` } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

const STEPS: { n: string; title: string; text: string; time: string; art: ReactNode }[] = [
  { n: "01", title: "Workspace", text: "O nome do cliente e o segmento.", time: "30 s", art: <ProjectMini /> },
  { n: "02", title: "Conectar", text: "O login do Meta Ads e do Google Ads.", time: "1 min", art: <ConnectMini /> },
  { n: "03", title: "Contas", text: "As contas, o Instagram e a Página que entram.", time: "20 s", art: <AccountsMini /> },
  { n: "04", title: "Modelo", text: "O visual do dashboard, sugerido pelo objetivo.", time: "20 s", art: <BuildMini /> },
];

export function Journey() {
  return (
    <ol className="fa-journey grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Os 4 passos" data-journey>
      {STEPS.map((s, i) => (
        <li key={s.n} className="flex flex-col gap-2.5 rounded-card border border-line p-3.5" style={{ ["--fa-d" as string]: `${i * 2.5}s` } as CSSProperties}>
          <div className="flex items-start justify-between gap-2">
            <span aria-hidden className="fa-num text-[44px] leading-[0.9] font-black tracking-[-0.04em] tnum">
              {s.n}
            </span>
            <span className="rounded-chip border border-line px-2 py-0.5 text-[11.5px] text-fg-2">{s.time}</span>
          </div>
          <div>
            <p className="font-semibold text-fg">
              <span className="sr-only">Passo {i + 1}: </span>
              {s.title}
            </p>
            <p className="text-[12.5px] leading-snug text-fg-2">{s.text}</p>
          </div>
          <div aria-hidden className="mt-auto">
            {s.art}
          </div>
        </li>
      ))}
    </ol>
  );
}
