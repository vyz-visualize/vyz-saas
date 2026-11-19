-- =============================================================================
-- VYZ · Acessos do cliente (aba Acessos do workspace)
--
-- Para quem vende dashboard para cliente (freelancers de BI, agências): saber se o cliente
-- está usando o dash, quem abriu, quando, por quanto tempo e quais telas viu.
--
--   share_links.recipient_name  para quem é o link ("Maria, diretora"). Um link por pessoa
--                               é o que diz quem abriu, sem pedir cadastro ao cliente.
--   share_visits                uma visita ao link público (/r/<token>): começa no primeiro
--                               sinal da página aberta (navegador com JavaScript, então a
--                               prévia do WhatsApp não conta) e soma o tempo com a aba
--                               visível e as telas vistas. Sem IP e sem navegador: só o tipo
--                               de aparelho.
--
-- Escrita só pelo servidor (service_role), por record_share_visit, que confere o link
-- (existe, não revogado, não expirado). Leitura: membros do workspace, só dos dashboards a
-- que têm acesso (mesma regra dos links). Vale em todos os planos.
-- =============================================================================

-- ---- para quem é o link -------------------------------------------------------------------------

alter table public.share_links
  add column recipient_name text check (recipient_name is null or char_length(btrim(recipient_name)) between 1 and 80);
comment on column public.share_links.recipient_name is 'Para quem é o link (ex.: "Maria, diretora"). Nulo = link sem nome.';

grant insert (recipient_name) on public.share_links to authenticated;
grant update (recipient_name) on public.share_links to authenticated;

-- ---- visitas ------------------------------------------------------------------------------------

create table public.share_visits (
  id uuid primary key,
  workspace_id uuid not null,
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  dashboard_id uuid not null,
  project_id uuid,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seconds integer not null default 0 check (seconds between 0 and 14400),
  pages text[] not null default '{}' check (cardinality(pages) <= 30),
  device text check (device in ('desktop', 'mobile', 'tablet')),
  foreign key (workspace_id, dashboard_id) references public.dashboards (workspace_id, id) on delete cascade
);
comment on table public.share_visits is 'Visitas ao link público do dashboard: quando, quanto tempo (aba visível, até 4 h) e quais telas. Escrita só pelo servidor (record_share_visit).';
comment on column public.share_visits.id is 'Gerado pela página aberta (uma visita por aba; volta a valer depois de 30 min parada).';
comment on column public.share_visits.project_id is 'Workspace (projeto) do dashboard no momento da visita.';
comment on column public.share_visits.pages is 'Telas vistas (ids de página), na ordem da primeira vez.';

create index share_visits_project_idx on public.share_visits (project_id, started_at desc);
create index share_visits_link_idx on public.share_visits (share_link_id, started_at desc);
create index share_visits_workspace_idx on public.share_visits (workspace_id, started_at desc);
create index share_visits_dashboard_idx on public.share_visits (workspace_id, dashboard_id);

alter table public.share_visits enable row level security;

create policy "share_visits: membros leem" on public.share_visits
  for select to authenticated using (workspace_id in (select private.workspace_ids()));
create policy "share_visits: so dos dashboards do usuario" on public.share_visits as restrictive for all to authenticated
  using (dashboard_id in (select private.dashboard_ids()));
grant select on public.share_visits to authenticated;

-- ---- gravação ----------------------------------------------------------------------------------

-- Um sinal da página aberta: cria a visita ou soma tempo e tela. false = link inválido,
-- revogado ou expirado (nada gravado). Visita de outro link ou parada há mais de 12 h não
-- muda. O tempo de cada sinal vale no máximo 2 min.
create function public.record_share_visit(p_link_id uuid, p_visit_id uuid, p_page text, p_seconds integer, p_device text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.share_links%rowtype;
  v_project uuid;
  v_seconds integer := least(greatest(coalesce(p_seconds, 0), 0), 120);
  v_page text := case when p_page ~ '^[a-z0-9-]{1,40}$' then p_page end;
  v_device text := case when p_device in ('desktop', 'mobile', 'tablet') then p_device end;
begin
  select * into v_link from public.share_links where id = p_link_id;
  if not found or v_link.revoked_at is not null or (v_link.expires_at is not null and v_link.expires_at <= now()) then
    return false;
  end if;
  select d.project_id into v_project from public.dashboards d where d.id = v_link.dashboard_id;

  insert into public.share_visits as v (id, workspace_id, share_link_id, dashboard_id, project_id, seconds, pages, device)
  values (p_visit_id, v_link.workspace_id, v_link.id, v_link.dashboard_id, v_project, v_seconds, case when v_page is null then '{}'::text[] else array[v_page] end, v_device)
  on conflict (id) do update set
    last_seen_at = now(),
    seconds = least(v.seconds + excluded.seconds, 14400),
    pages = case when v_page is null or v_page = any (v.pages) or cardinality(v.pages) >= 30 then v.pages else v.pages || v_page end
  where v.share_link_id = excluded.share_link_id
    and v.last_seen_at > now() - interval '12 hours';
  return true;
end;
$$;
revoke all on function public.record_share_visit(uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.record_share_visit(uuid, uuid, text, integer, text) to service_role;
