-- Auditoria (audit_events) nas tabelas de dado do usuário que ainda não
-- tinham gatilho: tarefas do A Fazer, inscrição no WhatsApp e lista de espera
-- das landing pages. Mesma função das demais (private.audit_row_change):
-- quem, quando, antes e depois.

-- Tarefas: marcar como vista (seen_at) não é mudança de dado; o resto entra.
create trigger audit after insert or delete on public.tasks
  for each row execute function private.audit_row_change('workspace_id', 'id');
create trigger audit_update after update on public.tasks
  for each row
  when ((to_jsonb(new) - 'seen_at' - 'updated_at') is distinct from (to_jsonb(old) - 'seen_at' - 'updated_at'))
  execute function private.audit_row_change('workspace_id', 'id');

-- WhatsApp: o número é dado pessoal, fica mascarado (registra só que mudou).
create trigger audit after insert or update or delete on public.whatsapp_subscriptions
  for each row execute function private.audit_row_change('workspace_id', 'id', 'phone');

-- Lista de espera: e-mail mascarado pelo mesmo motivo.
create trigger audit after insert or update or delete on public.landing_waitlist
  for each row execute function private.audit_row_change('workspace_id', 'id', 'email');
