# Vyzualize nas lojas: tudo para publicar

Guia para o Claude Desktop, que faz toda a configuração nas contas da Apple e
do Google e publica o app (App Store Connect, Apple Developer, Google Play
Console, Google Cloud, Firebase, RevenueCat, Supabase e Vercel). Os textos
estão prontos para colar, e as imagens estão nesta pasta.

O app se chama **Vyzualize**. "VYZ" é só o nome do assistente dentro do app
(a aba VYZ e as análises do VYZ).

Regras que valem para tudo abaixo:

- Não aceitar termos, preencher dados fiscais ou bancários nem pagar nada sem confirmar com o Gustavo.
- Não mudar IDs (bundle, package, produtos de assinatura e créditos).
- Segredos e senhas nunca no git. O `.env.production.local` do app só leva valores públicos.
- Texto do app e da ficha do iPhone nunca cita Android, Google Play, Pix, cartão, preço em reais ou pagamento fora da loja.

## 1. Identidade

| Campo | Valor |
|---|---|
| Nome do app | Vyzualize (embaixo do ícone também: `name` no `app.json`) |
| Bundle ID (iOS) / Package (Android) | `app.vyz.painel` |
| Versão | 1.0.0 (iOS build 1, Android versionCode 1) |
| Idioma principal | Português (Brasil) |
| Categoria | Negócios (secundária: Produtividade) |
| Copyright | © 2026 VYZ Intelligence |
| Site / Marketing | https://www.vyzualize.com.br |
| Suporte | https://www.vyzualize.com.br · suporte@vyzualize.com.br |
| Política de privacidade | https://www.vyzualize.com.br/privacidade |
| Termos de uso | https://www.vyzualize.com.br/termos |
| Classificação etária | 4+ (Apple) / Livre (Google). Sem conteúdo sensível, sem chat entre usuários, sem itens aleatórios pagos. |
| iPad | Não: o app é só para iPhone (`supportsTablet: false`), então não precisa de prints de iPad. |

Se o nome "Vyzualize" já estiver em uso na App Store, use `Vyzualize: Análise de Anúncios` (30 caracteres).

**Conta da Apple: confirmar com o Gustavo antes de criar o app.** O vendedor
que aparece na loja é o nome da conta. O Xcode tem hoje "Gustavo Lemos"
(pessoa física, time `93TPYZYG8P`) e "LL SERVICOS DIGITAIS LTDA" (time
`875W4SVP8N`). O desejado é "VYZ Intelligence", o que exige a conta de
organização da VYZ (o D-U-N-S já está no nome da empresa).

## 2. Textos da ficha

### App Store

**Subtítulo** (até 30): `Meta e Google Ads no celular`

**Texto promocional** (até 170):

```
Novo: o VYZ lê suas contas toda manhã e avisa o que mudou, qual campanha escalar e onde a verba está escapando.
```

**Palavras-chave** (até 100, sem espaço depois da vírgula):

```
anúncios,meta ads,google ads,roas,cpa,tráfego pago,campanhas,marketing,dashboard,relatório,métricas
```

**Descrição**:

```
O Vyzualize coloca os números das suas campanhas de Meta Ads e Google Ads na palma da mão, com análises que dizem o que fazer.

TUDO NUM TOQUE
Entre e veja na hora a receita, o ROAS e a variação de cada cliente, com a curva dos últimos 30 dias.

GRÁFICOS FEITOS PARA O CELULAR
Arraste o dedo no gráfico para ler o valor de cada dia. Toque num indicador para trocar o gráfico: receita, investimento, ROAS, custo por compra, CTR, CPM e mais.

O VYZ APONTA O QUE MUDOU
Alertas automáticos: indicador que subiu ou caiu, campanha que gasta sem vender, campanha abaixo do ponto de equilíbrio, criativo cansado, termos de pesquisa sem conversão e oportunidades para escalar.

FILTRE COM UM TOQUE
Toque numa campanha e o dashboard inteiro passa a mostrar só ela: funil, criativos, público, regiões e dispositivos.

PERGUNTE EM PORTUGUÊS
"Quanto investi esse mês?", "Qual cliente teve o melhor ROAS?". O VYZ responde com os seus números, sem inventar nada.

RESUMO TODA MANHÃ
Receba por notificação o destaque mais importante das suas contas. Tocar abre o dashboard certo.

Use a mesma conta do painel Vyzualize. Seus dados ficam protegidos e você pode excluir sua conta a qualquer momento pelo próprio app.
```

**Novidades desta versão**: `Primeira versão do Vyzualize para celular.`

### Google Play

- **Título** (até 30): `Vyzualize: Análise de Anúncios`
- **Descrição curta** (até 80): `Meta Ads e Google Ads no celular, com análises que dizem o que fazer.`
- **Descrição completa**: a mesma da App Store, acima.
- **Notas da versão**: `Primeira versão do Vyzualize para celular.`

