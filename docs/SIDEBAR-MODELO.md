# Sidebar de vidro — modelo para replicar

Especificação completa da sidebar do CAP Manager (estado de 13/11/2026): visual, comportamento, transições e o código pronto para copiar. Escrito para ser entregue a outro projeto (ou ao Claude Code de outro projeto) e reproduzido fielmente.

> **Instrução para quem for implementar:** siga os valores exatos deste documento (larguras, durações, curvas, molas, opacidades). Eles foram ajustados no olho e são o que dá a sensação da sidebar. Onde estiver `// ADAPTAR`, troque pelo equivalente do seu projeto (logo, rotas, menu do usuário).

---

## 1. Como ela é e como se comporta

**Visual**
- Painel **flutuante**: afastado 12px da borda esquerda, do topo e da base (`left-3 top-3 h-[calc(100vh-24px)]`), cantos de **22px**.
- **Vidro (glassmorphism)**: fundo translúcido + `backdrop-filter: blur(28px) saturate(1.6)`. Sem tinta colorida no painel; a cor da marca aparece **só** no item ativo.
- Borda feita com `box-shadow inset` (acompanha o raio sem somar largura) + um fio branco de 1px no topo (brilho de aresta) + sombra em três camadas.
- Ícones em círculos; item ativo é um **disco sólido na cor primária** com sombra colorida, sobre uma **pílula** de fundo bem diluída.

**Dois estados no desktop**
| Estado | Largura | Conteúdo |
|---|---|---|
| Trilho (recolhido) | **76px** | logo reduzido, lupa de busca, **um ícone por grupo**, rodapé (usuário, notificações, tema) |
| Painel (aberto) | **280px** | logo completo, botão de fixar, busca com ⌘K, grupos em acordeão com subtítulos, switch "Modo escuro", usuário |

**Ciclo de abertura/recolhimento**
1. Ao carregar a página a sidebar **nasce aberta** e recolhe sozinha depois de **2s**.
2. **Mouse entra** → abre na hora. **Mouse sai** → recolhe na hora (sem atraso).
3. **Fixar** (ícone de alfinete) → fica sempre aberta; preferência salva em `localStorage`.
4. Se um menu portalado (menu do usuário, gaveta de notificações) estiver aberto, a sidebar **não recolhe** quando o mouse sai rumo ao menu. Ao fechar o menu, só recolhe se o cursor não estiver mais sobre ela.
5. Ao recolher, todos os grupos fecham. Ao reabrir, o grupo da página atual já vem expandido.

**Transições**
- Largura: `width 300ms cubic-bezier(0.4, 0, 0.2, 1)`.
- Conteúdo da página acompanha com `padding-left` na **mesma duração e curva** (100px recolhida → 300px aberta), então nada fica escondido atrás do painel.
- Lista do painel aberto entra com fade de **180ms**.
- Acordeão do grupo: altura `0 → auto` + opacidade, **220ms**, curva `[0.4, 0, 0.2, 1]`. Chevron gira 90° em 300ms.
- **Pílula do item ativo desliza** entre itens (um único elemento com `layoutId`) com mola `stiffness 420, damping 34, mass 0.8`. No trilho, o **disco** do grupo ativo faz o mesmo.
- **Item ativo otimista:** ao clicar, a pílula já vai para o destino; a rota confirma depois (com timeout de 4s se a navegação for cancelada).
- **Efeito lupa (dock):** ao passar o cursor pela lista do painel, o ícone sob o cursor cresce até **1.3×** e os vizinhos crescem proporcionalmente menos (raio de 72px, curva smoothstep, mola `420/28/0.5`). Feito com MotionValue, **sem re-render**.
- No trilho: ícones de grupo com `whileHover scale 1.14`, `whileTap scale 0.95`, mola `520/30`.
- Rótulo do item desliza 2px para a direita no hover (300ms ease-out).
- Respeita "reduzir movimento" do sistema (`MotionConfig reducedMotion="user"` e a lupa fica em 1).

**Mobile (< lg)**
- Gaveta de 280px (máx. 85vw) com o mesmo vidro, um pouco mais opaco, entra de lado (`translate-x`, 300ms) sobre um véu `bg-black/50 backdrop-blur-sm`.
- Fecha ao navegar, ao clicar no véu e com **Esc**. Fechada fica `invisible` (sai da ordem de Tab e do leitor de tela).

---

## 2. Dependências

