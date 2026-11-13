// LocalEngine: entende perguntas por intenção/palavra-chave em PT-BR e
// responde só com o que está no contexto (montado no servidor). Nunca inventa
// número: sem dado, diz que não tem.

import { metric, type MetricId } from "@/features/metrics/definitions";
import { change, count, money, periodLabel, ratio } from "./format";
import type { AgentAnswer, AgentContext, ClientData, VyzEngine } from "./types";

export const SUGGESTIONS = ["Quanto investi esse mês?", "Qual cliente teve o melhor CPA?", "Quantos dashboards ainda posso criar?", "Ativar modo escuro"];
const NO_DATA = "Não tenho esse dado";

/** O período da resposta: o mês até hoje ou, com filtros, o período aberto no dashboard. */
const when = (ctx: AgentContext) => ctx.focus?.period ?? periodLabel(ctx.now);

/** Minúsculas, sem acento, sem pontuação e sem o "olá, vyz" do começo. */
export function normalize(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/^\s*(ola|oi|ei|hey)?\s*(vyz|viz|vis|vys|vaiz)\b/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavra inteira; com "*" no fim, prefixo ("invest*" pega investi, investimento). */
const has = (q: string, ...words: string[]) => words.some((w) => new RegExp(w.endsWith("*") ? `\\b${w.slice(0, -1)}` : `\\b${w}\\b`).test(q));
const strip = (s: string) => s.replace(/\*\*/g, "");
const answer = (a: Omit<AgentAnswer, "spoken" | "understood"> & { understood?: boolean }): AgentAnswer => ({ understood: true, ...a, spoken: strip(a.text) });

// ---- métricas comparáveis entre clientes ----------------------------------------

type Comparable = { id: MetricId; words: string[]; applies: (c: ClientData) => boolean };
const COMPARABLE: Comparable[] = [
  { id: "cplq", words: ["lead* qualificado*", "cplq"], applies: (c) => c.profile === "imob" },
  { id: "cpl", words: ["cpl", "custo por lead*", "lead*"], applies: (c) => c.profile !== "ecommerce" && c.cur.leads > 0 },
  { id: "roas", words: ["roas", "retorno"], applies: (c) => c.profile === "ecommerce" },
  { id: "cpa", words: ["cpa", "custo por venda*", "custo por aquisicao", "custo por conversao", "cpv"], applies: (c) => c.cur.conversions > 0 },
];

function format(id: MetricId, v: number): string {
  return id === "roas" ? ratio(v) : money(v);
}

/** "melhor" respeita o sentido da métrica (CPA menor é melhor; ROAS maior). */
function rank(id: MetricId, list: ClientData[], best: boolean) {
  const lowerIsBetter = metric(id, "ecommerce").better === "down";
  const sorted = [...list].sort((a, b) => (lowerIsBetter ? a.cur[id] - b.cur[id] : b.cur[id] - a.cur[id]));
  return best ? sorted : sorted.reverse();
}

const target = (c: ClientData, id: MetricId) => (c.kpis.includes(id) ? { dashboardId: c.dashboardId, metric: id } : undefined);

// ---- intenções ----------------------------------------------------------------

/** Resposta sobre números com filtros ativos: diz qual é o recorte. */
function withFocus(a: AgentAnswer, ctx: AgentContext): AgentAnswer {
  if (!ctx.focus) return a;
  const many = ctx.focus.label.includes(", ");
  const text = `Com ${many ? "os filtros" : "o filtro"} **${ctx.focus.label}**, ${a.text[0].toLowerCase()}${a.text.slice(1)}`;
  return { ...a, text, spoken: strip(text) };
}

function noDashboards(): AgentAnswer {
  return answer({
    text: `${NO_DATA} ainda: não há nenhum dashboard nesta conta. Crie o primeiro e eu passo a responder com os números dele.`,
    action: { type: "navigate", href: "/painel/dashboards/novo?novo=1", label: "Criar dashboard" },
    suggestions: ["Quantos dashboards ainda posso criar?", "Qual é o meu plano?"],
  });
}

function spend(ctx: AgentContext): AgentAnswer {
  const list = ctx.dashboards.filter((d) => d.cur.spend > 0);
  if (!list.length) return ctx.dashboards.length ? answer({ text: `${NO_DATA}: os dashboards não têm investimento registrado ${when(ctx)}.` }) : noDashboards();
  const cur = list.reduce((a, d) => a + d.cur.spend, 0);
  const prev = list.reduce((a, d) => a + d.prev.spend, 0);
  const d = prev ? cur / prev - 1 : null;
  const many = list.length > 1;
  return answer({
    text: `Você investiu **${money(cur)}** ${when(ctx)}${many ? `, somando ${count(list.length)} clientes` : ` em ${list[0].client}`}.${d !== null ? ` Isso é **${change(d)}** em relação ao período anterior de mesmo tamanho.` : ""}`,
    card: { label: `Investimento · ${when(ctx)}`, value: money(cur), delta: d !== null ? { text: `${change(d)} vs anterior`, good: null } : undefined },
    chart: many ? { title: "Por cliente", items: [...list].sort((a, b) => b.cur.spend - a.cur.spend).map((c) => ({ label: c.client, value: c.cur.spend, display: money(c.cur.spend) })) } : undefined,
    target: many ? undefined : target(list[0], "spend"),
  });
}

function totalOf(ctx: AgentContext, id: "conversions" | "leads"): AgentAnswer {
  const list = ctx.dashboards.filter((d) => d.cur[id] > 0);
  const word = id === "conversions" ? "vendas confirmadas" : "leads";
  if (!list.length) return ctx.dashboards.length ? answer({ text: `${NO_DATA}: nenhum dashboard registra ${word} ${when(ctx)}.` }) : noDashboards();
  const cur = list.reduce((a, d) => a + d.cur[id], 0);
  const prev = list.reduce((a, d) => a + d.prev[id], 0);
  const d = prev ? cur / prev - 1 : null;
  return answer({
    text: `Foram **${count(cur)} ${word}** ${when(ctx)}${list.length > 1 ? `, em ${count(list.length)} clientes` : ` em ${list[0].client}`}.${d !== null ? ` Variação de **${change(d)}** sobre o período anterior.` : ""}`,
    card: { label: `${word[0].toUpperCase()}${word.slice(1)} · ${when(ctx)}`, value: count(cur), delta: d !== null ? { text: `${change(d)} vs anterior`, good: d >= 0 } : undefined },
    chart: list.length > 1 ? { title: "Por cliente", items: [...list].sort((a, b) => b.cur[id] - a.cur[id]).map((c) => ({ label: c.client, value: c.cur[id], display: count(c.cur[id]) })) } : undefined,
    target: list.length === 1 ? target(list[0], id) : undefined,
  });
}

function compare(q: string, ctx: AgentContext): AgentAnswer | null {
  const m = COMPARABLE.find((c) => has(q, ...c.words));
  if (!m) return null;
  if (!ctx.dashboards.length) return noDashboards();
  const best = !has(q, "pior", "mais caro", "maior custo");
  const list = ctx.dashboards.filter(m.applies);
  const label = metric(m.id, "ecommerce").label;
  // no meio da frase: "custo por venda" (siglas ficam como estão)
  const inline = label === label.toUpperCase() ? label : label[0].toLowerCase() + label.slice(1);
  if (!list.length) return answer({ text: `${NO_DATA}: nenhum dos seus dashboards mede ${inline} ${when(ctx)}.` });
  const ranked = rank(m.id, list, best);
  const top = ranked[0];
  const d = top.prev[m.id] ? top.cur[m.id] / top.prev[m.id] - 1 : null;
  const lowerIsBetter = metric(m.id, "ecommerce").better === "down";
  const good = d === null ? null : lowerIsBetter ? d <= 0 : d >= 0;
  const alone = list.length === 1;
  return answer({
    text: alone
      ? `Só ${top.client} tem ${inline} nos seus dashboards: **${format(m.id, top.cur[m.id])}** ${when(ctx)}.`
      : `${best ? "O melhor" : "O pior"} ${inline} ${when(ctx)} é de **${top.client}**: **${format(m.id, top.cur[m.id])}**.`,
    card: { label: `${label} · ${top.client}`, value: format(m.id, top.cur[m.id]), delta: d !== null ? { text: `${change(d)} vs anterior`, good } : undefined, hint: lowerIsBetter ? "menor é melhor" : undefined },
    chart: alone ? undefined : { title: `${label} por cliente`, items: ranked.map((c) => ({ label: c.client, value: c.cur[m.id], display: format(m.id, c.cur[m.id]) })) },
    target: target(top, m.id),
  });
}

function limits(q: string, ctx: AgentContext): AgentAnswer | null {
  const { ent, counts, tierLabel } = ctx;
  if (has(q, "dashboard*")) {
    const left = Math.max(0, ent.maxDashboards - counts.dashboards);
    return answer({
      text: `No plano **${tierLabel}** você pode ter **${count(ent.maxDashboards)} dashboards**. Já criou ${count(counts.dashboards)}, então ${left ? `ainda pode criar **${count(left)}**` : "chegou ao limite"}.`,
      card: { label: "Dashboards disponíveis", value: `${count(left)} de ${count(ent.maxDashboards)}`, note: `Plano ${tierLabel}` },
      action: left ? { type: "navigate", href: "/painel/dashboards/novo?novo=1", label: "Criar dashboard" } : { type: "navigate", href: "/painel/plano", label: "Ver planos" },
    });
  }
  if (has(q, "landing*", "lp", "lps", "pagina*")) {
    if (!ctx.landingPages) return answer({ text: "As **landing pages** estão em breve. Em Landing pages, no menu, você entra na lista para acessar antes." });
    const left = Math.max(0, ent.maxLandingPages - counts.landingPublished);
    return answer({
      text: `No plano **${tierLabel}** cabem **${count(ent.maxLandingPages)} landing pages publicadas**. Você tem ${count(counts.landingPublished)} no ar, então ${left ? `ainda pode publicar **${count(left)}**` : "chegou ao limite"}.`,
      card: { label: "Landing pages disponíveis", value: `${count(left)} de ${count(ent.maxLandingPages)}`, note: `Plano ${tierLabel}` },
    });
  }
  if (has(q, "conta*")) {
    return answer({
      text: `Você tem **${count(counts.projects)} ${counts.projects === 1 ? "workspace" : "workspaces"}** de **${count(counts.contractedProjects)}** contratados, com ${count(counts.accounts)} ${counts.accounts === 1 ? "conta ativa" : "contas ativas"}.`,
      card: { label: "Workspaces", value: `${count(counts.projects)} de ${count(counts.contractedProjects)}` },
      action: { type: "navigate", href: "/painel/contas", label: "Abrir Contas" },
    });
  }
  return null;
}

const SECTIONS: { words: string[]; href: string; label: string }[] = [
  { words: ["landing*", "lps", "lp"], href: "/painel/landing-pages", label: "Landing pages" },
  { words: ["dashboard*"], href: "/painel/dashboards", label: "Dashboards" },
  { words: ["conta*"], href: "/painel/contas", label: "Contas" },
  { words: ["plano", "planos"], href: "/painel/plano", label: "Plano" },
  { words: ["inicio", "home"], href: "/painel", label: "Início" },
];

function act(q: string): AgentAnswer | null {
  if (has(q, "escuro", "dark", "noturno")) return answer({ text: "Pronto, **modo escuro** ligado.", action: { type: "theme", theme: "dark" } });
  if (has(q, "claro", "light") && has(q, "modo", "tema", "ativar", "ligar", "mudar", "trocar", "usar")) return answer({ text: "Pronto, **modo claro** ligado.", action: { type: "theme", theme: "light" } });
  if (has(q, "novo", "nova", "criar", "crie", "montar") && has(q, "dashboard*")) return answer({ text: "Abrindo **Novo dashboard**.", action: { type: "navigate", href: "/painel/dashboards/novo?novo=1", label: "Novo dashboard" } });
  if (has(q, "abr*", "ir", "vai", "va", "mostr*", "ver", "leva", "levar", "naveg*", "entrar", "entra")) {
    const s = SECTIONS.find((x) => has(q, ...x.words));
    if (s) return answer({ text: `Abrindo **${s.label}**.`, action: { type: "navigate", href: s.href, label: s.label } });
  }
  return null;
}

/** A resposta, de forma síncrona e pura (testável). */
export function respond(question: string, ctx: AgentContext): AgentAnswer {
  const q = normalize(question);
  if (!q) return answer({ text: "Oi! Pode perguntar. Por exemplo:", suggestions: SUGGESTIONS.slice(0, 3) });

  // limites antes das ações: "quantos dashboards ainda posso criar?" não é "criar dashboard"
  if (has(q, "quant*", "posso", "restam", "resta", "sobra*", "falta*", "limite*")) {
    const l = limits(q, ctx);
    if (l) return l;
  }

  const action = act(q);
  if (action) return action;
  if (has(q, "plano") && has(q, "qual", "meu", "estou", "tenho")) {
    return answer({
      text: `Você está no plano **${ctx.tierLabel}**. Ele libera **${count(ctx.ent.maxDashboards)} dashboards**${ctx.landingPages ? ` e **${count(ctx.ent.maxLandingPages)} landing pages publicadas**` : ""}.`,
      card: { label: "Plano", value: ctx.tierLabel, note: `${count(ctx.counts.contractedProjects)} ${ctx.counts.contractedProjects === 1 ? "workspace contratado" : "workspaces contratados"}` },
      action: { type: "navigate", href: "/painel/plano", label: "Ver plano" },
    });
  }
  const cmp = has(q, "melhor", "pior", "menor", "maior", "mais barato", "mais caro", "qual cliente", "quem") ? compare(q, ctx) : null;
  if (cmp) return withFocus(cmp, ctx);
  if (has(q, "invest*", "gast*", "verba*", "spend")) return withFocus(spend(ctx), ctx);
  if (has(q, "venda*", "conversao", "conversoes", "compra*")) return withFocus(totalOf(ctx, "conversions"), ctx);
  if (has(q, "lead*")) return withFocus(totalOf(ctx, "leads"), ctx);
  const metricQ = compare(q, ctx);
  if (metricQ) return withFocus(metricQ, ctx);

  return answer({
    understood: false,
    text: "Ainda não sei responder isso. Por enquanto eu leio os números dos seus dashboards (investimento, vendas, leads, CPA, CPL e ROAS), os limites do plano e abro seções do painel. Tente uma destas:",
    suggestions: SUGGESTIONS.slice(0, 3),
  });
}

export class LocalEngine implements VyzEngine {
  readonly label = "Motor local · dados da sua conta";
  async ask(question: string, ctx: AgentContext) {
    return respond(question, ctx);
  }
}