## 3. Imagens

| Onde | Arquivo | Tamanho |
|---|---|---|
| App Store, iPhone 6,9" | `screenshots/ios-6.9/01.jpg` a `05.jpg` | 1320 × 2868 |
| Google Play, telefone | `screenshots/android-phone/01.jpg` a `05.jpg` | 1080 × 1920 |
| Google Play, ícone | `graphics/icone-play-512.png` | 512 × 512 |
| Google Play, gráfico de recursos | `graphics/arte-destaque-play-1024x500.jpg` | 1024 × 500 |
| Ícone mestre (referência) | `graphics/icone-1024.png` | 1024 × 1024 |

A Apple usa o print de 6,9" para todos os iPhones. A ordem dos prints é:
início, dashboard, análises, campanhas e VYZ.

Para refazer, com o app web rodando (`npx expo start --web` com o `.env.production.local`):

```
cd apps/mobile
VYZ_EMAIL=... VYZ_SENHA=... node store/gerar/capturar.mjs   # telas em store/build/telas
node store/gerar/artes.mjs                                  # ícones, gráficos e prints com título
```

## 4. Revisão da Apple e do Google

**Conta de teste**: `revisao.apple@vyzualize.com.br`
- Plano Avançado ativo, com dashboards Meta e Google com dados.
- A senha não vai para o git: pedir ao Gustavo e preencher no campo de senha da conta de demonstração das duas lojas.

**Notas para a revisão** (App Store, "Notas"; Google Play, "Instruções de acesso"):

```
O Vyzualize é o app de acompanhamento do painel Vyzualize (vyzualize.com.br): mostra os resultados das campanhas de anúncios das contas que o cliente já conectou no painel.

Use a conta de demonstração informada: ela já tem dois dashboards com dados (Meta Ads e Google Ads).

Onde ver cada recurso:
- Início: dashboards com o indicador principal e os destaques da semana.
- Toque num dashboard: arraste o dedo no gráfico; toque numa campanha para filtrar.
- Aba Análises: alertas automáticos.
- Aba VYZ (o assistente): toque numa pergunta pronta.
- Aba Conta: plano, notificações, termos, privacidade, sair e "Excluir conta" (exclui de verdade, com confirmação).

Login: e-mail e senha, Entrar com Apple e Google.
Assinaturas: vendidas pela compra dentro do app (aba Conta, Plano).
```

## 5. Privacidade

### Rótulo da App Store (App Privacy)

Rastreamento: **Não**. Nada é usado para publicidade nem compartilhado com corretores de dados.

| Dado | Coletado | Ligado ao usuário | Finalidade |
|---|---|---|---|
| Nome | Sim | Sim | Funcionalidade do app |
| E-mail | Sim | Sim | Funcionalidade do app |
| ID de usuário | Sim | Sim | Funcionalidade do app |
| Histórico de compras | Sim | Sim | Funcionalidade do app |
| ID do dispositivo (token de notificação) | Sim | Sim | Funcionalidade do app |
| Localização, contatos, fotos, saúde, navegação, diagnósticos, análise de uso | Não | | |

### Segurança dos dados (Google Play, Data safety)

- **Coleta:** nome, e-mail, ID do usuário, histórico de compras e ID do dispositivo (token de push). Tudo obrigatório para a funcionalidade, nada para publicidade.
- **Compartilhamento com terceiros:** não. Provedores que processam os dados em nosso nome não contam como compartilhamento.
- **Criptografia em trânsito:** sim.
- **Exclusão de dados:** sim.
  - Pelo app: Conta > Excluir conta.
  - Por e-mail: suporte@vyzualize.com.br.
  - URL de exclusão: https://www.vyzualize.com.br/privacidade
- **Público-alvo:** 18 anos ou mais.
- **Anúncios no app:** não.

## 6. Compras dentro do app

Os IDs são fixos (não mudar). A lista completa com preços está em `planos-lojas.csv`: são 168 assinaturas (3 planos × mensal ou anual × 3 a 30 projetos). Para gerar a lista de novo: `npx tsx scripts/store/plan-products.ts`, na raiz do repositório.

- **Grupo de assinaturas** (App Store): `Vyzualize Planos`.
  - Ordem de nível, do maior para o menor: Avançado, Padrão, Básico.
  - Dentro de cada plano, mais projetos ficam acima de menos.
