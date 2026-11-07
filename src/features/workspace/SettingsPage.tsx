"use client";

// Configurações: perfil, workspace, marca própria (logo no Storage pelo
// servidor), segurança, equipe, histórico de acessos e atividade do
// workspace. Tudo vem do servidor e grava por Server Actions.

import { AlertTriangle, ArrowRight, ImageOff, LogIn } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { ColorField } from "@/components/ui/ColorField";
import { Switch } from "@/components/ui/controls";
import { FileInput } from "@/components/ui/FileInput";
import { LockBadge, PageHeader, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { ChangePasswordForm, SignOutEverywhereButton } from "@/features/auth/AccountSecurity";
import { formatPhone } from "@/features/checkout/phone";
import { relativeTime } from "@/features/integrations/sync-label";
import { removeBrandLogo, updateProfile, updateWorkspace, uploadBrandLogo } from "@/server/workspace/actions";
import type { AccessEvent, ActivityItem, SettingsData } from "./dto";
import { LOGO_ACCEPT, LOGO_HINT, logoProblem } from "./logo";
import { hasRole, ROLE_LABEL } from "./session";
import { TeamSection } from "./TeamSection";
import { useWorkspaceSession } from "./WorkspaceProvider";
import { Paywall } from "@/components/ui/Paywall";

type Notify = (msg: string) => void;

function Section({ id, title, aside, text, children }: { id: string; title: string; aside?: ReactNode; text?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-card border border-line bg-card p-5" aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="title text-lg">
          {title}
        </h2>
        {aside}
      </div>
      {text && <p className="-mt-2 text-[14px] text-fg-2">{text}</p>}
      {children}
    </section>
  );
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[13px] text-error-fg">
      {children}
    </p>
  );
}

// ---- perfil e workspace -----------------------------------------------------------------

function ProfileForm({ profile, notify }: { profile: SettingsData["profile"]; notify: Notify }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ? formatPhone(profile.phone) : "");
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; form?: string }>({});
  const [pending, start] = useTransition();
  const dirty = fullName !== profile.fullName || phone !== (profile.phone ? formatPhone(profile.phone) : "");
  const save = () =>
    start(async () => {
      const res = await updateProfile({ fullName, phone });
      if (!res.ok) return setErrors(res.error.fields ?? { form: res.error.message });
      setErrors({});
      notify("Perfil salvo.");
    });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Seu nome" value={fullName} onChange={setFullName} error={errors.fullName} />
        <TextField label="WhatsApp" value={phone} onChange={(v) => setPhone(formatPhone(v))} inputMode="tel" placeholder="(71) 99999-9999" error={errors.phone} hint="Opcional. Para avisos da conta." />
        <TextField label="E-mail" value={profile.email} onChange={() => {}} disabled hint="O e-mail de acesso não muda por aqui." />
      </div>
      {errors.form && <ErrorLine>{errors.form}</ErrorLine>}
      <button type="submit" className={btn.small} disabled={!dirty || pending}>
        {pending ? "Salvando…" : "Salvar perfil"}
      </button>
    </form>
  );
}

function WorkspaceForm({ canEdit, notify }: { canEdit: boolean; notify: Notify }) {
  const { workspace } = useWorkspaceSession();
  const [name, setName] = useState(workspace.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await updateWorkspace({ name });
      if (!res.ok) return setError(res.error.message);
      setError(null);
      notify("Workspace salvo.");
    });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="max-w-md">
        <TextField label="Nome do workspace" value={name} onChange={setName} disabled={!canEdit} hint={canEdit ? "Aparece no menu e nos convites." : "Só admins mudam o nome."} error={error} />
      </div>
      {canEdit && (
        <button type="submit" className={btn.small} disabled={pending || !name.trim() || name.trim() === workspace.name}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      )}
    </form>
  );
}

// ---- marca própria ----------------------------------------------------------------------

