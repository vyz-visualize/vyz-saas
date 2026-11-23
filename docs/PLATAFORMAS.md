# Plataformas: como cada uma conecta no VYZ

A tabela do código é `src/features/accounts/connection-modes.ts`; este guia segue a mesma tabela. Mudou uma, mude a outra.

Regras para quem for configurar (Claude Desktop ou pessoa):
- Nenhum segredo vai para o git. Client IDs, secrets e tokens ficam só nas variáveis da Vercel.
- Não mude IDs já cadastrados.
- Não envie nada para revisão de plataforma sem o ok do Gustavo.

Site: `https://vyzualize.com.br`. O endereço de retorno de cada login é `https://vyzualize.com.br/api/integrations/<plataforma>/callback`.
Em todas as plataformas, use:
- Política de privacidade: `https://vyzualize.com.br/privacidade`
- Termos de uso: `https://vyzualize.com.br/termos`

## Resumo

**Plano:** todas as plataformas valem em todos os planos, sem restrição (`tier: "base"` em todas, em `src/features/accounts/platforms.ts`). As que ainda não funcionam entram em todos os planos quando ficarem prontas.

**Funcionam de ponta a ponta hoje** (login, sincronização e dashboards): Meta Ads, Instagram, Facebook, Google Ads e GA4. É a lista `AVAILABLE_PLATFORMS` (`src/features/accounts/platforms.ts`), a mesma que o site e o app citam. As outras estão **em desenvolvimento**: algumas têm o login pronto no código, mas falta a aprovação da plataforma ou a credencial.

| Plataforma | Como entra | Otimiza pela API | No VYZ hoje | Na plataforma |
|---|---|---|---|---|
| Meta Ads | Login (OAuth) | Sim: pausar e orçamento | Funciona | App "Vyzualize" (portfólio Vyzualize) criado em 10/11/2026, em modo desenvolvimento; falta a Análise do App (Acesso Avançado) |
| Instagram e Página do Facebook | Pelo login do Meta, só leitura | Não | Funciona | Igual ao Meta Ads |
| Google Ads | Login (OAuth) | Sim: pausar e orçamento | Funciona | Em produção desde 10/11/2026 (nível Exploração da API); falta a verificação do app no Google |
| YouTube | Pelo login do Google Ads | Sim (é Google Ads) | As campanhas de vídeo vêm no Google Ads | Igual ao Google Ads |
| GA4 | Login do Google, só leitura | Não | Funciona | Mesmo cliente OAuth do Google; Admin API e Data API ativadas |
| TikTok Ads | Login (OAuth) | Sim: pausar e orçamento | Em desenvolvimento: login e sincronização no código | Falta o app aprovado e as credenciais |
| LinkedIn Ads | Login (OAuth) | Não (só leitura) | Em desenvolvimento: login e sincronização no código | Falta o app aprovado e as credenciais |
| RD Station CRM, HubSpot, Pipedrive, Kommo | Login (OAuth) | Não | Em desenvolvimento: login e leitura do CRM no código | Falta o app e as credenciais |
| Mercado Ads | Login (OAuth) | Não | Em desenvolvimento: login no código, sem sincronização | App ainda não criado (decisão de 10/11/2026) |
| X Ads | Login (OAuth 1.0a), quando liberado | Não | Não conecta ainda (sem login no código e fora de `IMPORT_PLATFORMS`) | Depende de o X liberar a Ads API |
| Shopee Ads | Planilha | Não | Importação por planilha | API só para parceiros aprovados |
| Spotify Ads | Planilha | Não | Importação por planilha | Sem API aberta |
| Globo Ads | Planilha ou relatório | Não | Importação por planilha | Sem API pública |
| ChatGPT Ads | Planilha | Não | Importação por planilha | Sem API para anunciantes |

Os logins ficam em `src/server/integrations/providers/<plataforma>.ts` e a sincronização em `src/server/sync/live/`. Com `INTEGRATIONS_MODE=live`, o botão Conectar (login) só aparece quando o par de credenciais da plataforma está na Vercel (`isProviderConfigured` em `src/server/integrations/providers/index.ts`, lista `loginReady`). Plataforma com conexão por token aparece sempre, com o botão "Usar token".

## Conexão por token (opção secundária ao login)

Enquanto o login de uma plataforma depende de aprovação (a Análise do App do Meta, por exemplo), o cliente pode gerar um token no app dele e colar no VYZ.

