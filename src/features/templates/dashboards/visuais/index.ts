// Os visuais oferecidos, um arquivo cada, na ordem da tela. Básico: VYZ e Lavanda;
// Padrão: + Pulso; Avançado: todos. Visual novo: crie o arquivo aqui e acrescente na lista.

import type { Visual } from "../composed";
import vyz from "./vyz";
import lavanda from "./lavanda";
import pulso from "./pulso";
import noturno from "./noturno";
import areia from "./areia";

export const VISUAL_LIST: Visual[] = [vyz, lavanda, pulso, noturno, areia];
