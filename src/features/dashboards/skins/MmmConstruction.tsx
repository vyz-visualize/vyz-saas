"use client";

// MMM em construção (dados reais): até o modelo de verdade existir, a tela não mostra contribuição,
// ROI, curva de resposta nem redistribuição. Mostra, por cliente (projeto), o que falta para o
// modelo ser treinado e o histórico real de investimento por canal e mês.

import { Check, Hammer, Plug, X } from "lucide-react";
import Link from "next/link";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { MMM_MIN_MONTHS, OUTCOME_LABEL, type ChannelReadiness, type MmmReadinessData, type ProjectReadiness } from "@/features/mmm/readiness";
import { brlCompact } from "@/lib/format";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;
const channelName = (id: string) => (id in PLATFORMS ? PLATFORMS[id as PlatformId].name : id);
const reais = (v: number) => brlCompact(Math.round(v * 100));

function Item({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-t border-line py-3 first:border-t-0" data-criterio-ok={ok ? "sim" : "nao"}>
      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${ok ? "bg-accent text-on-accent" : "bg-error-soft text-error-fg"}`} aria-label={ok ? "Cumpre" : "Falta"}>
        {ok ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-fg">{title}</p>
        <div className="mt-1 space-y-1 text-[12.5px] text-fg-2">{children}</div>
      </div>
    </li>
  );
}

function historyLine(c: ChannelReadiness) {
  if (c.months >= MMM_MIN_MONTHS) return `${c.months} meses com investimento (${monthLabel(c.first!)} a ${monthLabel(c.last!)})`;
  const missing = MMM_MIN_MONTHS - c.months;
  if (c.readyOn) return `${c.months} ${c.months === 1 ? "mês" : "meses"}: faltam ${missing}. Se continuar investindo, cumpre em ${monthLabel(c.readyOn)}.`;
  return `${c.months} ${c.months === 1 ? "mês" : "meses"}: faltam ${missing}. Sem investimento desde ${monthLabel(c.last!)}: sem previsão.`;
}

/** Investimento por mês de cada canal (dado real), do mais antigo ao mais recente, na mesma escala. */
function SpendHistory({ p }: { p: ProjectReadiness }) {
  const all = p.channels.flatMap((c) => c.monthly.map((m) => m.month)).sort();
  if (!all.length) return null;
  const months: string[] = [];
  for (let m = all[0]; m <= all.at(-1)!; ) {
    months.push(m);
    const [y, mm] = m.split("-").map(Number);
    m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
  }
  const top = Math.max(1, ...p.channels.flatMap((c) => c.monthly.map((m) => m.spend)));
  return (
    <section className="mt-4" aria-label={`Investimento por mês de ${p.name}`}>
      <h4 className="mb-2 text-[12px] font-semibold text-fg">Investimento por canal e mês</h4>
      <div className="space-y-3">
        {p.channels.map((c) => {
          const by = new Map(c.monthly.map((m) => [m.month, m.spend]));
          return (
            <div key={c.platform}>
              <p className="mb-1 flex justify-between text-[11.5px] text-fg-2">
                <span className="font-medium text-fg">{channelName(c.platform)}</span>
                <span className="tnum">{reais(c.monthly.reduce((a, m) => a + m.spend, 0))} no total</span>
              </p>
              <div className="flex h-12 items-end gap-px" role="img" aria-label={`${channelName(c.platform)}: ${c.monthly.map((m) => `${monthLabel(m.month)} ${reais(m.spend)}`).join(", ")}`}>
                {months.map((m) => {
                  const v = by.get(m) ?? 0;
                  return <span key={m} title={`${monthLabel(m)}: ${v ? reais(v) : "sem investimento"}`} className="min-w-[2px] flex-1 rounded-t-[2px]" style={{ height: `${v ? Math.max(4, (v / top) * 100) : 2}%`, background: v ? "var(--accent)" : "var(--line)" }} />;
                })}
              </div>
            </div>
          );
        })}
        <p className="flex justify-between text-[10.5px] text-fg-2 tnum">
          <span>{monthLabel(months[0])}</span>
          <span>{monthLabel(months.at(-1)!)}</span>
        </p>
      </div>
    </section>
  );
}

function ProjectBlock({ p, connectHref }: { p: ProjectReadiness; connectHref?: string }) {
  const ok = Object.fromEntries(p.criteria.map((c) => [c.id, c.ok])) as Record<string, boolean>;
  const missing = p.criteria.filter((c) => !c.ok).length;
  return (
    <section className="rounded-card border border-line bg-card p-5" data-mmm-cliente={p.projectId}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[16px] font-bold tracking-tight text-fg">{p.name}</h3>
        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${p.ready ? "bg-accent text-on-accent" : "bg-surface-2 text-fg-2"}`}>
          {p.ready ? "Pronto para treinar" : `Falta${missing === 1 ? "" : "m"} ${missing} ${missing === 1 ? "item" : "itens"}`}
        </span>
      </header>
      <ul className="mt-3">
        <Item ok={ok.canais} title="2 canais ou mais com investimento">
          <p>{p.channels.length ? `Tem: ${p.channels.map((c) => channelName(c.platform)).join(", ")}.` : "Nenhum canal com investimento nas contas deste dashboard."}{!ok.canais && p.channels.length === 1 ? " Com um canal só, não há o que separar." : ""}</p>
        </Item>
        <Item ok={ok.historico} title={`${MMM_MIN_MONTHS} meses ou mais de histórico em cada canal`}>
          {p.channels.length ? p.channels.map((c) => <p key={c.platform}><span className="font-medium text-fg">{channelName(c.platform)}:</span> {historyLine(c)}</p>) : <p>Sem histórico de investimento.</p>}
        </Item>
        <Item ok={ok.resultado} title={`Resultado de fonte independente com ${MMM_MIN_MONTHS} meses ou mais`}>
          {p.outcomes.map((o) => (
            <p key={o.source} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-fg">{OUTCOME_LABEL[o.source]}:</span>
              {o.months > 0 ? `${o.months} ${o.months === 1 ? "mês" : "meses"} com resultado` : o.connected ? "ligado, ainda sem resultado" : "não ligado"}
              {!o.connected && o.source !== "planilha" && connectHref && (
                <Link href={connectHref} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-fg hover:border-fg-2">
                  <Plug size={12} aria-hidden /> Ligar {o.source === "ga4" ? "o GA4" : "um CRM"}
                </Link>
              )}
              {!o.connected && o.source === "planilha" && <span className="text-[11.5px]">(liga na capa do visual Fachada)</span>}
            </p>
          ))}
          <p className="pt-1 text-[11.5px]">A conversão que a própria plataforma informa não serve: o modelo explicaria o efeito da plataforma com o número dela mesma (resultado circular).</p>
        </Item>
        <Item ok={ok.variacao} title="Verba com variação em cada canal">
          {p.channels.length ? (
            p.channels.map((c) => (
              <p key={c.platform}>
                <span className="font-medium text-fg">{channelName(c.platform)}:</span>{" "}
                {c.variation === "ok" ? "a verba varia: dá para medir o efeito." : c.variation === "constante" ? "a verba é quase sempre igual: o modelo não consegue medir este canal." : "pouco investimento ainda para dizer."}
              </p>
            ))
          ) : (
            <p>Sem investimento para avaliar.</p>
          )}
        </Item>
      </ul>
      <SpendHistory p={p} />
    </section>
  );
}

