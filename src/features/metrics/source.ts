// DataSource: de onde vêm os números dos widgets. Hoje só existe a MockSource
// (determinística, com seed); a DbSource entra quando houver conexões reais.

import { apportion } from "@/features/sync/apportion";
import { isAdPlatform, type PlatformId } from "@/features/accounts/platforms";
import { hash, rng, type Rng } from "@/lib/random";
import type { Profile } from "./definitions";

export type DataSpec = {
  /** Texto da seed: o mesmo texto gera sempre o mesmo painel. */
  seed: string;
  profile: Profile;
  sources: PlatformId[];
  /** Dias do período atual (o anterior tem o mesmo tamanho). */
  days: number;
  /** Meta de CPA/CPL (centavos), margem (0–1) e verba mensal (centavos). */
  goal?: number;
  margin?: number;
  budget?: number;
  /** Variação "ao vivo" (só no mock da LP). */
  tick?: number;
};

export type PlatformDay = { spend: number; impressions: number; clicks: number; conv: number };

export type DayRow = {
  /** Dias atrás (0 = hoje). */
  ago: number;
  spend: number;
  impressions: number;
  clicks: number;
  /** Conversões confirmadas (GA4 ou CRM), sem dupla contagem. */
  conversions: number;
  revenue: number;
  leads: number;
  qualified: number;
  visits: number;
  calls: number;
  sessions: number;
  views: number;
  /** O que cada plataforma atribui a si (a soma passa das confirmadas). */
  byPlatform: Partial<Record<PlatformId, PlatformDay>>;
  /** Parte das conversões ainda vai chegar (últimos 3 dias). */
  maturing: boolean;
};

export type Campaign = { /** Estável no mesmo modelo: é o que vai na URL do filtro. */ id: string; name: string; platform: PlatformId; spend: number; impressions: number; clicks: number; conversions: number; revenue: number };
export type Creative = { id: string; name: string; format: string; platform: PlatformId; spend: number; impressions: number; clicks: number; conversions: number; frequency: number; tone: number };
export type FunnelStep = { label: string; pct: number };
export type Project = { name: string; invest: number; cpl: number; bad?: boolean };
export type AudienceRow = { label: string; share: number; cpa: number };
export type Product = { name: string; sold: number; revenue: number; spend: number };
export type CrmStage = { stage: string; count: number; value: number };
export type Client = { name: string; spend: number; conversions: number; goal: number };
export type Alert = { level: "erro" | "atencao" | "info"; title: string; detail: string };

export type Dataset = {
  spec: DataSpec;
  current: DayRow[];
  previous: DayRow[];
  adPlatforms: PlatformId[];
  campaigns: Campaign[];
  creatives: Creative[];
  funnel: FunnelStep[];
  projects: Project[];
  audience: AudienceRow[];
  gender: { label: string; share: number }[];
  products: Product[];
  crm: CrmStage[];
  clients: Client[];
  alerts: Alert[];
  budget: { monthly: number; spent: number; day: number; daysInMonth: number };
  /** Meta de custo por conversão e ROAS de equilíbrio (1 ÷ margem). */
  goal: number;
  breakEven: number;
};

export interface DataSource {
  load(spec: DataSpec): Dataset;
}

// ---- parâmetros por perfil ------------------------------------------------

type Params = {
  spendDay: [number, number];
  /** Custo por conversão confirmada (centavos). */
  cpa: [number, number];
  roas?: [number, number];
  /** Leads por conversão (para perfis com lead antes da conversão). */
  leadsPerConv?: [number, number];
  qualifiedShare?: [number, number];
};

