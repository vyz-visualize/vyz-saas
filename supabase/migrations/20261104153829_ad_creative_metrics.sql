-- =============================================================================
-- VYZ · Métricas por anúncio para a página de Criativos e o comparativo
-- Só colunas opcionais, sem valor padrão: não reescreve as tabelas nem muda as
-- linhas existentes. O total por conta e dia (rollup_account_insights) não usa
-- estas colunas. null = a fonte não trouxe o dado; a tela esconde a métrica.
-- =============================================================================

alter table public.insights_ad_daily
  add column leads bigint check (leads >= 0),
  add column post_engagement bigint check (post_engagement >= 0),
  add column post_reactions bigint check (post_reactions >= 0),
  add column post_comments bigint check (post_comments >= 0),
  add column post_shares bigint check (post_shares >= 0),
  add column post_saves bigint check (post_saves >= 0),
  add column profile_visits bigint check (profile_visits >= 0),
  add column video_p25 bigint check (video_p25 >= 0),
  add column video_p50 bigint check (video_p50 >= 0),
  add column video_p75 bigint check (video_p75 >= 0),
  add column video_p95 bigint check (video_p95 >= 0),
  add column video_p100 bigint check (video_p100 >= 0),
  add column video_watch_seconds bigint check (video_watch_seconds >= 0);

comment on column public.insights_ad_daily.profile_visits is 'Visitas ao perfil. ATENÇÃO: o campo real na API da Meta ainda vai ser confirmado (não consta na referência de Insights consultada); hoje só o gerador simulado preenche.';
comment on column public.insights_ad_daily.video_watch_seconds is 'Segundos totais assistidos no dia. Guardado em total porque média não se soma: tempo médio = total do período ÷ reproduções.';

alter table public.ads
  add column post_url text check (post_url is null or (post_url ~ '^https://' and char_length(post_url) <= 2048));

comment on column public.ads.post_url is 'Link público do post (Instagram ou Facebook), para o botão "Ver post". Só https: vira link na tela.';
