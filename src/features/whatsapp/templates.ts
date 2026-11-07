// Templates do WhatsApp da VYZ. Mensagem que a VYZ inicia (fora da janela de
// 24 h depois da última resposta do cliente) só sai com template aprovado no
// Meta: os nomes, as categorias e os textos daqui são exatamente os que vão
// para o WhatsApp Manager (docs/WHATSAPP.md repete cada um). Mudou o texto
// aqui? Precisa enviar de novo para aprovação.

export type ReportKind = "boas-vindas" | "diario" | "semanal" | "alertas";

export const REPORT_KINDS: { id: ReportKind; label: string; hint: string }[] = [
  { id: "boas-vindas", label: "Boas-vindas", hint: "Logo depois de verificar o número: contas conectadas e os últimos 7 dias." },
  { id: "diario", label: "Resumo diário", hint: "Toda manhã, o destaque mais importante do dia anterior." },
  { id: "semanal", label: "Resumo semanal", hint: "Segunda de manhã: investimento, resultados e o que mudou contra a semana anterior." },
  { id: "alertas", label: "Alertas", hint: "Quando algo cai forte ou o gasto foge do normal. No máximo 2 por dia." },
];

export const isReportKind = (v: unknown): v is ReportKind => typeof v === "string" && REPORT_KINDS.some((k) => k.id === v);

export type TemplateCategory = "AUTHENTICATION" | "UTILITY";

export type TemplateDef = {
  /** Nome no WhatsApp Manager (minúsculas e _). */
  name: string;
  category: TemplateCategory;
  /** Corpo com {{1}}, {{2}}... como é cadastrado. */
  body: string;
  /** O que cada variável recebe, na ordem. */
  variables: string[];
  /** Exemplo de cada variável (o Meta pede na aprovação). */
  samples: string[];
  /** Rodapé fixo (opcional). */
  footer?: string;
};

export type TemplateId = "codigo" | ReportKind;

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  codigo: {
    name: "vyz_codigo_verificacao",
    category: "AUTHENTICATION",
    // texto fixo do Meta para autenticação (pt_BR), com o botão "Copiar código"
    body: "*{{1}}* é seu código de verificação. Para sua segurança, não o compartilhe.",
    variables: ["código de 6 dígitos"],
    samples: ["482913"],
    footer: "Este código expira em 10 minutos.",
  },
  "boas-vindas": {
    name: "vyz_boas_vindas",
    category: "UTILITY",
    body: "Olá, {{1}}! Seus relatórios da VYZ pelo WhatsApp estão ativos para {{2}}. Contas conectadas: {{3}}. Nos últimos 7 dias: {{4}} investidos e {{5}} conversões. Destaque: {{6}} Para não receber mais, responda PARAR.",
    variables: ["primeiro nome", "nome do workspace", "contas conectadas", "investimento em 7 dias", "conversões em 7 dias", "destaque"],
    samples: ["Ana", "Loja da Ana", "2 de Meta Ads e 1 de Google Ads", "R$ 3.420", "128", "ROAS da campanha Black Friday subiu 32%."],
  },
  diario: {
    name: "vyz_resumo_diario",
    category: "UTILITY",
    body: "Bom dia, {{1}}! Resumo de {{2}}: {{3}} {{4}} Detalhes no painel da VYZ. Para não receber mais, responda PARAR.",
    variables: ["primeiro nome", "nome do workspace", "destaque (título)", "detalhe com números"],
    samples: ["Ana", "Loja da Ana", "CPA: queda de 18%.", "Foi de R$ 42 para R$ 34 nos últimos 7 dias, contra o período anterior."],
  },
  semanal: {
    name: "vyz_resumo_semanal",
    category: "UTILITY",
    body: "Bom dia, {{1}}! Sua semana em {{2}}: {{3}} investidos ({{4}} contra a semana anterior) e {{5}} conversões ({{6}}). O que mudou: {{7}} Para não receber mais, responda PARAR.",
    variables: ["primeiro nome", "nome do workspace", "investimento da semana", "variação do investimento", "conversões da semana", "variação das conversões", "o que mudou"],
    samples: ["Ana", "Loja da Ana", "R$ 3.420", "+12%", "128", "+8%", "ROAS: alta de 21%."],
  },
  alertas: {
    name: "vyz_alerta",
    category: "UTILITY",
    body: "Alerta da VYZ em {{1}}, dashboard {{2}}: {{3}} {{4}} Para não receber mais, responda PARAR.",
    variables: ["nome do workspace", "nome do dashboard", "o que aconteceu", "detalhe com números"],
    samples: ["Loja da Ana", "Meta Ads", "Campanha Remarketing gastou sem converter.", "R$ 610 investidos nos últimos 7 dias e nenhuma conversão."],
  },
};

/**
 * O Meta recusa variável com quebra de linha, tab ou mais de 4 espaços
 * seguidos, e vazia. Também corta o tamanho para não estourar o limite.
 */
export function cleanParam(v: string | number | null | undefined, max = 300): string {
  const s = String(v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  if (!s) return "-";
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Texto final, como o cliente lê (para o registro e para o modo simulado). */
export function renderTemplate(id: TemplateId, params: (string | number | null | undefined)[]): string {
  const def = TEMPLATES[id];
  if (params.length !== def.variables.length) throw new Error(`Template ${def.name}: esperava ${def.variables.length} variáveis, recebeu ${params.length}.`);
  return def.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => cleanParam(params[Number(n) - 1]));
}