```bash
npm i motion next-themes lucide-react @radix-ui/react-switch
# a busca ⌘K usa o Command do shadcn (cmdk): npx shadcn@latest add command
```

Versões em uso: `motion ^13.5`, `next-themes ^0.4.6`, `lucide-react ^0.468`, `tailwindcss ^3.4`, Next.js 14 App Router. Também usa o `cn()` padrão do shadcn (`clsx` + `tailwind-merge`) e o `Switch` do shadcn.

> `motion` é o pacote novo do Framer Motion; importe de `motion/react`.

---

## 3. Tokens de cor (shadcn, HSL sem `hsl()`)

O vidro depende de `--card`, `--border` e `--primary`. Os valores do CAP, como referência:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 12%;
  --card: 0 0% 100%;
  --primary: 0 98% 60%;          /* vermelho da marca */
  --primary-foreground: 0 0% 100%;
  --muted: 210 20% 98%;          /* #F9FAFB */
  --muted-foreground: 240 4% 46%;
  --border: 240 5% 85%;
  --radius: 0.75rem;
}
.dark {
  --background: 0 0% 12%;
  --foreground: 0 0% 98%;
  --card: 0 0% 15%;
  --primary: 0 98% 60%;
  --primary-foreground: 0 0% 100%;
  --muted: 240 4% 20%;
  --muted-foreground: 50 43% 83%;
  --border: 240 4% 25%;
}
```

**Fundo da página:** o vidro precisa de algo atrás para ler como vidro. No layout autenticado o fundo é `bg-muted` no claro e `bg-background` no escuro (no escuro o `muted` é mais claro que o card e afundaria os cartões):

```tsx
<div className="relative min-h-screen bg-muted dark:bg-background">
```

---

## 4. CSS do vidro (`globals.css`)

```css
/* ===== Sidebar de vidro ===== */
.vidro-trilho {
  background:
    linear-gradient(180deg, hsl(0 0% 100% / 0.55) 0%, hsl(0 0% 100% / 0.15) 55%, hsl(0 0% 100% / 0.3) 100%),
    hsl(var(--card) / 0.58);
  -webkit-backdrop-filter: blur(28px) saturate(1.6);
  backdrop-filter: blur(28px) saturate(1.6);
  box-shadow:
    inset 0 1px 0 hsl(0 0% 100% / 0.9),
    inset 0 0 0 1px hsl(var(--border) / 0.55),
    0 1px 2px rgb(0 0 0 / 0.04),
    0 10px 28px -10px rgb(0 0 0 / 0.12),
    0 28px 64px -24px rgb(0 0 0 / 0.18);
}

.dark .vidro-trilho {
  background:
    linear-gradient(180deg, hsl(0 0% 100% / 0.07) 0%, hsl(0 0% 100% / 0.02) 55%, hsl(0 0% 100% / 0.04) 100%),
    hsl(var(--card) / 0.6);
  box-shadow:
    inset 0 1px 0 hsl(0 0% 100% / 0.1),
    inset 0 0 0 1px hsl(0 0% 100% / 0.07),
    0 1px 2px rgb(0 0 0 / 0.45),
    0 12px 32px -12px rgb(0 0 0 / 0.55),
    0 32px 72px -24px rgb(0 0 0 / 0.65);
}

/* Gaveta mobile: abre sobre véu preto 50%; mais opaca no claro para não virar cinza sem vida. */
.vidro-gaveta {
  background:
    linear-gradient(180deg, hsl(0 0% 100% / 0.6) 0%, hsl(0 0% 100% / 0.3) 55%, hsl(0 0% 100% / 0.45) 100%),
    hsl(var(--card) / 0.86);
}
.dark .vidro-gaveta {
  background:
    linear-gradient(180deg, hsl(0 0% 100% / 0.07) 0%, hsl(0 0% 100% / 0.02) 55%, hsl(0 0% 100% / 0.04) 100%),
    hsl(var(--card) / 0.72);
}

/* Navegador sem backdrop-filter: vira cartão sólido, nunca transparente. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .vidro-trilho { background: hsl(var(--card)); }
}

/* Pílula do item ativo: primária bem diluída no claro, vidro branco no escuro
   (vermelho a 7% sobre cinza escuro vira marrom sujo). */
