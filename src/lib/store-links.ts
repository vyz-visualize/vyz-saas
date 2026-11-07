// Links das lojas do app. Só aparecem com a URL configurada (os apps aguardam aprovação):
// NEXT_PUBLIC_APP_STORE_URL e NEXT_PUBLIC_PLAY_STORE_URL. Sem a URL, nada aparece.

export type StoreLinks = { appStore: string | null; playStore: string | null };

const valid = (url: string | undefined, host: RegExp) => {
  const v = url?.trim() ?? "";
  try {
    const u = new URL(v);
    return u.protocol === "https:" && host.test(u.hostname) ? v : null;
  } catch {
    return null;
  }
};

export function storeLinks(env: { appStore?: string; playStore?: string } = { appStore: process.env.NEXT_PUBLIC_APP_STORE_URL, playStore: process.env.NEXT_PUBLIC_PLAY_STORE_URL }): StoreLinks {
  return { appStore: valid(env.appStore, /(^|\.)apple\.com$/), playStore: valid(env.playStore, /(^|\.)play\.google\.com$/) };
}
