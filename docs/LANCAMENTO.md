# Lançamento: ligar a Stripe no modo live

**Hoje (16/11/2026):**
- a produção cobra pela Stripe em **modo de teste**, de propósito, até o lançamento;
- as sessões gravadas começam com `cs_test_`;
- as 2 assinaturas pagas em teste ficam como estão até lá.

Este é o checklist para quando formos ligar o modo live. Nada aqui foi executado.

## 1. Como a cobrança funciona (o que muda e o que não muda)

- O pagamento é no **Checkout hospedado** da Stripe. O cartão nunca passa pelo VYZ (`src/server/billing/stripe.ts`).
- **Não há produtos nem preços cadastrados na Stripe.** Cada pedido manda as linhas calculadas no VYZ (`price_data` com `product_data`, em `src/features/checkout/stripe-lines.ts`). Por isso **não é preciso criar produtos nem preços no modo live**. O preço continua vindo do código (`src/features/pricing/pricing.ts`) e do catálogo no banco (`plan_prices`, via `npm run db:catalog`).
- A conclusão do pedido chega por dois caminhos, e os dois são idempotentes (`fulfill_checkout`):
  - a volta do Checkout, em `/api/billing/stripe/retorno`;
  - o webhook, em `/api/billing/webhook`.
- Os ids da Stripe ficam gravados no banco:
  - `billing_customers.provider_customer_id` (`cus_…`);
  - `subscriptions.provider_subscription_id` (`sub_…`);
  - `checkout_sessions.provider_session_id` (`cs_…`).

  **Os ids do modo de teste não existem no modo live** (seção 5).

## 2. Variáveis na Vercel (Production)

Só os nomes. Os valores ficam no painel da Stripe e da Vercel.

| Variável | Hoje | No lançamento |
|---|---|---|
| `STRIPE_SECRET_KEY` | chave de teste (`sk_test_…`) | chave live (`sk_live_…`). Preferir uma chave restrita (`rk_live_…`) com só o que o código usa: Checkout Sessions, Customers, Subscriptions, Invoices, PaymentIntents, Charges e Refunds (leitura) |
| `STRIPE_WEBHOOK_SECRET` | segredo do endpoint de teste | segredo (`whsec_…`) do **endpoint live** (seção 4). Troca junto com a chave: um sem o outro quebra o webhook |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | opcional, não usada pelo Checkout hospedado | `pk_live_…`, se for preenchida |
| `BILLING_PROVIDER` | `stripe` | continua `stripe` |
| `ALLOW_MOCKS_IN_PRODUCTION` | conferir na Vercel (não foi lido daqui) | só pode ser `false` com `BILLING_PROVIDER=stripe` e `INTEGRATIONS_MODE=live`; com algo simulado, o build recusa |
| `CHECKOUT_SIMULATED_EMAILS` | equipe | continua. A organização de teste da equipe nunca chama a Stripe, nem no modo live |
| `BILLING_FREE_EMAILS` | sem efeito com a Stripe ligada | pode ficar vazia |

**Preview** continua com as chaves de **teste**. O preview grava no mesmo banco de produção, então nunca coloque a chave live no Preview.

Depois de trocar as variáveis, é preciso **um novo deploy da produção**: variável nova só vale em deploy novo.

## 3. Stripe: conta e configurações do modo live

As configurações do modo de teste **não** passam para o live sozinhas. Conferir no modo live:

1. Conta ativada: CNPJ, dados do responsável e conta bancária para os repasses.
2. **Formas de pagamento** do Checkout (Configurações > Formas de pagamento): cartão; Pix e boleto se forem usados. Em assinatura, confira quais formas a Stripe aceita para cobrança recorrente no Brasil.
3. Descritor na fatura do cartão (*statement descriptor*): "VYZ" ou "VYZUALIZE".
4. Identidade visual do Checkout (logo e cores) e e-mails de recibo da Stripe, se forem usados.
5. **Desligar no modo live** os e-mails de cobrança automáticos da Stripe que dupliquem os do VYZ.

## 4. Webhook live

Criar um endpoint no **modo live**:
- **URL:** `https://www.vyzualize.com.br/api/billing/webhook`
- **Eventos** (os mesmos que o código trata, em `src/server/billing/webhook.ts`):
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `charge.refunded`
- O "Signing secret" (`whsec_…`) desse endpoint vai em `STRIPE_WEBHOOK_SECRET` da Production.