export function MmmConstruction({ data, connectHref }: { data: MmmReadinessData | null; connectHref?: string }) {
  return (
    <div className="@container space-y-4" data-mmm-construcao>
      <header className="flex gap-3 rounded-card border border-dashed border-line bg-surface-2/50 p-4">
        <Hammer size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div>
          <h3 className="text-[15px] font-bold text-fg">Mix de mídia em construção</h3>
          <p className="mt-1 text-[13px] text-fg-2">O MMM de cada cliente é treinado quando os itens abaixo estiverem completos. Até lá, esta tela mostra só o que falta e o investimento real de cada canal.</p>
        </div>
      </header>
      {!data ? (
        <p className="rounded-card border border-line bg-card p-5 text-[13px] text-fg-2">Não deu para ler o histórico deste dashboard agora. Tente de novo em alguns minutos.</p>
      ) : (
        <>
          {!data.fullHistory && <p className="text-[12px] text-fg-2">Histórico considerado: o que o VYZ sincroniza desde a primeira sincronização de cada conta. Os meses anteriores, já carregados para o MMM, entram assim que a leitura deles estiver liberada.</p>}
          {data.projects.length > 1 && <p className="text-[12.5px] text-fg-2">Este dashboard tem contas de {data.projects.length} clientes: cada um tem o seu modelo.</p>}
          {data.projects.map((p) => (
            <ProjectBlock key={p.projectId} p={p} connectHref={connectHref} />
          ))}
        </>
      )}
    </div>
  );
}
