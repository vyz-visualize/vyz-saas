// Bancada do primeiro acesso: só existe no `next dev`. A extensão .dev.tsx só
// vira rota quando o next.config.ts liga "dev.tsx" em pageExtensions (fora de
// produção); no build de produção este arquivo nem é rota (ver harness.tsx).

import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Harness } from "./harness";

export const metadata = { title: "Primeiro acesso (desenvolvimento)", robots: { index: false, follow: false } };

export default function Page() {
  // segunda trava: mesmo que um dia vire rota num build de produção, responde 404
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Harness />
    </Suspense>
  );
}
