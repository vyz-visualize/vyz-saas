"use client";

// Telas de trabalho da bancada (/dev/painel?tela=a-fazer, a-fazer-vazio, whatsapp,
// whatsapp-novo, whatsapp-codigo), com dados de exemplo. ?plano=avancado libera o A Fazer
// completo e os relatórios no WhatsApp; nos outros planos aparecem os bloqueios.

import { TodoPage } from "@/features/todo/TodoPage";
import type { TaskDTO, TodoState } from "@/features/todo/types";
import { WhatsappPage } from "@/features/whatsapp/WhatsappPage";
import type { WhatsappPageData } from "@/server/whatsapp/queries";
import type { Screen } from "./types";

const TODAY = "2026-11-13";
const NOW = `${TODAY}T15:00:00.000Z`;
const ago = (min: number) => new Date(Date.parse(NOW) - min * 60_000).toISOString();
const day = (offset: number) => new Date(Date.parse(`${TODAY}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

const task = (p: Partial<TaskDTO> & Pick<TaskDTO, "id" | "title">): TaskDTO => ({
  detail: null,
  status: "planejado",
  stage: "midia_paga",
  priority: "media",
  startDate: null,
  dueDate: null,
  assignees: [],
  groupId: null,
  projectId: null,
  projectName: null,
  dashboardId: null,
  platform: null,
  source: "manual",
  autoNote: null,
  isNew: false,
  createdAt: ago(60 * 24 * 3),
  completedAt: null,
  action: null,
  ...p,
});

const TASKS: TaskDTO[] = [
  task({
    id: "t1",
    title: "Campanha Remarketing gastou sem converter",
    detail: "R$ 610 investidos nos últimos 7 dias e nenhuma conversão.",
    priority: "alta",
    dueDate: day(0),
    projectId: "p1",
    projectName: "Loja Aurora",
    platform: "meta",
    source: "insight",
    isNew: true,
    autoNote: "O VYZ fecha esta tarefa sozinho quando a campanha voltar a converter.",
    createdAt: ago(40),
    action: { kind: "pause", platform: "meta", campaignId: "c1", campaignName: "Remarketing 30 dias", currency: "BRL", from: "active", to: "paused" },
  }),
  task({
    id: "t2",
    title: "Aumentar a verba da campanha que mais vende",
    detail: "ROAS de 5,2 nos últimos 7 dias, acima da meta.",
    priority: "media",
    dueDate: day(2),
    projectId: "p1",
    projectName: "Loja Aurora",
    platform: "google",
    source: "insight",
    isNew: true,
    createdAt: ago(90),
    assignees: ["u2"],
    action: { kind: "budget", platform: "google", campaignId: "c2", campaignName: "Pesquisa · Marca", currency: "BRL", from: 100, to: 120 },
  }),
  task({ id: "t3", title: "Revisar página de oferta no celular", status: "em_andamento", stage: "cro", priority: "alta", startDate: day(-4), dueDate: day(-2), projectId: "p2", projectName: "Clínica Sol", assignees: ["u1", "u2"], groupId: "g1" }),
  task({ id: "t4", title: "Produzir criativos de esquenta e de oferta para a Black Friday", stage: "criativos", priority: "alta", startDate: day(1), dueDate: day(6), projectId: "p1", projectName: "Loja Aurora", assignees: ["u2"], groupId: "g1", source: "playbook" }),
  task({ id: "t5", title: "Programar disparos para a base de clientes", stage: "crm", priority: "media", startDate: day(5), dueDate: day(9), projectId: "p1", projectName: "Loja Aurora", groupId: "g1", source: "playbook" }),
  task({ id: "t6", title: "Fechar o relatório de outubro", status: "concluido", stage: "relatorio", priority: "media", dueDate: day(-8), projectId: "p3", projectName: "Imobiliária Vista do Parque Empreendimentos", assignees: ["u1"], completedAt: ago(60 * 24 * 7) }),
  task({ id: "t7", title: "Alinhar metas e verba do mês", stage: "outro", priority: "baixa", projectId: "p2", projectName: "Clínica Sol" }),
  task({ id: "t8", title: "Subir campanhas e acompanhar verba diária", stage: "midia_paga", priority: "alta", startDate: day(18), dueDate: day(22), projectId: "p1", projectName: "Loja Aurora", groupId: "g1", source: "playbook" }),
  task({ id: "t9", title: "Trocar criativos com sinal de cansaço", status: "cancelado", stage: "criativos", priority: "baixa", dueDate: day(-20), projectId: "p2", projectName: "Clínica Sol", completedAt: ago(60 * 24 * 18) }),
];

function todo(full: boolean, canEdit: boolean, tasks: TaskDTO[]): TodoState {
  return {
    tasks,
    groups: full ? [{ id: "g1", name: "Black Friday" }] : [],
    members: [
      { userId: "u1", name: "Pedro Freitas", avatarUrl: null },
      { userId: "u2", name: "Marina Alves", avatarUrl: null },
      { userId: "u3", name: "Caio Brandão", avatarUrl: null },
    ],
    projects: [
      { id: "p1", name: "Loja Aurora" },
      { id: "p2", name: "Clínica Sol" },
      { id: "p3", name: "Imobiliária Vista do Parque Empreendimentos" },
    ],
    level: full ? "full" : "basic",
    canEdit,
    today: TODAY,
    timeZone: "America/Sao_Paulo",
    justCreated: 0,
    runs: tasks.length
      ? [
          { id: "r1", taskId: "t0", description: "Orçamento diário de Catálogo · Vendas: de R$ 150,00 para R$ 120,00", mode: "manual", status: "applied", error: null, appliedAt: ago(60 * 5), undoneAt: null, canUndo: true },
          { id: "r2", taskId: null, description: "Pausar a campanha Tráfego frio", mode: "auto", status: "undone", error: null, appliedAt: ago(60 * 30), undoneAt: ago(60 * 20), canUndo: false },
          { id: "r3", taskId: null, description: "Orçamento diário de Leads · Formulário: de R$ 80,00 para R$ 96,00", mode: "auto", status: "failed", error: "A plataforma recusou a mudança.", appliedAt: ago(60 * 52), undoneAt: null, canUndo: false },
        ]
      : [],
    autopilot: { allowed: full, canEdit, projects: full ? { p1: { enabled: true, maxBudgetChangePct: 20, allowIncrease: false, allowPause: true, minCampaignAgeDays: 7 } } : {} },
  };
}

const WHATSAPP: WhatsappPageData = {
  subscription: { phone: "+5571999575898", verified: true, reports: ["diario", "alertas"], paused: false, optedOut: false, optedInAt: ago(60 * 24 * 12) },
  messages: [
    { id: "m1", direction: "out", kind: "alertas", status: "read", body: "Alerta da VYZ em Agência Exemplo, dashboard Loja Aurora · Vendas: Campanha Remarketing gastou sem converter. R$ 610 investidos nos últimos 7 dias e nenhuma conversão. Para não receber mais, responda PARAR.", error: null, createdAt: ago(55) },
    { id: "m2", direction: "out", kind: "diario", status: "delivered", body: "Bom dia, Pedro! Resumo de Agência Exemplo: CPA: queda de 18%. Foi de R$ 42 para R$ 34 nos últimos 7 dias, contra o período anterior. Detalhes no painel da VYZ. Para não receber mais, responda PARAR.", error: null, createdAt: ago(60 * 6) },
    { id: "m3", direction: "in", kind: "resposta", status: "received", body: "Obrigado!", error: null, createdAt: ago(60 * 26) },
    { id: "m4", direction: "out", kind: "semanal", status: "failed", body: "Bom dia, Pedro! Sua semana em Agência Exemplo: R$ 3.420 investidos (+12% contra a semana anterior) e 128 conversões (+8%).", error: "O WhatsApp não entregou: número fora da área de cobertura.", createdAt: ago(60 * 24 * 4) },
    { id: "m5", direction: "out", kind: "boas-vindas", status: "read", body: "Olá, Pedro! Seus relatórios da VYZ pelo WhatsApp estão ativos para Agência Exemplo. Contas conectadas: 2 de Meta Ads e 1 de Google Ads.", error: null, createdAt: ago(60 * 24 * 12) },
  ],
  simulated: false,
};

export const SCREENS_TAREFAS: Record<string, Screen> = {
  "a-fazer": { path: "/painel/a-fazer", node: (tier, role) => <TodoPage state={todo(tier === "avancado", role !== "viewer", TASKS)} /> },
  "a-fazer-vazio": { path: "/painel/a-fazer", node: (tier, role) => <TodoPage state={todo(tier === "avancado", role !== "viewer", [])} /> },
  // sem item no menu: a página abre por Configurações
  whatsapp: { path: "/painel/whatsapp", node: () => <WhatsappPage data={WHATSAPP} /> },
  "whatsapp-novo": { path: "/painel/whatsapp", node: () => <WhatsappPage data={{ subscription: null, messages: [], simulated: true }} /> },
  "whatsapp-codigo": { path: "/painel/whatsapp", node: () => <WhatsappPage data={{ subscription: { phone: "+5571999575898", verified: false, reports: [], paused: false, optedOut: false, optedInAt: null }, messages: [], simulated: false }} /> },
};
