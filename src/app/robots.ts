import type { MetadataRoute } from "next";
import { SITE_INDEXABLE } from "@/lib/flags";
import { robotsFor } from "@/lib/site";

// Antes do lançamento (SITE_INDEXABLE false): bloqueia tudo.
export default function robots(): MetadataRoute.Robots {
  return robotsFor(SITE_INDEXABLE);
}
