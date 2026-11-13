"use client";

import { CircleCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { Modal, PendingChip, SelectField, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { createScheduledReport } from "@/server/share/actions";
import { FORMAT_LABEL, scheduleLabel, WEEKDAYS, type ReportFormat, type ReportFrequency } from "./schedule";

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }));

/** Agenda o envio do dashboard. Fica gravado no servidor; o envio automático ainda está pendente. */
export function ReportModal({ open, onClose, dashboard }: { open: boolean; onClose: () => void; dashboard: { id: string; name: string } }) {
  const [frequency, setFrequency] = useState<ReportFrequency>("weekly");
  const [day, setDay] = useState(1);
  const [sendHour, setSendHour] = useState(8);
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [recipients, setRecipients] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const r = await createScheduledReport({ dashboardId: dashboard.id, frequency, day, sendHour, format, recipients });
      if (!r.ok) return setError(r.error.fields?.recipients ?? r.error.message);
      setSaved(scheduleLabel({ frequency, weekday: frequency === "weekly" ? day : null, monthDay: frequency === "monthly" ? day : null, sendHour }));
      setRecipients("");
    });
  }

  function close() {
    onClose();
    setSaved(null);
    setError(null);
  }

  return (
    <Modal open={open} onClose={close} title="Agendar relatório">
      <div className="space-y-4 text-[14px]">
        <p className="leading-relaxed text-fg-2">
          Envio periódico de <strong className="text-fg">{dashboard.name}</strong>.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField
            label="Frequência"
            value={frequency}
            onChange={(v) => {
              setFrequency(v as ReportFrequency);
              setDay(1);
            }}
            options={[
              { value: "weekly", label: "Semanal" },
              { value: "monthly", label: "Mensal" },
            ]}
          />
          <SelectField
            label="Dia"
            value={String(day)}
            onChange={(v) => setDay(Number(v))}
            options={frequency === "weekly" ? WEEKDAYS.map((w, i) => ({ value: String(i), label: w })) : Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Dia ${i + 1}` }))}
          />
          <SelectField label="Horário" value={String(sendHour)} onChange={(v) => setSendHour(Number(v))} options={HOURS} />
        </div>
        <SelectField
          label="Formato"
          value={format}
          onChange={(v) => setFormat(v as ReportFormat)}
          options={(["pdf", "whatsapp"] as const).map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
        />
        <TextField
          label="Destinatários"
          value={recipients}
          onChange={setRecipients}
          error={error}
          placeholder={format === "pdf" ? "cliente@empresa.com, gestor@agencia.com" : "71 99999-0000"}
          hint={format === "pdf" ? "E-mails separados por vírgula (até 10)." : "WhatsApp com DDD, separados por vírgula (até 10)."}
        />
        <PendingChip label="Envio automático pendente" detail="O agendamento fica salvo e aparece em Compartilhar. O envio por e-mail e WhatsApp entra quando o serviço de envio estiver ligado." />
        {saved && (
          <p role="status" className="flex items-start gap-2 rounded-control border border-accent/40 bg-accent-soft px-3 py-2.5 text-[13px] leading-snug">
            <CircleCheck size={15} aria-hidden className="mt-px shrink-0 text-accent" />
            <span>Agendado · {saved}</span>
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end max-sm:[&>*]:w-full">
          <button type="button" onClick={close} disabled={pending} className={btn.ghost.replace("h-10 px-3", "h-9 px-3 text-[13.5px]")}>
            {saved ? "Fechar" : "Cancelar"}
          </button>
          <button type="button" onClick={save} disabled={pending || !recipients.trim()} className={btn.small}>
            {pending ? "Salvando…" : "Salvar agendamento"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