function BrandForm({ canEdit, notify }: { canEdit: boolean; notify: Notify }) {
  const { workspace } = useWorkspaceSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (task: () => Promise<{ ok: boolean; error?: { message: string } }>, done: string) =>
    start(async () => {
      setError(null);
      try {
        const res = await task();
        if (!res.ok) return setError(res.error?.message ?? "Não deu certo. Tente de novo.");
        notify(done);
      } catch {
        // passou do limite de envio do servidor ou caiu a conexão
        setError("Não foi possível enviar o arquivo. Tente uma imagem menor.");
      }
    });

  const upload = (file: File) => {
    const problem = logoProblem(file);
    if (problem) return setError(problem);
    const form = new FormData();
    form.set("logo", file);
    run(() => uploadBrandLogo(form), "Logo enviado.");
  };

  return (
    <div className="space-y-5" aria-busy={pending}>
      <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-start">
        <div className="flex h-[112px] items-center justify-center rounded-card border border-line bg-bg p-3">
          {workspace.brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo do Storage, tamanho livre
            <img src={workspace.brandLogoUrl} alt={`Logo de ${workspace.name}`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[12px] text-fg-2">
              <ImageOff size={20} aria-hidden /> Sem logo
            </span>
          )}
        </div>
        {canEdit ? (
          <div className="space-y-2">
            <FileInput label="Logo" hint={LOGO_HINT} accept={LOGO_ACCEPT} onFile={upload} compact />
            {workspace.brandLogoUrl && (
              <button type="button" className={`${btn.ghost} h-8 px-2 text-[13px] text-fg-2`} disabled={pending} onClick={() => run(removeBrandLogo, "Logo removido.")}>
                Remover logo
              </button>
            )}
          </div>
        ) : (
          <p className="text-[13.5px] text-fg-2">Só admins trocam a marca.</p>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-6">
        {canEdit ? (
          <ColorField label="Cor da marca" value={workspace.brandColor} onChange={(brandColor) => run(() => updateWorkspace({ brandColor }), "Cor salva.")} />
        ) : (
          <p className="text-[13.5px]">
            Cor: <span className="inline-block size-3 rounded-[3px] align-middle" style={{ background: workspace.brandColor }} /> {workspace.brandColor.toUpperCase()}
          </p>
        )}
        <Switch
          label="Esconder a marca VYZ"
          hint="No dashboard, no link compartilhado e no PDF."
          checked={workspace.hideVyzBrand}
          disabled={!canEdit || pending}
          onChange={(hideVyzBrand) => run(() => updateWorkspace({ hideVyzBrand }), hideVyzBrand ? "Marca VYZ escondida." : "Marca VYZ de volta.")}
        />
      </div>
      {pending && <p className="text-[13px] text-fg-2">Salvando…</p>}
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}

// ---- histórico ------------------------------------------------------------------------------

function When({ at, now, timeZone }: { at: string; now: string; timeZone: string }) {
  const full = new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(at));
  return (
    <time dateTime={at} title={full} className="shrink-0 text-[12px] text-fg-2 tnum">
      {relativeTime(at, now, timeZone)}
    </time>
  );
}

function AccessList({ items, now, timeZone }: { items: AccessEvent[]; now: string; timeZone: string }) {
  if (!items.length) return <p className="text-[13.5px] text-fg-2">Nenhum acesso registrado ainda.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((e) => (
        <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-[13.5px]">
          <span className="flex min-w-0 gap-2.5">
            {e.tone === "warn" ? <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0 text-error-fg" /> : <LogIn size={15} aria-hidden className="mt-0.5 shrink-0 text-fg-2" />}
            <span className="min-w-0">
              <span className={`block ${e.tone === "warn" ? "text-error-fg" : ""}`}>{e.label}</span>
              <span className="block truncate text-[12px] text-fg-2">
                {e.device}
                {e.ip ? ` · IP ${e.ip}` : ""}
              </span>
            </span>
          </span>
          <When at={e.at} now={now} timeZone={timeZone} />
        </li>
      ))}
    </ul>
  );
}

function ActivityList({ items, now, timeZone }: { items: ActivityItem[]; now: string; timeZone: string }) {
  if (!items.length) return <p className="text-[13.5px] text-fg-2">Nada registrado ainda.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 text-[13.5px]">
          <span className="min-w-0">
            <span className={`block ${a.tone === "warn" ? "text-error-fg" : ""}`}>{a.label}</span>
            <span className="block text-[12px] text-fg-2">{a.actorName ?? "Sistema"}</span>
          </span>
          <When at={a.at} now={now} timeZone={timeZone} />
        </li>
      ))}
    </ul>
  );
}

