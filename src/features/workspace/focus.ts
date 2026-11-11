// Telas do dashboard em si (ver, editar, montar) abrem em tela cheia, sem a
// sidebar do produto. A lista e o "novo" continuam no painel.

export const isFocusPath = (path: string | null) => {
  const m = path?.match(/^\/painel\/dashboards\/([^/]+)(\/editar)?\/?$/);
  return !!m && m[1] !== "novo";
};
