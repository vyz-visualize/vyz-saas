-- =============================================================================
-- VYZ · Métricas novas do "Personalizar"
-- Só colunas opcionais, sem valor padrão: não reescreve as tabelas nem muda as
-- linhas existentes. O total por conta e dia (rollup_account_insights) não usa
-- estas colunas: os cards leem os anúncios (Meta) e as campanhas (Google).
-- null = a fonte não trouxe o dado; a tela mostra "sem dados nesta conta".
-- =============================================================================

alter table public.insights_ad_daily
  add column registrations bigint check (registrations >= 0);

comment on column public.insights_ad_daily.registrations is 'Cadastros concluídos. Na Meta: só a ação omni_complete_registration (já agrupa pixel e app), para não contar em dobro.';

-- Google por campanha, não por anúncio: Performance Max e Shopping não têm linha de
-- anúncio, e o total da conta sairia menor.
alter table public.insights_campaign_daily
  add column all_conversions numeric(14, 2) check (all_conversions >= 0),
  add column interactions bigint check (interactions >= 0),
  add column top_impression_pct numeric(7, 6) check (top_impression_pct between 0 and 1),
  add column absolute_top_impression_pct numeric(7, 6) check (absolute_top_impression_pct between 0 and 1);

comment on column public.insights_campaign_daily.all_conversions is 'Google: todas as conversões (metrics.all_conversions), inclusive as fora da coluna Conversões.';
comment on column public.insights_campaign_daily.interactions is 'Google: interações (metrics.interactions). Base da taxa de conversão.';
comment on column public.insights_campaign_daily.top_impression_pct is 'Google: % das impressões no topo (0 a 1). Confirmar a escala na API ao ligar a importação real: a documentação não diz se é fração ou 0 a 100.';
comment on column public.insights_campaign_daily.absolute_top_impression_pct is 'Google: % das impressões no topo absoluto (0 a 1). Mesma ressalva de escala.';
