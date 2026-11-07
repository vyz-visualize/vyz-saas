-- =============================================================================
-- VYZ · Relatórios pelo WhatsApp da VYZ (planos com whatsappReports)
--   whatsapp_subscriptions        número verificado de cada membro, relatórios escolhidos e opt-in (LGPD)
--   whatsapp_messages             registro de tudo que entra e sai (status do Meta ou "simulado")
--   whatsapp_verification_codes   código de 6 dígitos (só o hash), validade e tentativas
-- Quem grava é o servidor (service_role). O usuário lê e ajusta só o que é dele.
-- =============================================================================

create table public.whatsapp_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  verified_at timestamptz,
  opted_in_at timestamptz,
  opt_in_source text check (opt_in_source in ('painel', 'whatsapp')),
  opted_out_at timestamptz,
  reports text[] not null default array['boas-vindas', 'diario', 'semanal', 'alertas']::text[]
    check (reports <@ array['boas-vindas', 'diario', 'semanal', 'alertas']::text[]),
  paused boolean not null default false,
  welcome_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
comment on table public.whatsapp_subscriptions is 'Relatórios pelo WhatsApp de um membro do workspace. opted_in_at/opt_in_source = consentimento (LGPD); opted_out_at = respondeu PARAR.';
create index whatsapp_subscriptions_phone_idx on public.whatsapp_subscriptions (phone);
create trigger whatsapp_subscriptions_touch before update on public.whatsapp_subscriptions for each row execute function private.touch_updated_at();

alter table public.whatsapp_subscriptions enable row level security;
create policy "whatsapp_subscriptions: o proprio usuario le" on public.whatsapp_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "whatsapp_subscriptions: o dono do workspace le" on public.whatsapp_subscriptions
  for select to authenticated using (workspace_id in (select private.workspace_ids('owner')));
create policy "whatsapp_subscriptions: o proprio usuario ajusta" on public.whatsapp_subscriptions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "whatsapp_subscriptions: o proprio usuario remove" on public.whatsapp_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.whatsapp_subscriptions to authenticated;
-- número, verificação e consentimento só pelo servidor; a pessoa escolhe os relatórios e pausa
grant update (reports, paused) on public.whatsapp_subscriptions to authenticated;

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.whatsapp_subscriptions (id) on delete cascade,
  direction text not null check (direction in ('out', 'in')),
  kind text not null check (kind in ('codigo', 'boas-vindas', 'diario', 'semanal', 'alertas', 'teste', 'texto', 'resposta')),
  template text,
  status text not null check (status in ('sent', 'delivered', 'read', 'failed', 'simulado', 'received')),
  provider_message_id text unique,
  ref_key text,
  body text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.whatsapp_messages is 'Mensagens do WhatsApp da VYZ. ref_key = chave do alerta (sem repetir em 24 h).';
create index whatsapp_messages_sub_idx on public.whatsapp_messages (subscription_id, created_at desc);
create trigger whatsapp_messages_touch before update on public.whatsapp_messages for each row execute function private.touch_updated_at();

alter table public.whatsapp_messages enable row level security;
create policy "whatsapp_messages: o dono da inscricao le" on public.whatsapp_messages
  for select to authenticated using (
    subscription_id in (select s.id from public.whatsapp_subscriptions s where s.user_id = (select auth.uid()))
  );
grant select on public.whatsapp_messages to authenticated;

create table public.whatsapp_verification_codes (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.whatsapp_subscriptions (id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.whatsapp_verification_codes is 'Código de verificação do número (sha256 com segredo). Só service_role.';
create index whatsapp_verification_codes_sub_idx on public.whatsapp_verification_codes (subscription_id, created_at desc);
alter table public.whatsapp_verification_codes enable row level security;
-- sem políticas: só o servidor (service_role) lê e grava

grant all on public.whatsapp_subscriptions, public.whatsapp_messages, public.whatsapp_verification_codes to service_role;
