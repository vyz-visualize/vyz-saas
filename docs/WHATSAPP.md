# Relatórios pelo WhatsApp da VYZ

Planos com `whatsappReports` (Avançado e Personalizado) recebem relatórios pelo número oficial da VYZ, pela Cloud API do Meta (HTTP direto em `POST https://graph.facebook.com/v23.0/{phone-number-id}/messages`). O cliente escolhe em `/painel/whatsapp` (link em Configurações) o que quer receber: boas-vindas, resumo diário, resumo semanal e alertas.

Código: `src/features/whatsapp/` (templates, regras, relatórios, tela), `src/server/whatsapp/` (envio, webhook, ações), `src/app/api/webhooks/whatsapp`, `src/app/api/cron/whatsapp`, migration `supabase/migrations/20261107120000_whatsapp_reports.sql`.

## Templates para cadastrar no Meta

Mensagem iniciada pela VYZ só sai com template aprovado. Cadastre cada um em WhatsApp Manager > Modelos de mensagem exatamente como abaixo (idioma **Portuguese (BR) / pt_BR**). A fonte é `src/features/whatsapp/templates.ts`: mudou lá, envie de novo aqui.

### 1. `vyz_codigo_verificacao`

- Categoria: **Authentication** (Autenticação)
- Idioma: pt_BR
- Corpo: o texto padrão do Meta para autenticação, com a opção "Adicionar aviso de segurança" marcada:
  `*{{1}}* é seu código de verificação. Para sua segurança, não o compartilhe.`
- Rodapé: "Este código expira em 10 minutos." (opção de validade do código: 10 minutos)
- Botão: **Copiar código** (Copy code)
- Variáveis: `{{1}}` código de 6 dígitos
- Exemplo: `482913`

### 2. `vyz_boas_vindas`

- Categoria: **Utility** (Utilidade)
- Idioma: pt_BR
- Corpo:
  `Olá, {{1}}! Seus relatórios da VYZ pelo WhatsApp estão ativos para {{2}}. Contas conectadas: {{3}}. Nos últimos 7 dias: {{4}} investidos e {{5}} conversões. Destaque: {{6}} Para não receber mais, responda PARAR.`
- Variáveis e exemplos:
  1. primeiro nome: `Ana`
  2. nome do workspace: `Loja da Ana`
  3. contas conectadas: `2 de Meta Ads e 1 de Google Ads`
  4. investimento em 7 dias: `R$ 3.420`
  5. conversões em 7 dias: `128`
  6. destaque: `ROAS da campanha Black Friday subiu 32%.`

### 3. `vyz_resumo_diario`

- Categoria: **Utility**
- Idioma: pt_BR
- Corpo:
  `Bom dia, {{1}}! Resumo de {{2}}: {{3}} {{4}} Detalhes no painel da VYZ. Para não receber mais, responda PARAR.`
- Variáveis e exemplos:
  1. primeiro nome: `Ana`
  2. nome do workspace: `Loja da Ana`
  3. destaque (título): `CPA: queda de 18%.`
  4. detalhe com números: `Foi de R$ 42 para R$ 34 nos últimos 7 dias, contra o período anterior.`

### 4. `vyz_resumo_semanal`

- Categoria: **Utility**
- Idioma: pt_BR
- Corpo:
  `Bom dia, {{1}}! Sua semana em {{2}}: {{3}} investidos ({{4}} contra a semana anterior) e {{5}} conversões ({{6}}). O que mudou: {{7}} Para não receber mais, responda PARAR.`
- Variáveis e exemplos:
  1. primeiro nome: `Ana`
  2. nome do workspace: `Loja da Ana`
  3. investimento da semana: `R$ 3.420`
  4. variação do investimento: `+12%`
  5. conversões da semana: `128`
  6. variação das conversões: `+8%`
  7. o que mudou: `ROAS: alta de 21%.`

### 5. `vyz_alerta`

- Categoria: **Utility**
- Idioma: pt_BR
- Corpo:
  `Alerta da VYZ em {{1}}, dashboard {{2}}: {{3}} {{4}} Para não receber mais, responda PARAR.`
