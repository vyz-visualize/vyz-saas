# MMM: base de dados de mídia para Marketing Mix Modeling

Proposta. Direção aprovada: um schema `mmm` organizado por workspace. Aguarda a confirmação do Gustavo; **nenhuma migration foi criada**. Os números marcados com [M] foram medidos em produção, só com leitura, em 13/11/2026. Os marcados com [E] são estimativas.

## 1. O que já guardamos

- Banco com 192 MB [M]. São 121 contas, todas em BRL; 14 têm fatos de mídia (9 da Meta e 4 do Google ativas) [M].
- O histórico vai de 31/07/2026 a 12/11/2026, cerca de 105 dias [M].
- A sincronização inicial traz 90 dias. A agendada (09, 15 e 21 UTC) e a manual releem os últimos 7 dias. O CRM relê sempre 90 dias.
- Os fatos são gravados por upsert na chave. Depois, `pruneStale` apaga, dentro do período sincronizado, o que a fonte não devolveu mais.
- Campanhas, anúncios e produtos são sobrescritos por `(ad_account_id, external_id)`. Nome, status, orçamento e criativo **não têm histórico**.

| Tabela | Granularidade | Linhas [M] | Linhas por conta e dia [M] | Disco [M] |
|---|---|---|---|---|
| insights_account_daily | conta × dia | 1.133 | 1 | 2,3 MB |
| insights_campaign_daily | campanha × dia | 5.629 | 5,0 | 20 MB |
| insights_ad_daily | anúncio × dia | 18.515 | 16,3 | 23 MB |
| insights_breakdown_daily | conta × dia × dimensão × valor | 40.456 | 50,4 | 30 MB |
| insights_search_term_daily | campanha × dia × termo (Google) | 5.509 | 27,3 | 2,5 MB |
| insights_product_daily | produto × dia | 12.030 | 15,0 | 3,5 MB |
| organic_daily | conta × dia | 387 | 1 | 0,16 MB |
| analytics_daily (GA4) | conta × dia × canal | 41 | 1,1 | 0,05 MB |
| crm_daily | conta × dia × etapa | 0 | – | – |

Os índices estão inchados pela regravação diária. Em `insights_campaign_daily`, por exemplo, são 20 MB de índice para 1,2 MB de tabela [M].

## 2. O que o MMM precisa e o que falta

O MMM precisa de investimento, impressões, cliques, conversões e receita por dia e por canal ou campanha, com **pelo menos 2 anos** de histórico, além de variáveis externas.

O que falta hoje:

1. Histórico: temos cerca de 3,5 meses; precisamos de 24 meses ou mais.
2. Resultado do negócio: receita e pedidos reais. Hoje só temos o que as plataformas atribuem a si mesmas, e as janelas de atribuição da Meta mudaram em 2025–2026. O GA4 e o CRM ainda têm pouco ou nenhum dado.
3. Calendário e eventos: feriados nacionais, Black Friday, Dia das Mães, promoções, mudanças de preço e ruptura de estoque.
4. Histórico de orçamento e de preço: hoje as entidades são sobrescritas a cada sincronização.
5. Canal: o canal "Meta" vem de `ad_accounts.platform_id`. `ad_campaigns.channel` só traz os tipos de campanha do Google.

## 3. Schema proposto: `mmm`, organizado por workspace

No VYZ, o dono dos dados é o **workspace**. Uma pessoa pode ter vários workspaces, e um workspace pode ter várias pessoas. Por isso:

- Todas as tabelas ficam no schema `mmm` e têm `workspace_id` e `ad_account_id` em todas as linhas.
- O acesso segue a política "membros leem", com `workspace_id in (select private.workspace_ids())`. Só o `service_role` escreve.
- Cada carga registra o `user_id` de quem a pediu, para auditoria.
- Um schema por usuário **não** é recomendado: seriam milhares de schemas para migrar e manter, e não daria para ter uma política única.
- O padrão segue o resto do banco: snake_case e comentários em português.

### Camadas, do bruto ao pronto para análise

1. **`mmm.raw_insights`** (bruto e imutável)
   - Colunas: `workspace_id, ad_account_id, platform_id, level, date_from, date_to, request_hash, payload jsonb, fetched_at, requested_by`.
   - Particionada por mês em `fetched_at`, reaproveitando `private.ensure_monthly_partitions` e `drop_old_partitions`.
   - Índice em `(ad_account_id, date_from)`.
2. **`mmm.media_daily`** (tratado)
   - Colunas: `workspace_id, ad_account_id, platform_id, campaign_external_id, date, canal, moeda, spend, spend_brl, impressions, clicks, conversions, conversion_value, origem ('sync'|'backfill'), synced_at`.
   - Chave primária `(ad_account_id, campaign_external_id, date)`; índice em `(workspace_id, date)`.
   - A data segue o fuso da conta. O id externo da campanha mantém o histórico mesmo depois que a campanha sai da plataforma.
3. **`mmm.outcomes_daily`**
   - Uma linha por workspace × dia × fonte (GA4, CRM ou planilha), com receita, pedidos e leads.
