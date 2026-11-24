"use client";

// Peças do Pulso (painel de operação): a lateral "Atenção agora" (em todas as abas, recolhível),
// a tabela de status das campanhas (na primeira aba e nas abas de cada plataforma), a aba
// "Ações de hoje" e a faixa dos criativos cansando (aba Criativos). Só dado real: o status sai
// do dia a dia de cada campanha (as plataformas não mandam o liga/desliga) e o ritmo da verba só
// aparece com a verba do mês definida.

import { AlertTriangle, Bell, ChevronRight, Clock, Flame, ImageOff, PanelRightClose, PanelRightOpen, TrendingUp, Wallet } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { PlatformId } from "@/features/accounts/platforms";
import { filterAria, filterTone, useDashFilters } from "@/features/analytics/filter-context";
import type { Campaign, Creative } from "@/features/metrics/source";
import { BUDGET_INVITE } from "@/features/metrics/targets";
import type { PageId } from "@/features/templates/types";
import { CreativeImage, isVideoFormat } from "../widgets/CreativeImage";
import { MiniSpark } from "./extras";
import { FullName } from "./FullName";
import { actionToday, campaignStatus, pacing, tiredCreatives, type CampaignStatus, type Pacing } from "./insights";
import { decimal, initials, int, label, money, platformName, type SkinProps } from "./shared";

export const C = {
  bg: "#07050f",
  frame: "#110d1e",
  card: "#1a1530",
  card2: "#221b3d",
  side: "linear-gradient(180deg,#2b1e63 0%,#1a1340 100%)",
  sideActive: "#7b5cff",
  purple: "linear-gradient(150deg,#7c5cff 0%,#5434d4 100%)",
  purpleFlat: "#7b5cff",
  pink: "linear-gradient(150deg,#ff5fa9 0%,#de2f7e 100%)",
  pinkFlat: "#ff5fa9",
  fg: "#f4f1ff",
  fg2: "#a79ecf",
  line: "#2a2346",
  green: "#3ee08f",
  red: "#ff6b8b",
  amber: "#ffb347",
};

/** Cores dos blocos exclusivos (extras.tsx) no escuro do Pulso. */
export const TONE = { fg: C.fg, fg2: C.fg2, line: C.line, accent: C.pinkFlat, good: C.green, bad: C.red };

type Ctx = SkinProps["ctx"];

/** Sincronização mais velha que isso vira aviso (o robô roda uma vez por dia). */
const STALE_HOURS = 30;

// ---- status das campanhas -----------------------------------------------------------------------

const STATUS: Record<CampaignStatus["status"], { text: string; color: string; order: number }> = {
  // o status olha os últimos 3 dias (as colunas, o período inteiro): o texto diz a janela
  "sem resultado": { text: "Sem resultado em 3 dias", color: C.red, order: 0 },
  "custo subindo": { text: "Custo subindo em 3 dias", color: C.pinkFlat, order: 1 },
  "sem gasto": { text: "Sem gasto em 3 dias", color: C.fg2, order: 3 },
  normal: { text: "Normal", color: C.green, order: 2 },
};

/** Custo por resultado do período (a régua do "sem resultado"). */
const avgCostOf = (ctx: Ctx) => (ctx.cur.conversions > 0 ? ctx.cur.spend / ctx.cur.conversions : 0);

/** Campanhas com o status, as que pedem ação primeiro (e, dentro de cada grupo, as que mais gastam). */
export function statusRows(ctx: Ctx, platform?: PlatformId): { c: Campaign; s: CampaignStatus | null }[] {
  const avg = avgCostOf(ctx);
  return ctx.ds.campaigns
    .filter((c) => !platform || c.platform === platform)
    .map((c) => ({ c, s: campaignStatus(c, avg) }))
    .sort((a, b) => (a.s ? STATUS[a.s.status].order : 4) - (b.s ? STATUS[b.s.status].order : 4) || b.c.spend - a.c.spend);
}

