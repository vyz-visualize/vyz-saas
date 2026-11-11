"use client";

// Páginas do orgânico (Instagram e Página do Facebook): "Orgânico" (cards, série
// diária e a tabela por perfil) e "Conteúdo" (ranking de posts, reels e stories e
// o que cada formato entrega). Os números vêm em data.organic (server/analytics/queries).

import { ExternalLink } from "lucide-react";
import { LineChart } from "@/components/charts/LineChart";
import { addDays, diffDays } from "@/features/sync/dates";
import { int, pct } from "@/lib/format";
import { KIND_LABEL, type OrganicPostVM, type OrganicProfileVM } from "../organic";
import { ddmm } from "../ranges";
import type { PageProps } from "../shared";
import { DataTable, InlineBar, KpiCard, NoData, Panel, Thumb } from "../ui";

const PLATFORM_LABEL = { instagram: "Instagram", facebook: "Página do Facebook" } as const;
const num = (v: number | null) => (v === null ? "—" : int(v));
const rate = (v: number | null) => (v === null ? "—" : pct(v, 1));

function NoOrganic() {
  return (
    <Panel title="Orgânico">
      <NoData text="Ligue um Instagram ou uma Página do Facebook a este dashboard (em Editar) para ver os números do orgânico." />
    </Panel>
  );
}

export function OrganicOverview({ data }: PageProps) {
  const o = data.organic;
  if (!o || !o.profiles.length) return <NoOrganic />;
  const today = addDays(data.current.to, 1);
  const ago = o.daily.map((d) => diffDays(d.date, today));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 @[640px]:grid-cols-3 @[1040px]:grid-cols-4 @[1280px]:grid-cols-7">
        {o.kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} currency={data.currency} maturing={0} featured={k.id === "followers"} />
        ))}
      </div>
      <div className="grid gap-3 @[1040px]:grid-cols-3">
        <Panel title="Visualizações por dia" subtitle={`${ddmm(data.current.from)} a ${ddmm(data.current.to)} · somando os perfis`} className="min-w-0 @[1040px]:col-span-2">
          {o.daily.length ? (
            <LineChart
              height={220}
              values={o.daily.map((d) => d.views)}
              ago={ago}
              formatY={(v) => int(v)}
              summary={`Visualizações por dia: ${int(o.daily.reduce((a, d) => a + d.views, 0))} no período.`}
            />
          ) : (
            <NoData />
          )}
        </Panel>
        <Panel title="Interações por formato" subtitle="Curtidas, comentários, compartilhamentos e salvamentos dos posts do período.">
          <KindBars data={data} />
        </Panel>
      </div>
      <Panel title="Cada perfil" subtitle="Seguidores no fim do período e o que cada um entregou.">
        <ProfilesTable rows={o.byProfile} />
      </Panel>
    </div>
  );
}

function KindBars({ data }: PageProps) {
  const kinds = data.organic?.byKind ?? [];
  if (!kinds.length) return <NoData text="Nenhum post no período." />;
  const max = Math.max(...kinds.map((k) => k.interactions)) || 1;
  return (
    <ul className="space-y-2.5 text-[12.5px] tnum">
      {kinds.map((k) => (
        <li key={k.kind}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="font-medium">
              {KIND_LABEL[k.kind] ?? k.kind} <span className="font-normal text-fg-2">· {int(k.posts)} {k.posts === 1 ? "post" : "posts"}</span>
            </span>
            <span className="font-semibold">{int(k.interactions)}</span>
          </div>
          <InlineBar share={k.interactions / max} />
        </li>
      ))}
    </ul>
  );
}

