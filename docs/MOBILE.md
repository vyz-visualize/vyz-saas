# VYZ · App nativo (iOS e Android)

## Arquitetura

```
/                       site + LP + painel (Next.js) — inclui a API do app
  src/app/api/v1/       API do app: me, workspaces/:id/dashboards, dashboards/:id, account (DELETE), push-tokens
  src/app/api/webhooks/revenuecat/   compras da loja → créditos e assinatura do plano
  src/server/auth/bearer.ts          autenticação "Authorization: Bearer <jwt do Supabase>" (mesmo RLS do site)
packages/shared/        tipos da API, produtos de crédito, termos proibidos no iOS (usado pelos dois)
apps/mobile/            app Expo (React Native) com ios/ e android/ no repositório (prebuild)
  src/lib/              supabase (sessão no Keychain/Keystore), api, auth, purchases (RevenueCat), push
  src/app/              telas (Expo Router): entrar, dashboards, dashboard, conta
  scripts/audit-bundle.mjs           auditoria de termos antes de cada upload
```

- **Mesmo backend:** o app fala com o mesmo Supabase (login) e com a API do site (dados já calculados no servidor). Nenhuma regra de negócio no app.
- **Login:** e-mail/senha; Google nativo (idToken); Apple nativo no iOS (nonce SHA-256). Os tokens viram sessão via `signInWithIdToken`. Sem modo convidado.
- **Exclusão de conta:** Conta → Excluir conta → `DELETE /api/v1/account`. A propriedade dos workspaces passa a outro membro; sem equipe, a assinatura é encerrada. Faturas ficam (fiscal), sem vínculo pessoal.
- **Compras:** créditos só pela loja (RevenueCat). O webhook credita em `credit_ledger` (só cresce); o saldo (`credit_balances`) vale no app e no site. Produtos em `packages/shared/src/credits.ts`.
- **Assinatura do plano:** vendida também no app, pela loja (RevenueCat), com a MESMA regra do site: 3 planos fixos × mensal/anual, mesmo preço (Básico R$ 49,90/mês ou R$ 502,80/ano; Padrão R$ 149,90 ou R$ 1.498,80; Avançado R$ 299,90 ou R$ 2.998,80). São 6 produtos `vyz_<plano>_<mensal|anual>_ate<n>` (o número do id é o antigo e não muda), num único grupo de assinaturas; a lista com preços sai de `npx tsx scripts/store/plan-products.ts` (`apps/mobile/store/pacotes-lojas.csv`). Mudou o preço em `STORE_PLAN_PRICE`? Atualize também no App Store Connect e no Google Play Console. Antes da compra o app chama `POST /api/v1/workspaces/:id/store-plan` (só o dono; workspace sem plano do site); o webhook relê o estado em `GET /v1/subscribers/:id` (precisa de `REVENUECAT_SECRET_API_KEY`) e grava em `subscriptions` (`sync_store_subscription`). Plano contratado no site muda só no site (o app avisa, sem link).
- **Usuários por plano:** Básico 1; Padrão e Avançado ilimitados (`maxMembers` em entitlements.ts; o ilimitado é `UNLIMITED_MEMBERS` = 1000 no banco e nunca aparece na tela). O banco recusa convite ou membro acima do limite (convites pendentes contam). `GET /api/v1/me` traz `unlimitedMembers` por workspace: com ele, o app mostra só o uso, sem total.
- **Push:** token nativo (APNs/FCM) salvo em `push_tokens`; o envio sai do nosso backend.

## Rodar no simulador

```
cd apps/mobile && cp .env.example .env   # preencher
npx expo run:ios                          # compila pelo Xcode e abre no simulador
```

## Build e envio iOS (sem EAS)

1. `cd apps/mobile/ios && pod install`, abrir `VYZ.xcworkspace` no Xcode.
2. Signing & Capabilities: seu Team; confira **Sign in with Apple** e **Push Notifications**.
3. Antes de cada envio: `node scripts/audit-bundle.mjs ios` e conferir o resultado (os "Android" restantes são mensagens internas do React Native, fora da tela).
4. General → Build: incrementar. Product → Archive → Distribute App → App Store Connect → Upload.

## Lojas

Tudo para publicar (textos, prints, privacidade, produtos, credenciais e builds): [apps/mobile/store/LOJAS.md](../apps/mobile/store/LOJAS.md).

## Checklist antes de cada envio

- [ ] Número do build incrementado
- [ ] Auditoria do bundle rodada e revisada
- [ ] Compras dentro do app anexadas à versão no mesmo envio
- [ ] Excluir conta testado de ponta a ponta
- [ ] Conta de teste do revisor (com plano ativo e um dashboard com dados) nas notas da revisão
- [ ] Rótulo de privacidade coerente (rastreamento: Não)
