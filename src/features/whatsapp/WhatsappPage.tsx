"use client";

// Página WhatsApp do painel: número com verificação por código, relatórios à
// escolha do cliente, pausa, teste e as últimas mensagens com o status.
// Plano sem whatsappReports: vitrine travada (Paywall) com o caminho do upgrade.

import { ArrowLeft, CheckCircle2, Hand } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Paywall } from "@/components/ui/Paywall";
import { Checkbox, Switch } from "@/components/ui/controls";
import { Badge, PageHeader, TextField } from "@/components/ui/kit";
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

/** Passo numerado: o número vira um visto quando o passo está feito. */
function Section({ id, title, text, step, done, children }: { id: string; title: string; text?: ReactNode; step?: number; done?: boolean; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card p-5 sm:p-6" aria-labelledby={id}>
      <div className="flex gap-3.5">
        {step !== undefined && (
          <span aria-hidden className={`mt-px inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${done ? "bg-accent text-on-accent" : "border-[1.5px] border-accent text-accent"}`}>
            {done ? <CheckCircle2 size={16} /> : step}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-5">
          <div>
            <h2 id={id} className="text-[16.5px] font-semibold tracking-[-0.015em]">
              {title}
            </h2>
            {text && <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{text}</p>}
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}

const StopNote = () => (
  <p className="flex items-start gap-2.5 rounded-control bg-surface-2/70 px-3.5 py-3 text-[13px] leading-relaxed text-fg">
    <Hand size={15} aria-hidden className="mt-0.5 shrink-0 text-fg-2" />
    <span>
      Para parar de receber a qualquer momento, responda <strong>PARAR</strong> no WhatsApp. Para voltar, responda <strong>VOLTAR</strong>.
    </span>
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
      <div className="flex flex-col gap-3 rounded-[calc(var(--r-card)-4px)] border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-2 text-[15px]">
          <strong className="tnum">{formatPhone(sub.phone)}</strong>
          <Badge tone="ok">Verificado</Badge>
          {sub.optedOut && <Badge tone="warn">Você respondeu PARAR</Badge>}
        </p>
        <div className="flex gap-1.5">
          <button type="button" className={btn.subtle} onClick={() => setPhone("")}>
            Trocar número
          </button>
          <button
            type="button"
            className={btn.quiet}
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
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" className={`${btn.small} max-sm:h-11`} disabled={pending || code.length !== 6}>
          Confirmar
        </button>
        <button type="button" className={`${btn.quiet} max-sm:h-11`} disabled={pending} onClick={() => setStep("number")}>
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
      <button type="submit" className={`${btn.small} max-sm:h-11 max-sm:w-full`} disabled={pending || !phone}>
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
      <div className="space-y-2">
        {REPORT_KINDS.map((k) => (
          <div key={k.id} className="rounded-[calc(var(--r-card)-4px)] border border-line px-4 py-3 transition-colors hover:bg-surface-2/50">
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
          </div>
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
        className={`${btn.subtle} max-sm:h-11 max-sm:w-full`}
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

/** Últimas mensagens como uma conversa: o que a VYZ mandou à esquerda, as respostas da pessoa à direita. */
function Messages({ data, timeZone }: { data: WhatsappPageData; timeZone: string }) {
  if (!data.messages.length) return <p className="text-[14px] text-fg-2">Nenhuma mensagem ainda.</p>;
  const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone });
  return (
    <ul className="space-y-3 rounded-[calc(var(--r-card)-4px)] bg-surface-2/60 p-3 sm:p-4">
      {data.messages.map((m) => {
        const mine = m.kind === "resposta";
        return (
          <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-[16px] px-3.5 py-2.5 text-[13.5px] shadow-card ${mine ? "rounded-br-[5px] bg-accent-soft" : "rounded-bl-[5px] border border-line bg-card"}`}>
              <p className="text-[12px] font-semibold text-fg-2">{KIND_LABEL[m.kind] ?? m.kind}</p>
              {m.body && <p className="mt-0.5 line-clamp-4 leading-relaxed whitespace-pre-line text-fg">{m.body}</p>}
              {m.error && <p className="mt-1 text-[12px] text-error-fg">{m.error}</p>}
              <p className={`mt-1 text-right text-[11px] tnum ${m.status === "failed" ? "text-error-fg" : "text-fg-2"}`}>
                {fmt.format(new Date(m.createdAt))} · {STATUS_LABEL[m.status] ?? m.status}
              </p>
            </div>
          </li>
        );
      })}
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
        <p className="rounded-control border border-dashed border-line px-3.5 py-2.5 text-[13px] text-fg-2">Modo simulado: o WhatsApp da VYZ ainda não está configurado neste ambiente. As mensagens ficam registradas como &quot;simulado&quot; e nada é enviado.</p>
      )}
      <Section id="h-wa-numero" step={1} done={verified} title="Número" text="Enviamos um código pelo WhatsApp para confirmar que o número é seu.">
        <NumberForm data={data} notify={toast.show} />
      </Section>
      <Section id="h-wa-relatorios" step={2} title="O que receber" text={verified ? "Escolha os relatórios. Vale só para você neste workspace." : "Verifique o número para escolher os relatórios."}>
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
    <div className="space-y-6">
      <Link href="/painel/configuracoes#workspace" className={`${btn.quiet} -ml-3 -mb-2`}>
        <ArrowLeft size={15} aria-hidden /> Configurações
      </Link>
      <PageHeader title="Relatórios no WhatsApp" text={allowed ? PITCH : `${availableIn("avancado")}. ${PITCH}`} />
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
