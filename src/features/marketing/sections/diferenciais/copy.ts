// Textos da dobra Diferenciais ("Prompt × Pronto"), usados pelas duas direções da bancada
// /dev/diferenciais. Objeção a derrubar: "por que pagar o VYZ se eu faço isso numa IA?".
// Regras: nenhuma IA ou empresa citada pelo nome ("IA genérica" basta), nada de prova social,
// número inventado ou preço. [ANOS] fica marcado até o texto exato ser confirmado.

/** O caminho com uma IA genérica, na ordem em que acontece. Cada um é um passo de verdade. */
export const GENERIC_STEPS = [
  {
    title: "Conectar o MCP",
    note: "e torcer para a integração aceitar a sua conta",
  },
  { title: "Gerar o token", note: "e guardar num lugar seguro" },
  { title: "Colar no chat", note: "os dados ou o acesso, conta por conta" },
  {
    title: "Escrever o prompt",
    note: "explicando métrica, período e o que é conversão",
  },
  { title: "Conferir se bate com o Gerenciador", note: "número por número" },
  {
    title: "Refazer quando a conversa esquece",
    note: "o contexto, a janela, o cliente",
  },
  { title: "Acompanhar os créditos", note: "e o limite de mensagens do dia" },
  {
    title: "Montar algo para o cliente",
    note: "um print, um PDF, uma planilha",
  },
] as const;

export const GENERIC_END = "E amanhã, de novo.";

/** As quatro respostas à objeção. */
export const ANSWERS = [
  {
    title: "Não precisa configurar nada",
    text: "Sem conectar MCP, sem gerar token, sem escrever prompt. Um login na Meta ou no Google e pronto.",
  },
  {
    title: "Não depende de crédito",
    text: "Nem de limite de mensagens: o dashboard está sempre lá, sincronizando sozinho 3x por dia.",
  },
  {
    title: "Dá para confiar no número",
    text: "Números que batem com a plataforma, na janela de atribuição dela, com os últimos 3 dias marcados como em maturação.",
  },
  {
    title: "O cliente recebe um link",
    text: "Um dashboard que ele entende e filtra sozinho, não um print de conversa.",
  },
] as const;

/** Quem fez o VYZ e o que cada um garantiu no produto. */
export const ROLES = [
  {
    role: "Gestores de tráfego",
    // [ANOS]: aguardando o texto exato (não usar "mais de 10 anos" até confirmar)
    since: "[ANOS] de mídia paga",
    items: [
      "Números que batem com o Gerenciador",
      "Janela de atribuição de cada plataforma",
      "Funil real, do clique à venda",
    ],
  },
  {
    role: "Engenheiro de dados",
    since: null,
    items: [
      "Sincronização sozinha 3x por dia",
      "Histórico guardado, conta por conta",
      "Nada some quando a conversa acaba",
    ],
  },
  {
    role: "Cientista de dados",
    since: null,
    items: [
      "Últimos 3 dias marcados como em maturação",
      "Base diária pronta para o MMM",
      "Alerta só para queda de verdade",
    ],
  },
] as const;

/** Frases de fechamento para escolher (?frase=1|2|3 na bancada). */
export const CLOSINGS = [
  "A IA responde. O VYZ entrega.",
  "Sem prompt. Sem crédito. Sem achismo.",
  "Você não precisa pedir. Já está pronto.",
] as const;