4. **`mmm.calendario`** (global, lido por qualquer `authenticated`) e **`mmm.eventos`** (por workspace)
   - O calendário guarda feriados e datas sazonais do Brasil.
   - Os eventos guardam o que é de cada cliente: promoção, preço, estoque.
5. **`mmm.daily`** (pronto para análise)
   - Colunas: `data, workspace_id, canal, investimento, impressoes, cliques, conversoes, receita`, mais os indicadores do calendário.
   - É uma tabela recalculada por `mmm.rollup_daily(workspace, de, ate)`, no mesmo padrão de `rollup_account_insights`.
   - Materialized view fica fora, porque não tem RLS e é recalculada inteira. Se for view comum, precisa de `security_invoker = true`.

## 4. Backfill: até onde as APIs voltam

- **Meta:** os totais ficam disponíveis por **37 meses**, ou seja, até cerca de outubro de 2023. Breakdowns de contagem única e por hora ficam 13 meses; de frequência, 6 meses. O backfill deve ser só por campanha, sem breakdown, com jobs assíncronos e acompanhando o `x-fb-ads-insights-throttle`.
- **Google Ads:** desde 01/06/2026, os dados diários ficam **37 meses** (mensais, 11 anos). O limite de operações por dia depende do nível de acesso (Explorer 2.880, Basic 15.000).
- **Urgência:** o mês mais antigo sai das duas APIs todo mês.
- **Plano de carga:**
  - Uma fila `mmm.backfill_jobs` com (conta, mês, status, tentativas), processada pelo `/api/cron/sync` com 3 contas em paralelo e limite de 300 s.
  - Grava só nas camadas bruta e tratada. **Não** reaproveitar `writeDataset` e `pruneStale` para isso.
  - Com 14 contas × 37 meses, são 518 jobs: cerca de 7 dias [E].

## 5. Tamanho e custo

A base do MMM por campanha gera cerca de 1.800 linhas por conta por ano [E].

| Cenário em 3 anos [E] | Por conta | 50 contas | 200 contas |
|---|---|---|---|
| MMM tratado (cerca de 0,4 KB por linha) | 2,2 MB | 110 MB | 440 MB |
| Bruto em jsonb | 8 MB | 400 MB | 1,6 GB |

- Supabase Free: 500 MB, dos quais já usamos 38% [M].
- Supabase Pro: a partir de US$ 25 por mês, com 8 GB incluídos e US$ 0,125 por GB·mês acima disso.
- O custo real tende a vir de compute e de IO, mais do que de disco.

## 6. RLS e LGPD

- **Isolamento:** a mesma política "membros leem" por workspace. O `mmm.calendario` tem leitura para todos.
- **Exclusão de conta:** FKs `on delete cascade` para `ad_accounts` ou `workspaces`. Há um ponto de atenção:
  - No modo "shell" da exclusão (quando faturas precisam ficar), a linha do workspace continua existindo.
  - Por isso, `mmm.eventos` e `mmm.outcomes_daily` precisam entrar em `SHELL_PURGE_ORDER` e na conferência final de `account-deletion.ts`.
- **Retenção:** o bruto fica 13 meses, por derrubada de partição. O tratado fica enquanto o contrato estiver ativo, mais 90 dias. Isso exige ampliar o check de `private.retention_policy`.
- **Dados agregados entre clientes (benchmark):** só com base no contrato ou opt-in, cláusula no contrato de tratamento de dados e conferência dos termos da Meta e da Google Ads API.

## 7. Riscos e próximos passos

**Riscos:**

- O histórico se perde mês a mês enquanto o backfill não roda.
- A definição de conversão atribuída muda com o tempo.
- Os índices estão inchados.
- O nível Explorer do Google limita o número de operações.
- A cascata de `ad_campaigns` apagaria o histórico; por isso o MMM usa o id externo.

**Próximos passos:**

1. Confirmar com o Gustavo.
2. Escrever a migration do schema `mmm`, para revisão antes de aplicar.
3. Criar a fila de backfill.
4. Montar o calendário do Brasil.
5. Ligar GA4 e CRM como resultado do negócio.
6. Rodar `REINDEX CONCURRENTLY` como manutenção.

## Fontes

- [Supabase: preços](https://supabase.com/pricing)
- [Meta: disponibilidade de métricas da Ads Insights API](https://developers.facebook.com/blog/post/2025/10/16/ads-insights-api-metric-availability-updates/)
- [Meta: boas práticas e limites da Insights API](https://developers.facebook.com/docs/marketing-api/insights/best-practices)
- [Google Ads: retenção de dados](https://support.google.com/google-ads/answer/15188209?hl=en)
- [Google Ads: nova política de retenção (blog dos desenvolvedores)](https://developers.google.com/ads/blog/posts/2026/05/new-data-retention-policy-for-google)
- [Google Ads API: níveis de acesso](https://developers.google.com/google-ads/api/docs/api-policy/access-levels)
