"use client";

// Passo 1 do /assinar: dados da pessoa e da empresa, senha (só sem conta
// aberta) e aceites. Confere tudo na tela antes de enviar; o servidor
// (startCheckout) confere de novo, recalcula o pedido e segue para o pagamento.

import { ArrowRight, Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useId, useState, type FormEvent, type ReactNode } from "react";
import { CheckboxBox } from "@/components/ui/controls";
import { PendingChip } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { GoogleMark } from "@/features/auth/GoogleMark";
import { PASSWORD_HINT, passwordChecklist } from "@/features/auth/password-rules";
import { signInWithApple, signInWithGoogle } from "@/server/auth/actions";
import { AppleMark } from "@/features/auth/AppleMark";
import { startCheckout, type CheckoutFormState } from "@/server/billing/actions";
import { Field } from "./Field";
import { checkDetails, type CheckoutField, type CheckoutValues } from "./fields";
import { formatPhone } from "./phone";
import { formatTaxId } from "./tax-id";

const FIELD_ORDER: CheckoutField[] = ["fullName", "email", "password", "company", "phone", "taxId", "acceptTerms"];

type CheckoutFormProps = {
  /** Seleção da LP (toQuery); o servidor recalcula o pedido a partir dela. */
  planQuery: string;
  /** Conta aberta: pré-preenche e não pede senha. */
  account: { email: string; fullName: string; phone: string | null } | null;
  /** Workspace sem assinatura que este pedido assina. */
  workspaceName: string | null;
  /** Link para entrar e voltar a este pedido. */
  signInHref: string;
};

type Errors = Partial<Record<CheckoutField, string>>;

type ConsentProps = {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  aside?: ReactNode;
  children: ReactNode;
};

