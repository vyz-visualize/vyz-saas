# VYZ · O que já está feito

> **Histórico da fase 1.** A arquitetura atual (backend, dois produtos, checkout, app) está em [docs/ARQUITETURA.md](docs/ARQUITETURA.md); templates em [docs/TEMPLATES.md](docs/TEMPLATES.md).

Situação em 27/10/2026 (último commit: `c4ab882`). Fase 1: **só front-end**, sem backend. Tudo que depende de servidor funciona no navegador e aparece marcado com o aviso `PendingChip`.

Detalhes técnicos: [docs/ARQUITETURA.md](docs/ARQUITETURA.md). O que falta: [docs/PENDENCIAS.md](docs/PENDENCIAS.md).

## Stack

- Next.js 16.4 (App Router, Cache Components), React 19.3, TypeScript
- Tailwind v4, fonte Inter, tema claro/escuro sem flash (escuro é o padrão)
- Motion (LazyMotion), Lenis (scroll suave), Radix UI, lucide-react
- Vitest: 53 testes (preços, limites por plano, validação de IDs, eixos/rótulos de gráfico, assistente, codificação de link)

Três áreas isoladas por route group, com ESLint impedindo importações cruzadas: `(marketing)`, `(painel)`, `(publico)`, mais `(auth)`.

## 1. Marca

- Tokens da marca, logo VYZ e wordmark em SVG (`components/brand`)
- Imagem Open Graph e ícone do app gerados a partir do wordmark

## 2. Landing page de vendas (`/`)

- **Intro** animada (uma vez por sessão), navbar, barra de progresso de scroll
- **Dobra 1 · Hero:** headline em formato de prompt, gerador de dashboard mock ao vivo, ticker
- **Dobra 2 · Como funciona:** scroll-telling em passos, painel em tamanho real, cards técnicos ("por que VYZ")
- **Dobra 3 · Planos:** Base, Pro (em destaque) e Avançado, mensal/anual com odômetro, onda sonora do add-on de áudio
- **Dobra 4 · Monte seu plano:** configurador (contas por plataforma, LPs, dashboards sob medida, nicho) com total em formato de comanda/cupom e envio pelo WhatsApp
- **Footer** com wordmark gigante
- Motion: revelação pelo corte, reveal, cursor magnético, wipe entre seções; tudo desligado com `prefers-reduced-motion`
- Desempenho: LazyMotion, odômetro leve, hidratação fatiada; ajustes de responsivo e contraste

### Preços (`features/pricing/pricing.ts`, fonte única)

| Item | Mensal | Anual |
|---|---|---|
| Base (1ª conta) | R$ 41,66 | R$ 28,33 |
| Pro | R$ 125 | R$ 85 |
| Avançado | Pro + áudio R$ 990/mês | — |
| Conta extra Base | R$ 99,99 | R$ 67,99 |
| Conta extra Pro/Avançado | R$ 149,99 | R$ 101,99 |

Extras: dashboard sob medida (R$ 1.900 único ou R$ 990 + R$ 199/mês), LP feita pelo time (R$ 950), cuidado da LP (R$ 99/mês), dashboard extra (R$ 99). Economia anual: 32%. Até 30 contas no plano; acima, sob consulta.

## 3. Login (`/entrar`)

- Tela de login visual (brand book pág. 17). Sem backend: avisa e leva ao painel de demonstração.

## 4. Painel (`/painel`)

- **App shell:** sidebar em aba, recolhível (tecla `[`), seletor "Simular plano", aviso de modo demonstração
- **Início:** visão geral do workspace
- **Dashboards:** lista, galeria de **20 templates** e fluxo guiado de 5 passos; visualização com páginas, período, widgets e dados de amostra determinísticos
- **Landing pages:** lista, galeria de **10 templates**, fluxo de 4 passos, editor com preview, campos de GTM/Pixel/conversões
- **Contas:** 9 plataformas (Meta, Google Ads, GA4, TikTok, LinkedIn, YouTube, Mercado Ads, Shopee, CRM), cadastro por ID com validação de formato
- **Compartilhar:** link público, PDF e relatórios agendados
- **Plano:** limites e recursos do plano simulado
- **Configurações:** workspace e marca própria (white-label no Personalizado)
- Componentes de formulário próprios (Select, Menu, Tooltip, Checkbox/Radio/Switch, NumberStepper, PeriodPicker, FileInput, ColorField), sem controle nativo