.pilula-ativa {
  background: hsl(var(--primary) / 0.07);
  box-shadow:
    inset 0 0 0 1px hsl(var(--primary) / 0.12),
    0 1px 2px rgb(0 0 0 / 0.03);
}
.dark .pilula-ativa {
  background: hsl(0 0% 100% / 0.07);
  box-shadow:
    inset 0 0 0 1px hsl(0 0% 100% / 0.08),
    inset 0 1px 0 hsl(0 0% 100% / 0.06);
}

/* Hover dentro do vidro: preto/branco diluído (o token --muted some sobre o painel claro). */
.linha-vidro:hover { background: hsl(0 0% 0% / 0.04); }
.dark .linha-vidro:hover { background: hsl(0 0% 100% / 0.06); }

.botao-vidro { transition: background-color 200ms, color 200ms; }
.botao-vidro:hover { background: hsl(0 0% 0% / 0.05); }
.dark .botao-vidro:hover { background: hsl(0 0% 100% / 0.07); }
```

---

## 5. Estrutura da navegação (`src/lib/navigation.ts`)

Fonte única: alimenta trilho, painel, gaveta mobile e busca ⌘K. Grupos → colunas (com subtítulo opcional) → itens. No trilho aparece só o **ícone do grupo** (mantém o trilho curto: 5–7 ícones, não 30).

```ts
import { Eye, Inbox, LayoutDashboard, Wallet, Receipt, type LucideIcon } from 'lucide-react'

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
}

export interface NavColumn {
  /** Ausente = lista simples sem subtítulo. */
  label?: string
  items: NavItem[]
}

export interface NavGroup {
  name: string
  /** Rosto do grupo no trilho recolhido. */
  icon: LucideIcon
  columns: NavColumn[]
}

