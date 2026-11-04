# VYZ · Banco de dados (Supabase / Postgres 17)

O banco é a fonte de verdade de tudo o que pertence a um cliente: conta, equipe, assinatura, conexões, métricas, dashboards, landing pages e histórico. O schema vive em `supabase/migrations/` (uma migration por domínio, em ordem) e os tipos TypeScript são gerados dele (`src/lib/supabase/database.types.ts`).

## Operação

| Tarefa | Comando |
|---|---|
| Nova migration | `npm run db:new -- nome_curto` (cria `supabase/migrations/<timestamp>_nome_curto.sql`) |
| Aplicar no projeto | `npm run db:push` (usa `SUPABASE_DB_URL`, o pooler IPv4) |
| Regerar os tipos | `npm run db:types` (lê o catálogo do Postgres; não precisa de Docker) |
| Copiar o catálogo do código para o banco | `npm run db:catalog` (planos, preços, plataformas, templates…) |
| Conta de teste completa | `npx tsx scripts/dev/create-test-account.ts --email teste@vyz.dev --onboarding done` |
| Cookie de sessão para `curl` | `npx tsx scripts/dev/auth-cookie.ts --email … --password …` |

Regras: migration aplicada não se edita (corrige-se com outra); depois de toda migration, `npm run db:types`; mudou preço, limite, plataforma ou template no código, `npm run db:catalog`.

## Convenções

- **Schemas.** `public` tem o que a API do Supabase expõe, sempre com RLS. `private` guarda as funções internas (helpers de RLS, gatilhos) e as partições dos históricos; não é exposto.
- **Negado por padrão.** As *default privileges* tiram de `anon` e `authenticated` qualquer acesso a objetos novos em `public`. Cada tabela recebe grants explícitos, até por coluna (`grant update (name, …)`), e cada função tem `execute` só para quem precisa.
- **Ids.** `uuid` (`gen_random_uuid()`). Catálogos usam slugs de texto que o código também usa (`'pro'`, `'meta'`, `'meta-ecommerce'`).
- **Tenant.** Tudo de um cliente tem `workspace_id`. Referências entre tabelas do mesmo cliente usam FKs compostas `(workspace_id, x_id)`: um dashboard nunca aponta para a conta de outro workspace, nem por erro de código.
- **Dinheiro.** Cobrança em centavos (`bigint`, sufixo `_cents`). Métricas das plataformas em `numeric(18,4)`, na moeda da conta.
- **Datas.** `timestamptz`; `created_at`/`updated_at` em toda entidade (gatilho `private.touch_updated_at`).
- **Estados.** Máquinas de estado são enums (`subscription_status` com os mesmos valores da Stripe, `member_role`, `connection_status`…). Listas que crescem (planos, plataformas, templates) são tabelas de catálogo.
- **Erros de regra.** Gatilhos e funções levantam `P0001` com `message` no formato `grupo:motivo` (`limit:dashboards`, `plan:inactive`) e um `hint` em português. O app traduz em `src/server/supabase/errors.ts`.

## Domínios e tabelas

