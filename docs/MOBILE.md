# VYZ · App nativo (iOS e Android)

Versão atual: **1.0.0, build 10** (`apps/mobile/app.json`: `version`, `ios.buildNumber`, `android.versionCode`).

## Arquitetura

```
/                       site, painel e a API do app (Next.js)
  src/app/api/v1/       API do app: me, workspaces/:id (dashboards, insights, tarefas, otimizações,
                        store-plan), dashboards/:id, agent, account (DELETE), push-tokens, store/sync
  src/app/api/webhooks/revenuecat/   compras da loja: créditos e assinatura do plano
  src/server/auth/bearer.ts          "Authorization: Bearer <jwt do Supabase>" (mesmo RLS do site)
packages/shared/        tipos da API, créditos, planos da loja, termos proibidos no iOS (site e app)
apps/mobile/            app Expo SDK 58 (React Native, Expo Router)
  src/app/              telas: entrar; abas Início, Análises, VYZ e Conta; A Fazer; dashboard
  src/lib/              supabase (sessão no Keychain/Keystore), api, auth, purchases (RevenueCat), push
  scripts/audit-bundle.mjs           auditoria de termos antes de cada envio
  store/                LOJAS.md, textos, imagens, pacotes-lojas.csv e gerar/build.sh
```

- **Sem `ios/` e `android/` no git:** as pastas nativas são geradas pelo `expo prebuild` (ignoradas em `apps/mobile/.gitignore`). Configuração nativa vai no `app.json` e no `app.config.js`, nunca à mão.
- **Mesmo backend:** o app fala com o mesmo Supabase (login) e com a API do site (dados já calculados no servidor). Nenhuma regra de negócio no app.
- **Login:** e-mail e senha; Google nativo (idToken); Apple nativo no iOS (nonce SHA-256). Os tokens viram sessão via `signInWithIdToken`. Sem modo convidado.
- **Exclusão de conta:** Conta > Excluir conta > `DELETE /api/v1/account`. A propriedade dos workspaces passa a outro membro; sem equipe, a assinatura é encerrada. Faturas ficam (fiscal), sem vínculo pessoal. O que ainda falta nesse caminho está em `docs/PENDENCIAS.md`.
- **Créditos:** só pela loja (RevenueCat). O webhook credita em `credit_ledger` (só cresce); o saldo (`credit_balances`) vale no app e no site. Produtos em `packages/shared/src/credits.ts`.
- **Push:** token nativo (APNs/FCM) em `push_tokens`; o envio sai do nosso backend.

## Planos no app

Mesma regra do site (`src/features/pricing/pricing.ts` e `entitlements.ts`):

| Plano | Mensal | Anual | Workspaces | Dashboards | Usuários |
|---|---|---|---|---|---|
| Básico | R$ 49,90 | R$ 499,90 | até 3 | 3 | 1 |
| Padrão | R$ 149,90 | R$ 1.499,90 | até 5 | 10 | ilimitados |
| Avançado | R$ 299,90 | R$ 2.999,90 | ilimitados | 40 | ilimitados |

- O Personalizado (100 dashboards) é sob consulta e não é vendido na loja.
- Todas as plataformas em todos os planos. O paywall (`packages/shared/src/store-plans.ts`) cita as que funcionam hoje: Meta Ads, Instagram, Facebook, Google Ads e GA4. Mudou `AVAILABLE_PLATFORMS` no site? Mude o texto lá também.
- **Produtos:** 6, `vyz_<plano>_<mensal|anual>_ate<n>`, num único grupo de assinaturas. O número do id é o antigo e não muda. A lista com preços sai de `npx tsx scripts/store/plan-products.ts` (`apps/mobile/store/pacotes-lojas.csv`).
- **Preço:** `STORE_PLAN_PRICE` (`packages/shared/src/store-plans.ts`). Só valem os pontos de preço da Apple; o anual do site é o mesmo total (`PLAN_YEAR`). Mudou o preço? Atualize também no App Store Connect e no Google Play Console.
- **Compra:** antes, o app chama `POST /api/v1/workspaces/:id/store-plan` (só o dono; workspace sem plano do site). O webhook relê o estado em `GET /v1/subscribers/:id` (precisa de `REVENUECAT_SECRET_API_KEY`) e grava em `subscriptions` (`sync_store_subscription`). Plano contratado no site muda só no site (o app avisa, sem link).
- **Usuários:** o ilimitado é `UNLIMITED_MEMBERS` = 1000 no banco e nunca aparece na tela. O banco recusa convite ou membro acima do limite (convites pendentes contam). `GET /api/v1/me` traz `unlimitedMembers` por workspace.

## Rodar no simulador

```
cd apps/mobile && cp .env.example .env   # preencher
npx expo run:ios                          # gera a pasta nativa, compila e abre no simulador
```

## Builds das lojas (local, sem EAS)

Pelo script `apps/mobile/store/gerar/build.sh` (detalhes em `apps/mobile/store/LOJAS.md`, seção 8):

```
cd apps/mobile
store/gerar/build.sh android                       # .aab assinado em store/build/
TEAM_ID=<time da Apple> store/gerar/build.sh ios   # archive e .ipa (DESTINATION=upload envia direto)
store/gerar/build.sh ios-check                     # só confere que o iOS compila em Release
```

- Antes: `.env.production.local` preenchido (inclusive `EXPO_PUBLIC_REVENUECAT_*`) e `google-services.json` na pasta do app (push no Android).
- O `build.sh ios` roda a auditoria do bundle (`node scripts/audit-bundle.mjs ios`). Os "Android" que sobram são mensagens internas de bibliotecas, fora da tela.
- **Chaves de publicação** (Apple, Play, chave de envio do Android) ficam fora do git, em `~/Documents/VYZ/Publicar`. Envio para revisão e produção só com o ok do Gustavo.

## Checklist antes de cada envio

- [ ] `ios.buildNumber` e `android.versionCode` incrementados no `app.json`
- [ ] Auditoria do bundle rodada e revisada
- [ ] Compras dentro do app anexadas à versão no mesmo envio
- [ ] Excluir conta testado de ponta a ponta
- [ ] Conta de teste do revisor (com plano ativo e um dashboard com dados) nas notas da revisão
- [ ] Rótulo de privacidade coerente (rastreamento: Não)