const PARAMS: Record<Profile, Params> = {
  ecommerce: { spendDay: [160000, 420000], cpa: [4000, 8800], roas: [2.4, 4.4] },
  executivo: { spendDay: [200000, 520000], cpa: [4500, 9000], roas: [2.6, 4.2] },
  marketplace: { spendDay: [70000, 190000], cpa: [2400, 5800], roas: [3.2, 6] },
  site: { spendDay: [0, 0], cpa: [0, 0], roas: [0, 0] },
  infoproduto: { spendDay: [120000, 380000], cpa: [9000, 26000], roas: [2, 3.6], leadsPerConv: [16, 30] },
  leads: { spendDay: [60000, 200000], cpa: [1500, 4500], qualifiedShare: [0.4, 0.62] },
  imob: { spendDay: [150000, 400000], cpa: [4200, 11800], leadsPerConv: [1.5, 1.9] },
  local: { spendDay: [15000, 60000], cpa: [800, 2000] },
  midia: { spendDay: [40000, 150000], cpa: [1500, 6000] },
  pesquisa: { spendDay: [50000, 180000], cpa: [3000, 9000] },
  agencia: { spendDay: [300000, 900000], cpa: [3000, 8000] },
  saude: { spendDay: [30000, 120000], cpa: [5000, 12000], leadsPerConv: [2.2, 3] },
  educacao: { spendDay: [60000, 200000], cpa: [15000, 40000], leadsPerConv: [8, 15] },
  video: { spendDay: [30000, 120000], cpa: [3, 12] },
};

const WEIGHT: Partial<Record<PlatformId, number>> = { meta: 0.55, google: 0.35, tiktok: 0.22, linkedin: 0.15, youtube: 0.4, mercado: 0.5, shopee: 0.4 };
const CTR: Partial<Record<PlatformId, [number, number]>> = {
  meta: [0.011, 0.018],
  google: [0.035, 0.065],
  tiktok: [0.008, 0.012],
  linkedin: [0.005, 0.008],
  youtube: [0.004, 0.007],
  mercado: [0.018, 0.026],
  shopee: [0.02, 0.03],
};
const CPM: Partial<Record<PlatformId, [number, number]>> = {
  meta: [1400, 2600],
  google: [4500, 9000],
  tiktok: [800, 1600],
  linkedin: [6000, 11000],
  youtube: [900, 1800],
  mercado: [1200, 2400],
  shopee: [1000, 2000],
};

const HISTORY = 120;
const MATURING = [0.5, 0.72, 0.9]; // hoje, ontem, anteontem

// ---- nomes ----------------------------------------------------------------

const CAMPAIGNS: Record<Profile, string[]> = {
  ecommerce: ["Prospecção · Advantage+", "Remarketing · Catálogo", "Pesquisa · Marca", "Shopping · Performance Max", "Prospecção · Interesses"],
  executivo: ["Prospecção · Advantage+", "Remarketing · Catálogo", "Pesquisa · Marca", "Performance Max", "Prospecção · Interesses"],
  marketplace: ["Produtos patrocinados · Top 20", "Marca · Loja oficial", "Ofertas relâmpago", "Catálogo completo"],
  site: ["Orgânico", "Direto", "Mídia paga", "E-mail", "Referência"],
  infoproduto: ["Captação · Aula ao vivo", "Remarketing · Carrinho", "Pesquisa · Nome do curso", "Lookalike · Compradores"],
  leads: ["Formulário · Lookalike 1%", "Pesquisa · Serviço", "Formulário · Interesses", "Remarketing · Site"],
  imob: ["Empr. A · Lançamento", "Empr. B · Últimas unidades", "Pesquisa · Apartamento", "Empr. C · Decorado"],
  local: ["Mensagens · Raio 5 km", "Pesquisa · Perto de mim", "Mensagens · Remarketing", "Ligações · Pesquisa"],
  midia: ["Prospecção · Amplo", "Remarketing · 30 dias", "Lookalike · Clientes", "Engajamento · Vídeo"],
  pesquisa: ["Marca", "Serviço · Correspondência exata", "Concorrentes", "Serviço · Ampla", "Remarketing de pesquisa"],
  agencia: ["Carteira · Meta", "Carteira · Google", "Carteira · Pesquisa", "Carteira · Remarketing"],
  saude: ["Agendamento · Raio 8 km", "Pesquisa · Especialidade", "Remarketing · Site", "Lookalike · Pacientes"],
  educacao: ["Captação · Vestibular", "Pesquisa · Curso", "Remarketing · Inscritos", "Lookalike · Alunos"],
  video: ["In-stream · Pulável", "Bumper 6s", "Shorts", "Discovery"],
};

