# Sidebar de vidro: referência histórica (não é a do VYZ)

**O que é:** a especificação da sidebar de vidro do CAP Manager (outro projeto), de 13/11/2026. Serviu de ponto de partida para o menu lateral do VYZ, mas o VYZ seguiu outro desenho. **Não use como especificação do VYZ.**

A versão completa (CSS do vidro, contexto, busca ⌘K e o componente pronto para copiar) continua no histórico do git:

```
git show edf4dba:docs/SIDEBAR-MODELO.md
```

## O menu do VYZ hoje

Descrito em `docs/ARQUITETURA.md` (seção "Interface do painel"). Código:

- `src/features/workspace/Sidebar.tsx`: menu integrado à moldura oliva (sem vidro). O item ativo é uma aba na cor do painel com cantos côncavos (`.side-tab` em `src/app/globals.css`), que desliza entre os itens por `layoutId`.
- `src/features/workspace/nav.ts`: fonte única do menu, da barra do celular e da folha "Mais".
- `src/features/workspace/AppShell.tsx`: a moldura.

Diferenças em relação ao modelo do CAP:

| CAP (este modelo) | VYZ |
|---|---|
| Painel de vidro flutuante (`backdrop-filter`) | Moldura sólida na cor da marca |
| Abre no hover e recolhe sozinho; alfinete para fixar | Abre e recolhe só pelo botão do rodapé ou com `[`; estado em `<html data-sidebar>` (`vyz:sidebar`) |
| 280 px aberto, 76 px recolhido | 252 px aberto, 76 px recolhido |
| Grupos em acordeão, busca de páginas no ⌘K | Grupos fixos (Início, workspace aberto, Rotina); ⌘K abre o Pergunte ao VYZ |
| Gaveta lateral no celular | Topo, barra flutuante embaixo e folha "Mais" |

## O que ainda vale do modelo

Lições que se aplicam a qualquer menu com `motion`:

1. Cada árvore (computador e celular) precisa do seu `LayoutGroup id`, senão o `layoutId` tenta animar de uma para a outra.
2. Não ler `localStorage` no estado inicial (quebra a hidratação); aplicar o estado antes da primeira pintura ou corrigir num efeito.
3. Menus portalados para fora do `<aside>` disparam `mouseleave`: quem reage ao hover precisa saber que um menu está aberto.
4. `backdrop-filter` some se um ancestral tiver `filter`, `mask`, `opacity < 1` ou `will-change`.
5. Respeitar "reduzir movimento" (`MotionConfig reducedMotion="user"`).