function ProfilesTable({ rows }: { rows: OrganicProfileVM[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      caption="Números de cada perfil no período"
      minWidth={640}
      initialSort={{ key: "views", dir: "desc" }}
      columns={[
        { key: "name", label: "Perfil", sticky: true, render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "platform", label: "Rede", render: (r) => <span className="text-fg-2">{PLATFORM_LABEL[r.platform]}</span> },
        { key: "followers", label: "Seguidores", align: "right", sort: (r) => r.followers, render: (r) => num(r.followers) },
        { key: "net", label: "Novos", align: "right", sort: (r) => r.followersNet, render: (r) => (r.followersNet === null ? "—" : `${r.followersNet > 0 ? "+" : ""}${int(r.followersNet)}`) },
        { key: "views", label: "Visualizações", align: "right", sort: (r) => r.views, render: (r) => int(r.views) },
        { key: "reach", label: "Alcance", align: "right", sort: (r) => r.reach, render: (r) => num(r.reach) },
        { key: "interactions", label: "Interações", align: "right", sort: (r) => r.interactions, render: (r) => int(r.interactions) },
        { key: "engagement", label: "Engajamento", align: "right", sort: (r) => r.engagement, render: (r) => rate(r.engagement) },
        { key: "posts", label: "Posts", align: "right", sort: (r) => r.posts, render: (r) => int(r.posts) },
      ]}
    />
  );
}

export function OrganicContent({ data }: PageProps) {
  const o = data.organic;
  if (!o || !o.profiles.length) return <NoOrganic />;
  const top = o.posts.slice(0, 4);
  return (
    <div className="space-y-3">
      <Panel title="O que mais engajou" subtitle="Os 4 conteúdos do período com mais interações.">
        {top.length ? (
          <ul className="grid gap-2.5 @[640px]:grid-cols-2 @[1040px]:grid-cols-4">
            {top.map((p) => (
              <TopPost key={p.id} post={p} />
            ))}
          </ul>
        ) : (
          <NoData text="Nenhum post no período." />
        )}
      </Panel>
      <Panel title="Todos os conteúdos" subtitle="Números de vida inteira de cada post, reel e story publicado no período.">
        <DataTable
          rows={o.posts}
          rowKey={(r) => r.id}
          caption="Conteúdos do período"
          limit={10}
          minWidth={860}
          initialSort={{ key: "interactions", dir: "desc" }}
          columns={[
            {
              key: "caption",
              label: "Conteúdo",
              sticky: true,
              render: (r) => (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="max-w-[260px] truncate font-medium" title={r.caption}>
                    {r.caption}
                  </span>
                  {r.permalink && (
                    <a href={r.permalink} target="_blank" rel="noreferrer" aria-label="Abrir o post" className="shrink-0 text-fg-2 hover:text-fg">
                      <ExternalLink size={13} aria-hidden />
                    </a>
                  )}
                </span>
              ),
            },
            { key: "kind", label: "Formato", render: (r) => <span className="text-fg-2">{KIND_LABEL[r.kind] ?? r.kind}</span> },
            { key: "profile", label: "Perfil", render: (r) => <span className="text-fg-2">{r.profile}</span> },
            { key: "date", label: "Data", sort: (r) => r.publishedAt, render: (r) => ddmm(r.publishedAt.slice(0, 10)) },
            { key: "views", label: "Visualizações", align: "right", sort: (r) => r.views, render: (r) => num(r.views) },
            { key: "reach", label: "Alcance", align: "right", sort: (r) => r.reach, render: (r) => num(r.reach) },
            { key: "likes", label: "Curtidas", align: "right", sort: (r) => r.likes, render: (r) => num(r.likes) },
            { key: "comments", label: "Comentários", align: "right", sort: (r) => r.comments, render: (r) => num(r.comments) },
            { key: "shares", label: "Compart.", align: "right", sort: (r) => r.shares, render: (r) => num(r.shares) },
            { key: "saves", label: "Salvos", align: "right", sort: (r) => r.saves, render: (r) => num(r.saves) },
            { key: "interactions", label: "Interações", align: "right", sort: (r) => r.interactions, render: (r) => <span className="font-semibold">{int(r.interactions)}</span> },
            { key: "engagement", label: "Engajamento", align: "right", sort: (r) => r.engagement, render: (r) => rate(r.engagement) },
          ]}
        />
      </Panel>
    </div>
  );
}

function TopPost({ post }: { post: OrganicPostVM }) {
  return (
    <li className="min-w-0 overflow-hidden rounded-[10px] border border-line bg-bg">
      <Thumb seed={post.id} url={post.thumbnailUrl} label={post.caption} badge={KIND_LABEL[post.kind] ?? post.kind} className="aspect-[4/3] w-full" />
      <div className="space-y-1 p-2.5 text-[12px]">
        <p className="truncate font-medium" title={post.caption}>
          {post.caption}
        </p>
        <p className="text-fg-2">
          {post.profile} · {ddmm(post.publishedAt.slice(0, 10))}
        </p>
        <p className="flex flex-wrap gap-x-3 tnum">
          <span>
            <b>{int(post.interactions)}</b> interações
          </span>
          <span className="text-fg-2">{num(post.views)} visualizações</span>
        </p>
      </div>
    </li>
  );
}
