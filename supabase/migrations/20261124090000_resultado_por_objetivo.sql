-- Resultado de cada objetivo separado da compra.
--
-- Até aqui a coluna conversions da Meta guardava só a compra (omni_purchase). Os objetivos de
-- lead e de conversa mostravam essas compras com o nome "Leads" ou "Conversas no WhatsApp".
-- Agora os leads e as conversas iniciadas da Meta ficam nas colunas deles, e o dashboard mostra
-- cada objetivo com o número certo.
--
-- Colunas novas, todas opcionais: vazio quer dizer "a plataforma não informou", e é diferente de 0.
--   - leads: o "lead" agrupado da Meta.
--   - messages: conversas iniciadas (onsite_conversion.messaging_conversation_started_7d).
-- A linha do anúncio já tinha leads; ganha só messages.
--
-- O rollup por conta passa a somar as duas, como soma o resto.

alter table public.insights_campaign_daily
  add column leads numeric(14, 2) check (leads >= 0),
  add column messages numeric(14, 2) check (messages >= 0);

alter table public.insights_account_daily
  add column leads numeric(14, 2) check (leads >= 0),
  add column messages numeric(14, 2) check (messages >= 0);

alter table public.insights_breakdown_daily
  add column leads numeric(14, 2) check (leads >= 0),
  add column messages numeric(14, 2) check (messages >= 0);

alter table public.insights_ad_daily
  add column messages bigint check (messages >= 0);

comment on column public.insights_campaign_daily.leads is 'Meta: leads (tipo de ação "lead", o agrupado). Vazio: a plataforma não informa.';
comment on column public.insights_campaign_daily.messages is 'Meta: conversas iniciadas (onsite_conversion.messaging_conversation_started_7d). Vazio: a plataforma não informa.';
comment on column public.insights_account_daily.leads is 'Soma dos leads das campanhas (rollup_account_insights).';
comment on column public.insights_account_daily.messages is 'Soma das conversas iniciadas das campanhas (rollup_account_insights).';

create or replace function public.rollup_account_insights(p_ad_account_id uuid, p_from date, p_to date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with agg as (
    select
      c.workspace_id,
      c.ad_account_id,
      c.date,
      sum(c.spend) as spend,
      sum(c.impressions) as impressions,
      max(c.reach) as reach,
      sum(c.clicks) as clicks,
      sum(c.link_clicks) as link_clicks,
      sum(c.landing_page_views) as landing_page_views,
      sum(c.add_to_cart) as add_to_cart,
      sum(c.initiate_checkout) as initiate_checkout,
      sum(c.conversions) as conversions,
      sum(c.conversion_value) as conversion_value,
      sum(c.leads) as leads,
      sum(c.messages) as messages,
      sum(c.video_views) as video_views,
      sum(c.video_thruplays) as video_thruplays,
      (sum(c.impressions) filter (where c.search_impression_share > 0)
        / nullif(sum(c.impressions / c.search_impression_share) filter (where c.search_impression_share > 0), 0))::numeric(7, 6) as search_impression_share,
      (sum(c.search_lost_is_budget * c.impressions / c.search_impression_share) filter (where c.search_impression_share > 0 and c.search_lost_is_budget is not null)
        / nullif(sum(c.impressions / c.search_impression_share) filter (where c.search_impression_share > 0 and c.search_lost_is_budget is not null), 0))::numeric(7, 6) as search_lost_is_budget,
      (sum(c.search_lost_is_rank * c.impressions / c.search_impression_share) filter (where c.search_impression_share > 0 and c.search_lost_is_rank is not null)
        / nullif(sum(c.impressions / c.search_impression_share) filter (where c.search_impression_share > 0 and c.search_lost_is_rank is not null), 0))::numeric(7, 6) as search_lost_is_rank
    from public.insights_campaign_daily c
    where c.ad_account_id = p_ad_account_id and c.date between p_from and p_to
    group by c.workspace_id, c.ad_account_id, c.date
  ),
  upserted as (
    insert into public.insights_account_daily as t (
      workspace_id, ad_account_id, date, spend, impressions, reach, clicks, link_clicks, landing_page_views,
      add_to_cart, initiate_checkout, conversions, conversion_value, leads, messages, video_views, video_thruplays,
      search_impression_share, search_lost_is_budget, search_lost_is_rank, synced_at
    )
    select
      workspace_id, ad_account_id, date, spend, impressions, reach, clicks, link_clicks, landing_page_views,
      add_to_cart, initiate_checkout, conversions, conversion_value, leads, messages, video_views, video_thruplays,
      search_impression_share, search_lost_is_budget, search_lost_is_rank, now()
    from agg
    on conflict (ad_account_id, date) do update set
      spend = excluded.spend,
      impressions = excluded.impressions,
      reach = coalesce(t.reach, excluded.reach),
      clicks = excluded.clicks,
      link_clicks = excluded.link_clicks,
      landing_page_views = excluded.landing_page_views,
      add_to_cart = excluded.add_to_cart,
      initiate_checkout = excluded.initiate_checkout,
      conversions = excluded.conversions,
      conversion_value = excluded.conversion_value,
      leads = excluded.leads,
      messages = excluded.messages,
      video_views = excluded.video_views,
      video_thruplays = excluded.video_thruplays,
      search_impression_share = excluded.search_impression_share,
      search_lost_is_budget = excluded.search_lost_is_budget,
      search_lost_is_rank = excluded.search_lost_is_rank,
      synced_at = now()
    returning 1
  )
  select count(*)::integer from upserted;
$$;
revoke all on function public.rollup_account_insights(uuid, date, date) from public, anon, authenticated;
grant execute on function public.rollup_account_insights(uuid, date, date) to service_role;