// ADAPTAR: as rotas do seu projeto
export const NAVIGATION: NavGroup[] = [
  {
    name: 'Visão',
    icon: Eye,
    columns: [
      {
        items: [
          { name: 'Caixa de Entrada', href: '/caixa-de-entrada', icon: Inbox },
          { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        ],
      },
    ],
  },
  {
    name: 'Financeiro',
    icon: Wallet,
    columns: [
      { label: 'Receita', items: [{ name: 'Notas Fiscais', href: '/financeiro', icon: Receipt }] },
    ],
  },
]

/** Remove itens invisíveis e depois colunas/grupos que ficaram vazios. */
export function filterNavigation(groups: NavGroup[], canSee: (item: NavItem) => boolean): NavGroup[] {
  return groups
    .map(group => ({
      ...group,
      columns: group.columns
        .map(column => ({ ...column, items: column.items.filter(canSee) }))
        .filter(column => column.items.length > 0),
    }))
    .filter(group => group.columns.length > 0)
}

export function flattenNavigation(groups: NavGroup[]): Array<NavItem & { group: string; column?: string }> {
  return groups.flatMap(group =>
    group.columns.flatMap(column =>
      column.items.map(item => ({ ...item, group: group.name, column: column.label }))
    )
  )
}

/** Item ativo pelo prefixo mais longo: /financeiro/dre acende DRE, não /financeiro. */
export function activeHref(groups: NavGroup[], pathname: string): string | null {
  let best: string | null = null
  for (const item of flattenNavigation(groups)) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`)
    if (matches && (best === null || item.href.length > best.length)) best = item.href
  }
  return best
}
```

---

## 6. Contexto de navegação (`src/contexts/nav-context.tsx`)

`isCollapsed` e `isPinned` moram num contexto porque a área de conteúdo precisa deles para refluir junto, e a barra inferior do mobile abre a mesma gaveta.

```tsx
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const PIN_STORAGE_KEY = 'sidebar-pinned' // ADAPTAR o prefixo

interface NavContextType {
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (open: boolean) => void
  isPinned: boolean
  setIsPinned: (pinned: boolean) => void
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
}

const NavContext = createContext<NavContextType | undefined>(undefined)

export function NavProvider({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // Começa solto: ler localStorage no 1º render quebra a hidratação. O efeito corrige.
  const [isPinned, setIsPinnedState] = useState(false)
  // Nasce aberta; a sidebar recolhe sozinha depois de 2s.
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    try {
      setIsPinnedState(window.localStorage.getItem(PIN_STORAGE_KEY) === '1')
    } catch {}
  }, [])

  const setIsPinned = (pinned: boolean) => {
    setIsPinnedState(pinned)
    try {
      window.localStorage.setItem(PIN_STORAGE_KEY, pinned ? '1' : '0')
    } catch {}
  }

  return (
    <NavContext.Provider
      value={{ isMobileMenuOpen, setIsMobileMenuOpen, isPinned, setIsPinned, isCollapsed, setIsCollapsed }}
    >
      {children}
    </NavContext.Provider>
  )
}

export function useNav() {
  const context = useContext(NavContext)
  if (context === undefined) throw new Error('useNav must be used within a NavProvider')
  return context
}
```

---

## 7. Área de conteúdo (`src/components/layout/main-content.tsx`)

```tsx
'use client'

import { useNav } from '@/contexts/nav-context'
import { cn } from '@/lib/utils'

/** Acompanha a largura da sidebar com a MESMA duração e curva dela. */
export function MainContent({ children }: { children: React.ReactNode }) {
  const { isPinned, isCollapsed } = useNav()
  const aberta = isPinned || !isCollapsed

  return (
    <div
      className={cn(
        'transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        // Aberta: 12 margem + 280 painel + 8 respiro. Recolhida: 12 + 76 trilho + 12.
        aberta ? 'lg:pl-[300px]' : 'lg:pl-[100px]'
      )}
    >
      <main className="relative w-full overflow-x-clip px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+5rem)] lg:px-6 lg:pt-8 lg:pb-10">
        {children}
      </main>
    </div>
  )
}
```

> Variante possível: em vez de o conteúdo refluir no hover, reservar só 100px e deixar o painel **flutuar por cima** do conteúdo (aí o blur do vidro aparece muito mais). Basta usar `isPinned` no lugar de `aberta`. O CAP testou as duas e ficou com o reflow.

---

## 8. Busca ⌘K (`src/components/layout/nav-search.tsx`)

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { flattenNavigation, type NavGroup } from '@/lib/navigation'

export function NavSearch({
  groups,
  className,
  compact = false,
  atalhoGlobal = true,
}: {
  groups: NavGroup[]
  className?: string
  compact?: boolean
  /** Só UMA instância pode escutar o ⌘K (desktop e mobile ficam montados juntos). */
  atalhoGlobal?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform))
    if (!atalhoGlobal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [atalhoGlobal])

  const items = useMemo(() => flattenNavigation(groups), [groups])
  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar página"
        title={`Buscar (${isMac ? '⌘K' : 'Ctrl K'})`}
        className={cn(
          'flex items-center rounded-xl bg-muted/60 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          compact ? 'h-10 w-full justify-center' : 'h-9 w-full gap-2 px-2.5',
          className
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        {!compact && (
          <>
            <span>Buscar</span>
            <kbd className="ml-auto rounded-md border border-border/60 bg-background/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </>
        )}
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar página..." />
        <CommandList>
          <CommandEmpty>Nenhuma página encontrada.</CommandEmpty>
          {groups.map(group => (
            <CommandGroup key={group.name} heading={group.name}>
              {items
                .filter(item => item.group === group.name)
                .map(item => (
                  <CommandItem
                    key={item.href}
                    value={`${item.name} ${item.group} ${item.column ?? ''} ${item.href}`}
                    onSelect={() => go(item.href)}
                    className="gap-2.5"
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{item.name}</span>
                    {item.column && (
                      <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        {item.column}
                      </span>
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
```

---

## 9. A sidebar (`src/components/layout/sidebar.tsx`)

Versão do CAP com as partes específicas trocadas por props. O rodapé (menu do usuário, notificações) entra como `footer`, uma função que recebe `compact` e um `onOpenChange` para avisar quando um menu portalado abre/fecha.

```tsx
'use client'

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { ChevronRight, Moon, Pin, PinOff, Sun, X } from 'lucide-react'
import {
  AnimatePresence, LayoutGroup, MotionConfig, motion,
  useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue,
} from 'motion/react'
import { cn } from '@/lib/utils'
import { activeHref, flattenNavigation, type NavGroup, type NavItem } from '@/lib/navigation'
import { useNav } from '@/contexts/nav-context'
import { Switch } from '@/components/ui/switch'
import { NavSearch } from './nav-search'

export const RAIL_WIDTH = 76
export const PANEL_WIDTH = 280
/** Só o recolhimento inicial. Sair com o mouse recolhe na hora. */
const COLLAPSE_DELAY_MS = 2000
/** Lupa: alcance vertical (px) e escala máxima do ícone sob o cursor. */
const LUPA_RAIO = 72
const LUPA_MAX = 1.3
/** Mola da pílula/disco do item ativo. */
const MOLA_PILULA = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const

// ADAPTAR: logos do seu projeto (completo e reduzido, claro e escuro)
const LOGO = { light: '/logo-dark.png', dark: '/logo-light.png' }
const MARK = { light: '/mark-dark.png', dark: '/mark-light.png' }

// Posição Y do cursor sobre a lista. MotionValue, não state: nada re-renderiza no mousemove.
const CursorYContext = createContext<MotionValue<number> | null>(null)

function useLupa(ref: RefObject<HTMLElement>) {
  const cursorY = useContext(CursorYContext)
  const parado = useMotionValue(Infinity)
  const reduzido = useReducedMotion()
  const escala = useTransform(cursorY ?? parado, (y: number) => {
    const el = ref.current
    if (reduzido || !el || !Number.isFinite(y)) return 1
    const caixa = el.getBoundingClientRect()
    const d = Math.abs(y - (caixa.top + caixa.height / 2))
    if (d >= LUPA_RAIO) return 1
    const t = 1 - d / LUPA_RAIO
    return 1 + (LUPA_MAX - 1) * t * t * (3 - 2 * t) // smoothstep
  })
  return useSpring(escala, { stiffness: 420, damping: 28, mass: 0.5 })
}

interface SidebarProps {
  /** Navegação já filtrada por permissão. */
  groups: NavGroup[]
  /** Rodapé: menu do usuário, notificações... `onOpenChange` evita recolher com menu portalado aberto. */
  footer?: (opts: { compact: boolean; onOpenChange: (open: boolean) => void }) => ReactNode
}

export function Sidebar({ groups, footer }: SidebarProps) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const {
    isMobileMenuOpen, setIsMobileMenuOpen, isPinned, setIsPinned,
    isCollapsed: collapsed, setIsCollapsed: setCollapsed,
  } = useNav()

  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [camadaAberta, setCamadaAberta] = useState(false)
  const aside = useRef<HTMLElement>(null)
  const cursorY = useMotionValue(Infinity)

  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === 'dark'

  // ------- Item ativo otimista -------
  const [pendente, setPendente] = useState<string | null>(null)
  useEffect(() => setPendente(null), [pathname])
  useEffect(() => {
    if (!pendente) return
    const t = setTimeout(() => setPendente(null), 4000) // navegação cancelada
    return () => clearTimeout(t)
  }, [pendente])

  const currentHref = useMemo(() => activeHref(groups, pathname), [groups, pathname])
  const hrefAtivo = pendente ?? currentHref
  // O trilho mostra o ícone da PÁGINA aberta no disco do grupo ativo.
  const currentItem = useMemo(
    () => flattenNavigation(groups).find(item => item.href === hrefAtivo) ?? null,
    [groups, hrefAtivo]
  )
  const currentGroup = useMemo(
    () => groups.find(g => g.columns.some(c => c.items.some(i => i.href === hrefAtivo)))?.name ?? null,
    [groups, hrefAtivo]
  )

  // ------- Recolhimento automático -------
  const clearCollapseTimer = useCallback(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current)
    collapseTimer.current = null
  }, [])

  const scheduleCollapse = useCallback(() => {
    clearCollapseTimer()
    if (isPinned) return
    collapseTimer.current = setTimeout(() => setCollapsed(true), COLLAPSE_DELAY_MS)
  }, [clearCollapseTimer, isPinned, setCollapsed])

  useEffect(() => {
    if (isPinned) {
      clearCollapseTimer()
      setCollapsed(false)
      return
    }
    scheduleCollapse()
    return clearCollapseTimer
  }, [isPinned, clearCollapseTimer, scheduleCollapse, setCollapsed])

  const handleMouseEnter = () => {
    clearCollapseTimer()
    setCollapsed(false)
  }

  const handleMouseLeave = () => {
    clearCollapseTimer()
    cursorY.set(Infinity)
    if (isPinned || camadaAberta) return
    setCollapsed(true)
  }

  const aoFecharCamada = (aberto: boolean) => {
    setCamadaAberta(aberto)
    if (aberto || isPinned) return
    if (!aside.current?.matches(':hover')) setCollapsed(true)
  }

  useEffect(() => {
    if (collapsed) setOpenGroup(null)
    else setOpenGroup(prev => prev ?? currentGroup)
  }, [collapsed, currentGroup])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname, setIsMobileMenuOpen])

  useEffect(() => {
    if (!isMobileMenuOpen) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMobileMenuOpen(false) }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [isMobileMenuOpen, setIsMobileMenuOpen])

  const body = (isCollapsed: boolean, isMobile: boolean) => {
    const idTema = `${isMobile ? 'mobile' : 'desktop'}-modo-escuro`
    const aoNavegar = (href: string) => {
      setPendente(href)
      if (isMobile) setIsMobileMenuOpen(false)
    }
    return (
      <div className="flex h-full flex-col">
        {/* Marca */}
        <div className={cn('flex h-16 shrink-0 items-center', isCollapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          <Link href="/" className="flex items-center" aria-label="Início">
            {mounted && (
              <Image
                src={isCollapsed ? MARK[isDark ? 'dark' : 'light'] : LOGO[isDark ? 'dark' : 'light']}
                alt="Logo"
                width={120}
                height={36}
                className={cn(isCollapsed ? 'h-7 w-7 object-contain' : 'h-6 w-auto')}
                priority
              />
            )}
          </Link>
          {!isCollapsed &&
            (isMobile ? (
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setIsMobileMenuOpen(false)}
                className="botao-vidro flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                aria-label={isPinned ? 'Soltar a sidebar' : 'Fixar a sidebar aberta'}
                aria-pressed={isPinned}
                title={isPinned ? 'Soltar (volta a recolher sozinha)' : 'Fixar aberta'}
                onClick={() => setIsPinned(!isPinned)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200',
                  isPinned ? 'bg-primary/10 text-primary' : 'botao-vidro text-muted-foreground hover:text-foreground'
                )}
              >
                {isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              </button>
            ))}
        </div>

        {/* Busca */}
        <div className="shrink-0 px-3 pb-2">
          <NavSearch
            groups={groups}
            compact={isCollapsed}
            atalhoGlobal={!isMobile}
            className="bg-black/[0.04] hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
          />
        </div>

        {/* Navegação */}
        <nav
          onMouseMove={e => cursorY.set(e.clientY)}
          onMouseLeave={() => cursorY.set(Infinity)}
          className={cn('flex-1 py-1', isCollapsed ? 'overflow-visible px-2' : 'overflow-y-auto overflow-x-hidden px-3')}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              {groups.map(group => {
                const isActive = group.name === currentGroup
                const Icon = isActive && currentItem ? currentItem.icon : group.icon
                const rotulo = isActive && currentItem ? currentItem.name : group.name
                return (
                  <motion.button
                    key={group.name}
                    type="button"
                    whileHover={{ scale: 1.14 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                    aria-label={rotulo}
                    title={rotulo}
                    onClick={() => {
                      setCollapsed(false)
                      setOpenGroup(group.name)
                    }}
                    className={cn(
                      'relative flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300',
                      isActive ? 'text-primary-foreground' : 'botao-vidro text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="trilho-disco"
                        transition={MOLA_PILULA}
                        className="absolute inset-0 rounded-full bg-primary shadow-md shadow-primary/30"
                      />
                    )}
                    <Icon className="relative z-10 h-5 w-5" />
                  </motion.button>
                )
              })}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="space-y-1">
              {groups.map(group => (
                <GroupSection
                  key={group.name}
                  group={group}
                  hrefAtivo={hrefAtivo}
                  isCurrent={group.name === currentGroup}
                  isOpen={openGroup === group.name}
                  onToggle={() => setOpenGroup(prev => (prev === group.name ? null : group.name))}
                  onNavigate={aoNavegar}
                />
              ))}
            </motion.div>
          )}
          <div className="h-3" />
        </nav>

        {/* Rodapé */}
        <div className={cn('shrink-0 pb-3 pt-2', isCollapsed ? 'px-2' : 'px-3')}>
          {!isCollapsed && (
            <div className="mb-1 flex h-10 items-center gap-2.5 rounded-xl px-2 text-sm text-muted-foreground">
              {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
              <label htmlFor={idTema} className="flex-1 cursor-pointer select-none">Modo escuro</label>
              <Switch
                id={idTema}
                checked={isDark}
                onCheckedChange={v => setTheme(v ? 'dark' : 'light')}
                // O token --input some sobre o vidro; preto/branco diluído aparece em qualquer fundo.
                className="h-5 w-9 data-[state=unchecked]:bg-black/[0.14] dark:data-[state=unchecked]:bg-white/20 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
              />
            </div>
          )}
          <div className={cn('flex items-center gap-1', isCollapsed && 'flex-col')}>
            {footer?.({ compact: isCollapsed, onOpenChange: aoFecharCamada })}
            {isCollapsed && (
              <button
                type="button"
                aria-label={isDark ? 'Modo claro' : 'Modo escuro'}
                title={isDark ? 'Modo claro' : 'Modo escuro'}
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="botao-vidro flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <CursorYContext.Provider value={cursorY}>
        {/* Desktop */}
        <aside
          ref={aside}
          className="vidro-trilho fixed left-3 top-3 z-40 hidden h-[calc(100vh-24px)] overflow-hidden rounded-[22px] lg:block"
          style={{
            width: collapsed ? RAIL_WIDTH : PANEL_WIDTH,
            transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <LayoutGroup id="sidebar-desktop">
            <div className="relative h-full">{body(collapsed, false)}</div>
          </LayoutGroup>
        </aside>

        {/* Mobile */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
        )}
        <aside
          className={cn(
            'vidro-trilho vidro-gaveta fixed left-3 top-3 z-50 h-[calc(100vh-24px)] w-[280px] max-w-[85vw] overflow-hidden rounded-[22px]',
            'transition-[transform,visibility] duration-300 ease-in-out lg:hidden',
            isMobileMenuOpen ? 'visible translate-x-0' : 'invisible -translate-x-[calc(100%+24px)]'
          )}
          aria-hidden={!isMobileMenuOpen}
        >
          <LayoutGroup id="sidebar-mobile">{body(false, true)}</LayoutGroup>
        </aside>
      </CursorYContext.Provider>
    </MotionConfig>
  )
}

function GroupSection({
  group, hrefAtivo, isCurrent, isOpen, onToggle, onNavigate,
}: {
  group: NavGroup
  hrefAtivo: string | null
  isCurrent: boolean
  isOpen: boolean
  onToggle: () => void
  onNavigate: (href: string) => void
}) {
  const iconeRef = useRef<HTMLSpanElement>(null)
  const escala = useLupa(iconeRef)

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          'group linha-vidro flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium transition-colors duration-200',
          isCurrent ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <motion.span
          ref={iconeRef}
          style={{ scale: escala }}
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
            isCurrent ? 'bg-primary/10 text-primary' : 'text-muted-foreground group-hover:text-foreground'
          )}
        >
          <group.icon className="h-[18px] w-[18px]" />
        </motion.span>
        <span className="flex-1 truncate text-left">{group.name}</span>
        <ChevronRight
          className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-300', isOpen && 'rotate-90')}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="itens"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {/* pt/pb: o ícone sob a lupa cresce 30% e precisa de folga para não ser cortado. */}
            <div className="ml-[18px] mt-0.5 space-y-2 border-l border-black/[0.08] pb-1.5 pl-2 pt-1 dark:border-white/10">
              {group.columns.map((column, index) => (
                <div key={column.label ?? index}>
                  {column.label && (
                    <p className="px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                      {column.label}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {column.items.map(item => (
                      <ItemLink key={item.href} item={item} isActive={item.href === hrefAtivo} onNavigate={onNavigate} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ItemLink({ item, isActive, onNavigate }: { item: NavItem; isActive: boolean; onNavigate: (href: string) => void }) {
  const iconeRef = useRef<HTMLSpanElement>(null)
  const escala = useLupa(iconeRef)

  return (
    <Link
      href={item.href}
      onClick={() => onNavigate(item.href)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 text-sm transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        isActive ? 'font-medium text-foreground' : 'linha-vidro text-muted-foreground hover:text-foreground'
      )}
    >
      {/* Um só elemento "viaja" entre os itens: trocar de página é a pílula deslizando. */}
      {isActive && (
        <motion.span layoutId="nav-pilula" transition={MOLA_PILULA} className="pilula-ativa pointer-events-none absolute inset-0 rounded-xl" />
      )}
      <motion.span
        ref={iconeRef}
        style={{ scale: escala }}
        className={cn(
          'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
          isActive ? 'bg-primary text-primary-foreground shadow-md shadow-primary/40' : 'text-muted-foreground/70 group-hover:text-foreground'
        )}
      >
        <item.icon className="h-4 w-4" />
      </motion.span>
      <span className="relative z-10 truncate transition-transform duration-300 ease-out group-hover:translate-x-0.5">
        {item.name}
      </span>
    </Link>
  )
}
```

---

## 10. Montagem no layout

```tsx
// app/layout.tsx: ThemeProvider do next-themes com attribute="class"
// app/(app)/layout.tsx
import { NavProvider } from '@/contexts/nav-context'
import { Sidebar } from '@/components/layout/sidebar'
import { MainContent } from '@/components/layout/main-content'
import { NAVIGATION } from '@/lib/navigation'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavProvider>
      <div className="relative min-h-screen bg-muted dark:bg-background">
        <Sidebar
          groups={NAVIGATION /* ADAPTAR: filtrar por permissão com filterNavigation */}
          footer={({ compact, onOpenChange }) => (
            // ADAPTAR: menu do usuário / notificações. Repasse onOpenChange
            // para o onOpenChange do DropdownMenu/Popover de cada um.
            null
          )}
        />
        <MainContent>{children}</MainContent>
      </div>
    </NavProvider>
  )
}
```

Para o menu do usuário no rodapé, o padrão do CAP é: no trilho, só o avatar com hover `hover:bg-black/[0.05] dark:hover:bg-white/[0.07]`; no painel, linha inteira `min-w-0 flex-1 bg-black/[0.035] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]` com avatar + nome + e-mail.

No mobile, um botão (barra inferior ou header) chama `setIsMobileMenuOpen(true)` do `useNav()`.

---

## 11. Armadilhas já resolvidas (não repetir)

1. **`backdrop-filter` morre com `filter`/`mask` num ancestral.** Qualquer ancestral com `filter`, `mask`, `opacity < 1` ou `will-change` vira o "backdrop root" e o desfoque some. Não coloque máscaras ou filtros em volta da sidebar. (O CAP chegou a ter uma "mordida" com máscara radial e teve que remover.)
2. **Dois ⌘K abertos.** Desktop e mobile ficam montados juntos (quem esconde é o CSS), então só a instância do desktop escuta o atalho (`atalhoGlobal={!isMobile}`).
3. **Menu do usuário fugindo do cursor.** Dropdowns são portalados para fora do `<aside>`; ir até eles dispara `mouseleave` e a sidebar recolhia no meio do clique. Por isso o `camadaAberta` + `onOpenChange`.
4. **Hidratação.** Nunca ler `localStorage` no estado inicial; `isPinned` começa `false` e um efeito corrige. Logo e switch de tema só aparecem depois de `mounted` (o `resolvedTheme` não existe no servidor).
5. **Lupa cortada.** O acordeão tem `overflow-hidden`; sem `pt-1 pb-1.5` o ícone ampliado tem o topo cortado.
6. **Pílula pulando entre desktop e mobile.** Cada `aside` tem seu `LayoutGroup id` próprio, senão o `layoutId` tenta animar de uma árvore para a outra.
7. **Pílula atrasada.** Sem o `pendente` (item ativo otimista) a pílula só se move quando a página nova chega do servidor, meio segundo depois do clique.
8. **Tokens que somem no vidro.** `--muted` e `--input` ficam invisíveis sobre o painel claro translúcido; hovers e o trilho do switch usam preto/branco diluído.
9. **Hover no trilho sem `overflow-visible`.** No modo recolhido a `<nav>` é `overflow-visible` para o `scale 1.14` do ícone não ser cortado.

---

## 12. Checklist de aceite

- [ ] Carrega aberta e recolhe sozinha em 2s
- [ ] Hover abre na hora; sair recolhe na hora; conteúdo da página reflui junto, mesma curva
- [ ] Alfinete fixa e sobrevive a reload
- [ ] Trilho mostra um ícone por grupo; o do grupo ativo é um disco na cor primária com o ícone da página atual
- [ ] Clicar num item: a pílula desliza imediatamente até ele (mola)
- [ ] Passar o mouse pela lista faz os ícones incharem em onda (dock)
- [ ] Grupo abre/fecha em acordeão; ao reabrir a sidebar, o grupo atual vem aberto
- [ ] Conteúdo atrás do painel aparece desfocado (vidro), claro e escuro
- [ ] ⌘K / Ctrl+K abre uma única busca
- [ ] Menu do usuário aberto não faz a sidebar recolher
- [ ] Mobile: gaveta com véu, fecha com Esc, clique fora e ao navegar
- [ ] Com "reduzir movimento" ligado no sistema, sem lupa nem molas
