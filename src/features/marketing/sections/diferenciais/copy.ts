// Textos da dobra Diferenciais: o "cérebro de dados" e quem fez o VYZ. Regras: sem fotos nem
// nomes do time, sem anos, números ou prova social inventados, sem citar IA ou empresa pelo
// nome; a IA genérica só aparece no contraponto. Um marcador de texto pendente aqui derruba o
// deploy de produção (scripts/build/check-placeholders.ts, no postbuild).

export const EYEBROW = "Quem fez o VYZ";

/** Título em duas linhas; a segunda vai em destaque. */
export const TITLE = ["Inteligência de verdade", "não cabe num prompt."] as const;

/** Linha de apoio: "Feito por" e os três papéis, em destaque (cor de destaque e peso maior). */
export const SUPPORT_LEAD = "Feito por";
export const ROLES = ["Engenheiros de Dados", "Cientistas de Dados", "Gestores de Tráfego"] as const;

export const COUNTERPOINT = "Uma IA genérica faz o comum. O VYZ faz o que a sua operação precisa, todo dia, sem MCP e sem crédito.";