- **Na tela:** "Usar token" ao lado do Conectar, em Contas e na aba Contas do workspace. Abre o tutorial da plataforma com o campo do token. Conexão feita por token mostra "Trocar token" no lugar de "Reconectar".
- **Tutorial e regras:** `src/features/integrations/token-connect.ts` (`TOKEN_GUIDES`), um por plataforma. É a fonte única do texto: a tela mostra o que está lá.
- **Conferência:** `src/server/integrations/token-flow.ts` (`checkToken`) confere o token na plataforma, lê as permissões e lista as contas. O erro volta em linguagem de tutorial ("falta permissão, gere de novo marcando as do passo 5").
- **Gravação:** a ação `connectWithToken` (`src/server/integrations/actions.ts`) grava pelo mesmo caminho do login (`saveConnection` em `flow.ts`): token no Vault, contas novas ligadas se couberem no plano e primeira sincronização. A conexão leva a marca `vyz:token` nos escopos (`TOKEN_SCOPE`); não há coluna nova no banco.
- **Meta:** o token é do app do cliente, então as chamadas dele vão sem o `appsecret_proof` do VYZ (a prova feita com o nosso segredo não bate). A regra fica num lugar só, `src/server/integrations/meta-auth.ts`: `getValidAccessToken` marca o token das conexões com `vyz:token` e todas as chamadas à Graph API passam por `metaAuthParams`. No tutorial, o cliente deixa "Exigir segredo do app" desligado no app dele.
- **Desconectar:** apaga a conexão e o token do Vault. O VYZ não revoga nada no provedor (o token é do app do cliente); o tutorial explica como remover o usuário do sistema.

| Plataforma | Por token hoje | O que o cliente cola |
|---|---|---|
| Meta Ads, Instagram e Página do Facebook | Sim | Token de usuário do sistema do Business Manager dele (não expira), com `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`, `instagram_manage_insights` e, para o botão Aplicar, `ads_management` |
| Demais plataformas | Em construção | Ver PENDENCIAS |

Ressalva do Meta: sem a Análise do App, o token lê com segurança as contas da própria empresa do Business Manager. Contas de clientes que chegam como parceiro podem não aparecer; nesse caso, o token é gerado no Business Manager do próprio cliente (o tutorial avisa).

## Meta Ads (inclui Instagram)

1. Em developers.facebook.com, crie um app do tipo **Empresa**, ligado ao Business Manager da Vyzualize.
2. Adicione os produtos **Login do Facebook para Empresas** e **API de Marketing**.
3. Faça a **Verificação da Empresa** no Business Manager (CNPJ e documento). Sem ela, o Meta não libera o Acesso Avançado.
4. Em Login para Empresas, crie uma **configuração** com:
   - tipo de token: **token de usuário do sistema** (não expira);
   - ativos: **Contas de anúncio**;
   - permissões: `ads_read`, `ads_management` e `business_management`.

   O ID dessa configuração vai em `META_LOGIN_CONFIG_ID`. Sem `ads_management`, o VYZ só lê, e o botão Aplicar avisa para reconectar.
5. Em Configurações > Básico, preencha:
   - o domínio do app: `vyzualize.com.br`;
   - a política de privacidade;
   - a URL de exclusão de dados: `https://vyzualize.com.br/privacidade`;
   - o ícone e a categoria.
6. Em Login do Facebook > Configurações:
   - em URIs de redirecionamento do OAuth válidos, ponha `https://vyzualize.com.br/api/integrations/meta/callback`;
   - ligue **Exigir segredo do app**.
7. Na **Análise do App**, peça Acesso Avançado para `ads_read`, `ads_management` e `business_management`.
   - Grave um vídeo mostrando o login, a lista de contas e o botão Aplicar com o "de → para".
   - Explique que o VYZ só pausa campanhas e ajusta orçamento, sempre com registro e com a opção de desfazer.
8. Variáveis na Vercel: `META_APP_ID`, `META_APP_SECRET` e `META_LOGIN_CONFIG_ID`.

## Google Ads e YouTube

1. No Google Cloud, use o projeto da Vyzualize e ative a **Google Ads API**.
2. Configure a **tela de consentimento** como Externa, com:
   - os domínios autorizados: `vyzualize.com.br`;
   - a privacidade e os termos;
   - os escopos: `openid`, `email`, `profile` e `https://www.googleapis.com/auth/adwords`.

   O escopo adwords é **restrito**. Para sair do modo de teste, peça a verificação do app com um vídeo do fluxo. O Google pode pedir uma avaliação de segurança.