const CREATIVES = [
  ["Vídeo UGC 15s", "Vídeo"],
  ["Carrossel · Coleção", "Carrossel"],
  ["Estático · Oferta", "Imagem"],
  ["Depoimento 30s", "Vídeo"],
  ["Reels · Bastidores", "Vídeo"],
  ["Estático · Prova social", "Imagem"],
  ["Carrossel · Antes e depois", "Carrossel"],
  ["Vídeo · Demonstração", "Vídeo"],
] as const;

const FUNNELS: Record<Profile, string[]> = {
  ecommerce: ["Produto", "Carrinho", "Checkout", "Compra"],
  executivo: ["Produto", "Carrinho", "Checkout", "Compra"],
  marketplace: ["Visita", "Carrinho", "Pagamento", "Compra"],
  site: ["Sessão", "Produto", "Carrinho", "Checkout", "Compra"],
  infoproduto: ["Lead", "Página de vendas", "Checkout", "Compra"],
  leads: ["Clique", "Formulário", "Lead", "Qualificado"],
  imob: ["Lead", "Contato", "Visita", "Proposta"],
  local: ["Clique", "Conversa", "Orçamento", "Venda"],
  midia: ["Impressão", "Clique", "Página", "Resultado"],
  pesquisa: ["Clique", "Página", "Formulário", "Conversão"],
  agencia: ["Clique", "Página", "Lead", "Venda"],
  saude: ["Lead", "Contato", "Agendamento", "Consulta"],
  educacao: ["Lead", "Contato", "Aula ou visita", "Matrícula"],
  video: ["Impressão", "Visualização", "Clique", "Conversão"],
};

const CLIENTS = ["Loja Verde", "Clínica Sol", "Incorporadora Sul", "Escola Aurora", "Pet Mais", "Ótica Visão", "Academia Ritmo", "Café Grão"];
const PRODUCTS: Record<string, string[]> = {
  default: ["Camiseta básica", "Tênis casual", "Mochila urbana", "Jaqueta corta-vento", "Boné", "Meia esportiva"],
};

// ---- geração ----------------------------------------------------------------

function funnel(r: Rng, labels: string[]): FunnelStep[] {
  const steps: FunnelStep[] = [{ label: labels[0], pct: 100 }];
  let last = 100;
  for (let i = 1; i < labels.length; i++) {
    const keep = r.range(0.38, 0.72);
    last = Math.max(1, Math.round(last * keep));
    steps.push({ label: labels[i], pct: last });
  }
  return steps;
}

function emptyDay(ago: number): DayRow {
  return { ago, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, leads: 0, qualified: 0, visits: 0, calls: 0, sessions: 0, views: 0, byPlatform: {}, maturing: false };
}

type CampaignTotals = Pick<Campaign, "spend" | "impressions" | "clicks" | "conversions" | "revenue">;

/** Reparte um total pelos pesos, com pelo menos 1 para cada quando dá (nenhuma campanha fica sem conversão). */
function shareOut(total: number, weights: readonly number[], atLeastOne = false): number[] {
  const whole = Math.round(total);
  if (!atLeastOne || whole < weights.length) return apportion(whole, weights);
  return apportion(whole - weights.length, weights).map((v) => v + 1);
}

/**
 * As campanhas somam exatamente o que o modelo mostra: com uma plataforma de anúncios, os
 * totais dos cards; com mais de uma, a parte de cada plataforma (a mesma de platformPart).
 * Os cards não mudam: quem se ajusta é a campanha.
 */
