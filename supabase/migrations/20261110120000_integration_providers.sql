-- Logins das demais plataformas: GA4, TikTok, LinkedIn, Mercado Livre e os
-- CRMs (RD Station, HubSpot, Pipedrive, Kommo). Só acrescenta valores ao enum:
-- conexões e contas existentes (meta, google) não mudam. As plataformas novas
-- (pipedrive, kommo) e o oauth_provider de cada uma entram pelo npm run db:catalog.

alter type public.integration_provider add value if not exists 'ga4';
alter type public.integration_provider add value if not exists 'tiktok';
alter type public.integration_provider add value if not exists 'linkedin';
alter type public.integration_provider add value if not exists 'mercado';
alter type public.integration_provider add value if not exists 'rdstation';
alter type public.integration_provider add value if not exists 'hubspot';
alter type public.integration_provider add value if not exists 'pipedrive';
alter type public.integration_provider add value if not exists 'kommo';

comment on type public.integration_provider is 'Login (OAuth) que conecta a plataforma: meta, google, ga4, tiktok, linkedin, mercado, rdstation, hubspot, pipedrive, kommo.';
