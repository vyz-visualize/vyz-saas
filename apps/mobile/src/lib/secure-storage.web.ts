// Na versão web (prévia em desenvolvimento), a sessão fica no localStorage.
// No iPhone e no Android vale secure-storage.ts (chaveiro do aparelho).

export const secureStorage = {
  async getItem(key: string) {
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string) {
    globalThis.localStorage?.setItem(key, value);
  },
  async removeItem(key: string) {
    globalThis.localStorage?.removeItem(key);
  },
};
