// Dobra "Veja por dentro": o vídeo do produto, no lugar da demonstração. Sem o vídeo
// configurado (NEXT_PUBLIC_DEMO_VIDEO_URL), a dobra não aparece.

import { CutReveal } from "@/components/motion/CutReveal";
import { DEMO_VIDEO, VIDEO_SECTION_ID } from "@/features/marketing/video";
import { VideoPlayer } from "./VideoPlayer";

export function PorDentro() {
  if (!DEMO_VIDEO) return null;
  return (
    <section id={VIDEO_SECTION_ID} aria-labelledby="por-dentro-title" className="relative bg-card">
      <div className="mx-auto max-w-[1360px] px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-20 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="label-caps text-fg-2">Por dentro</p>
            <CutReveal as="h2" id="por-dentro-title" className="display mt-4 text-[clamp(2.2rem,5vw,4rem)] text-fg" lines={["Veja por dentro."]} />
          </div>
          <span className="rounded-chip border border-line px-2.5 py-0.5 text-[12px] font-medium text-fg-2">Amostra · dados fictícios</span>
        </div>
        <div className="mx-auto mt-8 max-w-[1120px]">
          <VideoPlayer sources={DEMO_VIDEO} />
        </div>
      </div>
    </section>
  );
}
