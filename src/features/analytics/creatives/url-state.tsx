"use client";

// O comparativo guarda os anúncios escolhidos na URL (no painel, o link leva a escolha).
// O site usa o mesmo componente na demonstração e não pode mexer no endereço: lá, o
// estado fica só na memória da página.

import { createContext, useContext, type ReactNode } from "react";
import { setQueryParam } from "./query";

const Ctx = createContext(true);

/** false = nada escreve na URL dentro deste trecho. Sem o provider, escreve (o painel). */
export const UrlWritesProvider = ({ value, children }: { value: boolean; children?: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;

const noop = () => {};

export function useQueryParamWriter(): typeof setQueryParam {
  return useContext(Ctx) ? setQueryParam : noop;
}
