"use client";

// Peças do Areia (pipeline do lead): o trilho do funil, que é a navegação da primeira aba
// (Anúncio → Lead → as etapas do CRM, com a passagem entre elas), o detalhe de uma etapa do
// CRM e a faixa "de onde vem o lead" das abas de cada plataforma. Sem CRM, as etapas dele viram
// um convite só. O CRM manda o total de cada etapa no período (sem o dia a dia nem o tempo em
// cada etapa): o detalhe mostra só isso.

import { ArrowRight, Plug } from "lucide-react";
import type { PlatformId } from "@/features/accounts/platforms";
import type { CrmStage } from "@/features/metrics/source";
import { delta } from "@/features/metrics/compute";
import { brlCompact } from "@/lib/format";
import { Block, StageFunnel } from "./bklit-blocks";
import { MiniSpark } from "./extras";
import { FullName } from "./FullName";
import { brl, goalOf, int, label, pct, platformName, type SkinProps } from "./shared";

type Ctx = SkinProps["ctx"];

export type Stage = { id: string; name: string; count: number | null; /** linha de baixo (a variação do lead) */ note?: string; /** valor em centavos (etapas do CRM) */ value?: number; kind: "anuncio" | "lead" | "crm" | "convite"; crm?: CrmStage };

function leadNote(now: number, before: number): string {
  const d = delta(now, before);
  return before > 0 && Number.isFinite(d) && d !== 0 ? `${d > 0 ? "▲" : "▼"} ${pct(Math.abs(d), 1)} contra o anterior` : "das plataformas";
}

/** As etapas do trilho: Anúncio (cliques), Lead (o resultado do objetivo) e as do CRM (ou o convite). */
export function stagesOf(ctx: Ctx): Stage[] {
  const { conv } = goalOf(ctx.profile, ctx.cur.leads);
  const crm = ctx.ds.crm.filter((s) => s.count > 0 || s.value > 0);
  const out: Stage[] = [
    { id: "anuncio", name: "Anúncio", count: ctx.cur.clicks, kind: "anuncio" },
    { id: "lead", name: label(ctx, conv), count: ctx.cur[conv], kind: "lead", note: leadNote(ctx.cur[conv], ctx.prev[conv]) },
  ];
  if (crm.length) {
    // a primeira etapa do CRM são os leads que chegaram nele; as outras, o funil dele até o ganho
    for (const [i, s] of ctx.ds.crm.entries()) if (i > 0) out.push({ id: `crm-${i}`, name: s.stage, count: s.count, value: s.value, kind: "crm", crm: s });
  } else if (ctx.cur.qualified > 0) {
    out.push({ id: "qualificado", name: "Qualificados", count: ctx.cur.qualified, kind: "crm" });
    out.push({ id: "convite", name: "Proposta e venda", count: null, kind: "convite" });
  } else out.push({ id: "convite", name: "Qualificado, proposta e venda", count: null, kind: "convite" });
  return out;
}

