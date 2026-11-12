"use client";

// Passo 4: recursos e marca. Os recursos que combinam com as contas
// conectadas (com o plano de cada um; os travados ficam à vista) e a logo e a
// cor da empresa, como no novo dashboard. Concluir monta as páginas do
// dashboard com as plataformas e os recursos escolhidos.

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { ColorField } from "@/components/ui/ColorField";
import { FileInput } from "@/components/ui/FileInput";
import { LockBadge } from "@/components/ui/kit";
import type { FeatureId } from "@/features/templates/dashboards/composed";
import { finishOnboarding } from "@/server/onboarding/actions";
import { removeBrandLogo, updateWorkspace, uploadBrandLogo } from "@/server/workspace/actions";
import type { FeatureOption } from "./steps";
import { StepFooter, StepHeader, useStepAction } from "./ui";

type FinishStepProps = {
  features: FeatureOption[];
  brand: { color: string; logoUrl: string | null };
  layoutName: string | null;
};

export function FinishStep({ features, brand, layoutName }: FinishStepProps) {
  const { pending, error, run } = useStepAction();
  const [chosen, setChosen] = useState<FeatureId[]>([]);
  const [color, setColor] = useState(brand.color);
  const [logo, setLogo] = useState<string | null>(brand.logoUrl);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandBusy, startBrand] = useTransition();

  function sendLogo(file: File) {
    setBrandError(null);
    const fd = new FormData();
    fd.set("logo", file);
    startBrand(async () => {
      const r = await uploadBrandLogo(fd);
      if (r.ok) setLogo(r.data.url);
      else setBrandError(r.error.message);
    });
  }

  function onContinue() {
    run(async () => {
      if (color.toLowerCase() !== brand.color.toLowerCase()) {
        const r = await updateWorkspace({ brandColor: color });
        if (!r.ok) return r;
      }
      return finishOnboarding(chosen);
    });
  }

  return (
    <section aria-labelledby="passo-titulo">
      <StepHeader
        eyebrow="Passo 4 de 4 · Recursos e marca"
        title="Os últimos detalhes"
        text={
          <>
            {layoutName ? (
              <>
                Escolha o que entra no <strong className="font-semibold text-fg">{layoutName}</strong> além das páginas das contas.{" "}
              </>
            ) : null}
            Tudo dá para mudar depois, em Editar e em Configurações.
          </>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div>
            <h2 className="title text-[17px] text-fg">Recursos</h2>
            <p className="text-[13.5px] text-fg-2">Cada recurso vira uma página. Aparecem só os que combinam com as plataformas conectadas.</p>
          </div>
          {features.length === 0 ? (
            <p className="rounded-card border border-dashed border-line p-4 text-[14px] text-fg-2">Nenhum recurso extra para estas plataformas. Conecte Meta ou Google depois para liberar mais.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {features.map((f) => {
                const on = chosen.includes(f.id);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={!f.allowed}
                      onClick={() => setChosen((cur) => (on ? cur.filter((x) => x !== f.id) : [...cur, f.id]))}
                      className={`flex h-full w-full items-start gap-3 rounded-card border p-3 text-left transition-colors disabled:cursor-not-allowed ${on ? "border-accent bg-accent-soft/60" : "border-line bg-card hover:border-accent/60"} ${f.allowed ? "" : "opacity-60"}`}
                    >
                      <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-accent bg-accent text-on-accent" : "border-line"}`}>{on && <Check size={12} aria-hidden />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 font-medium text-fg">
                          {f.label}
                          <span className={`rounded-chip px-2 py-0.5 text-[10.5px] font-semibold tracking-wide uppercase ${f.tier === "avancado" ? "bg-accent text-on-accent" : "border border-line text-fg-2"}`}>
                            {f.tier === "avancado" ? "Avançado" : "Padrão"}
                          </span>
                          {f.lockLabel && <LockBadge label={f.lockLabel} />}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] text-fg-2">{f.hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="title text-[17px] text-fg">Marca</h2>
            <p className="text-[13.5px] text-fg-2">A logo e a cor da sua empresa vestem o dashboard (e os próximos).</p>
          </div>
          <div className="space-y-4 rounded-card border border-line bg-card p-4">
            <div className="flex items-center gap-4">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-card border border-dashed border-line bg-bg" style={{ outline: `3px solid ${color}`, outlineOffset: 2 }}>
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo do próprio workspace
                  <img src={logo} alt="Logo da empresa" className="max-h-16 max-w-16 object-contain" />
                ) : (
                  <span className="text-[11px] text-fg-2">sua logo</span>
                )}
              </div>
              <div className="w-44">
                <ColorField label="Cor da marca" value={color} onChange={setColor} />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <FileInput label="Logo (PNG, JPG ou SVG)" accept="image/png,image/jpeg,image/svg+xml,image/webp" onFile={sendLogo} compact />
              {logo && (
                <button
                  type="button"
                  className="text-[12.5px] text-fg-2 underline-offset-2 hover:underline"
                  onClick={() =>
                    startBrand(async () => {
                      const r = await removeBrandLogo();
                      if (r.ok) setLogo(null);
                    })
                  }
                >
                  Tirar logo
                </button>
              )}
            </div>
            {brandBusy && <p className="text-[12px] text-fg-2">Enviando…</p>}
            {brandError && <p className="text-[12.5px] text-error">{brandError}</p>}
          </div>
        </div>
      </div>

      <StepFooter back="connect" pending={pending} error={error} disabled={brandBusy} continueLabel="Entrar no dashboard" pendingLabel="Montando o dashboard…" onContinue={onContinue} />
    </section>
  );
}
