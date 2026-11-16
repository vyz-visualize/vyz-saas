// "Pedir ao Vyz" com IA: o que vai para o Claude (o pedido e o contexto da aba) e como a resposta
// dele vira um LayoutPlan. A resposta nunca é confiada como veio: cada id passa pelas mesmas
// regras do painel (customSpec, contas do dashboard, investimento oculto), os nomes são limpos e
// a quantidade é limitada. O que não passa fica de fora sem quebrar o pedido.

import { z } from "zod";
import { PLATFORMS as PLATFORM_INFO, type PlatformId } from "@/features/accounts/platforms";
import type { Profile } from "@/features/metrics/definitions";
import { cleanTitle, customAllowed, customId, customSpec, customTitle } from "../layout/custom-blocks";
import { examplesFor, PLAN_MAX, type LayoutPlan, type PlannedBlock } from "./planner";

const PROFILES = ["ecommerce", "leads", "imob", "local", "midia", "pesquisa", "site", "infoproduto", "agencia", "marketplace", "saude", "educacao", "video", "executivo"] as const satisfies readonly Profile[];
const isPlatform = (x: string): x is PlatformId => Object.hasOwn(PLATFORM_INFO, x);

const short = (max: number) => z.string().trim().max(max);

/** O que o editor manda ao servidor. */
export const AskRequestSchema = z.object({
  text: z.string().trim().min(1).max(500),
  profile: z.enum(PROFILES),
  pageName: short(60),
  /** Contas do dashboard (o que não for conhecido é ignorado). */
  sources: z.array(z.string().max(40)).max(30).transform((xs) => xs.filter(isPlatform)),
  hideSpend: z.boolean(),
  hasProducts: z.boolean(),
  /** Blocos pedidos que já estão na aba. */
  existing: z.array(short(64)).max(60),
  /** Cards que dá para ligar nesta aba (id e nome) e os que já estão na tela. */
  kpis: z.array(z.object({ id: short(60), label: short(80) })).max(80),
  visibleKpis: z.array(short(60)).max(80),
});

export type AskRequest = z.infer<typeof AskRequestSchema>;

/** A ação do servidor (server/dashboards/ask.ts), passada ao painel como o Salvar. */
export type AskLayoutAction = (input: AskRequest) => Promise<{ ok: true; data: LayoutPlan } | { ok: false; error: { message: string } }>;

/** O formato da resposta do Claude (saída estruturada). Os limites de tamanho são aplicados depois. */
export const AiPlanSchema = z.object({
  understood: z.boolean().describe("true se deu para montar algo útil para o pedido"),
  summary: z.string().describe("Uma frase de volta, em português, dizendo o que foi entendido"),
  blocks: z
    .array(
      z.object({
        id: z.string().describe("Id do bloco, no formato do catálogo"),
        title: z.string().describe("Nome curto do bloco, até 50 caracteres"),
        why: z.string().describe("Uma frase dizendo o que o bloco mostra"),
      }),
    )
    .describe("Blocos propostos, do mais importante para o menos"),
  kpis: z.array(z.string()).describe("Ids de cards a ligar, da lista de cards disponíveis"),
  notes: z.array(z.string()).describe("Como algo foi interpretado ou por que ficou de fora (no máximo 3)"),
});

export type AiPlan = z.infer<typeof AiPlanSchema>;

/** Texto curto para a tela: sem quebra de linha, sem travessão, sem caractere de controle. */
export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** A resposta do Claude, conferida com as regras do painel. */
export function fromAi(raw: AiPlan, req: AskRequest): LayoutPlan {
  const notes = [...new Set(raw.notes.map((n) => cleanText(n, 220)).filter(Boolean))].slice(0, 3);
  const seen = new Set(req.existing);
  const blocks: PlannedBlock[] = [];
  for (const b of raw.blocks) {
    const spec = customSpec(String(b.id).trim());
    if (!spec) continue;
    const id = customId(spec);
    if (seen.has(id) || !customAllowed(id, req.sources, req.hideSpend)) continue;
    seen.add(id);
    if (blocks.length >= PLAN_MAX) break;
    blocks.push({ id, title: cleanTitle(cleanText(b.title, 80)) ?? customTitle(spec, req.profile), why: cleanText(b.why, 180), spec });
  }
  const offered = new Set(req.kpis.map((k) => k.id));
  const kpis = [...new Set(raw.kpis)].filter((k) => offered.has(k) && !req.visibleKpis.includes(k)).slice(0, 4);
  const understood = blocks.length > 0 || kpis.length > 0;
  const summary = cleanText(raw.summary, 220);
  return {
    understood,
    summary: understood ? summary || "Entendi. Montei estes blocos para a aba:" : summary || "Não entendi bem o pedido. Tente dizer o que quer ver e por qual número, como nos exemplos.",
    blocks,
    kpis,
    notes,
    examples: examplesFor(req.profile),
  };
}