/** O trilho: cada etapa com o número e a passagem da anterior; clicar escolhe o detalhe. */
export function FunnelRail({ stages, picked, onPick, money, accent }: { stages: Stage[]; picked: string; onPick: (id: string) => void; money?: (cents: number) => string; accent: string }) {
  return (
    <nav aria-label="Etapas do funil" className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]" data-trilho>
      <ol className="flex min-w-max items-stretch gap-1.5 @[900px]:min-w-0">
        {stages.map((s, i) => {
          const before = stages[i - 1];
          const pass = before && before.count && s.count !== null ? s.count / before.count : null;
          const on = s.id === picked;
          return (
            <li key={s.id} className="flex min-w-0 items-stretch gap-1.5 @[900px]:flex-1">
              {i > 0 && (
                <span className="flex w-12 shrink-0 flex-col items-center justify-center text-center text-[10.5px] leading-tight text-fg-2" aria-hidden={pass === null}>
                  <ArrowRight size={14} aria-hidden />
                  {pass !== null && <span className="font-semibold text-fg tnum">{pct(pass, pass < 0.1 ? 1 : 0)}</span>}
                  {pass !== null && <span>passam</span>}
                </span>
              )}
              <button
                type="button"
                onClick={() => onPick(s.id)}
                aria-pressed={on}
                className={`flex w-[150px] min-w-0 flex-col rounded-[18px] border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent @[900px]:w-auto @[900px]:flex-1 ${s.kind === "convite" ? "border-dashed" : ""}`}
                style={on ? { background: accent, borderColor: accent, color: "#fff7ef" } : { background: "var(--card)", borderColor: "var(--line)" }}
                data-etapa={s.kind}
              >
                <span className={`text-[11px] font-semibold tracking-wide uppercase ${on ? "" : "text-fg-2"}`}>{s.name}</span>
                {s.kind === "convite" ? (
                  <span className={`mt-1 flex items-center gap-1 text-[12px] ${on ? "" : "text-fg-2"}`}>
                    <Plug size={13} aria-hidden /> Conecte um CRM
                  </span>
                ) : (
                  <>
                    <span className="mt-1 text-[22px] leading-tight font-bold tnum">{int(s.count ?? 0)}</span>
                    <span className={`text-[11px] ${on ? "opacity-85" : "text-fg-2"}`}>
                      {s.kind === "anuncio" ? "cliques nos anúncios" : s.kind === "lead" ? s.note : s.value && money ? money(s.value) : "no CRM"}
                    </span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Detalhe de uma etapa do CRM: quantos, quanto vale, quantos passam e o funil inteiro com ela marcada. */
export function CrmStageDetail({ ctx, stage, stages, accent }: { ctx: Ctx; stage: Stage; stages: Stage[]; accent: string }) {
  const i = stages.findIndex((s) => s.id === stage.id);
  const before = stages[i - 1];
  const next = stages[i + 1];
  const lead = stages.find((s) => s.kind === "lead");
  const crmStages = stages.filter((s) => s.kind === "crm");
  const last = crmStages.at(-1)?.id === stage.id;
  const count = stage.count ?? 0;
  const tiles = [
    { l: "Nesta etapa", v: int(count) },
    ...(stage.value ? [{ l: "Valor", v: brlCompact(stage.value) }] : []),
    ...(before?.count ? [{ l: `Passam de ${before.kind === "crm" ? before.name : before.name.toLowerCase()}`, v: pct(count / before.count, 0) }] : []),
    ...(lead?.count ? [{ l: "Dos leads", v: pct(count / lead.count, count / lead.count < 0.1 ? 1 : 0) }] : []),
    ...(last && count > 0 && !ctx.hideSpend ? [{ l: "Investimento por fechamento", v: brl(ctx.cur.spend / count, { decimals: false }) }] : []),
    ...(last && count > 0 && stage.value ? [{ l: "Ticket médio", v: brlCompact(stage.value / count) }] : []),
  ];
  return (
    <div className="grid gap-4 @[900px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" data-detalhe-etapa={stage.id}>
      <Block title={stage.name} aside={<span className="text-[11px] text-fg-2">pelo CRM, no período</span>}>
        <dl className="grid grid-cols-2 gap-3 @[700px]:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.l} className="rounded-[14px] border border-line p-3">
              <dt className="text-[11px] text-fg-2">{t.l}</dt>
              <dd className="mt-0.5 text-[20px] font-bold tnum">{t.v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] text-fg-2">
          {next && next.count !== null && count > 0 ? (
            <>
              Daqui, <strong className="text-fg">{pct(next.count / count, 0)}</strong> seguem para {next.kind === "crm" ? next.name : next.name.toLowerCase()}.
            </>
          ) : last ? (
            "A última etapa do funil: os negócios ganhos."
          ) : null}{" "}
          O CRM manda o total de cada etapa no período: sem o dia a dia nem o tempo em cada etapa.
        </p>
      </Block>
      <Block title="O funil do CRM">
        <StageFunnel
          className="flex-1"
          orientation="vertical"
          color={accent}
          steps={crmStages.map((s) => ({ label: s.name, value: s.count ?? 0, display: int(s.count ?? 0), color: s.id === stage.id ? accent : "var(--muted)" }))}
          summary={`Funil do CRM: ${crmStages.map((s) => `${s.name} ${int(s.count ?? 0)}`).join(", ")}.`}
        />
      </Block>
    </div>
  );
}

/** Abas de uma plataforma: de onde vem o lead (as campanhas dela, com leads, custo e o dia a dia). */
export function LeadSources({ ctx, platform, accent }: { ctx: Ctx; platform: PlatformId; accent: string }) {
  const { conv } = goalOf(ctx.profile, ctx.cur.leads);
  const word = label(ctx, conv);
  const rows = ctx.ds.campaigns.filter((c) => c.platform === platform && (c.conversions > 0 || c.spend > 0)).sort((a, b) => b.conversions - a.conversions);
  const total = rows.reduce((a, c) => a + c.conversions, 0);
  const top = Math.max(1e-9, ...rows.flatMap((c) => c.daily?.conversions ?? []));
  return (
    <section className="mb-4" data-de-onde-vem={platform}>
      <Block title={`De onde vem o lead · ${platformName(platform)}`} aside={<span className="text-[11px] text-fg-2">{int(total)} {word.toLowerCase()} nas campanhas</span>}>
        {rows.length === 0 ? (
          <p className="text-[12px] text-fg-2">Sem campanhas com resultado em {platformName(platform)} no período.</p>
        ) : (
          <ol className="divide-y divide-line">
            {rows.slice(0, 8).map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-3 py-2">
                <FullName text={c.name} className="min-w-0 flex-1 text-[12.5px] font-medium" />
                <span className="hidden w-[90px] shrink-0 @[640px]:block" aria-hidden>
                  <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(4, (c.conversions / Math.max(1, rows[0].conversions)) * 100)}%`, background: accent }} />
                </span>
                <MiniSpark values={c.daily?.conversions ?? []} scaleMax={top} color={accent} className="h-6 w-16 shrink-0" label={`${word} por dia`} />
                <span className="w-12 shrink-0 text-right text-[12.5px] font-semibold tnum">{int(c.conversions)}</span>
                <span className="w-[52px] shrink-0 text-right text-[12px] text-fg-2 tnum">{total > 0 ? pct(c.conversions / total, 0) : "—"}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-[10.5px] text-fg-2">
          {word} de cada campanha, o dia a dia e a parte de cada uma. O custo por campanha está mais abaixo, nos blocos da plataforma.
        </p>
      </Block>
    </section>
  );
}
