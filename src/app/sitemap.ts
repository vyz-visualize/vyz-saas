import type { MetadataRoute } from "next";
import { SITE_INDEXABLE } from "@/lib/flags";
import { sitemapFor } from "@/lib/site";

// Antes do lançamento (SITE_INDEXABLE false): vazio.
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapFor(SITE_INDEXABLE);
}
