"use client";

// Compartilhar, PDF ou relatório num dashboard só com dados de exemplo: explica
// por que não dá e leva a conectar (o cliente veria números que não são dele).

import { PlugZap } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { SAMPLE_SHARE_BLOCKED } from "./sample-gate";

export function SampleBlockedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Ainda não dá para compartilhar">
      <p data-sample-blocked className="text-[14.5px] leading-relaxed text-fg-2">
        {SAMPLE_SHARE_BLOCKED}
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={`${btn.ghost} h-10`}>
          Agora não
        </button>
        <Link href="/painel/contas" className={btn.small}>
          <PlugZap size={15} aria-hidden /> Conectar contas
        </Link>
      </div>
    </Modal>
  );
}
