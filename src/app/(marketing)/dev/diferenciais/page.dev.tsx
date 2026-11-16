// Bancada da dobra Diferenciais: só existe no `next dev` (a extensão .dev.tsx só vira rota
// fora de produção; ver pageExtensions no next.config.ts). Compara as duas direções antes de
// irem para o site. Endereço: /dev/diferenciais?direcao=1|2|atual&frase=1|2|3

import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Bench } from "./bench";

export const metadata = { title: "Diferenciais (desenvolvimento)", robots: { index: false, follow: false } };

export default function Page() {
  // segunda trava: mesmo que um dia vire rota num build de produção, responde 404
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Bench />
    </Suspense>
  );
}
