import type { CSSProperties, MouseEvent } from "react";

export type BarItem = { label: string; value: number; display: string; /** Id do filtro, quando dá para clicar. */ id?: string };

export type BarAction = {
  label: (item: BarItem) => string;
  onClick: (item: BarItem, e: MouseEvent) => void;
  tone: (item: BarItem) => "selected" | "dimmed" | null;
};

type BarListProps = {
  items: BarItem[];
  /** Linha de referência (equilíbrio ou meta), no mesmo eixo. */
  reference?: { value: number; label: string };
  /** "up": abaixo da referência é ruim (ROAS). "down": acima é ruim (CPA). */
  better?: "up" | "down";
  summary: string;
  /** "lg": texto de leitura (painel de "Como funciona"). */
  size?: "sm" | "lg";
  /** Dashboard interativo: cada barra vira um botão que filtra. */
  action?: BarAction;
};

/**
 * Barras horizontais em ordem, com linha de referência tracejada. O que fica do
 * lado errado da referência vai em vermelho terroso; o resto em verde.
 */
export function BarList({ items, reference, better = "up", summary, size = "sm", action }: BarListProps) {
  const lg = size === "lg";
  const max = Math.max(...items.map((i) => i.value), reference?.value ?? 0) * 1.08 || 1;
  const sorted = [...items].sort((a, b) => (better === "up" ? b.value - a.value : a.value - b.value));
  const refPct = reference ? (reference.value / max) * 100 : 0;
  const bad = (v: number) => (reference ? (better === "up" ? v < reference.value : v > reference.value) : false);

  return (
    <div role={action ? "group" : "img"} aria-label={summary}>
      {reference && (
        <p className={`mb-1.5 flex items-center gap-1 leading-none text-fg-2 ${lg ? "text-[12px]" : "text-[11px]"}`} aria-hidden>
          <span className="w-3 border-t border-dashed border-fg-2" /> {reference.label}
        </p>
      )}
      <ul className={`relative ${lg ? "space-y-2.5" : "space-y-1.5"}`} aria-hidden={action ? undefined : true}>
        {sorted.map((it, i) => {
          const row = `grid items-center gap-2 ${lg ? "grid-cols-[minmax(0,11rem)_1fr_auto] text-[12.5px]" : "grid-cols-[minmax(0,6rem)_1fr_auto] text-[11px]"}`;
          const tone = action?.tone(it) ?? null;
          const body = (
            <>
            <span className={`truncate ${tone === "selected" ? "font-semibold text-fg" : "text-fg-2"}`}>{it.label}</span>
            <span className={`relative ${lg ? "h-3" : "h-2.5"}`}>
              <span
                className="m-bar absolute inset-y-0 left-0 rounded-[2px]"
                style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: bad(it.value) ? "#C9442E" : i < 3 ? "var(--accent)" : "var(--seq-c)", "--d": `${600 + i * 90}ms` } as CSSProperties}
              />
              {reference && <span className="absolute -inset-y-1 w-0 border-l border-dashed border-fg-2" style={{ left: `${refPct}%` }} />}
            </span>
            <span className={`font-semibold tnum ${bad(it.value) ? "text-error-fg" : "text-fg"}`}>{it.display}</span>
            </>
          );
          return action ? (
            <li key={it.label} data-filter-tone={tone ?? undefined} className={tone === "dimmed" ? "opacity-45" : ""}>
              <button type="button" data-filter-item={it.id} aria-pressed={tone === "selected"} aria-label={action.label(it)} onClick={(e) => action.onClick(it, e)} className={`${row} w-full cursor-pointer rounded-[4px] text-left outline-none hover:bg-line/30 focus-visible:ring-2 focus-visible:ring-accent`}>
                {body}
              </button>
            </li>
          ) : (
            <li key={it.label} className={row}>
              {body}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
