"use client";

// Página WhatsApp do painel: número com verificação por código, relatórios à
// escolha do cliente, pausa, teste e as últimas mensagens com o status.
// Plano sem whatsappReports: vitrine travada (Paywall) com o caminho do upgrade.

import { useState, useTransition, type ReactNode } from "react";
import { Paywall } from "@/components/ui/Paywall";
import { Checkbox, Switch } from "@/components/ui/controls";
import { PageHeader, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { formatPhone } from "@/features/checkout/phone";
import { availableIn } from "@/features/pricing/entitlements";
import { useWorkspaceSession } from "@/features/workspace/WorkspaceProvider";
import { confirmWhatsappCode, removeWhatsapp, sendWhatsappTest, startWhatsappVerification, updateWhatsappPreferences } from "@/server/whatsapp/actions";
import type { WhatsappPageData } from "@/server/whatsapp/queries";
import { REPORT_KINDS } from "./templates";

const STATUS_LABEL: Record<string, string> = { sent: "enviada", delivered: "entregue", read: "lida", failed: "falhou", simulado: "simulado", received: "recebida" };
const KIND_LABEL: Record<string, string> = { codigo: "Código", "boas-vindas": "Boas-vindas", diario: "Resumo diário", semanal: "Resumo semanal", alertas: "Alerta", teste: "Teste", texto: "Resposta da VYZ", resposta: "Sua resposta" };

function Section({ id, title, text, children }: { id: string; title: string; text?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-card border border-line bg-card p-5" aria-labelledby={id}>
      <h2 id={id} className="title text-lg">
        {title}
      </h2>
      {text && <p className="-mt-2 text-[14px] text-fg-2">{text}</p>}
      {children}
    </section>
  );
}

const StopNote = () => (
  <p className="rounded-control bg-accent-soft px-3 py-2 text-[13px] text-fg">
    Para parar de receber a qualquer momento, responda <strong>PARAR</strong> no WhatsApp. Para voltar, responda <strong>VOLTAR</strong>.
  </p>
);

function NumberForm({ data, notify }: { data: WhatsappPageData; notify: (m: string) => void }) {
  const sub = data.subscription;
  const [phone, setPhone] = useState(sub ? formatPhone(sub.phone) : "");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"number" | "code">(sub && !sub.verified ? "code" : "number");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const r = await startWhatsappVerification({ phone, consent });
      if (!r.ok) return setErrors(r.error.fields ?? { form: r.error.message });
      setErrors({});
      setStep("code");
      notify(r.data.simulated ? "Código simulado (veja o log do servidor)." : "Código enviado no WhatsApp.");
    });
  const confirm = () =>
    start(async () => {
      const r = await confirmWhatsappCode({ code });
      if (!r.ok) return setErrors(r.error.fields ?? { form: r.error.message });
      setErrors({});
      setCode("");
      setStep("number");
      notify("Número verificado.");
    });

  if (sub?.verified && step === "number" && formatPhone(sub.phone) === phone) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px]">
          <strong>{formatPhone(sub.phone)}</strong> <span className="text-fg-2">· verificado{sub.optedOut ? " · você respondeu PARAR" : ""}</span>
        </p>
        <div className="flex gap-2">
          <button type="button" className={btn.ghost} onClick={() => setPhone("")}>
            Trocar número
          </button>
          <button
            type="button"
            className={btn.ghost}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await removeWhatsapp();
                if (!r.ok) return setErrors({ form: r.error.message });
                setPhone("");
                notify("Número removido.");
              })
            }
          >
            Remover
          </button>
        </div>
      </div>
    );
  }

  return step === "code" ? (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        confirm();
      }}
    >
      <p className="text-[14px] text-fg-2">Enviamos um código de 6 dígitos para {phone || formatPhone(sub?.phone ?? "")}. Ele vale por 10 minutos.</p>
      <div className="max-w-xs">
        <TextField label="Código" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="000000" error={errors.code} />
      </div>
      {errors.form && <p role="alert" className="text-[13px] text-error-fg">{errors.form}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btn.small} disabled={pending || code.length !== 6}>
          Confirmar
        </button>
        <button type="button" className={btn.ghost} disabled={pending} onClick={() => setStep("number")}>
          Trocar número ou reenviar
        </button>
      </div>
    </form>
  ) : (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className="max-w-xs">
        <TextField label="Seu WhatsApp" value={phone} onChange={(v) => setPhone(formatPhone(v))} inputMode="tel" placeholder="(71) 99999-9999" error={errors.phone} />
      </div>
      <Checkbox
        label="Aceito receber relatórios da VYZ neste WhatsApp."
        hint="Você escolhe quais abaixo e pode parar quando quiser respondendo PARAR."
        checked={consent}
        onChange={setConsent}
      />
      {errors.consent && <p role="alert" className="text-[13px] text-error-fg">{errors.consent}</p>}
      {errors.form && <p role="alert" className="text-[13px] text-error-fg">{errors.form}</p>}
      <button type="submit" className={btn.small} disabled={pending || !phone}>
        Enviar código
      </button>
    </form>
  );
}