3. Crie o cliente OAuth do tipo **Aplicativo da Web**, com o redirecionamento `https://vyzualize.com.br/api/integrations/google/callback`. Os valores vão em `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET`.
4. Pegue o **developer token**:
   - no Google Ads, entre na conta de administrador (MCC) da Vyzualize e vá em Ferramentas > Central de API;
   - peça o **Acesso Básico** (o de teste só enxerga contas de teste);
   - o valor vai em `GOOGLE_ADS_DEVELOPER_TOKEN`.
5. O YouTube não tem login próprio. As campanhas de vídeo vêm pelo Google Ads.
6. Para o GA4, use o mesmo cliente com o escopo `https://www.googleapis.com/auth/analytics.readonly`, que é sensível e também passa pela verificação, e ative a **Google Analytics Data API** e a **Admin API**. O login do GA4 (`providers/ga4.ts`) e a leitura dos números (`analytics_daily`, migração `20261113090000_analytics_daily.sql`) já estão no código.

## TikTok Ads

1. Em business-api.tiktok.com (TikTok for Business Developers), crie um app de anunciante.
2. Peça as permissões:
   - Ad Account Management;
   - Campaign/Ad Group/Ad Management, para pausar e mudar o orçamento;
   - Reporting.
3. Redirecionamento: `https://vyzualize.com.br/api/integrations/tiktok/callback`.
4. A aprovação sai em alguns dias. Depois disso, os valores do app vão nas variáveis `TIKTOK_APP_ID` e `TIKTOK_APP_SECRET`. O login (`providers/tiktok.ts`), a sincronização (`sync/live/tiktok.ts`) e a aplicação das mudanças (`src/server/optimize/executors.ts`) já estão no código.

## LinkedIn Ads

1. Em linkedin.com/developers, crie o app ligado à página da Vyzualize e verifique a página.
2. Peça o produto **Advertising API**: um formulário que leva semanas para ser aprovado.
3. Escopos: `r_ads`, `r_ads_reporting` e, se quiser otimizar depois, `rw_ads`.
4. Redirecionamento: `https://vyzualize.com.br/api/integrations/linkedin/callback`.

## RD Station CRM e HubSpot

**RD Station:**
1. Crie o app na RD Station App Store para receber o client id e o secret.
2. Redirecionamento: `.../api/integrations/rdstation/callback`.

**HubSpot:**
1. No portal de desenvolvedor, crie um **app público**.
2. Escopos: `oauth`, `crm.objects.deals.read`, `crm.objects.contacts.read` e `crm.schemas.deals.read`.
3. Redirecionamento: `.../api/integrations/hubspot/callback`.

**Pipedrive e Kommo:** mesmo caminho (app na plataforma, redirecionamento `.../api/integrations/<pipedrive|kommo>/callback`, variáveis `<PLATAFORMA>_CLIENT_ID` e `<PLATAFORMA>_CLIENT_SECRET`). Os números dos CRMs vão para `crm_daily` (`src/server/sync/live/crm.ts`).

## Mercado Ads (Mercado Livre)

1. Em developers.mercadolivre.com.br (DevCenter), crie o app.
2. Redirecionamento: `.../api/integrations/mercado/callback`.
3. Escopos de leitura e acesso offline.

Os relatórios do Product Ads vão sair por esse login; a sincronização ainda não existe. A API não oferece escrita confiável de orçamento, então o VYZ não aplica mudanças no Mercado Ads.

## X Ads

Peça acesso em developer.x.com > **Ads API**. O X aprova poucos pedidos e exige uma conta de anúncios ativa com histórico. O login usa OAuth 1.0a e ainda não existe no código. A tela de Contas diz que, até lá, os dados do X entram por planilha, mas o X não está na lista da importação (`IMPORT_PLATFORMS`).

## Shopee, Spotify, Globo e ChatGPT Ads

Essas plataformas não têm API aberta para nós:
- **Shopee:** só para parceiros aprovados no Open Platform.
- **Spotify Ads:** API fechada para parceiros.
- **Globo Ads:** não tem API pública.
- **ChatGPT Ads:** ainda não tem API para anunciantes.

Por isso, no VYZ elas são da modalidade **importação por planilha**: o cliente sobe um CSV ou liga uma planilha do Google Sheets com data, campanha, investimento, impressões, cliques, conversões e receita. Quando alguma abrir uma API, mudamos a linha dela em `connection-modes.ts` e construímos o login.

### Importação por planilha: o que já existe

`src/features/import/spreadsheet.ts` (puro, com testes) faz a parte que independe de banco e de tela:

