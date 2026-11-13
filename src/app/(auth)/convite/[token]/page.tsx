import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/AuthShell";
import { AcceptInvite } from "@/features/workspace/AcceptInvite";
import { ROLE_LABEL, type MemberRole } from "@/features/workspace/session";
import { invitePath, isInviteToken } from "@/features/workspace/team";
import { getInvitationPreview } from "@/server/workspace/invitations";
import { getSessionUser } from "@/server/auth/session";

// O token vai na URL: nada de Referer para fora nem indexação.
export const metadata: Metadata = { title: "Convite", referrer: "no-referrer", robots: { index: false, follow: false } };

export default function Page({ params }: PageProps<"/convite/[token]">) {
  return (
    <Suspense
      fallback={
        <AuthCard title="Convite para a equipe">
          <p className="mt-3 text-[14px] text-fg-2">Conferindo o convite…</p>
        </AuthCard>
      }
    >
      <Convite params={params} />
    </Suspense>
  );
}

function Invalid() {
  return (
    <AuthCard
      title="Convite indisponível"
      description="Este convite expirou, foi cancelado ou já foi usado. Peça um novo a quem convidou você."
      footer={
        <Link href="/painel" className="font-medium text-accent">
          Ir para o painel
        </Link>
      }
    />
  );
}

async function Convite({ params }: Pick<PageProps<"/convite/[token]">, "params">) {
  const { token } = await params;
  if (!isInviteToken(token)) return <Invalid />;
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(invitePath(token))}`);

  const invite = await getInvitationPreview(token);
  if (!invite) return <Invalid />;
  if (invite.email !== (user.email ?? "").toLowerCase()) {
    return (
      <AuthCard
        title="Convite de outro e-mail"
        description={
          <>
            Você entrou como <strong className="text-fg">{user.email}</strong>, mas o convite é para outro endereço. Saia e entre com o e-mail que recebeu o convite.
          </>
        }
      />
    );
  }
  return (
    <AuthCard
      title={`Entrar na equipe de ${invite.workspaceName}`}
      description={
        <>
          Você foi convidado como <strong className="text-fg">{ROLE_LABEL[invite.role as MemberRole].toLowerCase()}</strong>. Ao aceitar, esta organização abre no seu painel.
        </>
      }
    >
      <AcceptInvite token={token} />
    </AuthCard>
  );
}
