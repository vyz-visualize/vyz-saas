-- =============================================================================
-- VYZ · Base de dados para MMM (Marketing Mix Modeling) — docs/MMM.md
--   Schema próprio (mmm), organizado por workspace: workspace_id e ad_account_id
--   em todas as linhas por cliente, leitura só de membros do workspace (RLS) e
--   escrita só pelo service_role. O schema NÃO é exposto na API do Supabase: o
--   servidor fala com ele pelas funções public.mmm_* (execute só para service_role).
--
--   Camadas: raw_insights (bruto, imutável, partição por mês) → media_daily
--   (tratado, campanha × dia) → daily (pronto para análise, conta × dia × canal),
--   mais outcomes_daily (resultado do negócio), calendario (global) e eventos.
--   A carga do histórico (37 meses) passa pela fila backfill_jobs, ligada e
--   pausada por backfill_control (começa desligada).
--
--   Retenção: bruto 13 meses (derrubada de partição); tratado enquanto o contrato
--   estiver ativo + 90 dias (private.retention_policy, regra "contrato").
-- =============================================================================

create schema mmm;
comment on schema mmm is 'Base de MMM (docs/MMM.md). Fora da API: o servidor usa as funções public.mmm_*.';
revoke all on schema mmm from public, anon;
grant usage on schema mmm to authenticated, service_role;

-- ---- calendário (global) ----------------------------------------------------------------------

create table mmm.calendario (
  data date not null,
  evento text not null check (length(evento) between 2 and 80),
  tipo text not null check (tipo in ('feriado', 'sazonal')),
  primary key (data, evento)
);
comment on table mmm.calendario is 'Feriados nacionais e datas sazonais do varejo no Brasil (variáveis externas do MMM). Global: todos leem.';

-- ---- bruto: a resposta da API como veio ------------------------------------------------------

create table mmm.raw_insights (
  id bigint generated always as identity,
  workspace_id uuid not null,
  ad_account_id uuid not null,
  platform_id text not null check (platform_id in ('meta', 'google')),
  level text not null default 'campaign' check (level = 'campaign'),
  date_from date not null,
  date_to date not null check (date_to >= date_from),
  request_hash text not null check (length(request_hash) between 8 and 128),
  payload jsonb not null,
  requested_by uuid references auth.users (id) on delete set null,
  -- a data da busca é a chave da partição (retenção de 13 meses por partição)
  created_at timestamptz not null default now(),
  primary key (id, created_at),
  foreign key (workspace_id, ad_account_id) references public.ad_accounts (workspace_id, id) on delete cascade
) partition by range (created_at);
comment on table mmm.raw_insights is 'Resposta bruta das APIs (campanha × dia), imutável. Partição por mês em private.raw_insights_AAAA_MM; 13 meses.';
create index raw_insights_account_idx on mmm.raw_insights (ad_account_id, date_from);
create table private.raw_insights_default partition of mmm.raw_insights default;
select private.ensure_monthly_partitions('mmm.raw_insights'::regclass, 3);

-- ---- tratado: campanha × dia, moeda e fuso normalizados --------------------------------------

