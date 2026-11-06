// Todos os preços, em centavos. Mudou preço? Muda só aqui.
// Cada linha é arredondada em centavos e os totais somam as linhas.

import { brl } from "@/lib/format";

export type PlanId = "base" | "pro" | "avancado";
export type PlanChoice = PlanId | "sem";
export type Period = "mensal" | "anual";
export type Nicho = "ecommerce" | "imobiliario";
export type CustomBilling = "unico" | "recorrente";
/** Linha de produto: SaaS de dashboards ou SaaS de landing pages. */
export type Product = "dash" | "lp";
export const PRODUCTS: Product[] = ["dash", "lp"];
export const PRODUCT_LABEL: Record<Product, string> = { dash: "Dashboards", lp: "Landing pages" };

// Cobrança por projeto (cliente ou marca): o plano já inclui INCLUDED_PROJECTS
// e cada projeto a mais soma EXTRA_PROJECT por mês. Preço por mês; o anual é
// cobrado 12× o valor anual de uma vez.
export const INCLUDED_PROJECTS = 3;

export const PLAN: Record<PlanId, Record<Period, number>> = {
  base: { mensal: 4990, anual: 3990 },
  pro: { mensal: 7990, anual: 5990 },
  avancado: { mensal: 12990, anual: 9990 },
};

export const EXTRA_PROJECT: Record<PlanId, Record<Period, number>> = {
  base: { mensal: 1290, anual: 1290 },
  pro: { mensal: 1890, anual: 1890 },
  avancado: { mensal: 2990, anual: 2990 },
};

/** Plataforma fora do Básico (ex.: TikTok), por mês, sem desconto no anual. */
export const EXTRA_PLATFORM_PRICE = 4990;
export const DASH_CUSTOM = { unico: 190000, recorrente: { setup: 99000, mensal: 19900 } }; // R$ 1.900 ou R$ 990 + R$ 199/mês
export const LP_TEAM_PRICE = 95000; // "Landing page feita pelo time", já com GTM
export const LP_CARE_MONTHLY = 9900; // hospedagem e ajustes, por LP, opcional
export const DASH_EXTRA_PRICE = 9900; // R$ 99
export const MAX_PROJECTS_IN_PLAN = 200; // acima disso: sob consulta
export const WHATSAPP_NUMBER = "5571999575898"; // trocar quando a VYZ tiver número próprio

/** Teto de cada extra. */
export const MAX_EXTRA = 10;

export const PLAN_LABEL: Record<PlanChoice, string> = {
  base: "Básico",
  pro: "Padrão",
  avancado: "Avançado",
  sem: "Sem plano",
};

export const PERIOD_LABEL: Record<Period, string> = { mensal: "mensal", anual: "anual" };

export const NICHO_LABEL: Record<Nicho, string> = {
  ecommerce: "E-commerce",
  imobiliario: "Imobiliário",
};

// ---- Landing pages (produto lp) ----------------------------------------------
// Pacote: cada LP é feita pelo time (LP_TEAM_PRICE, uma vez) e tem hospedagem
// e ajustes por mês (LP_CARE_MONTHLY). Só mensal. Plano no banco: lp_<tier>.

export const LP_PLAN_PAGES: Record<PlanId, number> = { base: 1, pro: 3, avancado: 5 };

/** Id do plano no banco: dash usa o tier ("pro"); lp usa "lp_pro". */
export const planDbId = (product: Product, plan: PlanId) => (product === "lp" ? `lp_${plan}` : plan);

/** Plano do banco → produto e tier. null = desconhecido. */
export function parsePlanDbId(id: string | null | undefined): { product: Product; tier: PlanId | "personalizado" } | null {
  if (!id) return null;
  const lp = id.startsWith("lp_");
  const tier = lp ? id.slice(3) : id;
  if (tier !== "base" && tier !== "pro" && tier !== "avancado" && (lp || tier !== "personalizado")) return null;
  return { product: lp ? "lp" : "dash", tier: tier as PlanId | "personalizado" };
}

/** Para onde o cliente vai depois de pagar: cada produto tem o seu caminho. */
export const PRODUCT_HOME: Record<Product, string> = { dash: "/comecar", lp: "/painel/landing-pages?bemvindo=1" };

export const lpMonthly = (plan: PlanId) => LP_PLAN_PAGES[plan] * LP_CARE_MONTHLY;
export const lpSetup = (plan: PlanId) => LP_PLAN_PAGES[plan] * LP_TEAM_PRICE;

