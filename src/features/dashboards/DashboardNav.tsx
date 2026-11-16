"use client";

// Barra do dashboard (visual padrão): flutua no topo, com vidro e sombra, e junta numa peça
// só o que antes eram três faixas (voltar e ações, título, abas e período). A pessoa escolhe
// como quer a barra, e a escolha fica no navegador dela:
//   - aberta: título, período, Editar e ações em cima; as abas embaixo;
//   - recolhida: uma linha só (marca, abas, período curto e Editar);
//   - escondida: some, e uma alça no topo traz de volta.
// Os blocos da aba se encaixam no espaço que sobra (a grade mede o que fica acima dela).

import { ArrowLeft, ChevronsDownUp, ChevronsUpDown, EyeOff, PanelTopOpen } from "lucide-react";
import Link from "next/link";
import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { OverflowTabs } from "@/components/ui/OverflowTabs";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Tooltip, TooltipProvider } from "@/components/ui/Tooltip";

export type NavMode = "open" | "compact" | "hidden";
const KEY = "vyz:dash-nav";
const listeners = new Set<() => void>();

function read(): NavMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "compact" || v === "hidden" ? v : "open";
  } catch {
    return "open";
  }
}

export function useNavMode() {
  const mode = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "open" as NavMode,
  );
  const set = useCallback((next: NavMode) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    listeners.forEach((l) => l());
  }, []);
  return [mode, set] as const;
}

const iconBtn = "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-fg-2 outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent";

type Props = {
  brand: ReactNode;
  name: string;
  client: string;
  /** Selos das plataformas e de dados reais/amostra. */
  chips: ReactNode;
  tabs: { items: { value: string; label: string; icon?: ReactNode }[]; value: string; onChange: (v: string) => void };
  /** O seletor de período (recebe se é a versão curta). */
  period: (compact: boolean) => ReactNode;
  /** Dica do período (atribuição, maturação). */
  hint?: ReactNode;
  /** Botão Editar (some na edição e na apresentação). */
  edit?: ReactNode;
  /** Ações do painel (apresentar, compartilhar, PDF, menu). */
  actions?: ReactNode;
  /** Voltar para a lista (na tela do painel). */
  backHref?: string;
  /** Na edição, a barra fica aberta e sem os controles de recolher. */
  locked?: boolean;
};

/** A barra leva o próprio provedor das dicas: o link público e as prévias não têm o do painel. */
export function DashboardNav(props: Props) {
  return (
    <TooltipProvider>
      <Nav {...props} />
    </TooltipProvider>
  );
}

function Nav({ brand, name, client, chips, tabs, period, hint, edit, actions, backHref, locked = false }: Props) {
  const [stored, setMode] = useNavMode();
  const mode: NavMode = locked ? "open" : stored;

  if (mode === "hidden")
    return (
      <div data-float-nav="hidden" className="pointer-events-none sticky top-0 z-30 flex h-0 justify-center print:hidden">
        <button
          type="button"
          onClick={() => setMode("open")}
          className="pointer-events-auto mt-1 inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-[color-mix(in_srgb,var(--card)_82%,transparent)] px-3 text-[12.5px] font-medium text-fg-2 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.5)] backdrop-blur-xl outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PanelTopOpen size={14} aria-hidden /> Mostrar menu · {tabs.items.find((t) => t.value === tabs.value)?.label}
        </button>
      </div>
    );

  const compact = mode === "compact";
  const tabBar = <OverflowTabs variant="pill" tourId="abas" label="Páginas do dashboard" value={tabs.value} onChange={tabs.onChange} items={tabs.items} />;
  const toggles = !locked && (
    <div className="flex shrink-0 items-center">
      <Tooltip content={compact ? "Abrir a barra" : "Recolher a barra"}>
        <button type="button" aria-label={compact ? "Abrir a barra" : "Recolher a barra"} onClick={() => setMode(compact ? "open" : "compact")} className={iconBtn}>
          {compact ? <ChevronsUpDown size={16} aria-hidden /> : <ChevronsDownUp size={16} aria-hidden />}
        </button>
      </Tooltip>
      <Tooltip content="Esconder a barra">
        <button type="button" aria-label="Esconder a barra" onClick={() => setMode("hidden")} className={iconBtn}>
          <EyeOff size={16} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
  const back = backHref && (
    <Tooltip content="Voltar para os dashboards">
      <Link href={backHref} aria-label="Voltar para os dashboards" className={`${iconBtn} -ml-1`}>
        <ArrowLeft size={17} aria-hidden />
      </Link>
    </Tooltip>
  );

  return (
    <div data-float-nav={mode} className="@container sticky top-2 z-30 print:hidden">
      <nav
        aria-label="Navegação do dashboard"
        className="rounded-[20px] border border-line/80 bg-[color-mix(in_srgb,var(--card)_80%,transparent)] px-2.5 py-2 shadow-[0_14px_40px_-22px_rgb(0_0_0/0.55),inset_0_1px_0_rgb(255_255_255/0.04)] backdrop-blur-xl backdrop-saturate-150"
      >
        {compact ? (
          <div className="flex items-center gap-2">
            {back}
            <div className="hidden shrink-0 pl-1 @[640px]:block">{brand}</div>
            <div className="min-w-0 flex-1">{tabBar}</div>
            <div className="hidden shrink-0 @[820px]:block">{period(true)}</div>
            {edit}
            {toggles}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {back}
              <div className="flex min-w-0 shrink items-center gap-3">
                <div className="hidden shrink-0 @[500px]:block">{brand}</div>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <h1 className="title truncate text-[1.15rem] leading-tight">{name}</h1>
                    <span className="hidden truncate text-[13px] text-fg-2 @[700px]:inline">{client}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">{chips}</div>
                </div>
              </div>
              {/* as ações medem este espaço (data-actions-slot): o que não cabe vai para o menu */}
              {actions ? (
                <div data-actions-slot className="flex min-w-10 flex-1 basis-0 justify-end">
                  {actions}
                </div>
              ) : (
                <span className="flex-1" aria-hidden />
              )}
              <div className="flex shrink-0 items-center gap-1.5">
                {period(false)}
                {hint}
                {edit}
              </div>
              {backHref && <ThemeToggle ghost className="size-9 shrink-0" />}
              {toggles}
            </div>
            <div className="border-t border-line/70 pt-2">{tabBar}</div>
          </div>
        )}
      </nav>
    </div>
  );
}
