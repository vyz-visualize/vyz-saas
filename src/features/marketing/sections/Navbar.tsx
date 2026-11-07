"use client";

import { Menu, X } from "lucide-react";
import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { scrollToId, stopScroll } from "@/components/motion/SmoothScroll";
import { btn } from "@/components/ui/styles";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { MSG_SPECIALIST, waLink } from "@/lib/whatsapp";

const LINKS = [
  { id: "demonstracao", label: "Demonstração" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "planos", label: "Planos" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [marker, setMarker] = useState<{ x: number; w: number } | null>(null);

  useEffect(() => {
    const link = active ? listRef.current?.querySelector<HTMLElement>(`[data-link="${active}"]`) : null;
    if (!link) return setMarker(null);
    setMarker({ x: link.offsetLeft, w: link.offsetWidth });
  }, [active]);

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  useEffect(() => {
    const els = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id;
          if (e.isIntersecting) setActive(id);
          else setActive((cur) => (cur === id ? null : cur));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    stopScroll(true);
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      stopScroll(false);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 isolate">
      <div
        className={`nav-bar border-b transition-colors duration-300 ${scrolled ? "border-line" : "border-transparent"}`}
      >
        <nav aria-label="Principal" className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <a href="#inicio" aria-label="VYZ, voltar ao início" className="block w-[72px] shrink-0" data-nav-mark>
            <Wordmark decorative />
          </a>

          <ul ref={listRef} className="relative hidden items-center gap-8 lg:flex">
            {LINKS.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  data-link={l.id}
                  aria-current={active === l.id ? "location" : undefined}
                  className={`block py-2 text-sm font-medium transition-colors duration-200 hover:text-fg ${active === l.id ? "text-fg" : "text-fg-2"}`}
                >
                  {l.label}
                </a>
              </li>
            ))}
            {/* traço do link ativo, na espessura do corte; desliza só com transform */}
            <span
              aria-hidden
              className="absolute -bottom-0.5 left-0 h-[var(--cut)] w-px origin-left bg-accent transition-[transform,opacity] duration-300 ease-brand"
              style={{ opacity: marker ? 1 : 0, transform: marker ? `translateX(${marker.x}px) scaleX(${marker.w})` : undefined }}
            />
          </ul>

          <div className="flex items-center gap-2">
            <span className="hidden lg:contents">
              <Link href="/entrar" className="inline-flex h-9 items-center rounded-control px-3 text-sm font-medium text-fg-2 transition-colors duration-200 hover:text-fg">
                Entrar
              </Link>
              <a href={waLink(MSG_SPECIALIST)} target="_blank" rel="noopener noreferrer" className={btn.small} data-track="whatsapp_click" data-track-origem="menu">
                <WhatsAppIcon size={16} />
                Falar com especialista
              </a>
              <ThemeToggle />
            </span>
            <button
              ref={toggleRef}
              type="button"
              aria-expanded={open}
              aria-controls="menu-celular"
              aria-label="Abrir menu"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex size-10 items-center justify-center rounded-control border border-line text-fg lg:hidden"
            >
              <Menu size={20} aria-hidden />
            </button>
          </div>
        </nav>
      </div>

      <AnimatePresence>
        {open && (
          <m.div
            ref={menuRef}
            id="menu-celular"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-[65] flex flex-col bg-bg px-4 pb-8 sm:px-6"
            initial={reduce ? { opacity: 0 } : { clipPath: "inset(50% 0 50% 0)" }}
            animate={reduce ? { opacity: 1 } : { clipPath: "inset(0% 0 0% 0)" }}
            exit={reduce ? { opacity: 0 } : { clipPath: "inset(50% 0 50% 0)" }}
            transition={{ duration: reduce ? 0.15 : 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {!reduce && (
              <m.span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/2 h-[var(--cut)] origin-center bg-accent"
                initial={{ scaleX: 0, opacity: 1 }}
                animate={{ scaleX: 1, opacity: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            <div className="flex h-16 items-center justify-between">
              <span className="block w-[72px]">
                <Wordmark decorative />
              </span>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-control border border-line text-fg"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <ul className="mt-8 space-y-1">
              {LINKS.map((l, i) => (
                <m.li
                  key={l.id}
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <a
                    href={`#${l.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setOpen(false);
                      window.setTimeout(() => scrollToId(l.id), 60);
                    }}
                    className="display block py-2 text-[2.6rem] text-fg">
                    {l.label}
                  </a>
                </m.li>
              ))}
            </ul>
            <Link href="/entrar" onClick={() => setOpen(false)} className={`${btn.secondary} mt-auto mb-3 w-full`}>
              Entrar
            </Link>
            <div className="flex items-center gap-3">
              <a href={waLink(MSG_SPECIALIST)} target="_blank" rel="noopener noreferrer" className={`${btn.primary} flex-1`} data-track="whatsapp_click" data-track-origem="menu_celular">
                <WhatsAppIcon /> Falar com especialista
              </a>
              <ThemeToggle className="size-12" />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
