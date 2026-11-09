This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Vídeo "Veja por dentro" do site

A dobra de vídeo só aparece com `NEXT_PUBLIC_DEMO_VIDEO_URL` definida. Sem ela, também somem o link "Ver por dentro" do hero, o item do menu e o "Ver funcionando". São duas versões, alternadas por CSS: 16:9 a partir de 640 px e 4:5 no celular. Só a visível carrega. A 4:5 é opcional: sem ela, o celular usa a 16:9.

Para gerar os arquivos a partir dos vídeos brutos (precisa do `ffmpeg`, no Mac: `brew install ffmpeg`):

```bash
npm run video:prepare -- bruto-16x9.mov bruto-4x5.mov
```

Isso cria em `public/video/` (ou na pasta de `VIDEO_OUT`):

| Arquivo | O que é |
|---|---|
| `vyz-por-dentro.mp4` e `vyz-por-dentro-celular.mp4` | H.264, alvo de até ~15 MB por minuto (16:9 até 1920x1080; 4:5 em 1080x1350, cortando pelo centro o que não couber) |
| `vyz-por-dentro.webm` e `vyz-por-dentro-celular.webm` | VP9, opcionais: o site usa se o arquivo existir no build |
| `vyz-por-dentro.jpg` e `vyz-por-dentro-celular.jpg` | as capas (frame dos 2 s) |

Depois, defina no `.env.local` e na Vercel, e faça um novo build (os valores são lidos no build):

```bash
NEXT_PUBLIC_DEMO_VIDEO_URL=/video/vyz-por-dentro.mp4
NEXT_PUBLIC_DEMO_VIDEO_MOBILE_URL=/video/vyz-por-dentro-celular.mp4
```

Os eventos no `dataLayer` são `video_inicio`, `video_som` e `video_fim`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
