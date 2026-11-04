"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { PageView } from "@/features/dashboards/widgets/PageView";
import { SHOW_LANDING_PAGES } from "@/lib/flags";
import { makeContext } from "@/features/dashboards/widgets/Widgets";
import { MockSource } from "@/features/metrics/source";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { PAGES } from "@/features/templates/pages";

type DashboardMockProps = {
  /** Template do cadastro do SaaS (o mock é o produto). */
  templateId: "ecommerce-visao-geral" | "imobiliario-leads";
  name: string;
  /** Monta peça por peça. */
  assemble: boolean;
  /** Vira "ao vivo" depois de montado e mexe nos números a cada ~5 s. */
  live?: boolean;
  seed: string;
  /** Marca a linha da meta como alvo da intro. */
  markGoal?: boolean;
};

const NAV = ["Dashboards", ...(SHOW_LANDING_PAGES ? ["Landing pages"] : []), "Contas conectadas", "Relatórios"];
const ASSEMBLE_MS = 1900;

export function DashboardMock({ templateId, name, assemble, live = false, seed, markGoal }: DashboardMockProps) {
  const reduce = useReducedMotion();
  const animate = assemble && !reduce;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "0px 0px -10% 0px" });

  const [typed, setTyped] = useState(animate ? 0 : name.length);
  const [counting, setCounting] = useState(!animate);
  const [isLive, setIsLive] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const t1 = window.setTimeout(() => setCounting(true), 380);
    let n = 0;
    const iv = window.setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= name.length) window.clearInterval(iv);
    }, 42);
    return () => {
      window.clearTimeout(t1);
      window.clearInterval(iv);
    };
  }, [animate, name]);

  useEffect(() => {
    if (!live || reduce) return;
    const t = window.setTimeout(() => setIsLive(true), animate ? ASSEMBLE_MS : 600);
    return () => window.clearTimeout(t);
  }, [live, reduce, animate]);

  useEffect(() => {
    if (!isLive || !inView) return;
    const iv = window.setInterval(() => setTick((t) => t + 1), 5000);
    return () => window.clearInterval(iv);
  }, [isLive, inView]);

  const template = dashboardTemplate(templateId)!;
  const ds = useMemo(
    () => MockSource.load({ seed, profile: template.profile, sources: template.sources, days: 28, tick }),
    [seed, template, tick],
  );
  const layout = PAGES["visao-geral"].build({ profile: template.profile, sources: template.sources });
  const ctx = makeContext(ds, { zero: !counting, markGoal });

  const title = template.profile === "imob" ? "Leads" : "Visão geral";
  const sources = template.sources.includes("ga4") ? "Meta Ads + Google Ads + GA4" : "Meta Ads + Google Ads + CRM";

  return (
    <div ref={ref} className="@container relative" data-anim={animate ? "on" : "off"}>
      <div className="scanner" aria-hidden />
      <div className="m-unveil flex min-h-[340px] text-fg">
        <aside className="m-side hidden w-[124px] shrink-0 flex-col border-r border-line p-3 @[600px]:flex" aria-hidden>
          <Wordmark className="w-12 text-accent" decorative />
          <ul className="mt-5 space-y-0.5 text-[10px] whitespace-nowrap">
            {NAV.map((n, i) => (
              <li key={n} className={`rounded-[6px] px-2 py-1.5 ${i === 0 ? "bg-accent-soft font-semibold text-fg" : "text-fg-2"}`}>
                {n}
              </li>
            ))}
            <li className="px-2 py-1.5 text-fg-2 opacity-60">
              Automações
              <span className="mt-0.5 block w-fit rounded-chip bg-accent-soft px-1.5 text-[8px] text-fg">em breve</span>
            </li>
          </ul>
          <div className="mt-auto rounded-[8px] border border-line bg-card p-2">
            <p className="truncate text-[10px] font-semibold">{name}</p>
            <p className="text-[9px] text-fg-2">Padrão · 3 projetos</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1 p-3">
          <div className="m-in mb-3" style={{ "--d": "80ms" } as CSSProperties}>
            <p className="truncate text-[15px] font-bold tracking-[-0.02em]">
              <span>{name.slice(0, typed)}</span>
              {typed < name.length && <span className="caret" aria-hidden />}
              <span> · {title}</span>
            </p>
            <p className="flex items-center gap-1.5 text-[10.5px] text-fg-2">
              <span className="truncate">{sources} ·</span>
              {isLive ? (
                <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-accent">
                  <span className="live-dot" aria-hidden /> ao vivo
                </span>
              ) : (
                <span className="shrink-0">atualizado há 4 min</span>
              )}
            </p>
          </div>
          <PageView layout={layout} ctx={ctx} variant="compact" />
        </div>
      </div>
    </div>
  );
}
