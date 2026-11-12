// Aviso fixo no topo do dashboard que mostra dados de exemplo (sem conta ativa
// ligada). Não fecha: some quando a conta é ligada. Sai também na impressão.

import { FlaskConical, PlugZap } from "lucide-react";
import Link from "next/link";
import { btn } from "@/components/ui/styles";
import { SAMPLE_NOTICE } from "./sample-gate";

export function SampleNotice({ connectHref, canConnect }: { connectHref: string; canConnect: boolean }) {
  return (
    <div
      role="status"
      data-sample-notice
      className="sticky top-2 z-30 mb-4 flex flex-col gap-3 rounded-card border border-warning/70 bg-[color-mix(in_srgb,var(--warning)_14%,var(--bg))] px-4 py-3 text-fg shadow-[0_6px_20px_rgba(0,0,0,0.12)] sm:flex-row sm:items-center sm:justify-between print:static print:shadow-none"
    >
      <p className="flex items-start gap-2 text-[14px] font-medium">
        <FlaskConical size={17} aria-hidden className="mt-0.5 shrink-0" />
        {SAMPLE_NOTICE}
      </p>
      {canConnect && (
        <Link href={connectHref} className={`${btn.small} shrink-0 self-start sm:self-auto print:hidden`}>
          <PlugZap size={15} aria-hidden /> Conectar
        </Link>
      )}
    </div>
  );
}
