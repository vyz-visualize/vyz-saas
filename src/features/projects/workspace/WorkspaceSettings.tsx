"use client";

// Aba Ajustes de um workspace: a identidade (logo e cor, member), o nome (member) e a zona de
// perigo (arquivar, admin): as contas saem do ar e o workspace libera espaço no plano;
// dashboards e dados ficam. A logo também vai para os dashboards deste cliente, no lugar da
// logo da organização.

import { Archive, Check, Pipette } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FileInput } from "@/components/ui/FileInput";
import { Modal, ModalActions, PageHeader, SectionHeader, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { shortDate } from "@/features/integrations/sync-label";
import { LOGO_ACCEPT, LOGO_HINT, logoProblem } from "@/features/workspace/logo";
import { useOptionalWorkspaceSession } from "@/features/workspace/WorkspaceProvider";
import { archiveProject, renameProject } from "@/server/projects/actions";
import { removeProjectLogo, setProjectColor, uploadProjectLogo } from "@/server/projects/identity";
import { normalizeProjectColor, PROJECT_COLORS, textOn } from "../identity";
import type { ProjectSummary } from "../types";
import { WorkspaceAvatar } from "../WorkspaceAvatar";

/** Cor livre (o seletor do sistema): grava quando a pessoa para de mexer. */
const CUSTOM_DELAY_MS = 600;

function Swatch({ hex, label, selected, disabled, onPick }: { hex: string | null; label: string; selected: boolean; disabled: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={`relative inline-flex size-9 items-center justify-center rounded-full outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50 ${selected ? "ring-2 ring-fg ring-offset-2 ring-offset-card" : ""} ${hex ? "" : "bg-accent"}`}
      style={hex ? { background: hex } : undefined}
    >
      {selected && <Check size={16} strokeWidth={3} aria-hidden style={{ color: hex ? textOn(hex) : "var(--on-accent)" }} />}
    </button>
  );
}

export function WorkspaceSettings({ summary, timeZone }: { summary: ProjectSummary; timeZone: string }) {
  const toast = useToast();
  const router = useRouter();
  const session = useOptionalWorkspaceSession();
  const whiteLabel = !!session?.access.entitlements?.whiteLabel;
  const [name, setName] = useState(summary.name);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [color, setColor] = useState<string | null>(summary.color ?? null);
  const [logo, setLogo] = useState<string | null>(summary.logoUrl ?? null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [saving, startSaving] = useTransition();
  const custom = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(custom.current), []);

  const rename = () =>
    start(async () => {
      const r = await renameProject(summary.id, name);
      if (!r.ok) return setError(r.error.fields?.name ?? r.error.message);
      setError(null);
      toast.show("Nome atualizado.");
    });
  const archive = () =>
    start(async () => {
      const r = await archiveProject(summary.id);
      if (!r.ok) return toast.show(r.error.message, "blocked");
      setArchiving(false);
      router.push("/painel/workspaces");
    });

  const saveColor = (next: string | null, before: string | null) =>
    startSaving(async () => {
      const r = await setProjectColor(summary.id, next);
      if (r.ok) return toast.show(next ? "Cor atualizada." : "Voltou à cor padrão.");
      setColor(before);
      toast.show(r.error.message, "blocked");
    });
  const pickColor = (next: string | null) => {
    if (next === color) return;
    window.clearTimeout(custom.current);
    const before = color;
    setColor(next);
    saveColor(next, before);
  };
  const pickCustom = (value: string) => {
    const next = normalizeProjectColor(value);
    if (!next) return;
    const before = color;
    setColor(next);
    window.clearTimeout(custom.current);
    custom.current = window.setTimeout(() => saveColor(next, before), CUSTOM_DELAY_MS);
  };

  const sendLogo = (file: File) => {
    const problem = logoProblem(file);
    if (problem) return setLogoError(problem);
    setLogoError(null);
    const form = new FormData();
    form.set("projectId", summary.id);
    form.set("logo", file);
    startSaving(async () => {
      const r = await uploadProjectLogo(form);
      if (!r.ok) return setLogoError(r.error.message);
      setLogo(r.data.url);
      toast.show("Logo atualizada.");
    });
  };
  const dropLogo = () =>
    startSaving(async () => {
      const r = await removeProjectLogo(summary.id);
      if (!r.ok) return setLogoError(r.error.message);
      setLogo(null);
      toast.show("Logo retirada.");
    });

  const preset = !color || PROJECT_COLORS.some((c) => c.hex === color);

  return (
    <div className="max-w-3xl space-y-5 lg:space-y-6">
      <PageHeader title="Ajustes" text={`A identidade e o nome de ${summary.name}, e o que fazer quando o cliente sair.`} />

      <section aria-labelledby="h-identidade" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
        <SectionHeader
          id="h-identidade"
          title="Logo e cor"
          text={`Identificam o workspace no menu, nas listas e no cabeçalho. Nos dashboards deste cliente, a logo entra no lugar da logo da organização${whiteLabel ? "" : " (no link do cliente, com a marca própria do plano)"}.`}
        />

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-4">
            <WorkspaceAvatar name={name || summary.name} color={color} logoUrl={logo} size={72} className="shadow-card" />
            <div className="min-w-0 sm:hidden">
              <p className="truncate text-[15px] font-semibold">{name || summary.name}</p>
              <p className="text-[12.5px] text-fg-2">Prévia</p>
            </div>
          </div>
          {summary.canEdit ? (
            <div className="min-w-0 flex-1 space-y-2">
              <FileInput label={logo ? "Trocar a logo" : "Logo do cliente"} hint={LOGO_HINT} accept={LOGO_ACCEPT} onFile={sendLogo} error={logoError} compact />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
                {logo && (
                  <button type="button" onClick={dropLogo} disabled={saving} className="font-medium text-fg-2 underline-offset-4 hover:text-fg hover:underline disabled:opacity-50">
                    Tirar a logo
                  </button>
                )}
                {saving && <span className="text-fg-2">Salvando…</span>}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-fg-2">Só editores e admins mudam a logo e a cor.</p>
          )}
        </div>

        <fieldset className="mt-6 border-t border-line pt-5" disabled={!summary.canEdit}>
          <legend className="sr-only">Cor</legend>
          <p className="text-[13.5px] font-semibold">Cor</p>
          <p className="mt-0.5 text-[12.5px] text-fg-2">Aparece nas iniciais quando o workspace não tem logo.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Swatch hex={null} label="Cor padrão" selected={!color} disabled={!summary.canEdit} onPick={() => pickColor(null)} />
            {PROJECT_COLORS.map((c) => (
              <Swatch key={c.hex} hex={c.hex} label={c.name} selected={color === c.hex} disabled={!summary.canEdit} onPick={() => pickColor(c.hex)} />
            ))}
            {/* cor livre: o seletor do sistema */}
            <label
              title="Outra cor"
              className={`relative inline-flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-line bg-surface-2 text-fg-2 transition-transform duration-150 hover:scale-105 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-card ${!preset ? "ring-2 ring-fg ring-offset-2 ring-offset-card" : ""}`}
              style={!preset && color ? { background: color, color: textOn(color), borderStyle: "solid" } : undefined}
            >
              <span className="sr-only">Outra cor</span>
              <Pipette size={15} aria-hidden />
              <input type="color" value={color ?? "#4b5320"} onChange={(e) => pickCustom(e.target.value)} disabled={!summary.canEdit} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="h-nome-ws" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
        <SectionHeader id="h-nome-ws" title="Nome" text="O cliente ou a marca. Aparece no menu, nos convites e nos dashboards daqui." />
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            rename();
          }}
        >
          <div className="max-w-md">
            <TextField label="Nome do workspace" value={name} onChange={setName} error={error} disabled={!summary.canEdit} hint={summary.canEdit ? `Criado em ${shortDate(summary.createdAt, timeZone)}.` : "Só editores e admins mudam o nome."} />
          </div>
          {summary.canEdit && (
            <button type="submit" disabled={pending || !name.trim() || name.trim() === summary.name} className={`${btn.small} max-sm:h-11 max-sm:w-full`}>
              {pending ? "Salvando…" : "Salvar nome"}
            </button>
          )}
        </form>
      </section>

      {summary.canManage && (
        <section aria-labelledby="h-perigo" className="rounded-card border border-error/40 bg-card p-5 shadow-card sm:p-6">
          <SectionHeader id="h-perigo" title="Arquivar workspace" text="As contas daqui saem do ar e o workspace libera espaço no plano. Os dashboards e os dados já importados ficam guardados." />
          <button type="button" onClick={() => setArchiving(true)} className={`${btn.subtle} mt-5 hover:!border-error hover:!text-error-fg`}>
            <Archive size={15} aria-hidden /> Arquivar {summary.name}
          </button>
        </section>
      )}

      <Modal open={archiving} onClose={() => setArchiving(false)} title="Arquivar workspace">
        <div className="space-y-5">
          <p className="text-[14.5px] leading-relaxed">
            As contas de <strong>{summary.name}</strong> saem do ar e o workspace libera espaço no plano. Os dashboards e os dados já importados ficam.
          </p>
          <ModalActions>
            <button type="button" onClick={() => setArchiving(false)} className={`${btn.quiet} max-sm:h-11`}>
              Cancelar
            </button>
            <button type="button" onClick={archive} disabled={pending} className={`${btn.danger} max-sm:h-11`}>
              {pending ? "Arquivando…" : "Arquivar"}
            </button>
          </ModalActions>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}
