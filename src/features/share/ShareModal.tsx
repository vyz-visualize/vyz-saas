"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Checkbox, Modal, SelectField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { ddmmyyyy } from "@/lib/format";
import { createShareLink, type CreatedShareLink } from "@/server/share/actions";
import { EXPIRY_OPTIONS, type ExpiryOption } from "./links";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

/**
 * Gera um link só de leitura no servidor. O link completo aparece só aqui, uma
 * vez: o VYZ guarda apenas uma impressão dele (para revogar e contar visitas).
 */
export function ShareModal({ open, onClose, dashboard }: { open: boolean; onClose: () => void; dashboard: { id: string; name: string; live: boolean } }) {
  const [expires, setExpires] = useState<ExpiryOption>("30");
  const [hideSpend, setHideSpend] = useState(false);
  const [link, setLink] = useState<CreatedShareLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    start(async () => {
      const r = await createShareLink({ dashboardId: dashboard.id, expires, hideSpend });
      if (!r.ok) return setError(r.error.message);
      setLink(r.data);
      setCopied(false);
    });
  }

  function close() {
    onClose();
    setLink(null);
    setError(null);
  }

  return (
    <Modal open={open} onClose={close} title="Compartilhar dashboard">
      <div className="space-y-4 text-[14px]">
        <p className="text-fg-2">
          Quem tiver o link vê <strong className="text-fg">{dashboard.name}</strong> só para leitura, sem entrar no VYZ{dashboard.live ? ", com os números das contas ligadas" : ", com os dados de exemplo"}.
        </p>
        {!link ? (
          <>
            <SelectField label="Expira em" value={expires} onChange={(v) => setExpires(v as ExpiryOption)} options={EXPIRY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
            <Checkbox label="Esconder os valores de investimento" hint={hideSpend ? "Métricas de custo e ROAS também ficam ocultas, para o valor investido não poder ser recalculado." : undefined} checked={hideSpend} onChange={setHideSpend} />
            {error && (
              <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13px] text-error-fg">
                {error}
              </p>
            )}
            <button type="button" onClick={create} disabled={pending} className={btn.small}>
              {pending ? "Gerando…" : "Gerar link"}
            </button>
          </>
        ) : (
          <div className="space-y-3 rounded-control border border-line bg-card p-3">
            <p className="text-[12.5px] font-medium text-fg">Copie agora: por segurança, o link completo não aparece de novo.</p>
            <p className="break-all rounded-control bg-bg px-2.5 py-2 text-[12.5px] text-fg-2 tnum">{link.url}</p>
            <p className="text-[12.5px] text-fg-2">
              {link.expiresAt ? `Vale até ${ddmmyyyy(new Date(link.expiresAt))}` : "Não expira"}
              {link.hideSpend ? " · investimento oculto" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btn.small}
                onClick={async () => {
                  await copyText(link.url);
                  setCopied(true);
                }}
              >
                {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "Copiado" : "Copiar link"}
              </button>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className={`${btn.ghost} h-9`}>
                <ExternalLink size={15} aria-hidden /> Abrir
              </a>
              <button type="button" className={`${btn.ghost} h-9`} onClick={() => setLink(null)}>
                Gerar outro
              </button>
            </div>
            <span className="sr-only" aria-live="polite">
              {copied ? "Link copiado" : ""}
            </span>
          </div>
        )}
        <p className="text-[12.5px] text-fg-2">
          Para revogar ou ver as visitas, use{" "}
          <Link href="/painel/compartilhar" className="text-accent underline-offset-2 hover:underline">
            Compartilhar
          </Link>
          .
        </p>
      </div>
    </Modal>
  );
}
