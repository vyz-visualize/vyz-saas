-- =============================================================================
-- VYZ · CRM com dados reais
-- O login de cada CRM (RD Station CRM, HubSpot, Pipedrive, Kommo) já descobre a
-- conta: uma linha em ad_accounts (platform_id do CRM). Aqui entram os números:
-- por conta, dia e etapa do funil.
--
-- Desenho (uma tabela só, no padrão do armazém):
--   * a linha da etapa '*' é o total do dia: leads novos (contatos criados no dia),
--     negócios criados no dia (todos), ganhos e perdidos no dia (pela data de
--     fechamento) e a receita ganha;
--   * as outras linhas são as etapas do funil (nome da etapa no CRM): negócios
--     criados no dia que estão abertos nessa etapa hoje, e o valor deles. A ordem
--     da etapa (stage_order) desenha o funil na ordem do CRM.
-- Assim o dashboard soma leads, negócios, ganhos e receita sem contar duas vezes,
-- e monta o funil pelas etapas. A sincronização relê sempre os últimos 90 dias
-- (os negócios mudam de etapa depois de criados).
--
-- Escrita só pelo service_role (sincronização). Membros do workspace leem.
-- =============================================================================

create table public.crm_daily (
  workspace_id uuid not null,
  ad_account_id uuid not null,
  date date not null,
  -- '*' = total do dia; senão, o nome da etapa no CRM
  stage text not null check (char_length(stage) between 1 and 120),
  stage_order integer not null default 0,
  deals integer not null default 0 check (deals >= 0),
  value numeric(14, 2) not null default 0 check (value >= 0),
  won integer not null default 0 check (won >= 0),
  won_value numeric(14, 2) not null default 0 check (won_value >= 0),
  lost integer not null default 0 check (lost >= 0),
  leads integer not null default 0 check (leads >= 0),
  synced_at timestamptz not null default now(),
  primary key (ad_account_id, date, stage),
  foreign key (workspace_id, ad_account_id) references public.ad_accounts (workspace_id, id) on delete cascade
);
comment on table public.crm_daily is 'CRM por conta, dia e etapa: leads, negócios, ganhos, perdidos e valores (etapa ''*'' = total do dia).';
create index crm_daily_workspace_idx on public.crm_daily (workspace_id, date);

alter table public.crm_daily enable row level security;
create policy "crm_daily: membros leem" on public.crm_daily for select to authenticated using (workspace_id in (select private.workspace_ids()));
grant select on public.crm_daily to authenticated;