export type PlanState = {
  /** Produto escolhido na página de preços. */
  produto: Product;
  plano: PlanChoice;
  periodo: Period;
  /** Projetos (clientes ou marcas): no mínimo INCLUDED_PROJECTS. */
  projetos: number;
  /** Plataformas acima do plano liberadas à parte (EXTRA_PLATFORM_PRICE cada). */
  plataformas: number;
  /** Landing pages feitas pelo time. */
  lp: number;
  /** Hospedagem e ajustes nas LPs (R$ 99/mês por LP). */
  lpcare: boolean;
  /** Dashboards sob medida. */
  sob: number;
  sobm: CustomBilling;
  dash: number;
  nicho: Nicho | null;
};

export const DEFAULT_STATE: PlanState = {
  produto: "dash",
  plano: "pro",
  periodo: "anual",
  projetos: INCLUDED_PROJECTS,
  plataformas: 0,
  lp: 0,
  lpcare: false,
  sob: 0,
  sobm: "unico",
  dash: 0,
  nicho: null,
};

export type QuoteLine = {
  id: string;
  label: string;
  detail?: string;
  /** Quantidade, nas linhas de extras. */
  qty?: number;
  amount: number;
  kind: "monthly" | "once" | "included";
};

export type Quote = {
  /** Projetos cobrados (entre INCLUDED_PROJECTS e MAX_PROJECTS_IN_PLAN; 0 sem plano). */
  projects: number;
  /** Acima de MAX_PROJECTS_IN_PLAN: sob consulta. */
  overLimit: boolean;
  /** Só o plano, por mês, no período escolhido. */
  planMonthly: number;
  /** Extras mensais (sem desconto no anual). */
  extrasMonthly: number;
  /** Todo mês = plano + extras mensais. */
  monthly: number;
  /** Todo mês, se fosse mensal / anual. */
  monthlyMensal: number;
  monthlyAnual: number;
  /** Total cobrado por ano no anual (todo mês × 12). */
  yearly: number;
  /** (plano no mensal − plano no anual) × 12. */
  annualSaving: number;
  /** Itens únicos + setups. */
  oneTime: number;
  twelveMonths: number;
  lines: QuoteLine[];
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function planMonthly(plan: PlanId, period: Period, projects: number): number {
  return PLAN[plan][period] + Math.max(0, projects - INCLUDED_PROJECTS) * EXTRA_PROJECT[plan][period];
}

/** Preço de entrada do plano, com os projetos inclusos. */
export function startingPrice(plan: PlanId, period: Period): number {
  return planMonthly(plan, period, INCLUDED_PROJECTS);
}

/** Desconto do anual sobre o mensal, em %, no preço de entrada. */
export function annualSavingPct(plan: PlanId): number {
  return Math.round((1 - PLAN[plan].anual / PLAN[plan].mensal) * 100);
}

const projectsLabel = (n: number) => `${n} ${n === 1 ? "projeto" : "projetos"}`;

export function quote(s: PlanState): Quote {
  if (s.produto === "lp") return quoteLp(s);
  const hasPlan = s.plano !== "sem";
  const overLimit = hasPlan && s.projetos > MAX_PROJECTS_IN_PLAN;
  const projects = hasPlan ? clamp(s.projetos, INCLUDED_PROJECTS, MAX_PROJECTS_IN_PLAN) : 0;

  const lines: QuoteLine[] = [];
  let planMensal = 0;
  let planAnual = 0;

  if (hasPlan) {
    const plan = s.plano as PlanId;
    planMensal = planMonthly(plan, "mensal", projects);
    planAnual = planMonthly(plan, "anual", projects);

    lines.push({ id: "plan", label: `Plano ${PLAN_LABEL[plan]} · ${projectsLabel(INCLUDED_PROJECTS)}`, amount: PLAN[plan][s.periodo], kind: "monthly" });
    const extra = projects - INCLUDED_PROJECTS;
    if (extra > 0) {
      const unit = EXTRA_PROJECT[plan][s.periodo];
      lines.push({
        id: "projects",
        label: extra === 1 ? "1 projeto a mais" : `${extra} projetos a mais`,
        detail: `${extra} × ${brl(unit)}`,
        amount: extra * unit,
        kind: "monthly",
      });
    }
  }

  let oneTime = 0;
  let extrasMonthly = 0;
  const once = (id: string, label: string, qty: number, unit: number, detail?: string) => {
    if (qty <= 0) return;
    const amount = qty * unit;
    oneTime += amount;
    lines.push({ id, label, detail: detail ?? `${qty} × ${brl(unit)}`, qty, amount, kind: "once" });
  };
  const monthlyExtra = (id: string, label: string, qty: number, unit: number) => {
    if (qty <= 0) return;
    const amount = qty * unit;
    extrasMonthly += amount;
    lines.push({ id, label, detail: `${qty} × ${brl(unit)} · sem desconto no anual`, qty, amount, kind: "monthly" });
  };

  once("lp", "Landing page feita pelo time", s.lp, LP_TEAM_PRICE, `${s.lp} × ${brl(LP_TEAM_PRICE)} · já com o GTM`);
  if (s.lpcare) monthlyExtra("lpcare", "Hospedagem e ajustes das LPs", s.lp, LP_CARE_MONTHLY);
  if (s.sobm === "recorrente") {
    once("sob", "Dashboard sob medida · setup", s.sob, DASH_CUSTOM.recorrente.setup);
    monthlyExtra("sobmes", "Dashboard sob medida · mensal", s.sob, DASH_CUSTOM.recorrente.mensal);
  } else {
    once("sob", "Dashboard sob medida", s.sob, DASH_CUSTOM.unico);
  }
  once("dash", "Dashboard adicional", hasPlan ? s.dash : 0, DASH_EXTRA_PRICE);
  if (s.plano === "base") monthlyExtra("platform", "Plataforma extra", s.plataformas, EXTRA_PLATFORM_PRICE);

  const planMonthlyNow = s.periodo === "anual" ? planAnual : planMensal;
  const monthly = planMonthlyNow + extrasMonthly;
  return {
    projects,
    overLimit,
    planMonthly: planMonthlyNow,
    extrasMonthly,
    monthly,
    monthlyMensal: planMensal + extrasMonthly,
    monthlyAnual: planAnual + extrasMonthly,
    yearly: (planAnual + extrasMonthly) * 12,
    annualSaving: (planMensal - planAnual) * 12,
    oneTime,
    twelveMonths: monthly * 12 + oneTime,
    lines,
  };
}

/** Plano de landing pages: pacote de LPs (uma vez) + hospedagem mensal. Sem anual. */
function quoteLp(s: PlanState): Quote {
  const lines: QuoteLine[] = [];
  let monthly = 0;
  let oneTime = 0;
  if (s.plano !== "sem") {
    const plan = s.plano;
    const pages = LP_PLAN_PAGES[plan];
    monthly = lpMonthly(plan);
    oneTime = lpSetup(plan);
    lines.push({ id: "plan", label: `Plano ${PLAN_LABEL[plan]} · ${pages} ${pages === 1 ? "landing page" : "landing pages"}`, detail: `${pages} × ${brl(LP_CARE_MONTHLY)} · hospedagem e ajustes`, amount: monthly, kind: "monthly" });
    lines.push({ id: "lp", label: "Criação pelo time", detail: `${pages} × ${brl(LP_TEAM_PRICE)} · já com o GTM`, qty: pages, amount: oneTime, kind: "once" });
  }
  return {
    projects: 0,
    overLimit: false,
    planMonthly: monthly,
    extrasMonthly: 0,
    monthly,
    monthlyMensal: monthly,
    monthlyAnual: monthly,
    yearly: monthly * 12,
    annualSaving: 0,
    oneTime,
    twelveMonths: monthly * 12 + oneTime,
    lines,
  };
}

// ---- URL ----------------------------------------------------------------

const PLAN_CHOICES: PlanChoice[] = ["base", "pro", "avancado", "sem"];
const NUM_KEYS = ["projetos", "plataformas", "lp", "sob", "dash"] as const;

export function toQuery(s: PlanState): string {
  const p = new URLSearchParams();
  if (s.produto === "lp") p.set("produto", "lp");
  p.set("plano", s.plano);
  p.set("periodo", s.periodo);
  for (const k of NUM_KEYS) p.set(k, String(s[k]));
  p.set("sobm", s.sobm);
  if (s.lpcare) p.set("lpcare", "1");
  if (s.nicho) p.set("nicho", s.nicho);
  return p.toString();
}

export function fromQuery(params: { get(key: string): string | null }): Partial<PlanState> | null {
  if (!params.get("plano") && !params.get("periodo")) return null;
  const out: Partial<PlanState> = {};
  const produto = params.get("produto");
  if (produto === "dash" || produto === "lp") out.produto = produto;
  const plano = params.get("plano");
  if (plano && (PLAN_CHOICES as string[]).includes(plano)) out.plano = plano as PlanChoice;
  const periodo = params.get("periodo");
  if (periodo === "mensal" || periodo === "anual") out.periodo = periodo;
  for (const k of NUM_KEYS) {
    const raw = params.get(k);
    if (raw === null) continue;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) continue;
    out[k] = k === "projetos" ? clamp(n, INCLUDED_PROJECTS, MAX_PROJECTS_IN_PLAN + 1) : clamp(n, 0, MAX_EXTRA);
  }
  const sobm = params.get("sobm");
  if (sobm === "unico" || sobm === "recorrente") out.sobm = sobm;
  if (params.get("lpcare") === "1") out.lpcare = true;
  const nicho = params.get("nicho");
  if (nicho === "ecommerce" || nicho === "imobiliario") out.nicho = nicho;
  return out;
}