create table mmm.media_daily (
  workspace_id uuid not null,
  ad_account_id uuid not null,
  platform_id text not null check (platform_id in ('meta', 'google')),
  -- o id externo mantém o histórico mesmo depois que a campanha sai da plataforma
  campaign_external_id text not null check (length(campaign_external_id) between 1 and 64),
  campaign_name text,
  date date not null,
  canal text not null check (length(canal) between 2 and 40),
  moeda text not null default 'BRL' check (moeda ~ '^[A-Z]{3}$'),
  spend numeric(14, 2) not null default 0 check (spend >= 0),
  spend_brl numeric(14, 2) check (spend_brl >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  conversions numeric(14, 2) not null default 0 check (conversions >= 0),
  conversion_value numeric(14, 2) not null default 0 check (conversion_value >= 0),
  origem text not null check (origem in ('sync', 'backfill')),
  synced_at timestamptz not null default now(),
  primary key (ad_account_id, campaign_external_id, date),
  foreign key (workspace_id, ad_account_id) references public.ad_accounts (workspace_id, id) on delete cascade
);
comment on table mmm.media_daily is 'Mídia tratada para o MMM: investimento, impressões, cliques, conversões e receita por campanha e dia (no fuso da conta).';
create index media_daily_workspace_date_idx on mmm.media_daily (workspace_id, date);

-- ---- resultado do negócio (GA4, CRM, planilha) -----------------------------------------------

create table mmm.outcomes_daily (
  workspace_id uuid not null,
  ad_account_id uuid not null,
  fonte text not null check (fonte in ('ga4', 'crm', 'planilha')),
  date date not null,
  receita numeric(14, 2) not null default 0 check (receita >= 0),
  pedidos numeric(14, 2) not null default 0 check (pedidos >= 0),
  leads numeric(14, 2) not null default 0 check (leads >= 0),
  synced_at timestamptz not null default now(),
  primary key (ad_account_id, fonte, date),
  foreign key (workspace_id, ad_account_id) references public.ad_accounts (workspace_id, id) on delete cascade
);
comment on table mmm.outcomes_daily is 'Resultado do negócio por dia (GA4, CRM ou planilha): a variável que o MMM explica.';
create index outcomes_daily_workspace_date_idx on mmm.outcomes_daily (workspace_id, date);

-- ---- eventos do cliente (promoção, preço, estoque) -------------------------------------------

create table mmm.eventos (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- null: vale para o negócio todo; com conta, só para ela (cascata quando a conta sai)
  ad_account_id uuid,
  inicio date not null,
  fim date not null check (fim >= inicio),
  tipo text not null check (tipo in ('promocao', 'preco', 'estoque', 'lancamento', 'outro')),
  descricao text not null check (length(descricao) between 2 and 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, ad_account_id) references public.ad_accounts (workspace_id, id) on delete cascade
);
comment on table mmm.eventos is 'Eventos do cliente que mexem nos resultados (promoção, preço, estoque). Entra em SHELL_PURGE_ORDER: fica pendurado no workspace.';
create index eventos_workspace_idx on mmm.eventos (workspace_id, inicio);

-- ---- pronto para análise: conta × dia × canal ------------------------------------------------

create table mmm.daily (
  workspace_id uuid not null,
  ad_account_id uuid not null,
  data date not null,
  canal text not null,
  investimento numeric(14, 2) not null default 0,
  impressoes bigint not null default 0,
  cliques bigint not null default 0,
  conversoes numeric(14, 2) not null default 0,
  receita numeric(14, 2) not null default 0,
  -- do calendário: feriado nacional e data sazonal do dia
  feriado boolean not null default false,
  sazonal text,
  atualizado_em timestamptz not null default now(),
  primary key (ad_account_id, data, canal),
  foreign key (workspace_id, ad_account_id) references public.ad_accounts (workspace_id, id) on delete cascade
);
comment on table mmm.daily is 'Base pronta para o MMM, recalculada por mmm.rollup_daily depois de cada carga.';
create index daily_workspace_data_idx on mmm.daily (workspace_id, data);

-- ---- fila da carga do histórico --------------------------------------------------------------

create table mmm.backfill_jobs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null,
  ad_account_id uuid not null,
  platform_id text not null check (platform_id in ('meta', 'google')),
  mes date not null check (mes = date_trunc('month', mes)::date),
  status text not null default 'pendente' check (status in ('pendente', 'rodando', 'aguardando', 'concluido', 'erro')),
  tentativas smallint not null default 0 check (tentativas >= 0),
  erro text check (length(erro) <= 500),
  -- Meta: o relatório assíncrono em andamento (a próxima rodada busca o resultado)
  report_run_id text check (report_run_id ~ '^[0-9]{1,32}$'),
  linhas integer check (linhas >= 0),
  requested_by uuid references auth.users (id) on delete set null,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_account_id, mes),
  foreign key (workspace_id, ad_account_id) references public.ad_accounts (workspace_id, id) on delete cascade
);
comment on table mmm.backfill_jobs is 'Carga do histórico (conta × mês, só campanha). Processada pelo /api/cron/sync quando backfill_control.ativo.';
create index backfill_jobs_fila_idx on mmm.backfill_jobs (status, mes desc) where status in ('pendente', 'aguardando', 'erro');

