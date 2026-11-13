"use client";

// O palco: a prévia grande de cada passo, à esquerda (no celular, um banner no topo).
// Boas-vindas: o resultado primeiro. Projeto: o cartão do cliente. Conectar e Contas: o VYZ
// ligado às plataformas. Modelo: o modelo escolhido, com o nome do cliente. Montando: a
// prévia se montando.

import { useSyncExternalStore } from "react";
import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { TemplatePreview, TemplateThumb } from "@/features/dashboards/TemplatePreview";
import type { ProviderId } from "@/features/integrations/providers";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import type { DashboardTemplate } from "@/features/templates/types";
import type { ActiveStep } from "../steps";
import { BuildPreview } from "./BuildPreview";
import { useDeferred } from "./useDeferred";

export type StageInfo = {
  step: ActiveStep;
  building: boolean;
  /** O nome do cliente (o digitado no passo 1); sem nome, "Seu cliente". */
  client: string;
  segment: string | null;
  connected: readonly ProviderId[];
  /** Acabou de voltar do login desta plataforma (o nó desenha o check). */
  justConnected: ProviderId | null;
  template: DashboardTemplate | null;
  /** 03 Contas: as contas marcadas agora (os cartões entram na prévia). */
  marked?: readonly { id: string; name: string; platformId: PlatformId }[];
};

