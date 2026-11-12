import "server-only";

// Importação real dos CRMs: negócios (com etapa, valor, criação e fechamento) e
// contatos criados no período. Cada CRM vira a mesma lista normalizada e
// buildCrmDays monta as linhas de crm_daily. O token é o do login de cada CRM.
//
// Tolerância: a lista de negócios criados no período é obrigatória (sem ela não há
// o que mostrar). Etapas, contatos e os ganhos de negócios criados antes do período
// são opcionais: se falharem, a sincronização segue sem eles (fica no log).
//
// Docs:
//   HubSpot: developers.hubspot.com/docs/api/crm/search (deals, contacts) e /crm/v3/pipelines/deals
//   Pipedrive: developers.pipedrive.com/docs/api/v1 (Deals, Stages, Persons)
//   RD Station CRM v2: developers.rdstation.com/reference (crm-v2: deals, pipelines, contacts)
//   Kommo: developers.kommo.com/reference (leads list com filter[created_at], leads/pipelines)

import { buildCrmDays, crmInstant, crmNumber, type CrmDataset, type CrmDealInput, type CrmDealStatus, type CrmPlatform } from "@/features/sync/crm";
import type { SyncRange } from "@/features/sync/dates";
import { addDays } from "@/features/sync/dates";
import { fetchJson } from "@/server/integrations/providers/http";
import { kommoDomain } from "@/server/integrations/providers/kommo";
import { bearer } from "@/server/integrations/providers/oauth2";
import { ProviderError } from "@/server/integrations/providers/types";
import { getValidAccessToken } from "@/server/integrations/tokens";
import type { SyncAccount } from "../source";

/** Teto de páginas por consulta (contas enormes ficam no recorte mais recente). */
const MAX_PAGES = 100;

type Collected = { leads: (Date | null)[]; deals: CrmDealInput[] };

