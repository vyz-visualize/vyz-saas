"use client";

// Leads recebidos pelos formulários das landing pages (admin): filtro por LP
// e período, páginas de 25 e exportação em CSV (gerada no servidor).

import { ArrowLeft, ChevronLeft, ChevronRight, Download, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EmptyState, PageHeader } from "@/components/ui/kit";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { btn } from "@/components/ui/styles";
import type { LeadsPageData } from "@/server/landing-pages/leads";
import { csvDate, LEAD_PERIOD_LABEL, LEAD_PERIODS, leadFiltersQuery, type LeadFilters, type LeadPeriod } from "./leads";

const ALL = "todas";

export function LeadsPage({ data, filters, timeZone }: { data: LeadsPageData | null; filters: LeadFilters; timeZone: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (f: Partial<LeadFilters>) => start(() => router.push(`/painel/landing-pages/leads${leadFiltersQuery({ ...filters, page: 1, ...f })}`));
  const back = (
    <Link href="/painel/landing-pages" className={`${btn.ghost} h-9`}>
      <ArrowLeft size={16} aria-hidden /> Landing pages
    </Link>
  );

  if (!data) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Landing pages" title="Leads" actions={back} />
        <div className="flex items-start gap-3 rounded-card border border-line bg-card p-5 text-[14px]">
          <Lock size={18} aria-hidden className="mt-0.5 shrink-0 text-fg-2" />
          <p className="text-fg-2">
            Os leads têm dados pessoais de quem preencheu o formulário: só administradores da organização veem e exportam. Peça a um administrador o acesso ou o arquivo.
          </p>
        </div>
      </div>
    );
  }

  const exportHref = `/api/landing-pages/leads${leadFiltersQuery({ landingPageId: filters.landingPageId, period: filters.period })}`;
  const options = [{ value: ALL, label: "Todas as landing pages" }, ...data.landings.map((l) => ({ value: l.id, label: l.name }))];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Landing pages"
        title="Leads"
        text="Contatos enviados pelos formulários das suas landing pages."
        actions={
          <>
            {back}
            {data.total > 0 ? (
              <a href={exportHref} className={btn.small} download>
                <Download size={16} aria-hidden /> Exportar CSV
              </a>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-card border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between" aria-busy={pending}>
        <div className="w-full sm:max-w-xs">
          <Select ariaLabel="Landing page" size="sm" value={filters.landingPageId ?? ALL} options={options} onChange={(v) => go({ landingPageId: v === ALL ? null : v })} />
        </div>
        <Segmented<LeadPeriod>
          label="Período"
          size="sm"
          value={filters.period}
          onChange={(period) => go({ period })}
          options={LEAD_PERIODS.map((p) => ({ value: p, label: LEAD_PERIOD_LABEL[p] }))}
        />
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          title={data.total > 0 ? "Esta página está vazia" : "Nenhum lead no período"}
          text={data.landings.length ? "Quando alguém preencher o formulário de uma landing page publicada, o contato aparece aqui." : "Publique uma landing page com formulário para começar a receber contatos."}
        />
      ) : (
        <div className={`overflow-x-auto rounded-card border border-line bg-card ${pending ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <caption className="sr-only">Leads recebidos</caption>
            <thead className="border-b border-line text-[12px] text-fg-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Recebido em
                </th>
                {!filters.landingPageId && (
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Landing page
                  </th>
                )}
                {data.fields.map((f) => (
                  <th key={f} scope="col" className="px-4 py-2.5 font-medium">
                    {f}
                  </th>
                ))}
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Origem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-fg-2 tnum">{csvDate(l.createdAt, timeZone)}</td>
                  {!filters.landingPageId && <td className="max-w-48 truncate px-4 py-2.5">{l.landingName}</td>}
                  {data.fields.map((f) => (
                    <td key={f} className="max-w-64 truncate px-4 py-2.5" title={l.data[f]}>
                      {l.data[f] ?? <span className="text-fg-2">—</span>}
                    </td>
                  ))}
                  <td className="max-w-48 truncate px-4 py-2.5 text-fg-2">{l.utm.utm_source ?? (l.referrer ? hostOf(l.referrer) : "Direto")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.total > 0 && (
        <nav className="flex flex-wrap items-center justify-between gap-3 text-[13.5px] text-fg-2" aria-label="Páginas dos leads">
          <span className="tnum">
            {data.total} {data.total === 1 ? "lead" : "leads"} · página {data.page} de {data.pages}
          </span>
          <span className="flex gap-2">
            <button type="button" className={`${btn.ghost} h-9`} disabled={data.page <= 1 || pending} onClick={() => go({ page: data.page - 1 })}>
              <ChevronLeft size={16} aria-hidden /> Anterior
            </button>
            <button type="button" className={`${btn.ghost} h-9`} disabled={data.page >= data.pages || pending} onClick={() => go({ page: data.page + 1 })}>
              Próxima <ChevronRight size={16} aria-hidden />
            </button>
          </span>
        </nav>
      )}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "—";
  }
}