function ClientCard({ client, segment, compact = false }: { client: string; segment: string | null; compact?: boolean }) {
  return (
    <div className={`fa-float w-full rounded-[22px] border border-line bg-card shadow-[0_30px_70px_rgba(0,0,0,0.3)] ${compact ? "max-w-[300px] p-4" : "max-w-[420px] p-6"}`} data-stage-client>
      <p className="label-caps text-fg-2">Projeto</p>
      <p className={`display mt-1.5 truncate text-fg ${compact ? "text-[24px]" : "text-[36px]"}`}>{client}</p>
      {segment && <span className="mt-2 inline-block rounded-chip bg-accent px-2.5 py-0.5 text-[12px] font-semibold text-on-accent">{segment}</span>}
      {!compact && (
        <div className="mt-5 space-y-2">
          {["Contas de anúncio", "Dashboards", "Links para o cliente"].map((k, i) => (
            <div key={k} className="flex items-center justify-between rounded-control border border-dashed border-line px-3 py-2.5 text-[13.5px] text-fg-2">
              {k}
              <span className="text-[12px]">{i === 0 ? "no próximo passo" : "em seguida"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Hub({ connected, justConnected, compact = false }: { connected: readonly ProviderId[]; justConnected: ProviderId | null; compact?: boolean }) {
  const nodes = [
    { id: "meta", label: "Meta Ads", x: 70, y: 70 },
    { id: "google", label: "Google Ads", x: 70, y: 230 },
    { id: "ga4", label: "GA4", x: 330, y: 70, extra: true },
    { id: "crm", label: "CRM", x: 330, y: 230, extra: true },
  ];
  return (
    <svg viewBox="0 0 400 300" className={`fa-anim w-full ${compact ? "max-w-[300px]" : "max-w-[520px]"}`} aria-hidden data-stage-hub>
      {nodes.map((n) => {
        const on = connected.includes(n.id as ProviderId);
        return (
          <path
            key={n.id}
            d={`M${n.x},${n.y} L200,150`}
            stroke={on ? "var(--accent)" : "color-mix(in srgb, var(--fg) 20%, transparent)"}
            strokeWidth={on ? 3 : 1.5}
            strokeDasharray={on ? "6 6" : "3 6"}
            style={on ? { animation: "fa-dash 700ms linear infinite" } : undefined}
          />
        );
      })}
      <circle cx="200" cy="150" r="46" fill="var(--accent)" opacity=".16" />
      <circle cx="200" cy="150" r="34" fill="var(--card)" stroke="var(--accent)" strokeWidth="2" />
      <text x="200" y="156" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--accent)">
        VYZ
      </text>
      {nodes.map((n) => {
        const on = connected.includes(n.id as ProviderId);
        const fresh = justConnected === n.id;
        return (
          <g key={n.label} data-node={n.id} data-on={on || undefined}>
            <circle cx={n.x} cy={n.y} r="26" fill={on ? "var(--accent)" : "var(--card)"} stroke={on ? "var(--accent)" : "var(--line)"} strokeWidth="2" opacity={n.extra ? 0.7 : 1} />
            {on && (
              <path
                d={`M${n.x - 9},${n.y} l5.5,6.5 l12,-13`}
                fill="none"
                stroke="var(--on-accent)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="30"
                strokeDashoffset={fresh ? 30 : 0}
                style={fresh ? { animation: "fa-draw 420ms 200ms var(--ease) forwards" } : undefined}
              />
            )}
            <text x={n.x} y={n.y + 44} textAnchor="middle" fontSize="12.5" fill="var(--fg)" opacity={n.extra ? 0.7 : 1}>
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Visual({ info, compact }: { info: StageInfo; compact: boolean }) {
  const { step, building, client, segment, connected, justConnected, template } = info;
  if (building) return <BuildPreview client={client} compact={compact} />;
  if (step === "welcome")
    return (
      <div className={`w-full ${compact ? "max-w-[340px]" : "max-w-[560px]"}`}>
        {!compact && <p className="display text-center text-[clamp(1.5rem,2.6vw,2.2rem)] leading-[1.08] text-fg">O mês do seu cliente, num link que ele entende.</p>}
        <div className={`fa-float ${compact ? "" : "mt-6"}`}>
          <BuildPreview client={client} compact={compact} />
        </div>
        <p className={`text-center text-fg-2 ${compact ? "mt-2 text-[12px]" : "mt-4 text-[14px]"}`} data-stage-promise>
          Em ~2 minutos, isto aqui com os números reais.
        </p>
      </div>
    );
  if (step === "project") return <ClientCard client={client} segment={segment} compact={compact} />;
  if (step === "connect") return <Hub connected={connected} justConnected={justConnected} compact={compact} />;
  if (step === "setup") return <AccountsPreview client={client} marked={info.marked ?? []} compact={compact} />;
  if (step === "model" && template) return <SetupPreview template={template} client={client} compact={compact} />;
  return null;
}

/**
 * 03 Contas: a prévia do dashboard recebendo as contas marcadas. Cada cartão (plataforma e
 * nome) entra quando a conta é marcada e sai quando é desmarcada; os números ficam em
 * esqueleto (nada inventado no primeiro acesso).
 */
function AccountsPreview({ client, marked, compact }: { client: string; marked: readonly { id: string; name: string; platformId: PlatformId }[]; compact: boolean }) {
  const shown = marked.slice(0, compact ? 3 : 6);
  const rest = marked.length - shown.length;
  return (
    <div className={`w-full rounded-[18px] border border-line bg-card shadow-[0_30px_70px_rgba(0,0,0,0.3)] ${compact ? "max-w-[340px] p-2.5" : "max-w-[520px] p-4 sm:p-5"}`} aria-hidden data-stage-accounts>
      <div className="flex items-center justify-between gap-2">
        <p className={`label-caps text-fg-2 ${compact ? "text-[9px]" : ""}`}>Contas no dashboard</p>
        <span className="truncate rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-fg">{client} · Visão geral</span>
      </div>
      <ul className={`mt-3 grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
        {shown.map((a) => (
          // a key é a conta: só a recém-marcada anima ao entrar
          <li key={a.id} className="fa-pop flex min-w-0 items-center gap-2 rounded-[10px] border border-accent/60 bg-accent-soft/40 px-2.5 py-2" data-stage-account>
            <span className="shrink-0 rounded-[6px] bg-accent px-1.5 py-0.5 text-[10px] font-bold text-on-accent">{PLATFORMS[a.platformId]?.short ?? a.platformId}</span>
            <span className={`truncate font-medium text-fg ${compact ? "text-[11.5px]" : "text-[12.5px]"}`}>{a.name}</span>
          </li>
        ))}
        {rest > 0 && <li className="rounded-[10px] border border-dashed border-line px-2.5 py-2 text-[12px] text-fg-2">+ {rest} {rest === 1 ? "conta" : "contas"}</li>}
        {!shown.length && <li className={`rounded-[10px] border border-dashed border-line px-2.5 py-2 text-fg-2 ${compact ? "col-span-1 text-[11.5px]" : "col-span-2 text-[12.5px]"}`}>Marque as contas: elas entram aqui.</li>}
      </ul>
      <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-4"}`}>
        {["Investimento", "Receita", "ROAS", "Vendas"].map((k, i) => (
          <div key={k} className={`rounded-[10px] border p-2 ${i === 2 ? "border-transparent bg-accent/80" : "border-line bg-bg/50"}`}>
            <p className={`truncate text-[9px] tracking-[0.08em] uppercase ${i === 2 ? "text-on-accent" : "text-fg-2"}`}>{k}</p>
            <span className={`mt-1.5 block h-2 rounded-full ${i === 2 ? "bg-on-accent/50" : "bg-fg-2/25"} ${marked.length ? "" : "opacity-40"}`} style={{ width: `${70 - i * 8}%` }} />
          </div>
        ))}
      </div>
      {!compact && (
        <div className="mt-2 h-[86px] rounded-[10px] border border-line bg-bg/50 p-2.5">
          <span className={`block h-full rounded-[6px] bg-gradient-to-t from-accent/25 to-transparent transition-opacity duration-500 ${marked.length ? "opacity-100" : "opacity-30"}`} />
        </div>
      )}
    </div>
  );
}

/** A prévia grande do modelo escolhido: pesada, entra depois de o passo aparecer (esqueleto até lá). */
function SetupPreview({ template, client, compact }: { template: DashboardTemplate; client: string; compact: boolean }) {
  const ready = useDeferred(0);
  if (!ready)
    return (
      <div aria-hidden data-preview-skeleton className={`w-full max-w-[640px] rounded-[16px] border border-line bg-card p-4 ${compact ? "h-[150px]" : "h-[430px]"}`}>
        <span className="block h-3 w-1/3 rounded-full bg-line/80" />
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`block h-14 rounded-[8px] ${i === 2 ? "bg-accent/35" : "bg-line/60"}`} />
          ))}
        </div>
        {!compact && <span className="mt-3 block h-[300px] rounded-[10px] bg-line/40" />}
      </div>
    );
  return (
      <div className="relative w-full max-w-[640px]">
        <div className="overflow-hidden rounded-[16px] border border-line bg-card shadow-[0_30px_70px_rgba(0,0,0,0.3)]">
          {compact ? (
            <TemplateThumb t={template} height={150} client={client} />
          ) : (
            <ScaledPreview height={430} width={template.skin ? 1100 : 760}>
              <div inert>
                <TemplatePreview t={template} variant="full" client={client} />
              </div>
            </ScaledPreview>
          )}
        </div>
        <span className="absolute top-2 right-2 rounded-chip bg-bg/90 px-2 py-0.5 text-[11px] text-fg-2 backdrop-blur">Prévia com dados de exemplo</span>
      </div>
  );
}

const LG = "(min-width: 1024px)";
function useLg() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(LG);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(LG).matches,
    () => false,
  );
}

/** O palco inteiro: grande no desktop, banner no celular (cada um com a sua versão). */
export function StageVisual({ info }: { info: StageInfo }) {
  const key = info.building ? "building" : info.step;
  const lg = useLg();
  // a prévia do modelo é pesada: desenha só a versão da tela atual (as outras são leves e trocam pelo CSS)
  const heavy = key === "model";
  return (
    <div
      className="relative flex h-full min-h-0 items-center justify-center overflow-hidden px-5 py-5 lg:px-10"
      style={{ background: "radial-gradient(120% 90% at 30% 20%, color-mix(in srgb, var(--accent) 26%, var(--bg)), var(--bg) 72%)" }}
      data-stage={key}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(var(--fg) 1px, transparent 1px), linear-gradient(90deg, var(--fg) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
      {heavy ? (
        <div key={`${key}-${lg}`} className="fa-in relative flex w-full justify-center">
          <Visual info={info} compact={!lg} />
        </div>
      ) : (
        <>
          <div key={key} className="fa-in relative flex w-full justify-center lg:hidden">
            <Visual info={info} compact />
          </div>
          <div key={`${key}-lg`} className="fa-in relative hidden w-full justify-center lg:flex">
            <Visual info={info} compact={false} />
          </div>
        </>
      )}
    </div>
  );
}