function Consent({ id, checked, onChange, error, aside, children }: ConsentProps) {
  return (
    <div role="group" aria-describedby={error ? `${id}-erro` : undefined}>
      <div className="flex items-start gap-2.5 text-[14px]">
        <span className="pt-0.5">
          <CheckboxBox id={id} checked={checked} onChange={onChange} />
        </span>
        <div className="leading-snug">
          <label htmlFor={id} className="cursor-pointer text-fg select-none">
            {children}
          </label>
          {aside && <span className="ml-1.5 inline-flex align-middle">{aside}</span>}
        </div>
      </div>
      {error && (
        <p id={`${id}-erro`} className="mt-1.5 pl-7 text-[12.5px] text-error-fg">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutForm({ planQuery, account, workspaceName, signInHref }: CheckoutFormProps) {
  const id = useId();
  const [state, formAction, pending] = useActionState<CheckoutFormState, FormData>(startCheckout, null);
  const [values, setValues] = useState<CheckoutValues>({
    fullName: account?.fullName ?? "",
    email: account?.email ?? "",
    password: "",
    company: workspaceName ?? "",
    phone: account?.phone ? formatPhone(account.phone) : "",
    taxId: "",
    acceptTerms: false,
    marketing: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);

  // resposta nova do servidor: os erros por campo dela substituem os da tela
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    setErrors(state && !state.ok ? ((state.error.fields ?? {}) as Errors) : {});
  }

  const set = <K extends CheckoutField>(key: K, value: CheckoutValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const fid = (key: CheckoutField) => `${id}-${key}`;

  // envia pela transição (e não por <form action>): o React não limpa o formulário depois de um erro
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const found = checkDetails(values, { newAccount: !account });
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const first = FIELD_ORDER.find((k) => found[k]);
      if (first) document.getElementById(fid(first))?.focus();
      return;
    }
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  const failure = state && !state.ok ? state.error : null;
  // Google: entra (ou cria a conta) e volta para este mesmo checkout, já logado
  const [googleState, googleAction, openingGoogle] = useActionState(signInWithGoogle.bind(null, `/assinar?${planQuery}`), null);
  const [appleState, appleAction, openingApple] = useActionState(signInWithApple.bind(null, `/assinar?${planQuery}`), null);
  const googleError = googleState && !googleState.ok ? googleState.error.message : appleState && !appleState.ok ? appleState.error.message : null;
  // sem conta: primeiro a escolha (Google é o caminho curto); e-mail e senha abre o formulário
  const [withEmail, setWithEmail] = useState(false);

  if (!account && !withEmail) {
    return (
      <div className="space-y-5">
        <h2 className="title text-lg text-fg">Crie sua conta</h2>
        <form action={googleAction}>
          <button type="submit" disabled={openingGoogle} className={`${btn.primary} h-13 w-full rounded-[10px] text-[15.5px]`}>
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-white">
              <GoogleMark />
            </span>
            {openingGoogle ? "Abrindo o Google…" : "Criar conta com Google"}
          </button>
        </form>
        <form action={appleAction}>
          <button type="submit" disabled={openingApple} className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-[10px] bg-black px-4 text-[15.5px] font-semibold text-white transition hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/85">
            <AppleMark />
            {openingApple ? "Abrindo a Apple…" : "Criar conta com Apple"}
          </button>
        </form>
        {googleError && <p className="text-[13px] text-error-fg">{googleError}</p>}
        <p className="text-center text-[13px] text-fg-2">Um clique, sem senha para lembrar. Você volta direto para este pedido.</p>
        <p className="flex items-center gap-3 text-[12.5px] text-fg-2" aria-hidden>
          <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
        </p>
        <button type="button" onClick={() => setWithEmail(true)} className={`${btn.secondary} w-full rounded-[10px]`}>
          Criar com e-mail e senha
        </button>
        <p className="text-center text-[13px] text-fg-2">
          Já tem conta?{" "}
          <Link href={signInHref} className="font-semibold text-accent underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="relative space-y-8">
        <input type="hidden" name="plan" value={planQuery} />
        <input type="hidden" name="acceptTerms" value={values.acceptTerms ? "on" : ""} />
        <input type="hidden" name="marketing" value={values.marketing ? "on" : ""} />
        {/* só robô preenche (fora da tela e da leitura) */}
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <label>
            Site
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <fieldset className="space-y-4">
          <legend className="title text-lg text-fg">Você</legend>
          <Field
            id={fid("fullName")}
            label="Nome completo"
            name="fullName"
            autoComplete="name"
            value={values.fullName}
            onChange={(v) => set("fullName", v)}
            error={errors.fullName}
            maxLength={120}
            required
          />
          {account ? (
            <Field id={fid("email")} label="E-mail" value={account.email} onChange={() => {}} readOnly hint="A assinatura fica nesta conta." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={fid("email")}
                label="E-mail"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nome@empresa.com"
                value={values.email}
                onChange={(v) => set("email", v)}
                error={errors.email}
                maxLength={254}
                required
              />
              <Field
                id={fid("password")}
                label="Crie uma senha"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={values.password}
                onChange={(v) => set("password", v)}
                error={errors.password}
                maxLength={72}
                required
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Esconder a senha" : "Mostrar a senha"}
                    aria-pressed={showPassword}
                    className="inline-flex size-9 items-center justify-center rounded-control text-fg-2 transition-colors hover:text-fg"
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                  </button>
                }
                hint={
                  values.password ? (
                    <ul className="flex flex-wrap gap-x-3 gap-y-0.5" aria-label="A senha precisa ter">
                      {passwordChecklist(values.password).map((r) => (
                        <li key={r.id} className={`inline-flex items-center gap-1 ${r.ok ? "text-accent" : ""}`}>
                          <Check size={12} strokeWidth={3} aria-hidden className={r.ok ? "" : "opacity-30"} />
                          {r.label}
                          <span className="sr-only">{r.ok ? " (ok)" : " (falta)"}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    PASSWORD_HINT
                  )
                }
              />
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="title text-lg text-fg">Empresa</legend>
          <Field
            id={fid("company")}
            label="Empresa ou agência"
            name="company"
            autoComplete="organization"
            value={values.company}
            onChange={(v) => set("company", v)}
            error={errors.company}
            maxLength={80}
            required
            hint={workspaceName ? `Nome na fatura. A organização continua "${workspaceName}".` : "Vira o nome da sua organização no VYZ."}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={fid("phone")}
              label="WhatsApp"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(71) 99999-9999"
              value={values.phone}
              onChange={(v) => set("phone", formatPhone(v))}
              error={errors.phone}
              required
              hint="Para avisos da conta e do suporte."
            />
            <Field
              id={fid("taxId")}
              label="CPF ou CNPJ (opcional)"
              name="taxId"
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={values.taxId}
              onChange={(v) => set("taxId", formatTaxId(v))}
              error={errors.taxId}
              hint="Para a nota fiscal."
            />
          </div>
        </fieldset>

        <div className="space-y-3">
          <Consent
            id={fid("acceptTerms")}
            checked={values.acceptTerms}
            onChange={(v) => set("acceptTerms", v)}
            error={errors.acceptTerms}
            aside={
              <PendingChip
                label="Textos em revisão"
                detail="Os documentos completos entram antes do lançamento. O seu aceite fica registrado com a versão vigente, a data e o aparelho."
              />
            }
          >
            Li e aceito os Termos de Uso e a Política de Privacidade da VYZ.
          </Consent>
          <Consent id={fid("marketing")} checked={values.marketing} onChange={(v) => set("marketing", v)}>
            Quero receber novidades e dicas da VYZ por e-mail e WhatsApp (opcional).
          </Consent>
        </div>

        {failure && (
          <div role="alert" className="rounded-control border border-error/40 bg-error-soft px-4 py-3 text-[14px] text-error-fg">
            {failure.message}
            {(failure.code === "checkout:email_exists" || failure.code === "auth:required") && (
              <>
                {" "}
                <Link href={signInHref} className="font-semibold underline underline-offset-4">
                  Entrar e continuar
                </Link>
              </>
            )}
          </div>
        )}

        <div>
          <button type="submit" disabled={pending} className={`${btn.primary} w-full rounded-[10px]`}>
            {pending ? (
              <>
                <LoaderCircle size={18} aria-hidden className="animate-spin" />
                {account ? "Salvando o pedido…" : "Criando sua conta…"}
              </>
            ) : (
              <>
                Continuar para o pagamento
                <ArrowRight size={17} aria-hidden />
              </>
            )}
          </button>
          <p className="mt-3 text-center text-[12.5px] text-fg-2">No próximo passo você confere o total e paga.</p>
        </div>
      </form>
    </>
  );
}