| Migration | Tabelas | Para quê |
|---|---|---|
| 01 fundação | — | schema `private`, privilégios negados por padrão, enums, `slugify` |
| 02 catálogo | `plans`, `plan_entitlements`, `plan_prices`, `billing_items`, `platforms`, `business_types`, `dashboard_page_types`, `dashboard_templates` (+ `_platforms`, `_pages`, `_business_types`), `landing_templates` | cópia do catálogo do código, com FKs; leitura pública |
| 03 identidade | `profiles`, `workspaces`, `workspace_members`, `workspace_invitations`, `workspace_platforms` | usuário, conta da agência/empresa, equipe com papel, convites (hash do token), plataformas do onboarding |
| 04 cobrança | `billing_customers`, `checkout_sessions`, `checkout_items`, `subscriptions`, `subscription_items`, `invoices`, `payment_transactions`, `service_orders`, `billing_events`; view `workspace_access` | pedido → pagamento → assinatura; faturas, cada transação, serviços a entregar, eventos de webhook (idempotência) |
| 05 integrações | `connections`, `connection_secrets`, `oauth_states`, `ad_accounts`, `sync_runs` | login OAuth no Meta/Google, tokens no Vault, contas de anúncio, cada sincronização |
| 06 métricas | `ad_campaigns`, `ads`, `ad_products`, `insights_account_daily`, `insights_campaign_daily`, `insights_ad_daily`, `insights_breakdown_daily`, `insights_search_term_daily`, `insights_product_daily` | armazém de métricas diárias sincronizadas |
| 07 dashboards | `dashboards`, `dashboard_pages`, `dashboard_sources`, `share_links`, `scheduled_reports`, `scheduled_report_recipients`, `report_deliveries`, `dashboard_exports` | dashboards, links públicos (hash do token), relatórios e envios, exportações |
| 08 landing pages | `landing_pages`, `landing_page_versions`, `landing_page_submissions` | páginas, versões publicadas, leads dos formulários |
| 09 limites | view `workspace_usage` | gatilhos que aplicam o plano no banco |
| 10 histórico | `audit_events`, `subscription_changes`, `auth_events`, `activity_events`, `legal_acceptances` | histórico de tudo (ver abaixo) |
| 11 manutenção | `rate_limits`; bucket `brand-assets` | limite de tentativas, limpeza diária (pg_cron), logos |
| 12 endurecimento | — | correções da revisão adversarial (segurança, integridade, desempenho; ver abaixo) |
| 13 cobrança: complementos | — | CNPJ alfanumérico, troca de plano atômica (`change_subscription`), renovação das assinaturas simuladas |
| 17 lista de espera | `landing_waitlist`, `landing_waitlist_visits` | quem pediu acesso antecipado às LPs (um por usuário em cada workspace; o e-mail vem do banco) e visitas à página "em breve" (leitura só com a chave de serviço) |
| 18 métricas do dashboard | `dashboards.metric_prefs` | o que difere do padrão do template, por plataforma (member+ edita) |
| 19 métricas de criativos | colunas em `insights_ad_daily`, `ads.post_url` | leads, engajamento, vídeo 25 a 100%, segundos assistidos, visitas ao perfil e link do post |
| 20 métricas do Personalizar | colunas em `insights_ad_daily` e `insights_campaign_daily` | cadastros por anúncio; todas as conversões, interações e topo por campanha. O rollup por conta não usa essas colunas |

### Fluxo de compra

`/assinar` grava `checkout_sessions` (seleção da LP + orçamento calculado no servidor) e `checkout_items`. Com o pagamento confirmado (hoje simulado; depois o webhook da Stripe), o servidor chama `public.fulfill_checkout(...)`, que numa transação cria o workspace e o dono, o cliente, a assinatura com os itens, a fatura paga, a transação, os pedidos de serviço e as plataformas sugeridas. Chamar de novo com o mesmo checkout devolve o mesmo workspace (idempotente).

### Plano e limites

`workspace_access` junta a assinatura viva (só uma por workspace, por índice parcial) com `plan_entitlements`. `has_access` vale para `active`, `trialing` e `past_due` (carência). Os gatilhos da migration 09 conferem, com um *advisory lock* por workspace (sem corrida entre duas abas):

- assinatura ativa para criar dashboards, LPs, links, relatórios e exportações e para ativar contas;
- quantidade: dashboards (`max_dashboards`), LPs publicadas (`max_landing_pages`) e contas ativas (`accounts_quantity`, com cada Business Manager do Meta contando uma vez);
- plano mínimo de template, página e plataforma, e marca própria só com `white_label`.

O app checa antes para mostrar a mensagem certa, mas quem garante é o banco: chamar a API direto com o próprio token não fura o plano.

## Segurança