function Preferences({ data, notify }: { data: WhatsappPageData; notify: (m: string) => void }) {
  const sub = data.subscription!;
  const [reports, setReports] = useState<string[]>(sub.reports);
  const [paused, setPaused] = useState(sub.paused);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (patch: { reports?: string[]; paused?: boolean }) =>
    start(async () => {
      const r = await updateWhatsappPreferences(patch);
      if (!r.ok) return setError(r.error.message);
      setError(null);
      notify("Preferências salvas.");
    });
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {REPORT_KINDS.map((k) => (
          <Checkbox
            key={k.id}
            label={k.label}
            hint={k.hint}
            checked={reports.includes(k.id)}
            disabled={pending}
            onChange={(on) => {
              const next = on ? [...reports, k.id] : reports.filter((r) => r !== k.id);
              setReports(next);
              save({ reports: next });
            }}
          />
        ))}
      </div>
      <Switch
        label="Pausar todos os relatórios"
        hint="Nada é enviado enquanto estiver pausado."
        checked={paused}
        disabled={pending}
        onChange={(v) => {
          setPaused(v);
          save({ paused: v });
        }}
      />
      {error && <p role="alert" className="text-[13px] text-error-fg">{error}</p>}
      <button
        type="button"
        className={btn.small}
        disabled={pending || sub.optedOut}
        onClick={() =>
          start(async () => {
            const r = await sendWhatsappTest();
            if (!r.ok) return setError(r.error.message);
            setError(null);
            notify(r.data.status === "simulado" ? "Teste simulado registrado." : r.data.status === "sem dados" ? "Ainda sem dados para um relatório." : "Relatório de teste enviado.");
          })
        }
      >
        Enviar relatório de teste
      </button>
    </div>
  );
}

function Messages({ data, timeZone }: { data: WhatsappPageData; timeZone: string }) {
  if (!data.messages.length) return <p className="text-[14px] text-fg-2">Nenhuma mensagem ainda.</p>;
  const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone });
  return (
    <ul className="divide-y divide-line">
      {data.messages.map((m) => (
        <li key={m.id} className="space-y-1 py-3 text-[14px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{KIND_LABEL[m.kind] ?? m.kind}</span>
            <span className={`text-[12px] ${m.status === "failed" ? "text-error-fg" : "text-fg-2"}`}>
              {STATUS_LABEL[m.status] ?? m.status} · {fmt.format(new Date(m.createdAt))}
            </span>
          </div>
          {m.body && <p className="line-clamp-3 text-fg-2">{m.body}</p>}
          {m.error && <p className="text-[12px] text-error-fg">{m.error}</p>}
        </li>
      ))}
    </ul>
  );
}

const PITCH = "Receba o resumo do dia, o fechamento da semana e alertas de queda ou gasto fora do normal direto no seu WhatsApp, enviados pelo número oficial da VYZ.";

export function WhatsappPage({ data }: { data: WhatsappPageData }) {
  const { access, workspace } = useWorkspaceSession();
  const toast = useToast();
  const allowed = access.hasAccess && !!access.entitlements?.whatsappReports;
  const verified = !!data.subscription?.verified;

  const body = (
    <div className="space-y-4">
      {data.simulated && allowed && (
        <p className="rounded-control border border-line px-3 py-2 text-[13px] text-fg-2">Modo simulado: o WhatsApp da VYZ ainda não está configurado neste ambiente. As mensagens ficam registradas como &quot;simulado&quot; e nada é enviado.</p>
      )}
      <Section id="h-wa-numero" title="Número" text="Enviamos um código pelo WhatsApp para confirmar que o número é seu.">
        <NumberForm data={data} notify={toast.show} />
      </Section>
      <Section id="h-wa-relatorios" title="O que receber" text={verified ? "Escolha os relatórios. Vale só para você neste workspace." : "Verifique o número para escolher os relatórios."}>
        {verified ? <Preferences data={data} notify={toast.show} /> : <p className="text-[14px] text-fg-2">{REPORT_KINDS.map((k) => k.label).join(", ")}.</p>}
        <StopNote />
      </Section>
      {verified && (
        <Section id="h-wa-mensagens" title="Últimas mensagens">
          <Messages data={data} timeZone={workspace.timezone} />
        </Section>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Configurações" title="Relatórios no WhatsApp" text={allowed ? PITCH : `${availableIn("avancado")}. ${PITCH}`} />
      {allowed ? (
        body
      ) : (
        <Paywall current={access.hasAccess ? access.tier : null} required="avancado" feature="Relatórios no WhatsApp" text={PITCH}>
          {body}
        </Paywall>
      )}
      {toast.node}
    </div>
  );
}
