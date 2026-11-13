// Classes de botão compartilhadas. Raio pelos tokens (8 px na marca, 10 px no painel), sem sombra.

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap transition-[background-color,color,border-color,opacity,transform] duration-200 ease-brand active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

export const btn = {
  primary: `${base} h-12 px-6 bg-accent text-on-accent hover:opacity-90`,
  secondary: `${base} h-12 px-6 border border-line text-fg hover:border-accent hover:text-accent`,
  outline: `${base} h-11 px-5 border border-accent text-accent hover:bg-accent-soft`,
  ghost: `${base} h-10 px-3 text-accent hover:bg-accent-soft`,
  small: `${base} h-9 px-4 text-sm bg-accent text-on-accent hover:opacity-90`,
  // ---- painel: ações secundárias e de ícone (36 px, 13,5 px) ----
  /** Contorno neutro sobre o cartão: a ação secundária ao lado da principal. */
  subtle: `${base} h-9 px-3.5 text-[13.5px] border border-line bg-card text-fg hover:border-fg-2/50 hover:bg-surface-2`,
  /** Fantasma neutro: ações de linha e de rodapé de cartão. */
  quiet: `${base} h-9 px-3 text-[13.5px] text-fg-2 hover:bg-surface-2 hover:text-fg`,
  /** Ação destrutiva (apagar, remover, excluir). */
  danger: `${base} h-9 px-4 text-sm bg-error text-white hover:opacity-90`,
  /** Só ícone (menu de mais ações, fechar). */
  icon: `${base} size-9 shrink-0 text-fg-2 hover:bg-surface-2 hover:text-fg`,
};

export const chip =
  "inline-flex items-center gap-1.5 rounded-chip border border-line px-3 py-1 text-[13px] text-fg-2";

export const card = "rounded-card border border-line bg-card";
