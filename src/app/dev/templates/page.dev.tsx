// Bancada dos modelos de dashboard: só existe no `next dev` (a extensão .dev.tsx só vira
// rota fora de produção; ver pageExtensions no next.config.ts). Mostra qualquer visual,
// inclusive os rascunhos (`draft: true` em templates/dashboards/visuais), com dados de
// exemplo e o Personalizar funcionando sem banco. Endereço: /dev/templates

import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TemplatesBench } from "./harness";

export const metadata = { title: "Modelos (desenvolvimento)", robots: { index: false, follow: false } };

export default function Page() {
  // segunda trava: mesmo que um dia vire rota num build de produção, responde 404
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <TemplatesBench />
    </Suspense>
  );
}
