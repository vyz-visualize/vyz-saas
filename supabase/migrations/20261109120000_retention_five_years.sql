-- =============================================================================
-- VYZ · Retenção de 5 anos: aceites de termos, atividade e auditoria
--   Cumpre o "até 5 anos" da página /exclusao-de-dados. Roda na limpeza diária
--   que já existe (vyz-housekeeping, 06:00 UTC), sem job novo.
--
--   Começa em SIMULAÇÃO: só conta as linhas com mais de 5 anos e registra em
--   private.retention_runs; nada é apagado. Para liberar (numa migração nova):
--     update private.retention_policy set apply = true, updated_at = now();
--   (ou só para uma tabela, com where table_name = '...').
--
--   Por que por linha, se a auditoria e a atividade já perdem partições inteiras
--   (60 e 13 meses)? O que cai na partição padrão (*_default) nunca é derrubado
--   por partição, e os aceites (legal_acceptances) nem são particionados.
-- =============================================================================

create table private.retention_policy (
  table_name text primary key check (table_name in ('legal_acceptances', 'activity_events', 'audit_events')),
  keep interval not null check (keep between interval '6 months' and interval '10 years'),
  apply boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on table private.retention_policy is 'Retenção por linha (housekeeping). apply = false: só conta e registra; true: apaga o que passou do prazo.';

insert into private.retention_policy (table_name, keep, apply) values
  ('legal_acceptances', interval '5 years', false),
  ('activity_events', interval '5 years', false),
  ('audit_events', interval '5 years', false);

create table private.retention_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  table_name text not null,
  mode text not null check (mode in ('simulacao', 'exclusao')),
  cutoff timestamptz not null,
  rows_found integer not null default 0 check (rows_found >= 0),
  error text
);
comment on table private.retention_runs is 'Cada execução da retenção de 5 anos: quantas linhas passaram do prazo e se foram apagadas (exclusao) ou só contadas (simulacao). Guardado por 2 anos.';
create index retention_runs_ran_at_idx on private.retention_runs (ran_at desc);

-- só o banco (a limpeza diária e quem administra) lê e escreve
alter table private.retention_policy enable row level security;
alter table private.retention_runs enable row level security;
revoke all on private.retention_policy, private.retention_runs from public, anon, authenticated, service_role;

-- Conta (simulação) ou apaga (liberada) o que passou do prazo, tabela por tabela.
-- Uma falha numa tabela fica registrada e não para as outras.
create function private.apply_retention()
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
  v_out jsonb := '{}'::jsonb;
begin
  for r in select p.table_name, p.keep, p.apply from private.retention_policy p order by p.table_name loop
    v_cutoff := now() - r.keep;
    v_mode := case when r.apply then 'exclusao' else 'simulacao' end;
    begin
      if r.apply then
        execute format('delete from public.%I where created_at < $1', r.table_name) using v_cutoff;
        get diagnostics v_n = row_count;
      else
        execute format('select count(*)::integer from public.%I where created_at < $1', r.table_name) into v_n using v_cutoff;
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

-- A mesma limpeza diária de 20261030010000_hardening.sql, com a retenção de 5 anos no fim.
-- Cada etapa isolada: uma falha vira aviso no resultado e não desfaz as outras.
create or replace function private.housekeeping()
returns jsonb
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_out jsonb := '{}'::jsonb;
  v_n integer;
  v_dropped integer := 0;
  r record;
begin
  begin
    update public.checkout_sessions set status = 'expired' where status = 'open' and expires_at < now();
    get diagnostics v_n = row_count;
    v_out := v_out || jsonb_build_object('expired_checkouts', v_n);
  exception when others then
    v_out := v_out || jsonb_build_object('expired_checkouts_error', sqlerrm);
    raise warning 'vyz housekeeping (checkouts): %', sqlerrm;
  end;

  begin
    delete from public.oauth_states where expires_at < now() - interval '1 day';
    get diagnostics v_n = row_count;
    v_out := v_out || jsonb_build_object('oauth_states_deleted', v_n);
  exception when others then
    v_out := v_out || jsonb_build_object('oauth_states_error', sqlerrm);
    raise warning 'vyz housekeeping (oauth): %', sqlerrm;
  end;

  begin
    delete from public.rate_limits where window_start < now() - interval '1 day';
    get diagnostics v_n = row_count;
    v_out := v_out || jsonb_build_object('rate_limit_windows_deleted', v_n);
  exception when others then
    v_out := v_out || jsonb_build_object('rate_limits_error', sqlerrm);
    raise warning 'vyz housekeeping (rate_limits): %', sqlerrm;
  end;

  begin
    update public.sync_runs
      set status = 'failed', error = coalesce(error, 'Tempo esgotado'), finished_at = now()
      where status in ('queued', 'running') and created_at < now() - interval '2 hours';
    get diagnostics v_n = row_count;
    v_out := v_out || jsonb_build_object('stuck_syncs_failed', v_n);
  exception when others then
    v_out := v_out || jsonb_build_object('stuck_syncs_error', sqlerrm);
    raise warning 'vyz housekeeping (sync_runs): %', sqlerrm;
  end;

  -- retenção: auditoria 5 anos (prazo fiscal), acessos 2 anos, atividade 13 meses
  for r in
    select * from (values
      ('public.audit_events'::regclass, 60),
      ('public.auth_events'::regclass, 24),
      ('public.activity_events'::regclass, 13)
    ) as t (parent, keep_months)
  loop
    begin
      perform private.ensure_monthly_partitions(r.parent, 3);
    exception when others then
      v_out := v_out || jsonb_build_object(r.parent::text || ':partitions_error', sqlerrm);
      raise warning 'vyz housekeeping (partições de %): %', r.parent, sqlerrm;
    end;
    begin
      v_dropped := v_dropped + private.drop_old_partitions(r.parent, r.keep_months);
    exception when others then
      v_out := v_out || jsonb_build_object(r.parent::text || ':retention_error', sqlerrm);
      raise warning 'vyz housekeeping (retenção de %): %', r.parent, sqlerrm;
    end;
  end loop;

  -- retenção de 5 anos por linha (aceites, atividade, auditoria): em simulação até ser liberada
  begin
    v_out := v_out || jsonb_build_object('retention_5y', private.apply_retention());
  exception when others then
    v_out := v_out || jsonb_build_object('retention_5y_error', sqlerrm);
    raise warning 'vyz housekeeping (retenção de 5 anos): %', sqlerrm;
  end;

  return v_out || jsonb_build_object('partitions_dropped', v_dropped);
end;
$$;
revoke all on function private.housekeeping() from public;
