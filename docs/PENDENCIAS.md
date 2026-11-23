# VYZ · Pendências

Só o que ainda falta: credencial, aprovação de plataforma, decisão ou código. Quando um item ficar pronto, apague a linha. No produto, o que depende de algo externo aparece com o selo `PendingChip`.

O que é do lançamento da cobrança está em `docs/LANCAMENTO.md`; o que é do armazém de dados do MMM, em `docs/MMM.md` (seção 12).

## Plataformas

Situação de cada uma em `docs/PLATAFORMAS.md`. Funcionam de ponta a ponta hoje: Meta Ads, Instagram, Facebook, Google Ads e GA4 (`AVAILABLE_PLATFORMS` em `src/features/accounts/platforms.ts`).

| Item | O que falta |
|---|---|
| Meta | Análise do App (Acesso Avançado para `ads_read`, `ads_management` e `business_management`) |
| Google | Verificação do app no Google (escopos `adwords` e `analytics.readonly`); hoje no nível Exploração da API |
| TikTok, LinkedIn, RD Station, HubSpot, Pipedrive, Kommo | Login pronto no código; falta o app aprovado na plataforma e as credenciais na Vercel |
| Mercado Ads | Login pronto no código; app ainda não criado |
| Planilha do Google fechada | Hoje a importação só lê planilha aberta por link; a do lançamento (Fachada) lê fechada com a conta de serviço em `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON`, que faltava criar e pôr na Vercel (13/11, `docs/TEMPLATES.md`) |

## Assistente VYZ

| Item | Como está | O que falta |
|---|---|---|
| Respostas abertas (`LlmEngine`) | Só o `LocalEngine` (intenções por palavra-chave, com os dados da conta vindos do servidor). O ponto de troca é `src/features/agent/engine/index.ts` | Um motor que chame o modelo por um route handler, com a mesma interface `VyzEngine` |
| "Pedir ao Vyz" no editor | Com `CLAUDE_API_KEY`, vai para `src/server/dashboards/ask.ts` (40 pedidos por hora por pessoa); sem chave ou com erro, vale a leitura local (`planner.ts`) | Medir em produção quantos pedidos caem na leitura local e o custo por mês |
| Conversa | Só na memória da aba | Decidir se guarda |
| Voz | Web Speech API: Chrome e Edge; no Firefox e em parte do Safari fica só o texto | Nada, enquanto o navegador não oferecer |
| Análise por áudio | "Em breve" (`audio: "soon"` em `entitlements.ts`) | Construir |

## Métricas e dashboards

| Item | Como está | O que falta |
|---|---|---|
| Alcance do período (Meta) | "Alcance médio por dia" | Pedir à Meta o alcance do intervalo inteiro (pessoas únicas não somam entre dias) e, com ele, a frequência do período |
| Métricas no app | `/api/v1/dashboards/:id` e o app ignoram `metric_prefs` | Ler a personalização na API e no app |
| Ordem dos cards | Segue o catálogo; soltar um card só adiciona | Guardar a ordem em `metric_prefs` |
| Visitas ao perfil (Meta) | A coluna `insights_ad_daily.profile_visits` existe, mas só o gerador simulado preenche | Confirmar o campo na API da Meta e mapear em `src/server/sync/live/map.ts` |
| Data de início do anúncio | O banco não guarda; "Dias veiculados" e "Dia 1" valem dentro do período | Guardar a data |

## Landing pages e site

| Item | Como está | O que falta |
|---|---|---|
| Venda de LP | Desligada (`SHOW_LANDING_PAGES = false` em `src/lib/flags.ts`); o painel mostra "em breve" e a lista de espera | Decidir quando abrir |
| Publicar LP em subdomínio | Só em `/p/<slug>`; a tela mostra `slug.vyz.app` como exemplo | Domínio e hospedagem das LPs |
| Teste de GTM e Pixel | As tags só rodam na página publicada | Depende da publicação |
| Indexação do site | A home segue com `noindex` até `SITE_INDEXABLE = true` (`src/lib/flags.ts`); as páginas legais já são indexáveis | Virar no lançamento |
| WhatsApp do site | Número provisório (`WHATSAPP_NUMBER` em `src/features/pricing/pricing.ts`) | Número próprio da VYZ |
| Lighthouse mobile da home | Medições locais entre 83 e 93 | Medir no PageSpeed com o site no ar |

## Privacidade e exclusão de dados

| Item | Como está | O que falta |
|---|---|---|
| Eventos de pagamento | `billing_events` (Stripe) e `store_events` (lojas) guardam o `payload` inteiro do webhook, que pode ter nome, e-mail e endereço. Nada apaga essas linhas, nem a exclusão de conta | Definir o prazo e incluir na limpeza, ou guardar só os campos necessários |
| "Excluir conta" no app | `DELETE /api/v1/account` só chama `prepare_account_deletion` e apaga o login. Não apaga workspaces de que a pessoa era o único membro, não revoga o acesso na Meta e no Google e não remove arquivos do Storage | Seguir o caminho do script interno (`src/server/admin/account-deletion.ts` e `revoke-access.ts`; `docs/EXCLUSAO-DE-DADOS.md`) |
| Retenção de 5 anos | Em **simulação** (migração `20261109120000_retention_five_years.sql`): a limpeza diária conta as linhas com mais de 5 anos em `legal_acceptances`, `activity_events` e `audit_events` e registra em `private.retention_runs`, sem apagar | Acompanhar `private.retention_runs` e, para liberar, uma migração com `update private.retention_policy set apply = true, updated_at = now();` |