- Variáveis e exemplos:
  1. nome do workspace: `Loja da Ana`
  2. nome do dashboard: `Meta Ads`
  3. o que aconteceu: `Campanha Remarketing gastou sem converter.`
  4. detalhe com números: `R$ 610 investidos nos últimos 7 dias e nenhuma conversão.`

Mensagens de texto livre (confirmação do PARAR e do VOLTAR) não usam template: saem dentro da janela de 24 h aberta pela resposta do cliente.

## Configuração

1. **Meta Business**: no business.facebook.com da VYZ, verifique a empresa (Configurações > Central de segurança). Sem verificação o número fica limitado.
2. **App**: em developers.facebook.com, crie (ou use) um app do tipo Business e adicione o produto **WhatsApp**. Anote a **chave secreta do app** (Configurações > Básico): vai em `WHATSAPP_APP_SECRET`.
3. **Número**: em WhatsApp > Configuração da API, adicione o número oficial da VYZ (não pode estar em uso no app do WhatsApp comum), defina o nome de exibição "VYZ" e aguarde a aprovação. Copie o **Phone number ID** para `WHATSAPP_PHONE_NUMBER_ID`.
4. **Token permanente**: Meta Business > Usuários > Usuários do sistema > crie um usuário admin, atribua o app e a conta do WhatsApp (controle total) e gere um token sem expiração com `whatsapp_business_messaging` e `whatsapp_business_management`. Vai em `WHATSAPP_ACCESS_TOKEN`.
5. **Pagamento**: adicione a forma de pagamento da conta do WhatsApp (conversas de utilidade e autenticação são cobradas pelo Meta).
6. **Templates**: cadastre os 5 acima e espere ficarem "Aprovado".
7. **Webhook**: em WhatsApp > Configuração, URL de retorno `https://vyzualize.com.br/api/webhooks/whatsapp` (o domínio de produção), token de verificação igual a `WHATSAPP_VERIFY_TOKEN` (texto que você inventa). Depois assine o campo **messages** (traz status e respostas).
8. **Variáveis na Vercel** (Production): `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TEMPLATE_LANG=pt_BR`. `CRON_SECRET` já é usado pelos outros agendamentos.
9. **Banco**: aplicar a migration `20261107120000_whatsapp_reports.sql`.

Sem `WHATSAPP_PHONE_NUMBER_ID` ou `WHATSAPP_ACCESS_TOKEN`, tudo funciona em **modo simulado**: nada sai, as mensagens ficam no registro com status "simulado" e o código de verificação aparece no log do servidor.

## Como funciona

- **Verificação**: o cliente informa o número e aceita receber (consentimento LGPD: `opted_in_at` e `opt_in_source`). A VYZ manda o código de 6 dígitos (vale 10 minutos, 5 tentativas; só o hash fica no banco). Limite: 5 códigos por usuário e 3 por número por hora.
- **Boas-vindas**: logo depois da verificação, se escolhida.
- **Agendamentos** (`vercel.json`, Bearer `CRON_SECRET`):
  - `/api/cron/whatsapp?mode=daily` às 11h UTC (8h em Brasília, mesmo horário do resumo por push): resumo diário + alertas.
  - `/api/cron/whatsapp?mode=weekly` às 11h UTC de segunda: resumo semanal (últimos 7 dias contra os 7 anteriores).
- **Alertas**: análises do motor de insights com tom de problema e peso alto (queda forte de KPI, campanha gastando sem converter, verba desperdiçada). No máximo 2 em 24 h por pessoa e nunca a mesma análise duas vezes em 24 h.
- **Plano**: só envia para workspace com assinatura ativa e plano com `whatsappReports`. Perdeu o plano, para de enviar; nada é apagado.
- **PARAR / SAIR** (também PARE, STOP, CANCELAR): registra `opted_out_at` e para tudo. **VOLTAR** reativa. A tela também deixa pausar ou remover o número.
- **Status**: o webhook atualiza enviada > entregue > lida (ou falhou) em `whatsapp_messages`, conferindo o `X-Hub-Signature-256`.
