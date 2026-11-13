// Os visuais oferecidos, um arquivo cada, na ordem da tela. Básico: VYZ e Lavanda;
// Padrão: + Pulso; Avançado: todos. Visual novo: crie o arquivo aqui e acrescente na lista.
// Enquanto estiver com `draft: true`, ele só aparece na bancada local (/dev/templates):
// pode ir para a main sem entrar na galeria, no onboarding nem no banco. Para lançar,
// tire o draft e rode npm run db:catalog.

import type { Visual } from "../composed";
import vyz from "./vyz";
import lavanda from "./lavanda";
import pulso from "./pulso";
import noturno from "./noturno";
import areia from "./areia";
import fachada from "./fachada";

const ALL: Visual[] = [vyz, lavanda, pulso, noturno, areia, fachada];

/** Os visuais lançados. */
export const VISUAL_LIST: Visual[] = ALL.filter((v) => !v.draft);
/** Os rascunhos (só a bancada local mostra). */
export const DRAFT_VISUALS: Visual[] = ALL.filter((v) => v.draft);