/** Parte opcional: falhou, segue sem ela (e avisa no log, sem token nem URL). */
async function optional<T>(label: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.warn(`[vyz] CRM: ${label} ficou de fora`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

/** Início e fim do intervalo como instantes (com um dia de folga para os fusos). */
const bounds = (range: SyncRange) => ({ from: new Date(`${addDays(range.from, -1)}T00:00:00Z`), to: new Date(`${addDays(range.to, 1)}T23:59:59Z`) });

export async function fetchCrmDataset(account: SyncAccount & { platform: CrmPlatform }, range: SyncRange): Promise<CrmDataset> {
  const token = await getValidAccessToken(account.connectionId);
  const collected =
    account.platform === "hubspot" ? await hubspot(token, range)
    : account.platform === "pipedrive" ? await pipedrive(token, range)
    : account.platform === "kommo" ? await kommo(token, range)
    : await rdstation(token, range);
  const daily = buildCrmDays({ range, timeZone: account.timezone, leads: collected.leads, deals: collected.deals });
  return { platform: account.platform, accountExternalId: account.externalId, range: { from: range.from, to: range.to }, daily };
}

/** Negócios das duas buscas (criados e ganhos no período) sem repetir o mesmo id. */
function dedupe<T extends { id: string }>(lists: T[][]): T[] {
  const seen = new Map<string, T>();
  for (const l of lists) for (const x of l) if (!seen.has(x.id)) seen.set(x.id, x);
  return [...seen.values()];
}

// ---- HubSpot (CRM v3) ----------------------------------------------------------------------

const HUBSPOT = "https://api.hubapi.com";
type HsObject = { id: string; properties?: Record<string, string | null | undefined> };
type HsSearch = { results?: HsObject[]; paging?: { next?: { after?: string } } };
type HsPipelines = { results?: { id: string; stages?: { id: string; label?: string; displayOrder?: number; metadata?: { isClosed?: string; probability?: string } }[] }[] };

async function hubspotSearch(token: string, object: "deals" | "contacts", filters: { propertyName: string; operator: string; value?: string; highValue?: string }[], properties: string[], label: string): Promise<HsObject[]> {
  const out: HsObject[] = [];
  let after: string | undefined;
  // a busca do HubSpot devolve até 10 mil resultados por consulta
  for (let page = 0; page < MAX_PAGES && out.length < 10_000; page++) {
    const res = await fetchJson<HsSearch>(`${HUBSPOT}/crm/v3/objects/${object}/search`, {
      method: "POST",
      headers: { ...bearer(token), "Content-Type": "application/json" },
      body: JSON.stringify({ filterGroups: [{ filters }], properties, sorts: [{ propertyName: "createdate", direction: "ASCENDING" }], limit: 100, ...(after ? { after } : {}) }),
      label,
      rejectCode: "provedor_recusou",
      timeoutMs: 30_000,
    });
    out.push(...(res.results ?? []));
    after = res.paging?.next?.after;
    if (!after || !res.results?.length) break;
  }
  return out;
}

async function hubspot(token: string, range: SyncRange): Promise<Collected> {
  const { from, to } = bounds(range);
  const between = (prop: string) => ({ propertyName: prop, operator: "BETWEEN", value: String(from.getTime()), highValue: String(to.getTime()) });
  const props = ["amount", "dealstage", "pipeline", "createdate", "closedate", "hs_is_closed_won", "hs_is_closed"];
  const stages = await optional("HubSpot: etapas", new Map<string, { label: string; order: number; closed: boolean }>(), async () => {
    const res = await fetchJson<HsPipelines>(`${HUBSPOT}/crm/v3/pipelines/deals`, { headers: bearer(token), label: "HubSpot: etapas", rejectCode: "provedor_recusou" });
    const m = new Map<string, { label: string; order: number; closed: boolean }>();
    for (const p of res.results ?? []) for (const s of p.stages ?? []) m.set(s.id, { label: s.label || s.id, order: (s.displayOrder ?? 0) + 1, closed: s.metadata?.isClosed === "true" });
    return m;
  });
  const created = await hubspotSearch(token, "deals", [between("createdate")], props, "HubSpot: negócios");
  const wonBefore = await optional("HubSpot: ganhos do período", [] as HsObject[], () =>
    hubspotSearch(token, "deals", [between("closedate"), { propertyName: "hs_is_closed_won", operator: "EQ", value: "true" }], props, "HubSpot: ganhos"),
  );
  const leads = await optional("HubSpot: contatos", [] as (Date | null)[], async () =>
    (await hubspotSearch(token, "contacts", [between("createdate")], ["createdate"], "HubSpot: contatos")).map((c) => crmInstant(c.properties?.createdate)),
  );
  const deals = dedupe([created, wonBefore]).map((d): CrmDealInput => {
    const p = d.properties ?? {};
    const stage = stages.get(p.dealstage ?? "");
    const status: CrmDealStatus = p.hs_is_closed_won === "true" ? "won" : p.hs_is_closed === "true" || stage?.closed ? "lost" : "open";
    return { createdAt: crmInstant(p.createdate), closedAt: crmInstant(p.closedate), status, stage: stage?.label ?? p.dealstage ?? "(sem etapa)", stageOrder: stage?.order ?? 0, value: crmNumber(p.amount) };
  });
  return { leads, deals };
}

// ---- Pipedrive (API v1) --------------------------------------------------------------------

const PIPEDRIVE = "https://api.pipedrive.com/v1";
type PdList<T> = { data?: T[] | null; additional_data?: { pagination?: { more_items_in_collection?: boolean; next_start?: number } } };
type PdDeal = { id: number; value?: number | null; status?: string; stage_id?: number; add_time?: string | null; won_time?: string | null; lost_time?: string | null; close_time?: string | null };

/** Lista paginada, mais recente primeiro, até passar do começo do intervalo. */
async function pipedriveList<T>(token: string, path: string, params: Record<string, string>, stampOf: (x: T) => Date | null, since: Date, label: string): Promise<T[]> {
  const out: T[] = [];
  let start = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${PIPEDRIVE}${path}`);
    url.search = new URLSearchParams({ ...params, start: String(start), limit: "500" }).toString();
    const res = await fetchJson<PdList<T>>(url, { headers: bearer(token), label, rejectCode: "provedor_recusou", timeoutMs: 30_000 });
    const items = res.data ?? [];
    out.push(...items);
    const last = items.at(-1);
    const lastStamp = last ? stampOf(last) : null;
    const more = res.additional_data?.pagination?.more_items_in_collection;
    if (!items.length || !more || (lastStamp && lastStamp < since)) break;
    start = res.additional_data?.pagination?.next_start ?? start + items.length;
  }
  return out;
}

async function pipedrive(token: string, range: SyncRange): Promise<Collected> {
  const { from } = bounds(range);
  const stages = await optional("Pipedrive: etapas", new Map<number, { name: string; order: number }>(), async () => {
    const res = await fetchJson<PdList<{ id: number; name?: string; order_nr?: number; pipeline_id?: number }>>(`${PIPEDRIVE}/stages`, { headers: bearer(token), label: "Pipedrive: etapas", rejectCode: "provedor_recusou" });
    return new Map((res.data ?? []).map((s) => [s.id, { name: s.name || `Etapa ${s.id}`, order: s.order_nr ?? 0 }]));
  });
  const created = await pipedriveList<PdDeal>(token, "/deals", { status: "all_not_deleted", sort: "add_time DESC" }, (d) => crmInstant(d.add_time), from, "Pipedrive: negócios");
  const won = await optional("Pipedrive: ganhos do período", [] as PdDeal[], () =>
    pipedriveList<PdDeal>(token, "/deals", { status: "won", sort: "won_time DESC" }, (d) => crmInstant(d.won_time), from, "Pipedrive: ganhos"),
  );
  const leads = await optional("Pipedrive: pessoas", [] as (Date | null)[], async () =>
    (await pipedriveList<{ id: number; add_time?: string }>(token, "/persons", { sort: "add_time DESC" }, (p) => crmInstant(p.add_time), from, "Pipedrive: pessoas")).map((p) => crmInstant(p.add_time)),
  );
  const deals = dedupe([created, won].map((l) => l.map((d) => ({ ...d, id: String(d.id) })))).map((d): CrmDealInput => {
    const status: CrmDealStatus = d.status === "won" ? "won" : d.status === "lost" ? "lost" : "open";
    const stage = d.stage_id !== undefined ? stages.get(d.stage_id) : undefined;
    return {
      createdAt: crmInstant(d.add_time),
      closedAt: crmInstant(status === "won" ? d.won_time ?? d.close_time : d.lost_time ?? d.close_time),
      status,
      stage: stage?.name ?? (d.stage_id !== undefined ? `Etapa ${d.stage_id}` : "(sem etapa)"),
      stageOrder: stage?.order ?? 0,
      value: crmNumber(d.value),
    };
  });
  return { leads, deals };
}

// ---- RD Station CRM (v2) -------------------------------------------------------------------

const RD = "https://api.rd.services/crm/v2";
type RdDeal = {
  id: string | number;
  amount_total?: number | string | null;
  total_price?: number | string | null;
  amount?: number | string | null;
  status?: string | null;
  win?: boolean | null;
  stage_id?: string | number | null;
  deal_stage?: { id?: string | number; name?: string; order?: number } | null;
  created_at?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
};
type RdPage<T> = { data?: T[]; links?: { next?: string | null }; meta?: { total_pages?: number } };

async function rdList<T>(token: string, path: string, params: Record<string, string>, stop: (items: T[]) => boolean, label: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(`${RD}${path}`);
    url.search = new URLSearchParams({ ...params, "page[number]": String(page), "page[size]": "100" }).toString();
    const res = await fetchJson<RdPage<T>>(url, { headers: bearer(token), label, rejectCode: "provedor_recusou", timeoutMs: 30_000 });
    const items = res.data ?? [];
    out.push(...items);
    if (!items.length || stop(items) || (res.meta?.total_pages !== undefined && page >= res.meta.total_pages) || res.links?.next === null) break;
  }
  return out;
}

async function rdstation(token: string, range: SyncRange): Promise<Collected> {
  const { from, to } = bounds(range);
  const stages = await optional("RD Station: etapas", new Map<string, { name: string; order: number }>(), async () => {
    const pipelines = await rdList<{ id: string | number }>(token, "/pipelines", {}, () => false, "RD Station: funis");
    const m = new Map<string, { name: string; order: number }>();
    for (const p of pipelines) {
      const st = await rdList<{ id: string | number; name?: string; order?: number; position?: number }>(token, `/pipelines/${encodeURIComponent(String(p.id))}/stages`, {}, () => false, "RD Station: etapas");
      st.forEach((s, i) => m.set(String(s.id), { name: s.name || `Etapa ${s.id}`, order: s.order ?? s.position ?? i + 1 }));
    }
    return m;
  });
  // mais recentes primeiro: para quando a página inteira já é de antes do intervalo
  const olderThan = (field: "created_at" | "updated_at") => (items: RdDeal[]) => items.every((d) => {
    const t = crmInstant(d[field]);
    return !!t && t < from;
  });
  const recent = await rdList<RdDeal>(token, "/deals", { sort: "-created_at" }, olderThan("created_at"), "RD Station: negócios");
  // ganhos de negócios antigos: os atualizados no período, quando a API aceita a ordem
  const updated = await optional("RD Station: ganhos do período", [] as RdDeal[], () => rdList<RdDeal>(token, "/deals", { sort: "-updated_at" }, olderThan("updated_at"), "RD Station: negócios atualizados"));
  const leads = await optional("RD Station: contatos", [] as (Date | null)[], async () =>
    (await rdList<{ id: string; created_at?: string }>(token, "/contacts", { sort: "-created_at" }, (items) => items.every((c) => {
      const t = crmInstant(c.created_at);
      return !!t && t < from;
    }), "RD Station: contatos")).map((c) => crmInstant(c.created_at)),
  );
  const deals = dedupe([recent, updated].map((l) => l.map((d) => ({ ...d, id: String(d.id) }))))
    .filter((d) => {
      const c = crmInstant(d.created_at);
      const f = crmInstant(d.closed_at);
      return (!!c && c >= from && c <= to) || (!!f && f >= from && f <= to);
    })
    .map((d): CrmDealInput => {
      const raw = (d.status ?? "").toLowerCase();
      const status: CrmDealStatus = d.win === true || raw === "won" || raw === "win" ? "won" : d.win === false || raw === "lost" || raw === "lose" ? "lost" : "open";
      const id = d.stage_id ?? d.deal_stage?.id;
      const stage = id !== undefined && id !== null ? stages.get(String(id)) : undefined;
      return {
        createdAt: crmInstant(d.created_at),
        closedAt: crmInstant(d.closed_at),
        status,
        stage: stage?.name ?? d.deal_stage?.name ?? "(sem etapa)",
        stageOrder: stage?.order ?? d.deal_stage?.order ?? 0,
        value: crmNumber(d.amount_total ?? d.total_price ?? d.amount),
      };
    });
  return { leads, deals };
}

// ---- Kommo (API v4) ------------------------------------------------------------------------

const KOMMO_WON = 142;
const KOMMO_LOST = 143;
type KommoLead = { id: number; price?: number | null; status_id?: number; pipeline_id?: number; created_at?: number; closed_at?: number | null };
type KommoPage = { _embedded?: { leads?: KommoLead[] }; _links?: { next?: { href?: string } } };

/** O token do Kommo vem como "<dominio>|<token>" (ver providers/kommo.ts). */
function kommoAuth(packed: string) {
  const i = packed.indexOf("|");
  if (i < 0) throw new ProviderError("troca_falhou", "Kommo: token sem domínio");
  return { base: `https://${kommoDomain(packed.slice(0, i))}/api/v4`, token: packed.slice(i + 1) };
}

/** O Kommo responde 204 (sem corpo) quando a lista está vazia. */
async function kommoGet<T>(url: URL, token: string, label: string): Promise<T | null> {
  try {
    return await fetchJson<T>(url, { headers: bearer(token), label, rejectCode: "provedor_recusou", timeoutMs: 30_000 });
  } catch (err) {
    if (err instanceof ProviderError && err.status === 204) return null;
    throw err;
  }
}

async function kommoLeads(base: string, token: string, filter: "created_at" | "closed_at", range: { from: Date; to: Date }, label: string): Promise<KommoLead[]> {
  const out: KommoLead[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(`${base}/leads`);
    url.search = new URLSearchParams({
      [`filter[${filter}][from]`]: String(Math.floor(range.from.getTime() / 1000)),
      [`filter[${filter}][to]`]: String(Math.floor(range.to.getTime() / 1000)),
      limit: "250",
      page: String(page),
    }).toString();
    const res = await kommoGet<KommoPage>(url, token, label);
    const items = res?._embedded?.leads ?? [];
    out.push(...items);
    if (!items.length || !res?._links?.next?.href) break;
  }
  return out;
}

async function kommo(packed: string, range: SyncRange): Promise<Collected> {
  const { base, token } = kommoAuth(packed);
  const b = bounds(range);
  const stages = await optional("Kommo: etapas", new Map<number, { name: string; order: number }>(), async () => {
    type Pipelines = { _embedded?: { pipelines?: { id: number; _embedded?: { statuses?: { id: number; name?: string; sort?: number }[] } }[] } };
    const res = await kommoGet<Pipelines>(new URL(`${base}/leads/pipelines`), token, "Kommo: funis");
    const m = new Map<number, { name: string; order: number }>();
    for (const p of res?._embedded?.pipelines ?? []) for (const s of p._embedded?.statuses ?? []) m.set(s.id, { name: s.name || `Etapa ${s.id}`, order: s.sort ?? 0 });
    return m;
  });
  const created = await kommoLeads(base, token, "created_at", b, "Kommo: leads");
  const closed = await optional("Kommo: fechados do período", [] as KommoLead[], () => kommoLeads(base, token, "closed_at", b, "Kommo: leads fechados"));
  const all = dedupe([created, closed].map((l) => l.map((d) => ({ ...d, id: String(d.id) }))));
  const deals = all.map((d): CrmDealInput => {
    const status: CrmDealStatus = d.status_id === KOMMO_WON ? "won" : d.status_id === KOMMO_LOST ? "lost" : "open";
    const stage = d.status_id !== undefined ? stages.get(d.status_id) : undefined;
    return { createdAt: crmInstant(d.created_at), closedAt: crmInstant(d.closed_at), status, stage: stage?.name ?? (d.status_id !== undefined ? `Etapa ${d.status_id}` : "(sem etapa)"), stageOrder: stage?.order ?? 0, value: crmNumber(d.price) };
  });
  // no Kommo o "lead" é o próprio negócio: cada lead criado no período conta como lead novo
  return { leads: created.map((d) => crmInstant(d.created_at)), deals };
}