function StatusChip({ s }: { s: CampaignStatus | null }) {
  if (!s) return <span className="text-[11px]" style={{ color: C.fg2 }} title="Menos de 7 dias no período: sem o dia a dia para dizer">—</span>;
  const st = STATUS[s.status];
  return (
    <span className="inline-flex items-start gap-1.5 text-[11px] leading-tight font-semibold" style={{ color: st.color }} title={s.detail || undefined}>
      <span className="mt-[3px] size-2 shrink-0 rounded-full" style={{ background: st.color }} aria-hidden />
      {st.text}
    </span>
  );
}

/**
 * Tabela de status: cada campanha com o status dos últimos dias, os números do período e o
 * resultado dos últimos 7 dias. Clicar no nome filtra o dashboard pela campanha.
 */
export function StatusTable({ ctx, platform, limit, className = "" }: { ctx: Ctx; platform?: PlatformId; limit?: number; className?: string }) {
  const filters = useDashFilters();
  const rows = statusRows(ctx, platform);
  const shown = limit ? rows.slice(0, limit) : rows;
  const conv = label(ctx, "conversions");
  const cost = label(ctx, "cpa").replace(/^Custo por /i, "Custo/");
  const top = Math.max(1, ...shown.flatMap((r) => r.s?.spark ?? []));
  if (!rows.length) return <p className="m-auto py-6 text-center text-[12.5px]" style={{ color: C.fg2 }}>Sem campanhas no período{platform ? ` em ${platformName(platform)}` : ""}.</p>;
  return (
    <div className={`min-h-0 overflow-auto [scrollbar-width:thin] ${className}`}>
      <table className="w-full border-separate @[640px]:min-w-[480px] border-spacing-0 text-[12px]" data-status-campanhas>
        <thead>
          <tr className="text-left align-bottom text-[10.5px] leading-tight tracking-wide uppercase" style={{ color: C.fg2 }}>
            <th className="sticky top-0 w-[92px] py-1.5 pr-2 font-medium" style={{ background: C.card }} title="Pelos últimos 3 dias; as colunas são do período inteiro">Status · 3 dias</th>
            <th className="sticky top-0 py-1.5 pr-2 font-medium" style={{ background: C.card }}>Campanha</th>
            {!ctx.hideSpend && <th className="sticky top-0 hidden @[640px]:table-cell py-1.5 pr-2 text-right font-medium" style={{ background: C.card }}>Investimento</th>}
            <th className="sticky top-0 py-1.5 pr-2 text-right font-medium" style={{ background: C.card }}>{conv}</th>
            {!ctx.hideSpend && <th className="sticky top-0 hidden @[640px]:table-cell py-1.5 pr-2 text-right font-medium" style={{ background: C.card }}>{cost}</th>}
            <th className="sticky top-0 py-1.5 font-medium" style={{ background: C.card }}>7 dias</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(({ c, s }) => {
            const tone = filterTone(filters, "campaigns", c.id);
            return (
              <tr key={c.id} style={{ opacity: tone === "dimmed" ? 0.45 : 1 }} data-status={s?.status ?? "sem-dados"}>
                <td className="border-t py-2 pr-2" style={{ borderColor: C.line }}>
                  <StatusChip s={s} />
                </td>
                <td className="max-w-[220px] border-t py-2 pr-2" style={{ borderColor: C.line }}>
                  {filters?.interactive ? (
                    <button
                      type="button"
                      data-filter-item={c.id}
                      aria-pressed={tone === "selected"}
                      aria-label={filterAria("campaigns", c.name)}
                      onClick={(e) => filters.toggle("campaigns", c.id, c.name, e)}
                      className="block w-full min-w-0 rounded-[6px] text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#ff5fa9]"
                    >
                      <span className="block truncate font-semibold" title={c.name} style={tone === "selected" ? { color: C.pinkFlat } : undefined}>{c.name}</span>
                      {!platform && <span className="block text-[10.5px]" style={{ color: C.fg2 }}>{platformName(c.platform)}</span>}
                    </button>
                  ) : (
                    <>
                      <FullName text={c.name} className="font-semibold" />
                      {!platform && <span className="block text-[10.5px]" style={{ color: C.fg2 }}>{platformName(c.platform)}</span>}
                    </>
                  )}
                </td>
                {!ctx.hideSpend && <td className="hidden border-t @[640px]:table-cell py-2 pr-3 text-right tnum" style={{ borderColor: C.line }}>{money(ctx, c.spend, true)}</td>}
                <td className="border-t py-2 pr-2 text-right font-semibold tnum" style={{ borderColor: C.line }}>{int(c.conversions)}</td>
                {!ctx.hideSpend && <td className="hidden border-t @[640px]:table-cell py-2 pr-3 text-right tnum" style={{ borderColor: C.line }}>{c.conversions > 0 ? money(ctx, c.spend / c.conversions, true) : "—"}</td>}
                <td className="border-t py-2" style={{ borderColor: C.line }}>
                  {s ? <MiniSpark values={s.spark} scaleMax={top} color={s.status === "normal" ? C.green : STATUS[s.status].color} className="h-6 w-16" label={`${conv} nos últimos 7 dias`} /> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <p className="pt-2 text-[10.5px]" style={{ color: C.fg2 }}>
          Mostrando {limit} de {rows.length}: as que pedem ação primeiro.
        </p>
      )}
    </div>
  );
}

// ---- o que pede atenção -------------------------------------------------------------------------

export type Attention = {
  id: string;
  kind: "campanha" | "verba" | "criativo" | "sync" | "convite";
  tone: "bad" | "warn" | "info";
  title: string;
  detail: string;
  campaign?: Campaign;
  creative?: Creative;
};

/** Tudo o que pede atenção agora, o mais grave primeiro. */
export function attentionOf(ctx: Ctx, syncHours?: number): { items: Attention[]; pace: Pacing | null } {
  const items: Attention[] = [];
  if (syncHours != null && syncHours > STALE_HOURS)
    items.push({ id: "sync", kind: "sync", tone: "bad", title: "Dados sem atualizar", detail: `A última sincronização foi há ${syncHours >= 48 ? `${Math.floor(syncHours / 24)} dias` : `${Math.floor(syncHours)} horas`}: os números podem estar atrasados.` });
  for (const a of actionToday(ctx.ds.campaigns, avgCostOf(ctx), 8))
    items.push({ id: `c-${a.campaign.id}`, kind: "campanha", tone: a.reason === "sem resultado" ? "bad" : "warn", title: a.campaign.name, detail: a.detail, campaign: a.campaign });
  const pace = ctx.hideSpend ? null : pacing(ctx.ds);
  if (pace && pace.status !== "no ritmo")
    items.push({
      id: "verba",
      kind: "verba",
      tone: pace.status === "estoura" ? "bad" : "warn",
      title: pace.status === "estoura" ? "Verba vai estourar" : "Verba vai sobrar",
      detail: `No ritmo dos últimos 7 dias, o mês fecha em ${money(ctx, pace.projected, true)} de ${money(ctx, pace.monthly, true)}.`,
    });
  for (const t of tiredCreatives(ctx.ds.creatives, 3))
    items.push({ id: `a-${t.creative.id}`, kind: "criativo", tone: "warn", title: t.creative.name, detail: `cansando: frequência ${decimal(t.creative.frequency, 1)} e CTR ${decimal(t.ctr * 100, 2)}% (média ${decimal(t.avgCtr * 100, 2)}%)`, creative: t.creative });
  if (!pace && !ctx.hideSpend && !(ctx.ds.budget.monthly > 0)) items.push({ id: "convite-verba", kind: "convite", tone: "info", title: "Ritmo da verba", detail: `${BUDGET_INVITE} para saber se o mês vai estourar ou sobrar.` });
  return { items, pace };
}

const TONE_COLOR = { bad: C.red, warn: C.pinkFlat, info: C.fg2 };
const KIND_ICON = { campanha: AlertTriangle, verba: Wallet, criativo: Flame, sync: Clock, convite: Wallet };

// recolher a lateral: a escolha fica guardada neste navegador
const KEY = "vyz:pulso:atencao";
const EVENT = "vyz-pulso-atencao";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const readClosed = () => {
  try {
    return localStorage.getItem(KEY) === "fechada";
  } catch {
    return false;
  }
};
function setClosed(next: boolean) {
  try {
    localStorage.setItem(KEY, next ? "fechada" : "aberta");
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
export const useAttentionClosed = () => useSyncExternalStore(subscribe, readClosed, () => false);

/** Uma linha de atenção: o motivo e o que dá para fazer (filtrar a campanha, ver o criativo). */
function AttentionRow({ a, onPage, pages, compact }: { a: Attention; onPage?: (p: PageId) => void; pages: PageId[]; compact?: boolean }) {
  const filters = useDashFilters();
  const Icon = KIND_ICON[a.kind];
  const act =
    a.campaign && filters?.interactive
      ? { label: filterTone(filters, "campaigns", a.campaign.id) === "selected" ? "Tirar filtro" : "Filtrar", run: (e: React.MouseEvent) => filters.toggle("campaigns", a.campaign!.id, a.campaign!.name, e) }
      : a.creative && pages.includes("criativos") && onPage
        ? { label: "Ver", run: () => onPage("criativos") }
        : null;
  return (
    <li className="flex min-w-0 gap-2.5 border-b py-2.5 last:border-b-0" style={{ borderColor: C.line }} data-atencao={a.kind}>
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color: TONE_COLOR[a.tone] }} aria-hidden />
      <span className="min-w-0 flex-1">
        <FullName text={a.title} className="text-[12.5px] font-semibold" />
        <span className={`block text-[11px] leading-snug ${compact ? "line-clamp-2" : ""}`} style={{ color: C.fg2 }}>
          {a.detail}
        </span>
      </span>
      {act && (
        <button type="button" onClick={act.run} className="h-7 shrink-0 self-center rounded-full border px-2.5 text-[11px] font-semibold" style={{ borderColor: C.line, color: C.fg }}>
          {act.label}
        </button>
      )}
    </li>
  );
}

/**
 * Lateral "Atenção agora": aparece em todas as abas (menos em Ações de hoje, que é ela por
 * inteiro). Recolhida, vira uma faixa com o sino e a contagem.
 */
export function AttentionPanel({ ctx, syncHours, pages, onPage, closed }: { ctx: Ctx; syncHours?: number; pages: PageId[]; onPage?: (p: PageId) => void; closed: boolean }) {
  const { items } = attentionOf(ctx, syncHours);
  const count = items.filter((a) => a.tone !== "info").length;
  if (closed)
    return (
      <button
        type="button"
        onClick={() => setClosed(false)}
        aria-label={`Abrir Atenção agora (${count} ${count === 1 ? "item" : "itens"})`}
        title="Abrir Atenção agora"
        className="flex w-full items-center justify-center gap-2 rounded-[18px] border px-3 py-2.5 text-[12px] font-semibold @[1000px]:h-full @[1000px]:flex-col @[1000px]:justify-start @[1000px]:rounded-none @[1000px]:border-0 @[1000px]:px-0 @[1000px]:py-5"
        style={{ borderColor: C.line, background: "#0d0a18", color: C.fg }}
        data-atencao-recolhida
      >
        <PanelRightOpen size={17} className="hidden @[1000px]:block" aria-hidden />
        <Bell size={16} style={{ color: count ? C.pinkFlat : C.fg2 }} aria-hidden />
        <span className="grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-[11px] tnum" style={{ background: count ? C.pinkFlat : C.card, color: count ? "#fff" : C.fg2 }}>
          {count}
        </span>
        <span className="@[1000px]:hidden">Atenção agora</span>
      </button>
    );
  return (
    <section aria-label="Atenção agora" className="flex min-w-0 flex-col" data-atencao-agora>
      <header className="flex items-center gap-2">
        <Bell size={17} style={{ color: C.pinkFlat }} aria-hidden />
        <h3 className="flex-1 text-[15px] font-bold">Atenção agora</h3>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold tnum" style={{ background: count ? C.pinkFlat : C.card, color: count ? "#fff" : C.fg2 }}>
          {count}
        </span>
        <button type="button" onClick={() => setClosed(true)} aria-label="Recolher Atenção agora" title="Recolher" className="grid size-8 place-items-center rounded-full" style={{ color: C.fg2 }}>
          <PanelRightClose size={17} aria-hidden />
        </button>
      </header>
      {items.length === 0 ? (
        <p className="mt-4 text-[12px] leading-snug" style={{ color: C.fg2 }}>
          Nada pede atenção agora: nenhuma campanha gastando sem resultado ou com o custo subindo, nem criativo cansando.
        </p>
      ) : (
        // no estreito (lateral em cima dos blocos), só os 3 primeiros: o resto está em Ações de hoje
        <ul className="mt-2 @max-[1000px]:[&>li:nth-child(n+4)]:hidden">
          {items.map((a) => (
            <AttentionRow key={a.id} a={a} onPage={onPage} pages={pages} compact />
          ))}
        </ul>
      )}
      {pages.includes("acoes-hoje") && onPage && items.length > 0 && (
        <button type="button" onClick={() => onPage("acoes-hoje")} className="mt-3 flex items-center gap-1 self-start text-[11.5px] font-semibold" style={{ color: C.pinkFlat }}>
          Ver o detalhe em Ações de hoje <ChevronRight size={14} aria-hidden />
        </button>
      )}
      <p className="mt-auto pt-4 text-[10.5px] leading-snug" style={{ color: C.fg2 }}>
        Os últimos 3 dias ainda estão em maturação: confira antes de pausar.
      </p>
    </section>
  );
}

// ---- aba "Ações de hoje" ------------------------------------------------------------------------

function Section({ icon: Icon, title, note, children }: { icon: typeof Bell; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border p-4 @[700px]:p-5" style={{ background: C.card, borderColor: C.line }}>
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-2 text-[15px] font-bold">
          <Icon size={17} style={{ color: C.pinkFlat }} aria-hidden /> {title}
        </h3>
        {note && <span className="text-[11.5px]" style={{ color: C.fg2 }}>{note}</span>}
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A aba inteira: cada item com o porquê, os números que mostram e o que dá para fazer. */
export function ActionsPage({ ctx, syncHours, pages, onPage }: { ctx: Ctx; syncHours?: number; pages: PageId[]; onPage?: (p: PageId) => void }) {
  const filters = useDashFilters();
  const { items, pace } = attentionOf(ctx, syncHours);
  const avg = avgCostOf(ctx);
  const camps = actionToday(ctx.ds.campaigns, avg, 50);
  const tired = tiredCreatives(ctx.ds.creatives, 12);
  const sync = items.find((a) => a.kind === "sync");
  const total = camps.length + tired.length + (sync ? 1 : 0) + (pace && pace.status !== "no ritmo" ? 1 : 0);
  const conv = label(ctx, "conversions").toLowerCase();
  return (
    <div className="space-y-4" data-acoes-hoje>
      <p className="text-[13px]" style={{ color: C.fg2 }}>
        {total === 0 ? "Nada pede ação hoje." : `${total} ${total === 1 ? "item pede" : "itens pedem"} ação hoje.`} Os últimos 3 dias ainda estão em maturação: confira antes de pausar.
      </p>

      {sync && (
        <Section icon={Clock} title={sync.title}>
          <p className="text-[12.5px]" style={{ color: C.fg2 }}>{sync.detail}</p>
        </Section>
      )}

      <Section icon={AlertTriangle} title="Campanhas" note="sem resultado ou com o custo subindo nos últimos 3 dias">
        {camps.length === 0 ? (
          <p className="text-[12.5px]" style={{ color: C.fg2 }}>Nenhuma campanha gastando sem resultado ou com o custo subindo.</p>
        ) : (
          <ul className="grid gap-3 @[900px]:grid-cols-2">
            {camps.map((a) => {
              const d = a.campaign.daily!;
              const n = d.spend.length;
              const s3 = d.spend.slice(n - 3).reduce((x, y) => x + y, 0);
              const c3 = d.conversions.slice(n - 3).reduce((x, y) => x + y, 0);
              const tone = filterTone(filters, "campaigns", a.campaign.id);
              return (
                <li key={a.campaign.id} className="flex min-w-0 flex-col rounded-[16px] border p-3.5" style={{ borderColor: C.line, background: C.card2 }} data-acao={a.reason}>
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: a.reason === "sem resultado" ? C.red : C.pinkFlat }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <FullName text={a.campaign.name} className="text-[13px] font-bold" />
                      <span className="block text-[11px]" style={{ color: C.fg2 }}>
                        {platformName(a.campaign.platform)} · {a.detail}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
                    {!ctx.hideSpend && (
                      <p className="text-[11px]" style={{ color: C.fg2 }}>
                        Gasto em 3 dias
                        <strong className="block text-[15px] tnum" style={{ color: C.fg }}>{money(ctx, s3, true)}</strong>
                      </p>
                    )}
                    <p className="text-[11px]" style={{ color: C.fg2 }}>
                      {label(ctx, "conversions")} em 3 dias
                      <strong className="block text-[15px] tnum" style={{ color: C.fg }}>{int(c3)}</strong>
                    </p>
                    <span className="ml-auto flex flex-col items-end gap-0.5">
                      <MiniSpark values={a.spark} color={C.pinkFlat} className="h-8 w-24" label="Investimento nos últimos 7 dias" />
                      <span className="text-[10px]" style={{ color: C.fg2 }}>investimento · 7 dias</span>
                    </span>
                  </div>
                  {filters?.interactive && (
                    <button
                      type="button"
                      onClick={(e) => filters.toggle("campaigns", a.campaign.id, a.campaign.name, e)}
                      aria-pressed={tone === "selected"}
                      className="mt-3 h-8 self-start rounded-full border px-3 text-[11.5px] font-semibold"
                      style={tone === "selected" ? { background: C.pinkFlat, borderColor: "transparent", color: "#fff" } : { borderColor: C.line, color: C.fg }}
                    >
                      {tone === "selected" ? "Tirar o filtro" : "Ver o dashboard só desta campanha"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {!ctx.hideSpend && (
        <Section icon={Wallet} title="Verba do mês">
          {pace ? (
            <p className="text-[12.5px]" style={{ color: C.fg2 }}>
              <strong className="tnum" style={{ color: C.fg }}>{money(ctx, pace.spent, true)}</strong> de {money(ctx, pace.monthly, true)} até o dia {pace.day} de {pace.daysInMonth}.{" "}
              <span className="font-semibold" style={{ color: pace.status === "no ritmo" ? C.green : pace.status === "estoura" ? C.red : C.pinkFlat }}>
                {pace.status === "no ritmo" ? "No ritmo: nada a fazer." : pace.status === "estoura" ? `Vai estourar: no ritmo dos últimos 7 dias, fecha em ${money(ctx, pace.projected, true)}. Para fechar na verba, a verba diária precisa cair.` : `Vai sobrar: no ritmo dos últimos 7 dias, fecha em ${money(ctx, pace.projected, true)}. Sobra espaço para subir a verba diária.`}
              </span>
            </p>
          ) : (
            <p className="text-[12.5px]" style={{ color: C.fg2 }}>{BUDGET_INVITE} para saber se o mês vai estourar ou sobrar.</p>
          )}
        </Section>
      )}

      <Section icon={Flame} title="Criativos cansando" note="frequência de 3 ou mais e CTR abaixo da média">
        {tired.length === 0 ? (
          <p className="text-[12.5px]" style={{ color: C.fg2 }}>
            {ctx.ds.creatives.length ? "Nenhum criativo com frequência alta e CTR abaixo da média." : "Os criativos aparecem quando o período tem anúncios da Meta."}
          </p>
        ) : (
          <ul className="grid gap-3 @[700px]:grid-cols-2 @[1100px]:grid-cols-3">
            {tired.map((t) => (
              <li key={t.creative.id} className="flex min-w-0 items-center gap-3 rounded-[16px] border p-3" style={{ borderColor: C.line, background: C.card2 }}>
                <CreativeImage
                  src={t.creative.imageUrl}
                  video={isVideoFormat(t.creative.format)}
                  compact
                  className="size-12 shrink-0 rounded-[12px]"
                  fallback={<span className="grid size-full place-items-center text-[11px] font-bold text-white" style={{ background: C.purpleFlat }}>{initials(t.creative.name)}</span>}
                />
                <span className="min-w-0 flex-1">
                  <FullName text={t.creative.name} className="text-[12.5px] font-bold" />
                  <span className="block text-[11px] tnum" style={{ color: C.fg2 }}>
                    frequência <strong style={{ color: C.pinkFlat }}>{decimal(t.creative.frequency, 1)}</strong> · CTR {decimal(t.ctr * 100, 2)}% (média {decimal(t.avgCtr * 100, 2)}%)
                  </span>
                  <span className="block text-[11px] tnum" style={{ color: C.fg2 }}>
                    {int(t.creative.conversions)} {conv}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {tired.length > 0 && pages.includes("criativos") && onPage && (
          <button type="button" onClick={() => onPage("criativos")} className="mt-3 flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: C.pinkFlat }}>
            Ver todos em Criativos <ChevronRight size={14} aria-hidden />
          </button>
        )}
      </Section>
    </div>
  );
}

// ---- faixas das outras abas ---------------------------------------------------------------------

/** Abas de uma plataforma: o status das campanhas dela, antes dos blocos padrão. */
export function PlatformStatus({ ctx, platform }: { ctx: Ctx; platform: PlatformId }) {
  return (
    <section className="mb-4 rounded-[22px] border p-4" style={{ background: C.card, borderColor: C.line }} data-status-plataforma={platform}>
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[14.5px] font-bold">
          <TrendingUp size={16} style={{ color: C.pinkFlat }} aria-hidden /> Status das campanhas · {platformName(platform)}
        </h3>
        <span className="text-[11px]" style={{ color: C.fg2 }}>pelo dia a dia: as que pedem ação primeiro</span>
      </header>
      <StatusTable ctx={ctx} platform={platform} limit={6} />
    </section>
  );
}

/** Aba Criativos: os que estão cansando primeiro, antes da galeria. */
export function TiredStrip({ ctx }: { ctx: Ctx }) {
  const tired = tiredCreatives(ctx.ds.creatives, 6);
  return (
    <section className="mb-4 rounded-[22px] border p-4" style={{ background: C.card, borderColor: C.line }} data-cansando>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[14.5px] font-bold">
          <Flame size={16} style={{ color: C.pinkFlat }} aria-hidden /> Cansando primeiro
        </h3>
        <span className="text-[11px]" style={{ color: C.fg2 }}>frequência de 3 ou mais e CTR abaixo da média</span>
      </header>
      {tired.length === 0 ? (
        <p className="flex items-center gap-2 text-[12px]" style={{ color: C.fg2 }}>
          <ImageOff size={15} aria-hidden /> Nenhum criativo cansando no período.
        </p>
      ) : (
        <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {tired.map((t) => (
            <li key={t.creative.id} className="flex w-[230px] shrink-0 items-center gap-3 rounded-[16px] border p-2.5" style={{ borderColor: C.line, background: C.card2 }}>
              <CreativeImage
                src={t.creative.imageUrl}
                video={isVideoFormat(t.creative.format)}
                compact
                className="size-11 shrink-0 rounded-[10px]"
                fallback={<span className="grid size-full place-items-center text-[11px] font-bold text-white" style={{ background: C.purpleFlat }}>{initials(t.creative.name)}</span>}
              />
              <span className="min-w-0 flex-1">
                <FullName text={t.creative.name} className="text-[12px] font-bold" />
                <span className="block text-[10.5px] tnum" style={{ color: C.fg2 }}>
                  freq. <strong style={{ color: C.pinkFlat }}>{decimal(t.creative.frequency, 1)}</strong> · CTR {decimal(t.ctr * 100, 2)}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
