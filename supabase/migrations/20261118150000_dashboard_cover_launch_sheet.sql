-- =============================================================================
-- VYZ · Capa do dashboard e planilha do lançamento (visuais com capa, como o Fachada)
--
-- cover: {"path":"<workspace_id>/capa-xxxx.png","fit":"recorte"|"foto","address":"Av. ..."}
--   path é o arquivo no bucket dashboard-covers; sem path, a ilustração padrão.
-- dashboard_launch_sheets: a planilha do Google ligada ao dashboard (uma por dashboard),
--   com o que ela trouxe na última leitura. Só contagens (nada de dado pessoal). Quem
--   grava é o servidor (chave de serviço), depois de conferir papel e plano; membros leem.
-- =============================================================================

alter table public.dashboards
  add column cover jsonb not null default '{}'::jsonb
  check (jsonb_typeof(cover) = 'object' and pg_column_size(cover) <= 2048);

comment on column public.dashboards.cover is
  'Capa (visuais com capa): arquivo da imagem em dashboard-covers, recorte ou foto e o endereço. {} = padrão.';

-- quem já edita o dashboard (member+, pela política existente) também troca a capa
grant update (cover) on public.dashboards to authenticated;

create table public.dashboard_launch_sheets (
  dashboard_id uuid primary key references public.dashboards (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  link text not null check (link like 'https://docs.google.com/spreadsheets/d/%' and length(link) <= 600),
  spreadsheet_id text not null check (spreadsheet_id ~ '^[A-Za-z0-9_-]{20,120}$'),
  gid text not null check (gid ~ '^[0-9]{1,12}$'),
  -- "service": lida pela conta de serviço (planilha fechada); "link": aberta por link
  via text not null check (via in ('service', 'link')),
  rows jsonb not null default '[]'::jsonb check (jsonb_typeof(rows) = 'array' and pg_column_size(rows) <= 4194304),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  read_at timestamptz,
  -- última releitura que falhou (link fechado, linha inválida): a tela mostra; null = deu certo
  last_error text check (length(last_error) <= 500),
  last_attempt_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.dashboard_launch_sheets is 'Planilha do lançamento ligada a um dashboard: link do Google Sheets e as linhas (só contagens) da última leitura.';
create index dashboard_launch_sheets_workspace_idx on public.dashboard_launch_sheets (workspace_id);
create index dashboard_launch_sheets_due_idx on public.dashboard_launch_sheets (last_attempt_at nulls first);

alter table public.dashboard_launch_sheets enable row level security;
create policy "dashboard_launch_sheets: membros leem" on public.dashboard_launch_sheets
  for select to authenticated using (workspace_id in (select private.workspace_ids()));
grant select on public.dashboard_launch_sheets to authenticated;

-- ---- bucket das capas ---------------------------------------------------------------------
-- Público para leitura (a capa aparece no link compartilhado). O envio é feito pelo servidor
-- depois de conferir o papel; as políticas abaixo valem para quem usar o cliente direto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dashboard-covers', 'dashboard-covers', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "dashboard-covers: membros listam a pasta do workspace" on storage.objects
  for select to authenticated
  using (bucket_id = 'dashboard-covers' and (storage.foldername(name))[1] in (select w::text from private.workspace_ids() as w));
create policy "dashboard-covers: membros apagam" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dashboard-covers' and (storage.foldername(name))[1] in (select w::text from private.workspace_ids('member') as w));
