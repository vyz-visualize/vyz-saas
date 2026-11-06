"use client";

// Os blocos de um visual próprio na grade de 12 colunas. Sem controle (galeria, PDF),
// mostra a disposição padrão do visual; no dashboard, a salva, e no Personalizar do
// Avançado deixa arrastar e redimensionar com a mesma animação das outras abas.

import type { ReactNode } from "react";
import { GridCanvas, type Block } from "../layout/GridCanvas";
import { PlatformMetricCard } from "../layout/LayoutEditor";
import { parseMetricCardId, type PageGrid } from "../layout/model";
import type { WidgetContext } from "../widgets/Widgets";
import type { SkinId } from "@/features/templates/types";
import { SKIN_BLOCKS, skinGrid } from "./blocks";

export type SkinGridControl = {
  items: PageGrid;
  editing?: boolean;
  onChange?: (g: PageGrid) => void;
  onHide?: (id: string) => void;
  onDropNew?: (id: string, x: number, y: number) => void;
};

export function SkinGrid({
  skin,
  nodes,
  ctx,
  grid,
}: {
  skin: SkinId;
  nodes: Record<string, ReactNode>;
  ctx: WidgetContext;
  grid?: SkinGridControl;
}) {
  const items = grid?.items ?? skinGrid(skin);
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
      sizeOf={(id) =>
        SKIN_BLOCKS[skin].find((s) => s.id === id) ?? { w: 3, h: 4 }
      }
    />
  );
}
