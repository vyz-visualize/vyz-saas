// Marcadores de texto pendente (ex.: "[ANOS]", na dobra Diferenciais) não podem chegar à
// produção. Roda depois do `next build` (postbuild) e procura os marcadores no que vai ao ar:
// o HTML e os arquivos do servidor (.next/server/app) e os JS do navegador (.next/static).
//
// No deploy de produção da Vercel (VERCEL_ENV=production) ou com STRICT_PLACEHOLDERS=1, achar
// um marcador falha o build. Em preview e no build local, só avisa (dá para testar a branch).
//
//   npx tsx scripts/build/check-placeholders.ts

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MARKERS = ["[ANOS]"];
const TEXT = /\.(html|js|mjs|cjs|rsc|body|json|txt|meta)$/;

export type Hit = { file: string; marker: string };

/** Arquivos de texto em `dir` (recursivo) que contêm algum marcador. */
export function findPlaceholders(dir: string, markers: readonly string[] = MARKERS): Hit[] {
  if (!existsSync(dir)) return [];
  const hits: Hit[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (TEXT.test(name)) {
        const body = readFileSync(path, "utf8");
        for (const marker of markers) if (body.includes(marker)) hits.push({ file: path, marker });
      }
    }
  };
  walk(dir);
  return hits;
}

export const isStrict = (env: Record<string, string | undefined>) => env.VERCEL_ENV === "production" || env.STRICT_PLACEHOLDERS === "1";

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const hits = [...findPlaceholders(".next/server/app"), ...findPlaceholders(".next/static")];
  if (!hits.length) {
    console.log("check-placeholders: nenhum marcador pendente no build.");
  } else {
    const markers = [...new Set(hits.map((h) => h.marker))].join(", ");
    const files = [...new Set(hits.map((h) => h.file))];
    const msg = `check-placeholders: ${markers} no build (${files.length} arquivo(s), ex.: ${files[0]}). Troque pelo texto final antes de ir para produção.`;
    if (isStrict(process.env)) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(`AVISO ${msg} Fora da produção, o build segue.`);
  }
}
