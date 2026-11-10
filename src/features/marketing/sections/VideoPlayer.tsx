"use client";

// O player da dobra "Veja por dentro". Duas versões, alternadas por CSS: 16:9 a partir de
// 640 px e 4:5 no celular. Só a visível carrega; a outra fica com preload="none" e sem capa.
// Antes de a dobra chegar perto (e de a página terminar de carregar), só a capa. Na dobra,
// toca sozinho e sem som (muted + playsInline, exigido pelo Safari, iPhone e Chrome); fora
// dela, pausa e continua de onde parou. "Ativar som" liga o som e os controles. Sem som fica
// em loop; com som, ao terminar mostra "Ver planos". "Reduzir movimento", economia de dados
// ou autoplay bloqueado pelo navegador: capa com botão de play.

import { ArrowRight, Play, RotateCcw, Volume2 } from "lucide-react";
import { useInView, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { btn } from "@/components/ui/styles";
import { track } from "@/features/marketing/track";
import { shouldAutoplay, type VideoSet, type VideoSources } from "@/features/marketing/video";
import { useHydrated, useSmUp } from "@/lib/hooks";

const saveDataOn = () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

// A página terminou de carregar (evento load). Logo abaixo do hero, a dobra já nasce "perto":
// o vídeo espera o load para não disputar a rede com o hero (LCP).
const subscribeLoad = (cb: () => void) => {
  window.addEventListener("load", cb);
  return () => window.removeEventListener("load", cb);
};
const usePageLoaded = () =>
  useSyncExternalStore(
    subscribeLoad,
    () => document.readyState === "complete",
    () => false,
  );

type LayerProps = {
  set: VideoSet;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  visible: boolean;
  className: string;
  playing: boolean;
  sound: boolean;
  /** Tela final à mostra: sem os controles nativos, que cobririam os botões. */
  ended: boolean;
  allowed: boolean;
  onPlaying: (v: HTMLVideoElement) => void;
  onPause: (v: HTMLVideoElement) => void;
  onEnded: (v: HTMLVideoElement) => void;
};

/** Uma versão do vídeo. A escondida não baixa nada: nem o vídeo, nem a capa. */
function VideoLayer({ set, videoRef, visible, className, playing, sound, ended, allowed, onPlaying, onPause, onEnded }: LayerProps) {
  return (
    <video
      ref={videoRef}
      className={`absolute inset-0 size-full object-cover ${className}`}
      style={{ opacity: playing ? 1 : 0 }}
      poster={visible ? (set.poster.webp ?? set.poster.jpg) : undefined}
      muted={!sound}
      playsInline
      controls={sound && visible && !ended}
      preload={visible && allowed ? "auto" : "none"}
      aria-label="Vídeo: o VYZ por dentro"
      aria-hidden={visible ? undefined : true}
      onPlaying={(e) => onPlaying(e.currentTarget)}
      onPause={(e) => onPause(e.currentTarget)}
      onEnded={(e) => onEnded(e.currentTarget)}
    >
      {set.webm && <source src={set.webm} type="video/webm" />}
      <source src={set.mp4} type="video/mp4" />
    </video>
  );
}

export function VideoPlayer({ sources }: { sources: VideoSources }) {
  const { wide, tall } = sources;
  const box = useRef<HTMLDivElement>(null);
  const wideRef = useRef<HTMLVideoElement>(null);
  const tallRef = useRef<HTMLVideoElement>(null);
  const near = useInView(box, { once: true, margin: "600px 0px" });
  const inView = useInView(box, { amount: 0.35 });
  const reduce = !!useReducedMotion();
  const hydrated = useHydrated();
  const loaded = usePageLoaded();
  const smUp = useSmUp();
  const allowed = hydrated && shouldAutoplay({ reduced: reduce, saveData: saveDataOn() });

  // a versão visível: a mesma regra do CSS (sm: 640 px)
  const usingTall = !!tall && !smUp;
  const current = useCallback(() => (usingTall ? tallRef.current : wideRef.current), [usingTall]);

  const [blocked, setBlocked] = useState(false); // o navegador recusou o autoplay
  const [clicked, setClicked] = useState(false); // tocou pelo botão de play
  const [sound, setSound] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);

  const auto = allowed && !blocked;
  const showPlay = !auto && !clicked && hydrated;
  const wantsPlay = auto || clicked;

  const userPaused = useRef(false);
  const ourPause = useRef(false);
  const startedOnce = useRef(false);
  const endedOnce = useRef(new Set<string>());

  // só a recusa do navegador conta como bloqueio; rolar para fora durante o play() interrompe
  // a promessa (AbortError) e não é bloqueio
  const playSafe = useCallback((v: HTMLVideoElement) => {
    v.play().catch((err: unknown) => {
      if (err instanceof Error && err.name === "NotAllowedError") setBlocked(true);
    });
  }, []);

  const pauseOurs = (v: HTMLVideoElement | null) => {
    if (!v || v.paused) return;
    ourPause.current = true;
    v.pause();
  };

  // na dobra, toca; fora dela, pausa (e continua de onde parou ao voltar). A versão escondida
  // nunca toca (ao girar a tela, troca).
  useEffect(() => {
    pauseOurs(usingTall ? wideRef.current : tallRef.current);
    const v = current();
    if (!v) return;
    if (!inView) {
      pauseOurs(v);
      return;
    }
    if (!wantsPlay || ended || userPaused.current) return;
    // Safari e iPhone conferem o "muted" do elemento ao tocar sozinho
    if (!sound) {
      v.muted = true;
      v.defaultMuted = true;
    }
    playSafe(v);
  }, [current, ended, inView, near, playSafe, sound, usingTall, wantsPlay]);

  const onPlaying = (v: HTMLVideoElement) => {
    if (v !== current()) return;
    setPlaying(true);
    if (startedOnce.current) return;
    startedOnce.current = true;
    track("video_inicio", { modo: auto ? "auto" : "clique" });
  };

  const onPause = (v: HTMLVideoElement) => {
    // pausa pelos controles: não volta sozinho ao rolar
    if (ourPause.current) ourPause.current = false;
    else if (v === current() && !v.ended) userPaused.current = true;
  };

  const onEnded = (v: HTMLVideoElement) => {
    if (v !== current()) return;
    // uma vez sem som e uma vez com som: o loop mudo não esconde quem assistiu ouvindo
    const key = v.muted ? "mudo" : "som";
    if (!endedOnce.current.has(key)) {
      endedOnce.current.add(key);
      track("video_fim", { som: !v.muted });
    }
    if (v.muted) {
      // sem som, em loop (à mão: com o atributo loop, o fim nunca é avisado)
      v.currentTime = 0;
      playSafe(v);
      return;
    }
    setEnded(true);
  };

  const turnSoundOn = () => {
    const v = current();
    if (!v) return;
    // no próprio clique: fora dele, o Safari recusa tocar com som
    v.muted = false;
    setSound(true);
    userPaused.current = false;
    playSafe(v);
    track("video_som");
  };

  const playByClick = () => {
    const v = current();
    if (!v) return;
    v.muted = false;
    setClicked(true);
    setSound(true);
    userPaused.current = false;
    playSafe(v);
    track("video_som");
  };

  const again = () => {
    const v = current();
    if (!v) return;
    setEnded(false);
    v.currentTime = 0;
    playSafe(v);
  };

  const layer = { playing, sound, ended, allowed, onPlaying, onPause, onEnded };
  return (
    // a altura vem da proporção de cada versão, pelo CSS: nada pula (CLS 0)
    <div ref={box} data-video-box className={`relative overflow-hidden rounded-card border border-line bg-deep ${tall ? "aspect-[4/5] sm:aspect-video" : "aspect-video"}`}>
      {/* a capa: a única coisa que baixa antes de a dobra chegar perto. O <picture> só baixa a da
          versão visível, em WebP (JPG para quem não lê WebP). */}
      <picture>
        {tall?.poster.webp && <source media="(max-width: 639.98px)" type="image/webp" srcSet={tall.poster.webp} />}
        {tall && <source media="(max-width: 639.98px)" srcSet={tall.poster.jpg} />}
        {wide.poster.webp && <source type="image/webp" srcSet={wide.poster.webp} />}
        <img src={wide.poster.jpg} alt="" loading="lazy" decoding="async" className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${playing ? "opacity-0" : "opacity-100"}`} />
      </picture>
      {near && hydrated && loaded && (
        <>
          <VideoLayer set={wide} videoRef={wideRef} visible={!usingTall} className={tall ? "hidden sm:block" : ""} {...layer} />
          {tall && <VideoLayer set={tall} videoRef={tallRef} visible={usingTall} className="sm:hidden" {...layer} />}
        </>
      )}

      {showPlay && (
        <button
          type="button"
          onClick={playByClick}
          className="absolute inset-0 m-auto inline-flex h-14 w-fit items-center gap-2 rounded-full bg-accent px-6 font-semibold text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-offwhite"
        >
          <Play size={20} aria-hidden fill="currentColor" /> Assistir
        </button>
      )}

      {auto && !sound && (
        <button
          type="button"
          onClick={turnSoundOn}
          className="absolute right-3 bottom-3 inline-flex h-11 items-center gap-2 rounded-full bg-black/70 px-4 text-[14px] font-semibold text-white outline-none hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-offwhite sm:right-4 sm:bottom-4"
        >
          <Volume2 size={18} aria-hidden /> Ativar som
        </button>
      )}

      {/* tela final: um véu escurece o último quadro e os botões ficam no espaço abaixo do logo e
          do "vyzualize.com.br" (no quadro, eles terminam em 72% da altura no 16:9 e em 69% no 4:5) */}
      {ended && (
        <div className="absolute inset-0 bg-black/60">
          <div className={`absolute inset-x-0 bottom-0 flex flex-wrap content-center items-center justify-center gap-x-3 gap-y-1.5 px-3 pb-1 ${tall ? "top-[72%] sm:top-[76%]" : "top-[76%]"}`}>
            <a href="#planos" className={`${btn.primary} group`} data-track="cta_final" data-track-cta="video_ver_planos">
              Ver planos
              <ArrowRight size={18} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
            <button type="button" onClick={again} className="inline-flex h-10 items-center gap-2 rounded-control px-3 text-[14px] font-medium text-white outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offwhite">
              <RotateCcw size={15} aria-hidden /> Assistir de novo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