create table mmm.backfill_control (
  id boolean primary key default true check (id),
  ativo boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
comment on table mmm.backfill_control is 'Liga e pausa a carga do histórico (uma linha). Começa desligada.';
insert into mmm.backfill_control (ativo) values (false);

-- ---- RLS: membros leem, só o service_role escreve --------------------------------------------

alter table mmm.calendario enable row level security;
alter table mmm.raw_insights enable row level security;
alter table mmm.media_daily enable row level security;
alter table mmm.outcomes_daily enable row level security;
alter table mmm.eventos enable row level security;
alter table mmm.daily enable row level security;
alter table mmm.backfill_jobs enable row level security;
alter table mmm.backfill_control enable row level security;

create policy "calendário: todos leem" on mmm.calendario for select to authenticated using (true);
create policy "bruto: membros leem" on mmm.raw_insights for select to authenticated using (workspace_id = any (array(select private.workspace_ids())));
create policy "mídia: membros leem" on mmm.media_daily for select to authenticated using (workspace_id = any (array(select private.workspace_ids())));
create policy "resultados: membros leem" on mmm.outcomes_daily for select to authenticated using (workspace_id = any (array(select private.workspace_ids())));
create policy "eventos: membros leem" on mmm.eventos for select to authenticated using (workspace_id = any (array(select private.workspace_ids())));
create policy "mmm diário: membros leem" on mmm.daily for select to authenticated using (workspace_id = any (array(select private.workspace_ids())));
create policy "fila: membros leem" on mmm.backfill_jobs for select to authenticated using (workspace_id = any (array(select private.workspace_ids())));

revoke all on all tables in schema mmm from public, anon, authenticated;
grant select on mmm.calendario, mmm.raw_insights, mmm.media_daily, mmm.outcomes_daily, mmm.eventos, mmm.daily, mmm.backfill_jobs to authenticated;
grant all on all tables in schema mmm to service_role;
grant usage, select on all sequences in schema mmm to service_role;

-- ---- recálculo da base pronta ----------------------------------------------------------------

create function mmm.rollup_daily(p_workspace_id uuid, p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if p_to < p_from or p_to - p_from > 1200 then
    raise exception using errcode = 'P0001', message = 'mmm:invalid_range';
  end if;
  delete from mmm.daily d where d.workspace_id = p_workspace_id and d.data between p_from and p_to;
  insert into mmm.daily (workspace_id, ad_account_id, data, canal, investimento, impressoes, cliques, conversoes, receita, feriado, sazonal)
  select m.workspace_id, m.ad_account_id, m.date, m.canal,
         sum(coalesce(m.spend_brl, m.spend)), sum(m.impressions), sum(m.clicks), sum(m.conversions), sum(m.conversion_value),
         exists (select 1 from mmm.calendario c where c.data = m.date and c.tipo = 'feriado'),
         (select string_agg(c.evento, ', ' order by c.evento) from mmm.calendario c where c.data = m.date and c.tipo = 'sazonal')
  from mmm.media_daily m
  where m.workspace_id = p_workspace_id and m.date between p_from and p_to
  group by m.workspace_id, m.ad_account_id, m.date, m.canal;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function mmm.rollup_daily(uuid, date, date) from public, anon, authenticated;
grant execute on function mmm.rollup_daily(uuid, date, date) to service_role;

-- ---- funções para o servidor (o schema não é exposto: o supabase-js chama estas) -------------

-- Monta a fila: conta × mês das contas Meta e Google ativas, com acesso, nos últimos p_months
-- meses fechados (o mês corrente fica com a sincronização de todo dia). Repetir não duplica.
create function public.mmm_enqueue_backfill(p_months integer default 37, p_requested_by uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if p_months < 1 or p_months > 37 then
    raise exception using errcode = 'P0001', message = 'mmm:invalid_months';
  end if;
  insert into mmm.backfill_jobs (workspace_id, ad_account_id, platform_id, mes, requested_by)
  select a.workspace_id, a.id, a.platform_id::text, (date_trunc('month', now()) - make_interval(months => g))::date, p_requested_by
  from public.ad_accounts a
  join public.workspace_access w on w.workspace_id = a.workspace_id and w.has_access
  join public.connections c on c.id = a.connection_id and c.status = 'active' and not c.is_mock
  cross join generate_series(1, p_months) g
  where a.is_enabled and a.platform_id::text in ('meta', 'google')
  on conflict (ad_account_id, mes) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Liga ou pausa a carga. Devolve a contagem da fila por status.
create function public.mmm_backfill_control(p_ativo boolean default null, p_by uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_ativo is not null then
    update mmm.backfill_control set ativo = p_ativo, updated_by = p_by, updated_at = now() where id;
  end if;
  return jsonb_build_object(
    'ativo', (select ativo from mmm.backfill_control where id),
    'fila', coalesce((select jsonb_object_agg(status, n) from (select status, count(*)::int n from mmm.backfill_jobs group by status) s), '{}'::jsonb)
  );
end;
$$;

-- Pega até p_limit trabalhos para esta rodada (pausada: nenhum). Mais recentes primeiro; o que
-- espera relatório da Meta e o que falhou (até 5 tentativas) voltam; travado há 30 min também.
create function public.mmm_claim_backfill(p_limit integer default 3)
returns table (id bigint, workspace_id uuid, ad_account_id uuid, platform_id text, mes date, status text, tentativas smallint, report_run_id text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (select ativo from mmm.backfill_control where backfill_control.id) then
    return;
  end if;
  return query
  with escolhidos as (
    select j.id from mmm.backfill_jobs j
    where (j.status in ('pendente', 'aguardando') or (j.status = 'erro' and j.tentativas < 5) or (j.status = 'rodando' and j.updated_at < now() - interval '30 minutes'))
    order by (j.status = 'aguardando') desc, j.mes desc, j.id
    limit least(greatest(p_limit, 1), 20)
    for update skip locked
  )
  update mmm.backfill_jobs j
     set status = 'rodando', tentativas = j.tentativas + 1, iniciado_em = coalesce(j.iniciado_em, now()), updated_at = now()
    from escolhidos e
   where j.id = e.id
  returning j.id, j.workspace_id, j.ad_account_id, j.platform_id, j.mes, j.status, j.tentativas, j.report_run_id;
end;
$$;

-- Fim de um trabalho sem gravar dados: aguardando (relatório da Meta em andamento, ou pausa pelo
-- limite da plataforma, que não conta tentativa) ou erro.
create function public.mmm_update_backfill(p_id bigint, p_status text, p_erro text default null, p_report_run_id text default null, p_refund boolean default false)
returns void
language sql
security definer
set search_path = ''
as $$
  update mmm.backfill_jobs
     set status = p_status, erro = left(p_erro, 500), report_run_id = p_report_run_id, updated_at = now(),
         tentativas = case when p_refund and tentativas > 0 then tentativas - 1 else tentativas end
   where id = p_id and p_status in ('aguardando', 'erro', 'pendente');
$$;

-- Grava a carga de um trabalho, de uma vez: o bruto, a mídia tratada (upsert) e o recálculo da
-- base pronta do mês. p_raw: [{date_from, date_to, request_hash, payload}]; p_rows: as linhas de
-- mmm.media_daily (sem workspace, conta e plataforma, que vêm do trabalho).
create function public.mmm_save_backfill(p_id bigint, p_raw jsonb, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  j mmm.backfill_jobs%rowtype;
  v_n integer;
begin
  select * into j from mmm.backfill_jobs where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'mmm:job_not_found';
  end if;
  insert into mmm.raw_insights (workspace_id, ad_account_id, platform_id, date_from, date_to, request_hash, payload, requested_by)
  select j.workspace_id, j.ad_account_id, j.platform_id, (r ->> 'date_from')::date, (r ->> 'date_to')::date, r ->> 'request_hash', r -> 'payload', j.requested_by
  from jsonb_array_elements(coalesce(p_raw, '[]'::jsonb)) r;
  insert into mmm.media_daily (workspace_id, ad_account_id, platform_id, campaign_external_id, campaign_name, date, canal, moeda, spend, spend_brl, impressions, clicks, conversions, conversion_value, origem, synced_at)
  select j.workspace_id, j.ad_account_id, j.platform_id, x.campaign_external_id, x.campaign_name, x.date, x.canal, coalesce(x.moeda, 'BRL'),
         coalesce(x.spend, 0), x.spend_brl, coalesce(x.impressions, 0), coalesce(x.clicks, 0), coalesce(x.conversions, 0), coalesce(x.conversion_value, 0), 'backfill', now()
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x (campaign_external_id text, campaign_name text, date date, canal text, moeda text, spend numeric, spend_brl numeric, impressions bigint, clicks bigint, conversions numeric, conversion_value numeric)
  where x.date >= j.mes and x.date < (j.mes + interval '1 month')::date
  on conflict (ad_account_id, campaign_external_id, date) do update
    set campaign_name = excluded.campaign_name, canal = excluded.canal, moeda = excluded.moeda, spend = excluded.spend, spend_brl = excluded.spend_brl,
        impressions = excluded.impressions, clicks = excluded.clicks, conversions = excluded.conversions, conversion_value = excluded.conversion_value,
        origem = excluded.origem, synced_at = excluded.synced_at;
  get diagnostics v_n = row_count;
  perform mmm.rollup_daily(j.workspace_id, j.mes, (j.mes + interval '1 month' - interval '1 day')::date);
  update mmm.backfill_jobs set status = 'concluido', erro = null, report_run_id = null, linhas = v_n, concluido_em = now(), updated_at = now() where id = p_id;
  return v_n;
end;
$$;

-- Quantas buscas o Google já recebeu hoje pela carga (limite diário de operações do token).
create function public.mmm_google_ops_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from mmm.backfill_jobs
  where platform_id = 'google' and updated_at >= date_trunc('day', now()) and status in ('concluido', 'erro', 'rodando');
$$;

revoke all on function public.mmm_enqueue_backfill(integer, uuid), public.mmm_backfill_control(boolean, uuid), public.mmm_claim_backfill(integer),
  public.mmm_update_backfill(bigint, text, text, text, boolean), public.mmm_save_backfill(bigint, jsonb, jsonb), public.mmm_google_ops_today()
  from public, anon, authenticated;
grant execute on function public.mmm_enqueue_backfill(integer, uuid), public.mmm_backfill_control(boolean, uuid), public.mmm_claim_backfill(integer),
  public.mmm_update_backfill(bigint, text, text, text, boolean), public.mmm_save_backfill(bigint, jsonb, jsonb), public.mmm_google_ops_today()
  to service_role;

-- ---- retenção: bruto 13 meses por partição; tratado até 90 dias depois do contrato ------------

alter table private.retention_policy drop constraint retention_policy_table_name_check;
alter table private.retention_policy drop constraint retention_policy_keep_check;
alter table private.retention_policy
  add column regra text not null default 'linha' check (regra in ('linha', 'particao', 'contrato')),
  add constraint retention_policy_table_name_check check (table_name in (
    'legal_acceptances', 'activity_events', 'audit_events',
    'mmm.raw_insights', 'mmm.media_daily', 'mmm.outcomes_daily', 'mmm.eventos', 'mmm.daily', 'mmm.backfill_jobs'
  )),
  add constraint retention_policy_keep_check check (keep between interval '30 days' and interval '10 years');
comment on column private.retention_policy.regra is 'linha: created_at mais velho que keep; particao: derruba as partições mensais mais velhas que keep; contrato: dados do workspace sem acesso há mais que keep.';

insert into private.retention_policy (table_name, keep, apply, regra) values
  ('mmm.raw_insights', interval '13 months', true, 'particao'),
  ('mmm.media_daily', interval '90 days', true, 'contrato'),
  ('mmm.outcomes_daily', interval '90 days', true, 'contrato'),
  ('mmm.eventos', interval '90 days', true, 'contrato'),
  ('mmm.daily', interval '90 days', true, 'contrato'),
  ('mmm.backfill_jobs', interval '90 days', true, 'contrato');

-- Workspaces cujo contrato acabou há mais que p_keep (sem acesso, e a última assinatura terminou antes).
create function private.contract_ended(p_keep interval)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select w.id
  from public.workspaces w
  join public.workspace_access a on a.workspace_id = w.id
  where not a.has_access
    and coalesce(
      (select max(coalesce(s.ended_at, s.canceled_at, s.current_period_end)) from public.subscriptions s where s.workspace_id = w.id),
      w.created_at
    ) < now() - p_keep;
$$;
revoke all on function private.contract_ended(interval) from public, anon, authenticated, service_role;

create or replace function private.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '5s'
set timezone = 'UTC'
as $$
declare
  r record;
  v_cutoff timestamptz;
  v_mode text;
  v_n integer;
  v_months integer;
  v_schema text;
  v_table text;
  v_out jsonb := '{}'::jsonb;
begin
  for r in select p.table_name, p.keep, p.apply, p.regra from private.retention_policy p order by p.table_name loop
    v_cutoff := now() - r.keep;
    v_mode := case when r.apply then 'exclusao' else 'simulacao' end;
    v_schema := case when position('.' in r.table_name) > 0 then split_part(r.table_name, '.', 1) else 'public' end;
    v_table := case when position('.' in r.table_name) > 0 then split_part(r.table_name, '.', 2) else r.table_name end;
    begin
      if r.regra = 'particao' then
        v_months := (extract(year from r.keep) * 12 + extract(month from r.keep))::integer;
        perform private.ensure_monthly_partitions(format('%I.%I', v_schema, v_table)::regclass, 3);
        if r.apply then
          v_n := private.drop_old_partitions(format('%I.%I', v_schema, v_table)::regclass, v_months);
        else
          execute format('select count(*)::integer from %I.%I where created_at < $1', v_schema, v_table)
            into v_n using date_trunc('month', now()) - make_interval(months => v_months);
        end if;
      elsif r.regra = 'contrato' then
        if r.apply then
          execute format('delete from %I.%I t where t.workspace_id in (select private.contract_ended($1))', v_schema, v_table) using r.keep;
          get diagnostics v_n = row_count;
        else
          execute format('select count(*)::integer from %I.%I t where t.workspace_id in (select private.contract_ended($1))', v_schema, v_table) into v_n using r.keep;
        end if;
      elsif r.apply then
        execute format('delete from %I.%I where created_at < $1', v_schema, v_table) using v_cutoff;
        get diagnostics v_n = row_count;
      else
        execute format('select count(*)::integer from %I.%I where created_at < $1', v_schema, v_table) into v_n using v_cutoff;
      end if;
      insert into private.retention_runs (table_name, mode, cutoff, rows_found) values (r.table_name, v_mode, v_cutoff, v_n);
      v_out := v_out || jsonb_build_object(r.table_name, jsonb_build_object('mode', v_mode, 'rows', v_n));
    exception when others then
      insert into private.retention_runs (table_name, mode, cutoff, error) values (r.table_name, v_mode, v_cutoff, left(sqlerrm, 500));
      v_out := v_out || jsonb_build_object(r.table_name, jsonb_build_object('mode', v_mode, 'error', sqlerrm));
      raise warning 'vyz retenção (%): %', r.table_name, sqlerrm;
    end;
  end loop;
  delete from private.retention_runs where ran_at < now() - interval '2 years';
  return v_out;
end;
$$;
revoke all on function private.apply_retention() from public, anon, authenticated, service_role;

-- ---- calendário 2023–2027: feriados nacionais e datas sazonais -------------------------------

insert into mmm.calendario (data, evento, tipo)
select make_date(y, m, d), nome, 'feriado'
from generate_series(2023, 2027) y
cross join (values
  (1, 1, 'Confraternização Universal'),
  (4, 21, 'Tiradentes'),
  (5, 1, 'Dia do Trabalho'),
  (9, 7, 'Independência do Brasil'),
  (10, 12, 'Nossa Senhora Aparecida'),
  (11, 2, 'Finados'),
  (11, 15, 'Proclamação da República'),
  (12, 25, 'Natal')
) as f (m, d, nome);

-- Consciência Negra: feriado nacional desde 2024 (Lei 14.759/2023)
insert into mmm.calendario (data, evento, tipo)
select make_date(y, 11, 20), 'Consciência Negra', 'feriado' from generate_series(2024, 2027) y;

-- móveis: a partir da Páscoa (Carnaval, Sexta-feira Santa, Corpus Christi)
insert into mmm.calendario (data, evento, tipo)
select p + o, nome, 'feriado'
from (values (date '2023-04-09'), (date '2024-03-31'), (date '2025-04-20'), (date '2026-04-05'), (date '2027-03-28')) as e (p)
cross join (values (-48, 'Carnaval (segunda)'), (-47, 'Carnaval (terça)'), (-2, 'Sexta-feira Santa'), (60, 'Corpus Christi')) as x (o, nome);

-- sazonais do varejo
insert into mmm.calendario (data, evento, tipo)
select make_date(y, 3, 15), 'Dia do Consumidor', 'sazonal' from generate_series(2023, 2027) y
union all
-- Dia das Mães: 2º domingo de maio
select make_date(y, 5, 1) + ((7 - extract(dow from make_date(y, 5, 1))::int) % 7) + 7, 'Dia das Mães', 'sazonal' from generate_series(2023, 2027) y
union all
-- Dia dos Pais: 2º domingo de agosto
select make_date(y, 8, 1) + ((7 - extract(dow from make_date(y, 8, 1))::int) % 7) + 7, 'Dia dos Pais', 'sazonal' from generate_series(2023, 2027) y
union all
-- Black Friday: a sexta depois da 4ª quinta-feira de novembro
select make_date(y, 11, 1) + ((4 - extract(dow from make_date(y, 11, 1))::int + 7) % 7) + 22, 'Black Friday', 'sazonal' from generate_series(2023, 2027) y
union all
select make_date(y, 12, 25), 'Natal (vendas)', 'sazonal' from generate_series(2023, 2027) y;
