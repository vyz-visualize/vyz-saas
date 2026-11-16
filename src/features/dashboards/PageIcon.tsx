// Ícone de cada aba do dashboard: o logo da plataforma nas abas de uma plataforma (Meta, Google,
// GA4, Instagram, Página do Facebook) e um ícone de linha nas outras. Usado nas abas da barra
// e no menu "Mais".

import {
  Activity,
  Briefcase,
  Clapperboard,
  Contact,
  FileText,
  Filter,
  GitCompareArrows,
  Images,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Mic,
  Package,
  PieChart,
  Route,
  Search,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import type { PageId } from "@/features/templates/types";

const BRAND: Partial<Record<PageId, string>> = { "meta-ads": "meta", "google-ads": "google", site: "ga4", instagram: "instagram", "pagina-facebook": "facebook" };

const LINE: Partial<Record<PageId, LucideIcon>> = {
  "visao-geral": LayoutDashboard,
  "por-plataforma": Layers,
  campanhas: Megaphone,
  funil: Filter,
  criativos: Images,
  metas: Target,
  publico: Users,
  comparativo: GitCompareArrows,
  "leads-crm": Contact,
  crm: Contact,
  produtos: Package,
  audio: Mic,
  carteira: Briefcase,
  canais: Route,
  "canais-site": Route,
  "saude-conta": Activity,
  executivo: FileText,
  termos: Search,
  organico: LayoutGrid,
  conteudo: LayoutGrid,
  "criativos-ao-vivo": Clapperboard,
  previsao: TrendingUp,
  mmm: PieChart,
};

export function PageIcon({ page, size = 15 }: { page: PageId; size?: number }) {
  const brand = BRAND[page];
  if (brand) return <PlatformIcon id={brand} size={size + 1} />;
  const Icon = LINE[page] ?? LayoutDashboard;
  return <Icon size={size} aria-hidden className="shrink-0 opacity-80" />;
}
