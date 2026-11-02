"use client";

// Boas-vindas depois do checkout (?bemvindo=1): o cliente já escolhe o
// template e cai direto no editor. Cada produto tem a sua galeria.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/kit";
import { LandingGallery } from "@/features/landing-pages/LandingGallery";
import { EMPTY_TRACKING, slugFromBrand } from "@/features/landing-pages/model";
import { landingDefaults, landingTemplate } from "@/features/templates/landing-pages";
import type { LandingDraft } from "@/features/workspace/types";
import { useWorkspace } from "@/features/workspace/workspace";
import { store } from "@/lib/store/store";
import { useWorkspaceSession } from "./WorkspaceProvider";

export function WelcomeModal() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useWorkspaceSession();
  const { ws } = useWorkspace();
  const [open, setOpen] = useState(params.get("bemvindo") === "1");
  if (!open) return null;

  const firstName = session.user.fullName.split(" ")[0];
  const close = () => {
    setOpen(false);
    router.replace(window.location.pathname);
  };

  return (
    <Modal open onClose={close} title="Bem-vindo ao VYZ" full>
      <div className="mx-auto max-w-[1180px]">
        <p className="label-caps text-accent">Passo 1</p>
        <h3 className="display mt-2 text-[clamp(1.6rem,3.6vw,2.4rem)] text-fg">{firstName ? `${firstName}, escolha` : "Escolha"} o template da sua primeira página.</h3>
        <p className="mt-2 text-[15px] text-fg-2">Ele já vem com textos de exemplo e o GTM. Você ajusta tudo no próximo passo.</p>
        <div className="mt-6">
          <LandingGallery
            onUse={(id) => {
              const t = landingTemplate(id)!;
              const content = landingDefaults(t, ws.name || "Sua marca");
              store.setDoc<LandingDraft>("draft:landing", { templateId: id, content, tracking: EMPTY_TRACKING, slug: slugFromBrand(content.brand), step: 2 });
              router.push("/painel/landing-pages/novo");
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
