"use client";

// "Usar token": a opção secundária ao login. Abre o tutorial da plataforma com o campo do
// token; o servidor confere na hora (connectWithToken) e grava a conexão como o login faria.
// Só aparece para quem pode conectar e nas plataformas com tutorial (token-connect.ts).

import { CircleCheck, ExternalLink, KeyRound, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Modal, ModalActions, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { plural } from "@/lib/format";
import { connectWithToken } from "@/server/integrations/actions";
import { PROVIDERS, type ProviderId } from "./providers";
import { PLAIN_FIELDS, tokenGuide, type TokenGuide } from "./token-connect";
import { btnSmallGhost } from "./ui";

type Result = { accounts: number; enabled: number };

export function TokenConnectButton({ provider, canManage = true, label = "Usar token", className = "" }: { provider: ProviderId; canManage?: boolean; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const guide = tokenGuide(provider);
  if (!guide || !canManage) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btnSmallGhost} ${className}`} aria-label={`Conectar ${PROVIDERS[provider].name} com token`}>
        <KeyRound size={15} aria-hidden /> {label}
      </button>
      {open && <TokenModal guide={guide} onClose={() => setOpen(false)} />}
    </>
  );
}

function TokenModal({ guide, onClose }: { guide: TokenGuide; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await connectWithToken(guide.provider, values);
      if (r.ok) setDone(r.data);
      else setError({ message: r.error.message, fields: r.error.fields });
    });

  return (
    <Modal open onClose={onClose} title={guide.title} wide>
      {done ? (
        <div className="space-y-4">
          <p className="flex items-start gap-2.5 text-[15px] leading-relaxed">
            <CircleCheck size={20} aria-hidden className="mt-0.5 shrink-0 text-success" />
            <span>
              Conectado. O token enxerga {plural(done.accounts, "conta", "contas")}
              {done.enabled ? `; ${plural(done.enabled, "já está ligada", "já estão ligadas")} e sincronizando.` : ". Escolha quais ligar na lista de contas."}
            </span>
          </p>
          <ModalActions>
            <button type="button" className={btn.small} onClick={onClose}>
              Fechar
            </button>
          </ModalActions>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className="text-[14.5px] leading-relaxed text-fg-2">{guide.intro}</p>

          <ol className="space-y-4">
            {guide.steps.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span aria-hidden className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12.5px] font-semibold text-fg tnum">
                  {i + 1}
                </span>
                <div className="min-w-0 space-y-1.5">
                  <p className="text-[14.5px] font-semibold">{s.title}</p>
                  <p className="text-[14px] leading-relaxed text-fg-2">{s.text}</p>
                  {s.items && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Permissões">
                      {s.items.map((it) => (
                        <li key={it} className="rounded-chip border border-line bg-card px-2 py-0.5 font-mono text-[12px] text-fg">
                          {it}
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.link && (
                    <a href={s.link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent hover:underline">
                      {s.link.label} <ExternalLink size={13} aria-hidden />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {guide.notes.length > 0 && (
            <ul className="space-y-1.5 rounded-card border border-line bg-card px-4 py-3 text-[13px] leading-relaxed text-fg-2">
              {guide.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}

          {guide.fields.map((f) => (
            <TextField
              key={f.name}
              type={PLAIN_FIELDS.has(f.name) ? "text" : "password"}
              label={f.label}
              placeholder={f.placeholder}
              hint={f.hint}
              value={values[f.name] ?? ""}
              error={error?.fields?.[f.name]}
              disabled={pending}
              onChange={(v) => setValues((cur) => ({ ...cur, [f.name]: v }))}
            />
          ))}

          {error && !error.fields && (
            <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13.5px] text-error-fg">
              {error.message}
            </p>
          )}

          <ModalActions>
            <button type="button" className={btnSmallGhost} onClick={onClose} disabled={pending}>
              Cancelar
            </button>
            <button type="submit" className={btn.small} disabled={pending} aria-busy={pending}>
              {pending && <LoaderCircle size={15} aria-hidden className="animate-spin motion-reduce:animate-none" />}
              {pending ? "Conferindo…" : "Conferir e conectar"}
            </button>
          </ModalActions>
        </form>
      )}
    </Modal>
  );
}