// ---- página ---------------------------------------------------------------------------------

export function SettingsPage({ data }: { data: SettingsData }) {
  const { workspace, role, access } = useWorkspaceSession();
  const toast = useToast();
  const admin = hasRole(role, "admin");
  const white = !!access.entitlements?.whiteLabel && access.hasAccess;
  const tz = workspace.timezone;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Configurações" title="Conta e workspace" text={`${workspace.name} · você é ${ROLE_LABEL[role].toLowerCase()} deste workspace.`} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Section id="h-perfil" title="Perfil">
          <ProfileForm profile={data.profile} notify={toast.show} />
        </Section>
        <Section id="h-ws" title="Workspace">
          <WorkspaceForm canEdit={admin} notify={toast.show} />
        </Section>
      </div>

      <Section id="h-marca" title="Marca própria (white-label)" aside={!white && <LockBadge label="Sob consulta" />}>
        <p className="-mt-2 text-[14px] text-fg-2">Seu logo e suas cores no dashboard, no link e no PDF, sem a marca VYZ.</p>
        {white ? (
          <BrandForm canEdit={admin} notify={toast.show} />
        ) : (
          <Paywall current={access.hasAccess ? access.tier : null} required="personalizado" feature="Marca própria" text="Para agências que entregam o dashboard como se fosse delas.">
            <BrandForm canEdit={false} notify={toast.show} />
          </Paywall>
        )}
      </Section>

      <Section
        id="h-whatsapp"
        title="Relatórios no WhatsApp"
        aside={!access.entitlements?.whatsappReports && <LockBadge label="Avançado" />}
        text="Resumo diário, semanal e alertas no seu WhatsApp, pelo número oficial da VYZ. Responda PARAR para não receber mais."
      >
        <Link href="/painel/whatsapp" className={btn.small}>
          Configurar WhatsApp <ArrowRight size={15} aria-hidden />
        </Link>
      </Section>

      <Section id="h-seguranca" title="Segurança" text="Trocar a senha pede a senha atual. Os outros aparelhos saem da conta.">
        <ChangePasswordForm />
        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-fg-2">Esqueceu um aparelho logado? Saia de todos, inclusive deste.</p>
          <SignOutEverywhereButton className="shrink-0" />
        </div>
      </Section>

      <Section id="h-equipe" title="Equipe" text={admin ? "Convide por e-mail, escolha o papel de cada pessoa e tire quem não precisa mais de acesso." : undefined}>
        <TeamSection data={data} role={role} timeZone={tz} notify={toast.show} />
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section id="h-acessos" title="Seus acessos" text="Entradas, saídas e trocas de senha da sua conta, com o aparelho e o IP.">
          <AccessList items={data.access} now={data.now} timeZone={tz} />
        </Section>
        {data.activity && (
          <Section id="h-atividade" title="Atividade do workspace" text="O que a equipe e o sistema fizeram aqui: cobrança, conexões, dashboards e mudanças de dados.">
            <ActivityList items={data.activity} now={data.now} timeZone={tz} />
          </Section>
        )}
      </div>
      {toast.node}
    </div>
  );
}
