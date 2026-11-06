"use client";

// Tela de entrada (Brand Showcase, pág. 17): e-mail e senha, Google ou Apple. A
// sessão nasce no servidor (cookies httpOnly); aqui só o formulário. Sem
// JavaScript o formulário também funciona (Server Action com useActionState).

import Link from "next/link";
import { useActionState, useId } from "react";
import { PendingChip } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { signIn, signInWithApple, signInWithGoogle } from "@/server/auth/actions";
import { AppleMark } from "./AppleMark";
import { AuthCard, authLink } from "./AuthShell";
import { AuthInput, FormAlert, PasswordInput, useFocusFirstInvalid } from "./fields";
import { APPLE_PENDING, GOOGLE_PENDING, type GoogleStatus } from "./google";
import { GoogleMark } from "./GoogleMark";
import type { Notice } from "./messages";


export function LoginPage({ next, google, apple = "unknown", notice = null }: { next: string; google: GoogleStatus; apple?: GoogleStatus; notice?: Notice | null }) {
  const id = useId();
  // permalink: sem JavaScript o estado volta pela URL, para o formulário do
  // fallback (casca estática) e o do conteúdo, que têm posições diferentes.
  const [state, signInAction, signingIn] = useActionState(signIn, null, "/entrar");
  const [googleState, googleAction, openingGoogle] = useActionState(signInWithGoogle.bind(null, next), null, "/entrar");
  const [appleState, appleAction, openingApple] = useActionState(signInWithApple.bind(null, next), null, "/entrar");
  const formRef = useFocusFirstInvalid(state);

  const fields = state?.ok === false ? state.error.fields : undefined;
  const error = state?.ok === false && !fields ? state.error.message : googleState?.ok === false ? googleState.error.message : appleState?.ok === false ? appleState.error.message : null;
  const googleOff = google === "disabled";
  const appleOff = apple === "disabled";
  const busy = signingIn || openingGoogle || openingApple;
  const googleForm = `${id}-google`;
  const appleForm = `${id}-apple`;

  return (
    <AuthCard
      title="Entrar no VYZ"
      footer={
        <>
          <p>
            Ainda não tem conta?{" "}
            <Link href="/assinar" className={authLink}>
              Assine
            </Link>
          </p>
          <p>
            <Link href="/#planos" className="underline-offset-4 hover:text-fg hover:underline">
              Ver planos e preços
            </Link>
          </p>
        </>
      }
    >
      <form ref={formRef} action={signInAction} noValidate className="mt-4 space-y-3">
        {notice && !state && <FormAlert tone={notice.tone}>{notice.message}</FormAlert>}
        <input type="hidden" name="next" value={next} />
        <AuthInput
          label="E-mail"
          hideLabel
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="nome@empresa.com"
          defaultValue={state?.values?.email}
          error={fields?.email}
        />
        <PasswordInput label="Senha" hideLabel name="password" autoComplete="current-password" placeholder="Senha" error={fields?.password} />
        <p className="text-right text-[13px]">
          <Link href="/recuperar-senha" className="text-fg-2 underline-offset-4 hover:text-accent hover:underline">
            Esqueci minha senha
          </Link>
        </p>
        <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-[auto_1fr]">
          <button type="submit" disabled={busy} className={`${btn.primary} rounded-[10px]`}>
            {signingIn ? "Entrando…" : "Entrar"}
          </button>
          <button
            type="submit"
            form={googleForm}
            disabled={busy || googleOff}
            aria-describedby={googleOff ? `${id}-google-aviso` : undefined}
            className={`${btn.secondary} rounded-[10px]`}
          >
            <GoogleMark /> {openingGoogle ? "Abrindo o Google…" : "Entrar com Google"}
          </button>
        </div>
        <button
          type="submit"
          form={appleForm}
          disabled={busy || appleOff}
          aria-describedby={appleOff ? `${id}-apple-aviso` : undefined}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-black px-4 text-[14.5px] font-semibold text-white transition hover:bg-black/85 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/85"
        >
          <AppleMark /> {openingApple ? "Abrindo a Apple…" : "Entrar com Apple"}
        </button>
        {error && <FormAlert>{error}</FormAlert>}
        {googleOff && (
          <p id={`${id}-google-aviso`}>
            <PendingChip label={GOOGLE_PENDING.label} detail={GOOGLE_PENDING.detail} />
          </p>
        )}
      </form>
      {appleOff && (
        <p id={`${id}-apple-aviso`} className="mt-2">
          <PendingChip label={APPLE_PENDING.label} detail={APPLE_PENDING.detail} />
        </p>
      )}
      {/* Formulários à parte: os botões do Google e da Apple não enviam e-mail nem senha. */}
      <form id={googleForm} action={googleAction} hidden />
      <form id={appleForm} action={appleAction} hidden />
    </AuthCard>
  );
}
