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

Os arquivos finais vêm prontos do projeto do vídeo (`vyz-video`, pasta `renders/final/`) e são só copiados, com os mesmos nomes, para `public/video/`. Aqui não se gera nem se converte nada.

| Arquivo | De onde vem | O que é |
|---|---|---|
| `vyz-por-dentro.mp4` e `.webm` | `renders/final/com-som/` | 16:9, 1920x1080, a partir de 640 px |
| `vyz-por-dentro-celular.mp4` e `.webm` | `renders/final/com-som/` | 4:5, 1080x1350, no celular |
| `vyz-por-dentro.webp` e `.jpg` | `renders/final/` | capa da 16:9 |
| `vyz-por-dentro-celular.webp` e `.jpg` | `renders/final/` | capa da 4:5 |

O build confere quais desses arquivos existem (`next.config.ts`) e não depende de variável de ambiente. Com o MP4 e a capa JPG da 16:9, aparecem a dobra, o link "Ver por dentro" do hero e o item do menu. A 4:5 é opcional: sem ela, o celular usa a 16:9. O WebM entra antes do MP4, e a capa WebP antes da JPG, quando existem. As duas versões são alternadas por CSS, e só a visível carrega.

Para trocar o vídeo, copie os novos arquivos por cima, com os mesmos nomes, e faça um novo build.

Os eventos no `dataLayer` são `video_inicio`, `video_som` e `video_fim`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
