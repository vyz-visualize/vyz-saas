-- =============================================================================
-- VYZ · GA4 com dados reais
-- O login do GA4 (Google, analytics.readonly) já descobre as propriedades: cada
-- uma é uma linha em ad_accounts (platform_id 'ga4'). Aqui entram os números,
-- pela Data API (runReport): por propriedade, dia e canal (sessionDefaultChannelGroup).
--
-- São números de site, não de anúncio (sessões, usuários, eventos-chave, compras),
-- então moram numa tabela própria, no padrão do armazém. Escrita só pelo
-- service_role (sincronização). Membros do workspace leem.
-- =============================================================================

create table public.analytics_daily (
  workspace_id uuid not null,
  ad_account_id uuid not null,
  date date not null,
  -- canal padrão do GA4 ("Paid Search", "Organic Search", "Direct", ...)
  channel text not null check (char_length(channel) between 1 and 80),
  sessions integer not null default 0 check (sessions >= 0),
  -- usuários do dia no canal (não somam entre dias nem canais: cada um é distinto)
  users integer not null default 0 check (users >= 0),
  new_users integer not null default 0 check (new_users >= 0),
  engaged_sessions integer not null default 0 check (engaged_sessions >= 0),
  -- eventos-chave (as conversões marcadas no GA4)
  key_events numeric(14, 2) not null default 0 check (key_events >= 0),
  transactions integer not null default 0 check (transactions >= 0),
  revenue numeric(14, 2) not null default 0 check (revenue >= 0),
  synced_at timestamptz not null default now(),
  primary key (ad_account_id, date, channel),
  foreign key (workspace_id, ad_account_id) references public.ad_accounts (workspace_id, id) on delete cascade
);
comment on table public.analytics_daily is 'GA4 por propriedade, dia e canal: sessões, usuários, eventos-chave, compras e receita (Data API).';
create index analytics_daily_workspace_idx on public.analytics_daily (workspace_id, date);

alter table public.analytics_daily enable row level security;
create policy "analytics_daily: membros leem" on public.analytics_daily for select to authenticated using (workspace_id in (select private.workspace_ids()));
grant select on public.analytics_daily to authenticated;
