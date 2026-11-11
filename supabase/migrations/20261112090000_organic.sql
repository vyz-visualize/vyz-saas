-- =============================================================================
-- VYZ · Orgânico: Instagram e Página do Facebook
-- O mesmo login do Meta (Facebook Login for Business) traz as Páginas e os
-- perfis do Instagram ligados a elas. Cada um vira uma linha em ad_accounts
-- (platform_id 'facebook' ou 'instagram', oauth_provider 'meta' no catálogo) e
-- conta 1 conta do plano, como uma conta de anúncio.
--
-- Os números são outros (seguidores, visualizações, interações, posts), então
-- moram em tabelas próprias, no mesmo padrão do armazém de anúncios:
--   * organic_daily: total por perfil e dia;
--   * organic_posts: cada post, reel ou story, com os números de vida inteira
--     (o Meta não dá série diária por post).
-- Escrita só pelo service_role (sincronização). Membros do workspace leem.
-- =============================================================================

-- Novo tipo de plataforma: rede social (orgânico).
alter table public.platforms drop constraint if exists platforms_kind_check;
alter table public.platforms add constraint platforms_kind_check check (kind in ('ads', 'analytics', 'crm', 'social'));

create table public.organic_daily (
  workspace_id uuid not null,
  ad_account_id uuid not null,
  date date not null,
  -- seguidores no fim do dia (Instagram: followers_count do dia da sincronização; Página: page_follows)
  followers bigint check (followers >= 0),
  follows integer check (follows >= 0),
  unfollows integer check (unfollows >= 0),
  -- visualizações (substituem as impressões: Instagram views, Página page_media_view)
  views bigint not null default 0 check (views >= 0),
  -- contas alcançadas (estimado pelo Meta)
  reach bigint check (reach >= 0),
  profile_views integer check (profile_views >= 0),
  accounts_engaged integer check (accounts_engaged >= 0),
  interactions integer not null default 0 check (interactions >= 0),
  likes integer check (likes >= 0),
  comments integer check (comments >= 0),
  shares integer check (shares >= 0),
  saves integer check (saves >= 0),
  link_clicks integer check (link_clicks >= 0),
  posts integer not null default 0 check (posts >= 0),
  synced_at timestamptz not null default now(),
  primary key (ad_account_id, date),
  foreign key (workspace_id, ad_account_id) references public.ad_accounts (workspace_id, id) on delete cascade
);
comment on table public.organic_daily is 'Orgânico por perfil (Instagram) ou Página (Facebook) e dia. null = a plataforma não informa o número.';
create index organic_daily_workspace_idx on public.organic_daily (workspace_id, date);

create table public.organic_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  ad_account_id uuid not null,
  external_id text not null,
  kind text not null check (kind in ('post', 'carousel', 'reel', 'story', 'video', 'text')),
  caption text,
  permalink text,
  thumbnail_url text,
  published_at timestamptz not null,
  views bigint check (views >= 0),
  reach bigint check (reach >= 0),
  likes integer check (likes >= 0),
  comments integer check (comments >= 0),
  shares integer check (shares >= 0),
  saves integer check (saves >= 0),
  interactions integer not null default 0 check (interactions >= 0),
  synced_at timestamptz not null default now(),
  unique (ad_account_id, external_id),
  foreign key (workspace_id, ad_account_id) references public.ad_accounts (workspace_id, id) on delete cascade
);
comment on table public.organic_posts is 'Posts, reels e stories com os números de vida inteira (lidos de novo a cada sincronização).';
create index organic_posts_account_idx on public.organic_posts (ad_account_id, published_at desc);

alter table public.organic_daily enable row level security;
alter table public.organic_posts enable row level security;
create policy "organic_daily: membros leem" on public.organic_daily for select to authenticated using (workspace_id in (select private.workspace_ids()));
create policy "organic_posts: membros leem" on public.organic_posts for select to authenticated using (workspace_id in (select private.workspace_ids()));
grant select on public.organic_daily, public.organic_posts to authenticated;