function closeCampaigns(raw: readonly Campaign[], current: readonly DayRow[], adPlatforms: readonly PlatformId[]): Campaign[] {
  const sum = (pick: (d: DayRow) => number) => current.reduce((a, d) => a + pick(d), 0);
  const attributed = adPlatforms.reduce((a, id) => a + sum((d) => d.byPlatform[id]?.conv ?? 0), 0);
  const target = (id: PlatformId): CampaignTotals => {
    if (adPlatforms.length <= 1 || !adPlatforms.includes(id)) {
      return { spend: sum((d) => d.spend), impressions: sum((d) => d.impressions), clicks: sum((d) => d.clicks), conversions: sum((d) => d.conversions), revenue: sum((d) => d.revenue) };
    }
    const conversions = sum((d) => d.byPlatform[id]?.conv ?? 0);
    return {
      spend: sum((d) => d.byPlatform[id]?.spend ?? 0),
      impressions: sum((d) => d.byPlatform[id]?.impressions ?? 0),
      clicks: sum((d) => d.byPlatform[id]?.clicks ?? 0),
      conversions,
      revenue: attributed > 0 ? (sum((d) => d.revenue) * conversions) / attributed : 0,
    };
  };
  const out = [...raw];
  for (const id of new Set(raw.map((c) => c.platform))) {
    const idx = raw.flatMap((c, i) => (c.platform === id ? [i] : []));
    const t = target(id);
    const of = (pick: (c: Campaign) => number) => idx.map((i) => pick(raw[i]));
    const spend = shareOut(t.spend, of((c) => c.spend));
    const impressions = shareOut(t.impressions, of((c) => c.impressions));
    const clicks = shareOut(t.clicks, of((c) => c.clicks));
    const conversions = shareOut(t.conversions, of((c) => c.conversions), true);
    const revenue = shareOut(t.revenue, of((c) => c.revenue));
    idx.forEach((i, k) => {
      out[i] = { ...raw[i], spend: spend[k], impressions: impressions[k], clicks: clicks[k], conversions: conversions[k], revenue: revenue[k] };
    });
  }
  return out;
}

