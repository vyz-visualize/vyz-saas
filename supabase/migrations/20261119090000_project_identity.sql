-- Identidade de cada workspace (tabela projects): cor e logo.
-- A cor e a logo identificam o workspace no painel (menu, seletor, listas, cabeçalho); a logo
-- também vai para os dashboards desse cliente, no lugar da logo da organização.
-- A logo fica no bucket brand-assets, dentro da pasta da organização:
--   <workspace_id>/projects/<project_id>/logo-<16 hex>.<png|jpg|webp>
-- (o servidor grava com a chave de serviço depois de autorizar; a exclusão da organização já
-- apaga a pasta inteira). Quem edita o workspace (member com acesso a ele) troca as duas.

alter table public.projects
  add column color text,
  add column logo_path text;

alter table public.projects
  add constraint projects_color_hex check (color is null or color ~ '^#[0-9a-f]{6}$'),
  -- só um caminho gravado pelo servidor, na pasta deste workspace
  add constraint projects_logo_path_own check (
    logo_path is null
    or logo_path ~ ('^' || workspace_id::text || '/projects/' || id::text || '/logo-[0-9a-f]{16}\.(png|jpg|webp)$')
  );

comment on column public.projects.color is 'Cor do workspace no painel (#rrggbb, minúsculas). Sem cor, a padrão.';
comment on column public.projects.logo_path is 'Logo do workspace no bucket brand-assets (<workspace_id>/projects/<id>/logo-...): painel e dashboards do cliente.';
