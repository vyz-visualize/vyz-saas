-- =============================================================================
-- VYZ · Guias do primeiro acesso, por pessoa
-- O tour do primeiro dashboard (dashboard_tour) e os lembretes de conexão
-- (nudge:meta, nudge:google). Uma linha por pessoa e guia:
--   done     = terminou (o tour não volta)
--   skipped  = pulou (o tour não volta)
--   snoozed  = "Agora não" num lembrete: volta depois de snoozed_until
-- O limite de um lembrete por sessão fica no navegador (sessionStorage).
-- =============================================================================

create table public.user_guides (
  user_id uuid not null references public.profiles (id) on delete cascade,
  guide text not null check (guide ~ '^[a-z0-9_:-]{1,60}$'),
  status text not null check (status in ('done', 'skipped', 'snoozed')),
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, guide),
  check ((status = 'snoozed') = (snoozed_until is not null))
);

comment on table public.user_guides is
  'Guias do primeiro acesso de cada pessoa: tour do primeiro dashboard e lembretes de conexão. Vale em qualquer workspace.';
comment on column public.user_guides.snoozed_until is 'Só em snoozed: o lembrete volta a aparecer depois desta data.';

alter table public.user_guides enable row level security;

-- cada pessoa só vê e grava os próprios guias
create policy "user_guides: ler os proprios" on public.user_guides
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_guides: gravar os proprios" on public.user_guides
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "user_guides: editar os proprios" on public.user_guides
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "user_guides: apagar os proprios" on public.user_guides
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.user_guides to authenticated;

create trigger user_guides_touch before update on public.user_guides
  for each row execute function private.touch_updated_at();