- **RLS em todas as tabelas.** As políticas usam `workspace_id = any (array(select private.workspace_ids('<papel>')))`: a função (security definer, `search_path` vazio) roda uma vez por consulta, inclusive nas tabelas particionadas, e a condição usa índice. Escreva políticas novas nessa forma (a forma `in (select …)` vira um filtro que varre a tabela inteira). Papéis em ordem: `viewer` lê; `member` cria e edita dashboards, LPs, links e relatórios; `admin` gerencia contas, conexões, equipe e marca; `owner` cuida da cobrança.
- **Quem é de fora não descobre nada.** Os gatilhos de plano conferem a filiação antes de olhar plano e limites: um usuário de outro workspace recebe o mesmo erro do RLS, não "limite atingido".
- **Revisado de forma adversarial.** Antes de entrar em uso, o banco passou por testes ao vivo de isolamento: 59 relações × 9 perfis na leitura e 2.416 tentativas de escrita e escalada de papel, sem nenhum vazamento entre clientes. Também passou por revisão estática, testes de integridade e análise de desempenho com volume. As correções estão na migration 12, e a matriz rodou de novo depois dela com o mesmo resultado.
- **Escrita sensível só pelo servidor.** Cobrança, conexões, tokens, métricas e históricos não têm política de escrita para usuários: só a chave de serviço grava, e só depois da autorização em `src/server/auth`.
- **Tokens no Vault.** Access e refresh tokens do Meta/Google ficam criptografados no Supabase Vault; `connection_secrets` guarda só os ids. Ler ou gravar passa por `connection_tokens_read/save`, restritas ao `service_role`. Apagar a conexão apaga os segredos.
- **Hash em vez de segredo.** Convites, links públicos e estados de OAuth guardam o sha256 do token. O link completo aparece uma vez, na criação.
- **Funções.** Toda `security definer` tem `search_path = ''`. O padrão global tira o `execute` de `PUBLIC` de toda função nova; cada uma recebe `execute` só de quem precisa (as de serviço, só `service_role`). Atenção: vale também para funções de extensões instaladas depois; conceda `execute` quando a API precisar.
- **Histórico imutável.** Nem a chave de serviço altera ou apaga histórico (`audit_events`, `subscription_changes`, `auth_events`, `activity_events`, `legal_acceptances`, `landing_page_versions`); só a retenção, por partição, o remove.
- **Dados financeiros ficam.** Faturas e transações seguram o workspace (`on delete restrict`): apagar uma conta exige purgar ou anonimizar antes.
- **Regras de conteúdo.** Link público revogado não volta; convite vale no máximo 30 dias e só enquanto quem convidou for admin; slugs de LP reservados (`www`, `app`, `painel`…) e "aposentados" por 180 dias depois de apagados (ninguém de outra conta captura o endereço); a data de publicação de LP é sempre a do banco; caminhos do Storage gravados nas tabelas precisam ser da pasta do próprio workspace.
- **Storage.** `brand-assets` aceita só PNG, JPEG e WebP (sem SVG), até 2 MB, na pasta `<workspace_id>/` e só por admin.
- **No app:** cookies de sessão `httpOnly`; JWT validado localmente (`getClaims`, chave ES256); validação com zod em toda Server Action; `safeNextPath` contra *open redirect*; limite de tentativas em login, cadastro, senha, checkout e OAuth; headers de segurança (CSP, HSTS, `frame-ancestors 'none'`); pagamento e OAuth simulados bloqueados em produção sem `ALLOW_MOCKS_IN_PRODUCTION=true`.

## Desempenho

