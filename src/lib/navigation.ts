// Abrir uma página ou só trocar a URL dentro dela? Filtrar, trocar o período e salvar
// pedem os dados de novo ao servidor, mas não são uma abertura. Puro e testado.

type RequestSignals = {
  /** Cabeçalho Sec-Fetch-Dest: "document" ao abrir o endereço, "empty" nos pedidos de dentro da página. */
  fetchDest: string | null;
  /** Cabeçalho Referer: de onde o pedido partiu. */
  referer: string | null;
};

/** O pedido partiu desta mesma página. Sem os cabeçalhos, conta como abertura. */
export function isSamePageRequest({ fetchDest, referer }: RequestSignals, pathname: string): boolean {
  if (fetchDest !== "empty" || !referer) return false;
  try {
    return new URL(referer).pathname.replace(/\/$/, "") === pathname.replace(/\/$/, "");
  } catch {
    return false;
  }
}