- lê CSV com vírgula, ponto e vírgula ou tabulação, com aspas e BOM (`parseCsv`);
- reconhece as colunas pelo nome em português ou inglês (`mapHeader`): data, campanha e investimento são obrigatórias; impressões, cliques, conversões e receita são opcionais;
- aceita número brasileiro ou americano e datas em dd/mm/aaaa ou aaaa-mm-dd;
- valida linha por linha e recusa o arquivo inteiro se alguma estiver errada, dizendo a linha (`readSpreadsheet`). Limites: 2 MB, 20 mil linhas, 500 campanhas;
- soma linhas repetidas da mesma data e campanha;
- converte para o formato do armazém (`toDataset`: campanhas com id estável pelo nome, fatos por campanha e por conta, como em `features/sync/dataset.ts`);
- transforma o link de uma planilha do Google no endereço de exportação em CSV, aceitando só `https://docs.google.com/spreadsheets/d/<id>` (`sheetsCsvUrl`);
- traz o modelo de arquivo para a pessoa baixar (`IMPORT_TEMPLATE_CSV`).

### Como a importação funciona de ponta a ponta

1. **Tela.** Em Contas, a seção "Importação por planilha" (`src/features/accounts/ImportSection.tsx`): escolhe a plataforma, dá um nome para a conta e sobe um CSV ou cola o link do Google Sheets. O arquivo é conferido no navegador (resumo ou linhas com erro) antes de enviar.
2. **Servidor.** `importSpreadsheet` (`src/server/import/actions.ts`, só admin): confere o plano, lê e valida de novo, cria a conta já ativa (ou usa a que existe) e grava pelo mesmo caminho da sincronização (`writeDataset` + `rollupAccount`). Cada importação é uma linha em `sync_runs` e um evento em `activity_events`. No período da planilha, a conta fica igual ao arquivo; dias fora dele não mudam.
3. **Google Sheets.** A planilha precisa estar compartilhada como "Qualquer pessoa com o link". O servidor só busca `https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<aba>` e só segue redirecionamento para o próprio Google (`src/server/import/sheets.ts`); tempo máximo de 15 s e 2 MB. O link fica salvo na conta (`metadata.sheet`) e é relido uma vez por dia (quem foi lido há menos de 20 h espera) pela rota do agendador (`/api/cron/sync`, `src/server/import/scheduled.ts`). O `vercel.json` chama essa rota às 9h, 15h e 21h UTC (6h, 12h e 18h em Brasília); a primeira fica duas horas antes dos resumos por push e WhatsApp (11h UTC). A mesma rota traz os últimos 7 dias das contas com login, relê as planilhas do lançamento (Fachada) e anda com a carga do histórico do MMM, se ligada. Falha (link fechado, linha inválida) aparece na conta.
4. **Banco.** Migração `20261111130000_import_accounts.sql`: conta ativa precisa de conexão ou de `metadata.source = 'import'`. Quem está logado não consegue ativar conta sem conexão por conta própria (não muda o `status`); só o servidor cria a conta de planilha ativa. Ela conta no limite do plano como qualquer outra (mesmo gatilho). Testes em `src/server/import/import-accounts.db.test.ts`.
5. **Dashboard.** Qualquer modelo (visual × objetivo) lê as contas de planilha ligadas ao dashboard (`REAL_DATA_PLATFORMS` em `src/features/templates/live.ts`): elas entram na Visão geral, em Campanhas e no Funil (`composePages`), com as páginas em `src/features/analytics/import/ImportPages.tsx`. TikTok e LinkedIn usam o mesmo caminho, com dados da API.

O que ainda não tem: login do Google para planilha fechada (hoje é só por link compartilhado) e planilha com colunas além das do modelo.

## Otimizações (botão Aplicar e automático)

- Só aparecem em tarefas de campanhas do Meta, do Google ou do TikTok com conexão ativa (`WRITE_PLATFORMS` em `src/features/optimize/actions.ts`).
- O VYZ confere na plataforma se o valor ainda é o "de" antes de mudar; se alguém mexeu, não altera nada.
- Tudo fica em `optimization_runs`, e dá para desfazer em até 30 dias (`UNDO_DAYS` em `src/server/optimize/service.ts`).
- O automático é do Avançado e do Personalizado (`autoOptimize`) e é configurado por workspace no A Fazer:
  - variação máxima do orçamento por dia;
  - idade mínima da campanha;
  - se pode pausar e se pode aumentar o orçamento (desligado por padrão).

  Ele nunca cria nem reativa campanha.
