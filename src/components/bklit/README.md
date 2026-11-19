# Bklit UI (gráficos)

Biblioteca padrão dos gráficos dos dashboards. É um registry do shadcn
(https://ui.bklit.com): o código vem copiado para cá, não é um pacote do npm.
Licença MIT (arquivo LICENSE desta pasta; vale para os componentes de gráfico,
não para o Bklit Studio).

## O que está instalado

Só as peças que o produto usa: line, area, bar e composed-chart, funnel-chart,
sparkline, ring-chart, x-axis, y-axis, grid, tooltip e o que eles puxam
(chart-context, patterns, gradients, series...). O resto do registry (heatmap,
scatter, legend, candlestick-chart, trend-line, o componente reference-area...) foi tirado em
2026-11-19 por não ter uso; para voltar a usar, instale de novo pelo registry.
Dependências no package.json: d3-shape, d3-scale, d3-array, clsx,
tailwind-merge, @number-flow/react e motion.

## O que mudamos em relação ao original

- `@/lib/utils` virou `@/components/bklit/lib/utils`.
- Datas e números em pt-BR (era en-US) em chart-formatters.ts e em
  chart-stat-flow.ts (número do centro do anel).
- theme.css (nosso): os tokens `--chart-*` e `--legend*` apontam para os tokens
  da VYZ. Importado em src/app/globals.css.

O ESLint ignora esta pasta (código de terceiros, mantido como veio).

## Como usar

Os componentes do produto ficam em `src/components/charts` (LineChart, BarList,
Funnel...) e desenham com as peças daqui. Camadas próprias (alvo, maturação,
trecho selecionado) usam `useChart()` para ler as escalas. Componente que
desenha fora da área do traçado (etiqueta na margem) marca
`__isPostOverlay = true` para não ser recortado pela animação de entrada.

Trecho da tela com outra cor de destaque (marca própria, visuais especiais):
ponha `data-chart-theme` no contêiner para os gráficos usarem o `--accent` dali.

## Atualizar ou instalar outro gráfico

Baixe o JSON do registry (`https://ui.bklit.com/r/<nome>.json`, com os
`registryDependencies`), copie os arquivos para `charts/` e reaplique as três
mudanças acima.