export const MockSource: DataSource = {
  load(spec) {
    const r = rng(hash(`${spec.seed}|${spec.profile}|${[...spec.sources].sort().join(",")}`));
    const p = PARAMS[spec.profile];
    const ads = spec.sources.filter(isAdPlatform);
    const adPlatforms = ads.length ? ads : spec.profile === "site" ? [] : (["meta"] as PlatformId[]);

    // com verba informada, o investimento acompanha a verba (pacing plausível)
    const drawn = r.range(...p.spendDay);
    const spendDay = spec.budget && p.spendDay[1] > 0 ? (spec.budget / 30) * (0.88 + (drawn / p.spendDay[1]) * 0.18) : drawn;
    const cpa = r.range(...p.cpa);
    const roas = p.roas ? r.range(...p.roas) : 0;
    const ticket = roas * cpa;
    const trend = r.range(-0.12, 0.08);
    const weights = adPlatforms.map((id) => (WEIGHT[id] ?? 0.3) * r.range(0.8, 1.2));
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    const ctr = Object.fromEntries(adPlatforms.map((id) => [id, r.range(...(CTR[id] ?? [0.01, 0.02]))]));
    const cpm = Object.fromEntries(adPlatforms.map((id) => [id, r.range(...(CPM[id] ?? [1500, 2500]))]));
    const overclaim = r.range(1.22, 1.5);
    const qualifiedShare = p.qualifiedShare ? r.range(...p.qualifiedShare) : r.range(0.52, 0.66);
    const leadsPerConv = p.leadsPerConv ? r.range(...p.leadsPerConv) : 1;
    const siteSessions = r.range(1800, 6000);
    const siteRate = r.range(0.012, 0.028);
    const siteTicket = r.range(18000, 42000);

    const days: DayRow[] = [];
    for (let i = HISTORY - 1; i >= 0; i--) {
      const d = emptyDay(i);
      const t = 1 - i / HISTORY; // 0 → 1 do mais antigo ao mais novo
      const weekday = (HISTORY - i) % 7;
      const season = weekday === 5 || weekday === 6 ? 0.86 : 1;
      const noise = () => r.range(0.84, 1.16);
      const spend = spendDay * (1 + trend * (t - 0.5)) * season * noise();
      const matured = i < 3 ? MATURING[i] : 1;
      d.maturing = i < 3;

      if (spec.profile === "site") {
        d.sessions = Math.round(siteSessions * season * noise());
        d.conversions = Math.round(d.sessions * siteRate * noise() * matured);
        d.revenue = Math.round(d.conversions * siteTicket * r.range(0.9, 1.1));
      } else {
        let clicks = 0;
        let impressions = 0;
        adPlatforms.forEach((id, k) => {
          const s = (spend * weights[k]) / wsum;
          const imp = (s / cpm[id]) * 1000;
          const c = imp * ctr[id] * r.range(0.9, 1.1);
          d.byPlatform[id] = { spend: Math.round(s), impressions: Math.round(imp), clicks: Math.round(c), conv: 0 };
          clicks += c;
          impressions += imp;
        });
        d.spend = Math.round(spend);
        d.impressions = Math.round(impressions);
        d.clicks = Math.round(clicks);
        const conv = (spend / cpa) * noise();
        d.conversions = Math.max(0, Math.round(conv * matured));
        d.revenue = Math.round(d.conversions * ticket * r.range(0.92, 1.08));
        d.leads = Math.round(d.conversions * leadsPerConv * r.range(0.95, 1.05));
        if (spec.profile === "leads") {
          d.leads = d.conversions;
          d.qualified = Math.round(d.leads * qualifiedShare);
        }
        if (spec.profile === "imob") {
          d.qualified = d.conversions;
          d.visits = Math.round(d.qualified * r.range(0.18, 0.28));
        }
        if (spec.profile === "local") d.calls = Math.round(d.conversions * r.range(0.25, 0.4));
        if (spec.profile === "video") {
          d.views = d.conversions;
          d.conversions = Math.round(d.clicks * 0.04 * matured);
        }
        d.sessions = Math.round(clicks * r.range(0.78, 0.9));
        // cada plataforma atribui a si mais do que a sua parte
        adPlatforms.forEach((id, k) => {
          const share = weights[k] / wsum;
          d.byPlatform[id]!.conv = Math.round(d.conversions * share * overclaim * r.range(0.9, 1.1));
        });
      }
      days.push(d);
    }

    // "ao vivo": o dia de hoje mexe um pouco a cada tick
    if (spec.tick) {
      const lr = rng(hash(`${spec.seed}|tick|${spec.tick}`));
      const today = days[days.length - 1];
      const f = 1 + lr.range(-0.06, 0.06);
      today.spend = Math.round(today.spend * f);
      today.conversions = Math.max(0, Math.round(today.conversions * (1 + lr.range(-0.08, 0.08))));
      today.revenue = Math.round(today.revenue * (1 + lr.range(-0.06, 0.06)));
    }

    const n = Math.max(1, Math.min(spec.days, HISTORY / 2));
    const current = days.slice(-n);
    const previous = days.slice(-2 * n, -n);

    const totalSpend = current.reduce((a, d) => a + d.spend, 0);
    const totalConv = current.reduce((a, d) => a + d.conversions, 0);

    // campanhas: dividem o investimento e variam em eficiência
    const names = CAMPAIGNS[spec.profile];
    const cshares = names.map(() => r.range(0.6, 1.4));
    const csum = cshares.reduce((a, b) => a + b, 0);
    const rawCampaigns = names.map((name, i) => {
      const share = cshares[i] / csum;
      const eff = r.range(0.55, 1.6);
      const spend = Math.round(totalSpend * share);
      const impressions = Math.round(current.reduce((a, d) => a + d.impressions, 0) * share * r.range(0.8, 1.2));
      const clicks = Math.round(current.reduce((a, d) => a + d.clicks, 0) * share * r.range(0.7, 1.3));
      const conversions = Math.max(1, Math.round(totalConv * share * eff));
      return { id: `c${i}`, name, platform: adPlatforms[i % Math.max(1, adPlatforms.length)] ?? "ga4", spend, impressions, clicks, conversions, revenue: Math.round(conversions * (ticket || siteTicket) * r.range(0.85, 1.15)) };
    });

    const campaigns = closeCampaigns(rawCampaigns, current, adPlatforms);

    const creatives: Creative[] = CREATIVES.map(([name, format], i) => {
      const spend = Math.round((totalSpend / CREATIVES.length) * r.range(0.4, 1.8));
      const impressions = Math.round((spend / 2000) * 1000 * r.range(0.8, 1.2));
      const clicks = Math.round(impressions * r.range(0.006, 0.024));
      return {
        id: `c${i}`,
        name,
        format,
        platform: adPlatforms[i % Math.max(1, adPlatforms.length)] ?? "meta",
        spend,
        impressions,
        clicks,
        conversions: Math.max(0, Math.round((spend / cpa) * r.range(0.4, 1.7))),
        frequency: r.range(1.2, 4.1),
        tone: i % 5,
      };
    });

    const projects: Project[] = Array.from({ length: r.int(6, 7) }, (_, i) => ({
      name: `Empr. ${"ABCDEFG"[i]}`,
      invest: r.range(0.08, 0.66),
      cpl: r.range(0.12, 0.48),
    }));
    const bad = r.int(0, projects.length - 1);
    projects[bad] = { ...projects[bad], invest: r.range(0.78, 0.95), cpl: r.range(0.78, 0.92), bad: true };

    const ages = ["18–24", "25–34", "35–44", "45–54", "55+"];
    const ashares = ages.map(() => r.range(0.4, 1.4));
    const asum = ashares.reduce((a, b) => a + b, 0);
    const audience = ages.map((label, i) => ({ label, share: ashares[i] / asum, cpa: cpa * r.range(0.65, 1.5) }));
    const female = r.range(0.38, 0.68);

    const products: Product[] = PRODUCTS.default.map((name) => {
      const sold = r.int(20, 260);
      const revenue = Math.round(sold * (ticket || siteTicket) * r.range(0.4, 1.2));
      return { name, sold, revenue, spend: Math.round(revenue / r.range(1.6, 6)) };
    });

    const totalLeads = current.reduce((a, d) => a + (d.leads || d.conversions), 0);
    const crmLabels = ["Lead", "MQL", "SQL", "Proposta", "Venda"];
    let count = totalLeads;
    const crm: CrmStage[] = crmLabels.map((stage, i) => {
      if (i > 0) count = Math.round(count * r.range(0.35, 0.65));
      return { stage, count, value: Math.round(count * r.range(80000, 260000)) };
    });

    const clients: Client[] = CLIENTS.slice(0, r.int(6, 8)).map((name) => {
      const spend = Math.round((totalSpend / 7) * r.range(0.3, 1.8));
      const goal = Math.round(cpa * r.range(0.8, 1.2));
      return { name, spend, goal, conversions: Math.max(1, Math.round((spend / goal) * r.range(0.6, 1.4))) };
    });

    const goal = spec.goal ?? Math.round(cpa * r.range(0.86, 0.98) / 500) * 500;
    const breakEven = spec.margin ? 1 / spec.margin : Math.round(r.range(2, 2.7) * 10) / 10;

    const worst = [...campaigns].sort((a, b) => b.spend / b.conversions - a.spend / a.conversions)[0];
    const tired = [...creatives].sort((a, b) => b.frequency - a.frequency)[0];
    const alerts: Alert[] = [
      { level: "erro", title: `CPA ${Math.round(((worst.spend / worst.conversions) / goal - 1) * 100)}% acima da meta`, detail: `${worst.name}: vale revisar segmentação e lance.` },
      { level: "atencao", title: `Frequência ${tired.frequency.toFixed(1).replace(".", ",")} em ${tired.name}`, detail: "O criativo está saturando o público. Hora de renovar." },
      { level: "atencao", title: "Últimos 3 dias em maturação", detail: "Parte das conversões ainda vai chegar. Não corte verba por essa queda." },
      { level: "info", title: "Tag de conversão ativa", detail: "Eventos chegando normalmente nas últimas 24 h." },
    ];

    const daysInMonth = 30;
    const day = r.int(12, 26);
    const monthly = spec.budget ?? Math.round((spendDay * daysInMonth * r.range(0.95, 1.15)) / 100000) * 100000;
    const spent = Math.round(spendDay * day * r.range(0.9, 1.12));

    return {
      spec,
      current,
      previous,
      adPlatforms,
      campaigns,
      creatives,
      funnel: funnel(r, FUNNELS[spec.profile]),
      projects,
      audience,
      gender: [
        { label: "Mulheres", share: female },
        { label: "Homens", share: 1 - female },
      ],
      products,
      crm,
      clients,
      alerts,
      budget: { monthly, spent, day, daysInMonth },
      goal,
      breakEven,
    } satisfies Dataset;
  },
};
