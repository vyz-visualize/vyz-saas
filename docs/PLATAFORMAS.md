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

| Plataforma | Como entra | Otimiza pela API | Situação no VYZ |
|---|---|---|---|
| Meta Ads | Login (OAuth) | Sim: pausar e orçamento | App "Vyzualize" (portfólio Vyzualize) criado em 10/11/2026, em modo desenvolvimento; falta a Análise do App (Acesso Avançado) |
| Google Ads | Login (OAuth) | Sim: pausar e orçamento | No ar desde 10/11/2026 (nível Exploração da API); falta a verificação do app no Google |
| YouTube | Pelo login do Google Ads | Sim (é Google Ads) | Igual ao Google Ads |
| GA4 | Login do Google, só leitura | Não | Login pronto no código, mesmo cliente do Google; Admin API e Data API ativadas |
| TikTok Ads | Login (OAuth) | Sim: pausar e orçamento | Login pronto no código; falta o app aprovado e as credenciais |
| LinkedIn Ads | Login (OAuth) | Leitura primeiro | Login pronto no código; falta o app aprovado e as credenciais |
| RD Station CRM | Login (OAuth) | Não | Login pronto no código; falta o app e as credenciais |
| HubSpot | Login (OAuth) | Não | Login pronto no código; falta o app e as credenciais |
| Pipedrive | Login (OAuth) | Não | Login pronto no código; falta o app e as credenciais |
| Kommo | Login (OAuth) | Não | Login pronto no código; falta a integração e as credenciais |
| Mercado Ads | Login (OAuth) | Não | Em breve (decisão de 10/11/2026): login pronto no código, app ainda não criado |
| X Ads | Login (OAuth 1.0a) | Não | Depende de o X liberar a Ads API |
| Shopee Ads | Planilha | Não | API só para parceiros aprovados |
| Spotify Ads | Planilha | Não | Sem API aberta |
| Globo Ads | Planilha ou relatório | Não | Sem API pública |
| ChatGPT Ads | Planilha | Não | Sem API para anunciantes |

Com `INTEGRATIONS_MODE=live`, cada login só aparece na tela de Contas quando o par de credenciais dele está na Vercel. Enquanto isso, o cliente cadastra a conta pelo ID na tela Contas e o VYZ mostra como ela vai conectar.

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
6. Para o GA4, use o mesmo cliente com o escopo `https://www.googleapis.com/auth/analytics.readonly`, que é sensível e também passa pela verificação, e ative a **Google Analytics Data API** e a **Admin API**. O login do GA4 ainda vai ser construído.

## TikTok Ads

1. Em business-api.tiktok.com (TikTok for Business Developers), crie um app de anunciante.
2. Peça as permissões:
   - Ad Account Management;
   - Campaign/Ad Group/Ad Management, para pausar e mudar o orçamento;
   - Reporting.
3. Redirecionamento: `https://vyzualize.com.br/api/integrations/tiktok/callback`.
4. A aprovação sai em alguns dias. Depois disso, os valores do app vão nas variáveis `TIKTOK_APP_ID` e `TIKTOK_APP_SECRET`, e o login do TikTok é construído no VYZ. A aplicação das mudanças já está pronta em `src/server/optimize/executors.ts`.

## LinkedIn Ads

1. Em linkedin.com/developers, crie o app ligado à página da Vyzualize e verifique a página.
2. Peça o produto **Advertising API**: um formulário que leva semanas para ser aprovado.
3. Escopos: `r_ads`, `r_ads_reporting` e, se quiser otimizar depois, `rw_ads`.
4. Redirecionamento: `https://vyzualize.com.br/api/integrations/linkedin/callback`.

## RD Station CRM e HubSpot

**RD Station:**
1. Crie o app na RD Station App Store para receber o client id e o secret.
2. Redirecionamento: `.../api/integrations/rdstation/callback`.
3. Até o login ficar pronto, o cliente usa o token da instância.

**HubSpot:**
1. No portal de desenvolvedor, crie um **app público**.
2. Escopos: `crm.objects.deals.read`, `crm.objects.contacts.read` e `crm.schemas.deals.read`.
3. Redirecionamento: `.../api/integrations/hubspot/callback`.

## Mercado Ads (Mercado Livre)

1. Em developers.mercadolivre.com.br (DevCenter), crie o app.
2. Redirecionamento: `.../api/integrations/mercado/callback`.
3. Escopos de leitura e acesso offline.

Os relatórios do Product Ads saem por esse login. A API não oferece escrita confiável de orçamento, então o VYZ não aplica mudanças no Mercado Ads.

## X Ads

Peça acesso em developer.x.com > **Ads API**. O X aprova poucos pedidos e exige uma conta de anúncios ativa com histórico. O login usa OAuth 1.0a. Até a aprovação, os dados do X entram por planilha.

## Shopee, Spotify, Globo e ChatGPT Ads

Essas plataformas não têm API aberta para nós:
- **Shopee:** só para parceiros aprovados no Open Platform.
- **Spotify Ads:** API fechada para parceiros.
- **Globo Ads:** não tem API pública.
- **ChatGPT Ads:** ainda não tem API para anunciantes.

Por isso, no VYZ elas são da modalidade **importação por planilha**: o cliente sobe um CSV ou liga uma planilha do Google Sheets com data, campanha, investimento, impressões, cliques, conversões e receita. Quando alguma abrir uma API, mudamos a linha dela em `connection-modes.ts` e construímos o login.

## Otimizações (botão Aplicar e automático)

- Só aparecem em tarefas de campanhas do Meta, do Google ou do TikTok com conexão ativa.
- O VYZ confere na plataforma se o valor ainda é o "de" antes de mudar; se alguém mexeu, não altera nada.
- Tudo fica em `optimization_runs`, e dá para desfazer em até 30 dias.
- O automático é só do Avançado e é configurado por projeto no A Fazer:
  - variação máxima do orçamento por dia;
  - idade mínima da campanha;
  - se pode pausar e se pode aumentar o orçamento (desligado por padrão).

  Ele nunca cria nem reativa campanha.