- **Google Play:** uma assinatura por `product_id`, com um base plan mensal ou anual conforme o id, renovação automática.
- **Créditos** (consumíveis): `vyz_creditos_100` (100 créditos) e `vyz_creditos_500` (500 créditos).
- **RevenueCat:**
  - Projeto com os dois apps (iOS e Android).
  - Offering `default` com os pacotes de créditos.
  - Webhook para `https://www.vyzualize.com.br/api/webhooks/revenuecat`, com o mesmo valor de `REVENUECAT_WEBHOOK_SECRET` da Vercel.
  - As chaves públicas (`appl_...` e `goog_...`) vão em `EXPO_PUBLIC_REVENUECAT_IOS_KEY` e `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, no `apps/mobile/.env.production.local`. Depois, gerar o build de novo.
  - Sem as chaves, o app funciona, mas esconde as compras.
- **Apple:**
  - As compras precisam ser anexadas à versão no mesmo envio para a revisão.
  - O contrato de apps pagos precisa estar aceito: pedir ao Gustavo para aceitar (ele confirma termos, dados fiscais e bancários).

## 7. Credenciais a configurar

| O quê | Onde criar | Onde colocar |
|---|---|---|
| Push no iPhone (APNs) | Apple Developer > Keys > chave com "Apple Push Notifications service" (.p8) | Vercel: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` |
| Push no Android (FCM) | Firebase: projeto com o app Android `app.vyz.painel` | `google-services.json` em `apps/mobile/` (fora do git); JSON da conta de serviço na Vercel, em `FCM_SERVICE_ACCOUNT_JSON` |
| Resumo diário | Um segredo de 16 caracteres ou mais | Vercel: `CRON_SECRET` (o agendamento já está no `vercel.json`: todo dia às 8h de Brasília) |
| Entrar com Apple (site e Android) | Apple Developer:<br>• no App ID, ligar Sign in with Apple;<br>• criar um Services ID (ex.: `app.vyz.painel.web`) com o domínio `vyzualize.com.br` e o retorno `https://<projeto>.supabase.co/auth/v1/callback`;<br>• criar uma chave "Sign in with Apple" | Supabase > Authentication > Providers > Apple:<br>• Client IDs `app.vyz.painel.web,app.vyz.painel`;<br>• Team ID, Key ID e o conteúdo do .p8 |
| Volta do login no Android | | Supabase > Authentication > URL Configuration: adicionar `vyz://auth` |
| Google no Android | Google Cloud > Credentials: cliente OAuth do tipo Android, com o package `app.vyz.painel` e dois SHA-1: o da chave de envio (abaixo) e o da chave de assinatura do Play (Play Console > Integridade do app) | Nenhuma variável: o app já usa o cliente web que existe |
| Compras | RevenueCat (seção 6) | `.env.production.local` do app |

Depois de configurar a Vercel, fazer um redeploy. Para testar o push, no app: Conta > "Enviar notificação de teste".

**Chave de envio do Android** (impressões digitais públicas):

```
SHA1:   3A:D7:15:67:DD:BC:F5:8D:20:69:A6:D1:E9:B5:1C:52:AB:E1:7C:99
SHA256: FB:6D:47:6A:FB:34:40:13:81:D9:8A:B2:64:89:6E:92:AA:9F:96:EE:88:DE:91:68:60:24:A7:F1:B0:CB:1C:67
```

## 8. Builds

```
cd apps/mobile
store/gerar/build.sh android                       # → store/build/vyz-1.0.0-1.aab
TEAM_ID=<time da Apple> store/gerar/build.sh ios   # → archive + .ipa (com DESTINATION=upload, envia direto)
store/gerar/build.sh ios-check                     # só confere que o iOS compila
```

- **Chave de envio do Android:**
  - O arquivo está em `~/.vyz/vyz-upload.jks` (alias `vyz-upload`), no Mac do Gustavo; a senha, em `~/.vyz/vyz-upload.txt`.
  - Guardar uma cópia dos dois num cofre de senhas.
  - No primeiro envio, aceitar o **Play App Signing**: o Google guarda a chave final, e se a chave de envio se perder dá para trocar pelo suporte.
- **A cada novo envio:** subir `ios.buildNumber` e `android.versionCode` no `app.json`.
- **Gerar o build de novo depois de pôr o `google-services.json` e as chaves do RevenueCat** (o build novo também traz o nome "Vyzualize" embaixo do ícone). O `.aab` que já existe serve para o teste interno, mas não tem push no Android nem compras.
- **Auditoria do iOS:** roda sozinha no `build.sh ios`. Os "Android" que sobram são mensagens internas de bibliotecas, que nunca aparecem na tela.

## 9. Ordem sugerida

1. Confirmar com o Gustavo a conta da Apple (seção 1).
2. Criar o app "Vyzualize" no App Store Connect e no Play Console com os dados da seção 1.
3. Configurar as credenciais da seção 7 e fazer o redeploy da Vercel.
4. Cadastrar os produtos e o RevenueCat (seção 6) e pôr as chaves no `.env.production.local`.
5. Rodar `build.sh android` e `build.sh ios` e enviar os builds.
6. Teste interno: TestFlight (testadores internos, sem revisão) e faixa de teste interno do Play.
7. Testar no aparelho:
   - login com Apple e com Google;
   - push de teste;
   - compra no sandbox;
   - excluir conta.
8. Preencher a ficha (seções 2 a 5), subir os prints e enviar para a revisão.
