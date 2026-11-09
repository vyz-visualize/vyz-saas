import type { MetadataRoute } from "next";
import { SITE_INDEXABLE } from "@/lib/flags";
import { robotsFor } from "@/lib/site";

// Antes do lançamento (SITE_INDEXABLE false): os robôs só abrem a home e as páginas legais.
export default function robots(): MetadataRoute.Robots {
  return robotsFor(SITE_INDEXABLE);
}
