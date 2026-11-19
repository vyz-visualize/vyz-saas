# VYZ (Vyzualize)

Painel de mídia paga para gestores de tráfego, agências e freelas de BI: conecta Meta Ads, Instagram, Facebook, Google Ads e GA4, monta o dashboard do cliente e manda por link, PDF ou WhatsApp. Também tem o app para iPhone e Android.

- Site e painel: https://www.vyzualize.com.br (Next.js na Vercel, banco no Supabase)
- App: `apps/mobile` (Expo), nas lojas como "Vyzualize"
- Documentação: [docs/README.md](docs/README.md). Comece pela [ARQUITETURA](docs/ARQUITETURA.md).

## O que tem em cada pasta

| Pasta | O quê |
|---|---|
| `src/app` | rotas: site `(marketing)`, painel `(painel)`, login `(auth)`, assinatura `(checkout)`, primeiro acesso `(onboarding)`, link do cliente `(publico)`, termos `(legal)`, APIs (`api/`) |
| `src/features` | domínio e interface, sem acesso ao banco (preços, limites, templates, métricas, telas) |
| `src/server` | só servidor: Server Actions, consultas, integrações, cobrança, sincronização |
| `src/components` | peças de interface (`ui/`), gráficos (`charts/` e a biblioteca `bklit/`), marca e animações |
| `src/lib` | utilitários sem domínio (formatação, texto, flags, links) |
| `packages/shared` | tipos e regras usados pelo site e pelo app (API, créditos, planos da loja) |
| `apps/mobile` | app Expo ([MOBILE](docs/MOBILE.md), [guia das lojas](apps/mobile/store/LOJAS.md)) |
| `supabase/migrations` | o banco, em ordem ([BANCO](docs/BANCO.md)) |
| `scripts` | tarefas de linha de comando: banco, conta de teste, exclusão de dados, MMM, lojas |
| `docs` | documentação |

Regra de ouro: cada assunto tem uma fonte só no código (preço e limite em `src/features/pricing`, templates em `src/features/templates`, plataformas em `src/features/accounts/platforms.ts`). O banco recebe uma cópia pelo `npm run db:catalog`.

## Rodar local

```bash
npm install
cp .env.example .env.local   # preencha os valores (lista comentada no arquivo)
npm run dev                  # http://localhost:3000
```

Sem as chaves das plataformas e da Stripe, o painel funciona no modo simulado (`INTEGRATIONS_MODE=mock`, `BILLING_PROVIDER=mock`). Telas de desenvolvimento ficam em `/dev/*` (só no `next dev`).

## Comandos

| Comando | Para quê |
|---|---|
| `npm run dev` | site e painel local |
| `npm test` | testes (vitest; os `*.db.test.ts` sobem um Postgres em memória com as migrations) |
| `npm run typecheck` / `npm run lint` | tipos e lint |
| `npm run check:unused` | arquivos, exportações e dependências sem uso (knip) |
| `npm run build` | build de produção |
| `npm run db:new -- nome` | cria uma migration |
| `npm run db:push` | aplica as migrations no Supabase de produção |
| `npm run db:types` | regenera os tipos do banco |
| `npm run db:catalog` | copia planos, preços, plataformas e templates do código para o banco |

Os outros comandos estão na [ARQUITETURA, seção Comandos](docs/ARQUITETURA.md#10-comandos).

## Publicar

1. **Código:** branch nova, PR para `main`, merge. A Vercel publica a `main` sozinha. Commits e push sempre pela conta GitHub Vyzualize.
2. **Banco:** migration nova vai antes do merge que depende dela (`npm run db:push`, rodado na pasta que tem a migration).
3. **Catálogo:** mudou preço, limite, plataforma ou template? Depois do deploy, `npm run db:catalog`.
4. **App:** builds locais com `apps/mobile/store/gerar/build.sh`; envio às lojas pelas APIs, com as chaves fora do git (`~/Documents/VYZ/Publicar`). Revisão da Apple e produção do Play só com o ok do Gustavo.

Antes de abrir o PR: `npm test`, `npm run typecheck`, `npm run lint` e `npm run check:unused`.

## Vídeo "Veja por dentro" do site

Os arquivos finais vêm prontos do projeto do vídeo (`vyz-video`, pasta `renders/final/`) e são só copiados, com os mesmos nomes, para `public/video/`. Aqui não se gera nem se converte nada.

| Arquivo | De onde vem | O que é |
|---|---|---|
| `vyz-por-dentro.mp4` e `.webm` | `renders/final/com-som/` | 16:9, 1920x1080, a partir de 640 px |
| `vyz-por-dentro-celular.mp4` e `.webm` | `renders/final/com-som/` | 4:5, 1080x1350, no celular |
| `vyz-por-dentro.webp` e `.jpg` | `renders/final/` | capa da 16:9 |
| `vyz-por-dentro-celular.webp` e `.jpg` | `renders/final/` | capa da 4:5 |

O build confere quais desses arquivos existem (`next.config.ts`). Com o MP4 e a capa JPG da 16:9, aparecem a dobra, o link "Ver por dentro" do hero e o item do menu. A 4:5 é opcional: sem ela, o celular usa a 16:9. Para trocar o vídeo, copie os novos arquivos por cima, com os mesmos nomes, e faça um novo build. Os eventos no `dataLayer` são `video_inicio`, `video_som` e `video_fim`.

## Regras

- Nada de segredo no git: `.env.example` leva só os nomes.
- Não mudar IDs fixos (produtos das lojas, bundle e package do app, IDs de plataformas).
- Textos em português do Brasil.