### Templates de dashboard (20)

- **Base:** E-commerce · Visão geral; Geração de leads · Visão geral; Imobiliário · Leads; Negócio local · WhatsApp e ligações; Meta Ads essencial
- **Pro:** Google Ads · Pesquisa; Criativos · Meta Ads; Funil do site · GA4; Lançamento e infoproduto; Agência · Carteira de clientes
- **Avançado:** TikTok Ads; Marketplace · Mercado Ads e Shopee; CRM · Do lead à venda; Comparativo de canais; Metas e pacing de verba; Saúde da conta e alertas; Clínicas e saúde; Educação · Matrículas; YouTube e vídeo; Relatório executivo

### Templates de LP (10)

Captura de leads, Produto ou oferta, Atendimento no WhatsApp, Empreendimento imobiliário, Evento ou webinar, Serviço local, Lançamento, Clínica, Educação · Matrícula, Promoção sazonal.

### Limites por plano

| | Base | Pro | Avançado | Personalizado |
|---|---|---|---|---|
| Templates de dashboard | 5 | 10 | 20 | 20 + sob medida |
| Templates de LP | 3 | 6 | 10 | 10 |
| Dashboards | 2 | 10 | 20 | 50 |
| LPs publicadas | 1 | 3 | 10 | 10 |
| Plataformas | Meta, Google, GA4 | todas | todas | todas |
| White-label | não | não | não | sim |
| Assistente VYZ | chat | chat | chat + voz | chat + voz |

## 5. Gráficos e métricas

- Gráficos em SVG feitos à mão (linha, funil, dispersão, barras, sparkline), sempre em pixels reais, sem escala
- Regras de métrica: venda confirmada deduplicada (GA4/CRM), CTR ponderado do período, últimos 3 dias marcados como "em maturação", ROAS de equilíbrio (1 ÷ margem)
- `MockSource`: dados determinísticos por seed (campanhas, criativos, funis, públicos, produtos, CRM, pacing). Interface `DataSource` pronta para trocar por dados reais

## 6. Páginas públicas

- `/r/[id]#payload`: dashboard compartilhado, só leitura. Configuração comprimida (deflate + base64url) no fragmento da URL, com expiração
- `/p/[id]#conteúdo`: prévia da LP publicada
- PDF via impressão: A4 paisagem, capa, uma página por folha, sempre em modo claro

## 7. Assistente VYZ (só no painel)

- Drawer de chat; entradas pelo mascote no topo, barra "Pergunte ao VYZ…" e ⌘K / Ctrl+K
- Motor local por palavra-chave em PT-BR (`LocalEngine`): responde só com dados do contexto, nunca inventa número
- Ações: trocar tema, abrir telas, criar dashboard; botão **"Mostrar no painel"** navega até o KPI e destaca
- Voz (Web Speech API, pt-BR): microfone, leitura em voz alta e legenda, só no Avançado/Personalizado
- **Mascote 3D**: esfera brilhante com o rosto do logo, flutuando no canto, com giro que mostra o V

## 8. Persistência

- `Store` com `LocalStore` (localStorage, prefixo `vyz:v1:`), pronta para trocar por `SupabaseStore` com a mesma interface

## Ainda não feito (resumo)

Backend Supabase (login, workspace, plano real, persistência), OAuth das plataformas e dados reais, `LlmEngine` do assistente, envio de relatórios agendados, publicação de LP em subdomínio, domínio do site e remoção do `noindex`. Lista completa em [docs/PENDENCIAS.md](docs/PENDENCIAS.md).
