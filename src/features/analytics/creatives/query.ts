// Endereço da página de Criativos: ?pagina=criativos&criativos=comparativo&anuncios=a,b,c.
// Vale no painel e no link compartilhado.

import type { PageId } from "@/features/templates/types";
import type { CreativesTab } from "../types";

const AD_ID = /^[\w-]{1,64}$/;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export type CreativesQuery = { page?: PageId; tab: CreativesTab; ads: string[] };

export function parseCreativesQuery(query: Record<string, string | string[] | undefined>): CreativesQuery {
  const ads = (one(query.anuncios) ?? "").split(",").filter((id, i, all) => AD_ID.test(id) && all.indexOf(id) === i);
  return { page: one(query.pagina) as PageId | undefined, tab: one(query.criativos) === "comparativo" ? "comparativo" : "galeria", ads: ads.slice(0, 3) };
}

/** Link para uma aba de Criativos, mantendo o resto da URL (período). */
export function creativesHref(current: string, tab: CreativesTab, ads: readonly string[] = []): string {
  const q = new URLSearchParams(current);
  q.set("pagina", "criativos");
  q.delete("anuncios");
  if (tab === "comparativo") q.set("criativos", "comparativo");
  else q.delete("criativos");
  const rest = q.toString();
  return `?${rest}${ads.length ? `&anuncios=${ads.join(",")}` : ""}`;
}

/** Troca um parâmetro da URL sem recarregar (aba aberta, anúncios escolhidos). */
export function setQueryParam(name: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  // vírgula legível: o link dos anúncios escolhidos vai ser copiado e compartilhado
  window.history.replaceState(null, "", url.toString().replace(/%2C/g, ","));
}
