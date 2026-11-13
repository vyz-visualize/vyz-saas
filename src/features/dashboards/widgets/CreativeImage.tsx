"use client";

// A imagem real do anúncio nos dashboards de modelo. Vídeo: a capa, com o play por cima.
// Proporção fixa (quem chama dá o tamanho), esqueleto enquanto carrega, carregamento sob
// demanda e, se a imagem falhar (o link da plataforma expira) ou não existir, a miniatura
// de amostra que veio em `fallback`.

import { useState, type ReactNode } from "react";

/** Formato de vídeo, em qualquer das grafias que chegam ("video", "Vídeo", "Reels"). */
export const isVideoFormat = (format: string | null | undefined) => /^(video|v[íi]deo|reels?)$/i.test((format ?? "").trim());

type CreativeImageProps = {
  src?: string | null;
  /** Anúncio em vídeo: a imagem é a capa e ganha o ícone de play. */
  video?: boolean;
  /** Sem imagem (ou se ela falhar): a miniatura de amostra. */
  fallback: ReactNode;
  /** Tamanho e proporção (ex.: "aspect-[4/3]", "size-10 rounded-full"). */
  className?: string;
  /** Play menor, para miniaturas pequenas. */
  compact?: boolean;
};

export function CreativeImage({ src, video = false, fallback, className = "", compact = false }: CreativeImageProps) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  const image = src && broken !== src ? src : null;
  if (!image) return <div className={`relative overflow-hidden ${className}`}>{fallback}</div>;
  const ready = loaded === image;
  return (
    <div className={`relative overflow-hidden bg-line/40 ${className}`} data-creative-image={ready ? "loaded" : "loading"}>
      {!ready && <span aria-hidden className="absolute inset-0 bg-line/50 motion-safe:animate-pulse" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem da plataforma (domínio variável, link assinado) */}
      <img
        // imagem que já veio do cache antes da hidratação não dispara onLoad: confere ao montar
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0 && loaded !== image) setLoaded(image);
        }}
        src={image}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(image)}
        onError={() => setBroken(image)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {video && ready && (
        <span aria-hidden className="absolute inset-0 grid place-items-center">
          <span className={`grid place-items-center rounded-full bg-black/55 text-white backdrop-blur-[2px] ${compact ? "size-5" : "size-9"}`}>
            <svg viewBox="0 0 24 24" className={compact ? "ml-px size-2.5" : "ml-0.5 size-4"} fill="currentColor">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
        </span>
      )}
    </div>
  );
}
