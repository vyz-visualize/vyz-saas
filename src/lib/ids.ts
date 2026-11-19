// Ids e slugs gerados no navegador.

/** "Loja Verde Ltda." → "lojaverdeltda"; com separador "-" → "loja-verde-ltda". */
export function slugify(name: string, sep = ""): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return words.join(sep).slice(0, 32) || "suamarca";
}
