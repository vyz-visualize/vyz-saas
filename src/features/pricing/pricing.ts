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

// Três planos fixos, cada um com o seu limite de workspaces (clientes ou marcas; no
// banco, "projects"): Básico até 3, Padrão até 5 e Avançado ilimitado (como o
// Personalizado). Não se escolhe quantidade: mais workspaces = plano de cima. Mensal: preço
// por mês. Anual: o total do ano (PLAN_YEAR, igual ao das lojas, que só aceitam os pontos de
// preço delas), cobrado de uma vez (~17% a menos nos três); PLAN.anual é esse total ÷ 12,
// arredondado, só para mostrar "por mês" e para o catálogo do banco (os itens guardam o valor
// por mês; a cobrança usa o total exato). Dashboards e usuários de cada plano: entitlements.ts. O banco
// aplica o mesmo limite (plan_entitlements.max_projects, nulo = sem limite; migration
// 20261120090000_plan_projects).

/**
 * Quantidade gravada na assinatura (accounts_quantity, obrigatória de 1 a 200) dos planos
 * sem limite de workspaces. O banco não confere o limite deles (max_projects nulo).
 */
export const UNLIMITED_PROJECTS = 200;

export const PLAN_PROJECTS: Record<PlanId, number> = { base: 3, pro: 5, avancado: UNLIMITED_PROJECTS };

/** Como o limite aparece na tela: "até 3 workspaces"; o Avançado, "workspaces ilimitados". */
export function projectsLabel(tier: PlanId, opts: { capital?: boolean } = {}): string {
  const text = tier === "avancado" ? "workspaces ilimitados" : `até ${PLAN_PROJECTS[tier]} workspaces`;
  return opts.capital ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Anual: o total cobrado no ano. Iguais aos das lojas (packages/shared/src/store-plans.ts). */
export const PLAN_YEAR: Record<PlanId, number> = {
  base: 49990, // R$ 499,90/ano
  pro: 149990, // R$ 1.499,90/ano
  avancado: 299990, // R$ 2.999,90/ano
};

/** Por mês em cada período. No anual, o total do ano ÷ 12, arredondado (R$ 41,66): só para mostrar. */
export const PLAN: Record<PlanId, Record<Period, number>> = {
  base: { mensal: 4990, anual: Math.round(PLAN_YEAR.base / 12) }, // R$ 49,90/mês; anual ≈ R$ 41,66/mês
  pro: { mensal: 14990, anual: Math.round(PLAN_YEAR.pro / 12) }, // R$ 149,90/mês; anual ≈ R$ 124,99/mês
  avancado: { mensal: 29990, anual: Math.round(PLAN_YEAR.avancado / 12) }, // R$ 299,90/mês; anual ≈ R$ 249,99/mês
};

export const DASH_CUSTOM = { unico: 190000, recorrente: { setup: 99000, mensal: 19900 } }; // R$ 1.900 ou R$ 990 + R$ 199/mês
export const LP_TEAM_PRICE = 95000; // "Landing page feita pelo time", já com GTM
export const LP_CARE_MONTHLY = 9900; // hospedagem e ajustes, por LP, opcional
export const DASH_EXTRA_PRICE = 9900; // R$ 99, pagamento único (não é mensalidade)
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
  /** Projetos do plano (PLAN_PROJECTS; 0 sem plano). */
  projects: number;
  /** Só o plano, por mês, no período escolhido. */
  planMonthly: number;
  /** Extras mensais (sem desconto no anual). */
  extrasMonthly: number;
  /** Todo mês = plano + extras mensais. */
  monthly: number;
  /** Todo mês, se fosse mensal / anual. */
  monthlyMensal: number;
  monthlyAnual: number;
  /** Total cobrado por ano no anual: o total do plano (PLAN_YEAR) + extras mensais × 12. */
  yearly: number;
  /** (plano no mensal − plano no anual) × 12. */
  annualSaving: number;
  /** Itens únicos + setups. */
  oneTime: number;
  twelveMonths: number;
  lines: QuoteLine[];
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Preço do plano por mês no período. O número de projetos é fixo por plano. */
export function planMonthly(plan: PlanId, period: Period): number {
  return PLAN[plan][period];
}

/** Preço de entrada do plano. */
export function startingPrice(plan: PlanId, period: Period): number {
  return planMonthly(plan, period);
}

/** Total cobrado por ano no anual. */
export const annualTotal = (plan: PlanId) => PLAN_YEAR[plan];

/** O que se cobra a cada período: o mês no mensal, o ano inteiro no anual. */
export const periodCharge = (plan: PlanId, period: Period) => (period === "anual" ? PLAN_YEAR[plan] : PLAN[plan].mensal);

/** Maior desconto do anual entre os planos (seletores de período: "até −17%"). */
export function maxAnnualSavingPct(): number {
  return Math.max(...(["base", "pro", "avancado"] as const).map(annualSavingPct));
}

/** Desconto do anual sobre 12 meses no mensal, em %. */
export function annualSavingPct(plan: PlanId): number {
  return Math.round((1 - PLAN_YEAR[plan] / (PLAN[plan].mensal * 12)) * 100);
}


export function quote(s: PlanState): Quote {
  if (s.produto === "lp") return quoteLp(s);
  const hasPlan = s.plano !== "sem";
  const projects = hasPlan ? PLAN_PROJECTS[s.plano as PlanId] : 0;

  const lines: QuoteLine[] = [];
  let planMensal = 0;
  let planAnual = 0;

  if (hasPlan) {
    const plan = s.plano as PlanId;
    planMensal = planMonthly(plan, "mensal");
    planAnual = planMonthly(plan, "anual");
    lines.push({ id: "plan", label: `Plano ${PLAN_LABEL[plan]} · ${projectsLabel(plan)}`, amount: PLAN[plan][s.periodo], kind: "monthly" });
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
  once("dash", "Dashboard adicional", hasPlan ? s.dash : 0, DASH_EXTRA_PRICE, `${s.dash} × ${brl(DASH_EXTRA_PRICE)} · pagamento único`);

  const planMonthlyNow = s.periodo === "anual" ? planAnual : planMensal;
  const monthly = planMonthlyNow + extrasMonthly;
  // no anual, o plano entra pelo total exato do ano (não por "por mês × 12")
  const planYear = hasPlan ? annualTotal(s.plano as PlanId) : 0;
  const yearly = planYear + extrasMonthly * 12;
  return {
    projects,
    planMonthly: planMonthlyNow,
    extrasMonthly,
    monthly,
    monthlyMensal: planMensal + extrasMonthly,
    monthlyAnual: planAnual + extrasMonthly,
    yearly,
    annualSaving: hasPlan ? planMensal * 12 - planYear : 0,
    oneTime,
    twelveMonths: (s.periodo === "anual" ? yearly : monthly * 12) + oneTime,
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
const NUM_KEYS = ["lp", "sob", "dash"] as const;

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
    out[k] = clamp(n, 0, MAX_EXTRA);
  }
  const sobm = params.get("sobm");
  if (sobm === "unico" || sobm === "recorrente") out.sobm = sobm;
  if (params.get("lpcare") === "1") out.lpcare = true;
  const nicho = params.get("nicho");
  if (nicho === "ecommerce" || nicho === "imobiliario") out.nicho = nicho;
  return out;
}
