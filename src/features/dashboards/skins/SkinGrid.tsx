"use client";

// Os blocos de um visual próprio na grade de 12 colunas. Sem controle (galeria, PDF),
// mostra a disposição padrão do visual; no dashboard, a salva, e no Personalizar do
// Avançado deixa arrastar e redimensionar com a mesma animação das outras abas.

import type { ReactNode } from "react";
import { GridCanvas, type Block } from "../layout/GridCanvas";
import { PlatformMetricCard } from "../layout/LayoutEditor";
import { kindOf, parseMetricCardId, type PageGrid } from "../layout/model";
import type { WidgetContext } from "../widgets/Widgets";
import type { SkinId } from "@/features/templates/types";
import { isSkinCard, SKIN_BLOCKS, skinGrid, withoutBlocks } from "./blocks";

export type SkinGridControl = {
  items: PageGrid;
  editing?: boolean;
  onChange?: (g: PageGrid) => void;
  onHide?: (id: string) => void;
  onDropNew?: (id: string, x: number, y: number) => void;
  canDrop?: (id: string) => boolean;
  /** Encaixa os blocos na altura da tela (sem rolar a página). */
  fit?: boolean;
};

export function SkinGrid({
  skin,
  nodes,
  ctx,
  grid,
  hide = [],
}: {
  skin: SkinId;
  nodes: Record<string, ReactNode>;
  ctx: WidgetContext;
  grid?: SkinGridControl;
  /** Blocos sem nada para mostrar neste dashboard: saem da tela e o vizinho ocupa o espaço (no Personalizar, ficam). */
  hide?: readonly string[];
}) {
  const saved = grid?.items ?? skinGrid(skin);
  const items = grid?.editing ? saved : withoutBlocks(saved, hide);
  const blocks: Record<string, Block> = {};
  for (const s of SKIN_BLOCKS[skin])
    blocks[s.id] = {
      label: s.label,
      node: <div className="h-full min-h-0 [&>*]:h-full">{nodes[s.id]}</div>,
    };
  for (const it of items) {
    if (parseMetricCardId(it.id))
      blocks[it.id] = {
        label: "Métrica",
        node: (
          <PlatformMetricCard
            id={it.id}
            ds={ctx.ds}
            profile={ctx.profile}
            compare={ctx.compare}
          />
        ),
      };
  }
  return (
    <GridCanvas
      items={items}
      blocks={blocks}
      editing={grid?.editing}
      onChange={grid?.onChange}
      onHide={grid?.onHide}
      onDropNew={grid?.onDropNew}
      canDrop={grid?.canDrop}
      fit={grid?.fit}
      compactBlock={(id) => isSkinCard(skin, id) || kindOf(id) === "metric"}
      sizeOf={(id) =>
        SKIN_BLOCKS[skin].find((s) => s.id === id) ?? { w: 3, h: 4 }
      }
    />
  );
}