O endpoint de **teste** atual:
- Se continuar apontando para a produção, ele passa a falhar na assinatura do evento (o segredo será o do live) e a Stripe vai reenviar por dias.
- Apague o endpoint de teste ou aponte-o para uma URL de preview.

## 5. O que fazer com o que foi criado em teste

**Antes** de ligar o live, conferir (só leitura) o que o banco guarda com ids de teste:
- `billing_customers` com `provider = 'stripe'`: os ids `cus_…` são de teste;
- `subscriptions` com `provider = 'stripe'` e status vivo: as 2 assinaturas pagas em teste;
- `checkout_sessions` com `provider = 'stripe'` e `status = 'open'`.

Decisões e passos:

1. **As 2 assinaturas pagas em teste** (Avançado anual de 11/11 e Padrão anual de 11/11; nenhum dinheiro entrou). Escolher uma das saídas:
   - **a)** virar **cortesia** pelo painel interno (Usuários > conceder plano), com data de fim, e avisar os dois clientes para assinar de verdade até essa data; ou
   - **b)** cancelar no lançamento, com aviso antes.

   Em qualquer caso, a assinatura não pode continuar como `provider = 'stripe'` apontando para um id de teste: troca de plano e cancelamento chamariam a Stripe live com esse id e falhariam.
2. **Clientes de teste** (`billing_customers` com `cus_…` de teste): limpar o vínculo das organizações. Sem isso, o próximo checkout live dessa organização manda `customer: cus_…` de teste, e a Stripe live recusa ("No such customer"). Feito isso, o próximo checkout cria o cliente live pelo e-mail.
3. **Pedidos abertos** (`checkout_sessions` `open` de teste): marcar como `canceled`. A sessão `cs_test_` não abre no live; o código já cria outra se precisar, mas é melhor não deixar sobra.
4. **Histórico** (`invoices`, `payment_transactions`, `billing_events` de teste): manter, com uma nota no relatório interno de que tudo antes da data do lançamento era modo de teste. A receita do painel interno vem da própria Stripe, então o teste some sozinho quando a chave virar live.

Cada passo que altera dados é uma migration ou um script revisado antes, nunca SQL solto em produção.

## 6. Ordem segura da troca

1. Stripe live pronta (seção 3) e endpoint do webhook live criado (seção 4); anotar o `whsec_…`.
2. Avisar os clientes das 2 assinaturas de teste (seção 5.1) e definir a saída.
3. Janela curta, fora do horário dos crons de sincronização (anúncios 09, 15 e 21 UTC; orgânico 07, 12 e 19 UTC):
   1. aplicar a limpeza da seção 5 (clientes, pedidos abertos e as 2 assinaturas);
   2. na Vercel (Production), trocar **juntas** `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` para as live;
   3. **redeploy** da produção;
   4. apagar ou redirecionar o endpoint de webhook de teste.
4. **Compra real de conferência**, feita pela equipe:
   - um e-mail **fora** de `CHECKOUT_SIMULATED_EMAILS`, cartão real, plano mais barato (Básico mensal);
   - conferir no banco: pedido `completed`, assinatura `active` com `sub_…` live, fatura e transação;
   - conferir na Stripe: webhook com resposta 200;
   - **estornar** pela Stripe e conferir o `charge.refunded` no VYZ;
   - cancelar a assinatura de conferência.
5. Acompanhar por 48 h:
   - entregas do webhook (Stripe > Webhooks);
   - erros em `billing_events.error`;
   - logs da Vercel em `/api/billing/*`.

**Voltar atrás:** trocar as duas variáveis de novo para as de teste e fazer redeploy. Pedidos live já pagos continuam válidos na Stripe e no banco.

## 7. Junto do lançamento (fora da Stripe)

- Em `src/lib/flags.ts`: `BILLING_LIVE = true` (tira o aviso "Simulação · não é cobrança") e `SITE_INDEXABLE = true` (a home deixa de ter `noindex`).
- Textos legais (termos e privacidade) revisados para a cobrança real.
- O marcador `[ANOS]` da dobra Diferenciais já foi trocado. A checagem continua no `postbuild` (`scripts/build/check-placeholders.ts`): um marcador novo na lista faz o deploy de produção falhar.