- **Leituras pequenas.** Os dashboards leem `insights_account_daily` (um total por conta e dia, recalculado pelo banco ao fim de cada sincronização com `rollup_account_insights`): um período de 30 dias são ~30 linhas por conta. As outras tabelas de fatos são lidas filtradas por `(ad_account_id, date)`, sempre com índice.
- **Nunca a API da plataforma na tela.** O dashboard lê o armazém; só a sincronização fala com Meta/Google, em lotes, uma por conta por vez (índice único parcial em `sync_runs`).
- **Cache no app.** Dados de dashboard ficam em cache por dashboard e por conta (`cacheTag`), invalidados quando a sincronização termina.
- **Índice em toda FK** e nas colunas das políticas.
- **Históricos particionados por mês** (`audit_events`, `auth_events`, `activity_events`): sem FKs (inserção barata), BRIN em `created_at`, partições criadas com 3 meses de folga e apagadas inteiras ao vencer.
- **`rate_limits` é UNLOGGED** (sem WAL).
- **Limpeza diária** (`private.housekeeping`, pg_cron às 06:00 UTC): expira checkouts abertos, apaga estados de OAuth e janelas de limite vencidas, destrava sincronizações presas, cria partições futuras e aplica a retenção. Cada etapa é isolada (uma falha não desfaz as outras), as partições são calculadas em UTC e a DDL espera no máximo 1 s por lock (nunca enfileira na frente das escritas).
- **Ciclo de cobrança** (`private.billing_tick`, pg_cron a cada 15 min): encerra assinaturas com cancelamento agendado vencido e renova as simuladas, com fatura e transação, como a Stripe faria.
- **Auditoria sem ruído.** Batimentos gravados pelo servidor (última sincronização, visitas a um link, execução de relatório) não geram linha de auditoria; o histórico deles fica em `sync_runs`, `activity_events` e `report_deliveries`.
- **Sessão esquecida** dentro de uma transação (scripts, psql) cai em 15 min (`idle_in_transaction_session_timeout`), para não travar migrations nem o vacuum.
- **Tempo máximo** por consulta: 8 s para usuários logados, 3 s para anônimos (padrão do Supabase).

## Histórico de tudo

| Tabela | O que guarda | Quem grava | Retenção |
|---|---|---|---|
| `audit_events` | toda inserção, alteração e exclusão nas tabelas de negócio e no catálogo (preços inclusive): quem, quando, colunas alteradas, antes e depois, IP e navegador | gatilho `private.audit_row_change` | 5 anos |
| `subscription_changes` | linha do tempo da assinatura: criação, troca de plano, de contas, de período, de status, cancelamento agendado ou revertido, renovação | gatilho | sem prazo |
| `invoices` + `payment_transactions` | faturas e cada cobrança, estorno ou contestação, com forma de pagamento (bandeira e final do cartão, nunca o número) | servidor (checkout, webhook) | sem prazo (fiscal) |
| `checkout_sessions` + `checkout_items` | cada pedido, com a seleção e o orçamento da época | servidor | sem prazo |
| `auth_events` | cadastro, login e falhas, saída, troca e recuperação de senha, com IP e navegador | servidor | 2 anos |
| `activity_events` | uso do produto (dashboard aberto, exportado, link visto, relatório enviado, sincronização) | servidor | 13 meses |
| `legal_acceptances` | aceite de termos, privacidade e comunicações, com versão, IP e navegador | servidor | sem prazo |
| `sync_runs`, `report_deliveries`, `dashboard_exports`, `landing_page_versions`, `billing_events` | histórico de cada operação do seu domínio | servidor / gatilho | sem prazo |

A auditoria nunca copia segredos (hashes de token, PKCE) e, em colunas grandes (conteúdo de LP, seleção do checkout), registra só que mudaram. Quem age em nome de alguém com a chave de serviço manda `x-vyz-actor-id`, então a auditoria sabe quem foi. `ip_trusted` marca quando IP e navegador vieram do servidor (chave de serviço); nas outras linhas, eles foram informados pelo cliente e servem só como indício.

### Troca de plano

`public.change_subscription(...)` (só servidor) troca plano, período e contas numa transação: confere o preço no catálogo, confere se o uso cabe no plano novo (contas ativas, dashboards, LPs publicadas, plataformas) e grava a fatura proporcional com a transação. O app calcula o valor proporcional; o banco recusa o que não fecha.
