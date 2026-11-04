-- =============================================================================
-- VYZ · 17 · Lista de espera das landing pages e visitas à página "em breve"
--   landing_waitlist         uma inscrição por usuário em cada workspace
--   landing_waitlist_visits  só cresce; a leitura é interna (service_role)
-- =============================================================================

create table public.landing_waitlist (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  use_case text check (char_length(use_case) <= 500),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
comment on table public.landing_waitlist is 'Quem pediu acesso antecipado às landing pages.';
comment on column public.landing_waitlist.email is 'Vem de auth.users (gatilho); o navegador não escolhe.';
comment on column public.landing_waitlist.use_case is 'Resposta opcional a "Para que você usaria?".';
create index landing_waitlist_user_idx on public.landing_waitlist (user_id);

create function private.landing_waitlist_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select u.email into strict new.email from auth.users u where u.id = new.user_id;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function private.landing_waitlist_fill() from public;

create trigger landing_waitlist_fill before insert on public.landing_waitlist
  for each row execute function private.landing_waitlist_fill();

alter table public.landing_waitlist enable row level security;
create policy "landing_waitlist: dono le" on public.landing_waitlist
  for select to authenticated using (user_id = (select auth.uid()));
create policy "landing_waitlist: dono se inscreve" on public.landing_waitlist
  for insert to authenticated
  with check (user_id = (select auth.uid()) and workspace_id in (select private.workspace_ids()));
grant select on public.landing_waitlist to authenticated;
grant insert (workspace_id, user_id, use_case) on public.landing_waitlist to authenticated;
grant select on public.landing_waitlist to service_role;

create table public.landing_waitlist_visits (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  visited_at timestamptz not null default now()
);
comment on table public.landing_waitlist_visits is 'Visitas à página "Landing pages · em breve". Só cresce.';
create index landing_waitlist_visits_workspace_idx on public.landing_waitlist_visits (workspace_id, visited_at desc);

alter table public.landing_waitlist_visits enable row level security;
create policy "landing_waitlist_visits: membro registra" on public.landing_waitlist_visits
  for insert to authenticated with check (workspace_id in (select private.workspace_ids()));
grant insert (workspace_id) on public.landing_waitlist_visits to authenticated;
grant select on public.landing_waitlist_visits to service_role;
