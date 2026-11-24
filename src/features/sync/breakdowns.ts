// Valores das quebras (insights_breakdown_daily.value): chaves estáveis, iguais
// para o gerador e para as fontes reais (que traduzem o que a API devolve), e
// os rótulos em português para a tela.
//
//   age          "18-24" … "65+"
//   gender       "female" | "male" | "unknown"
//   age_gender   "<idade>|<gênero>", ex.: "25-34|female"
//   placement    Meta: "instagram_feed", "facebook_reels"…
//   device       Meta: "android", "iphone", "desktop", "tablet"; Google: "mobile", "desktop", "tablet", "connected_tv"
//   region       UF: "SP", "RJ"…
//   hour         "00" … "23" (hora do fuso da conta)

import type { BreakdownDimension } from "./dataset";

export const AGE_BUCKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export const GENDERS = ["female", "male", "unknown"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABEL: Record<Gender, string> = { female: "Mulheres", male: "Homens", unknown: "Não informado" };

export const ageGenderValue = (age: AgeBucket, gender: Gender) => `${age}|${gender}`;

export function parseAgeGender(value: string): { age: AgeBucket; gender: Gender } | null {
  const [age, gender] = value.split("|");
  if (!(AGE_BUCKETS as readonly string[]).includes(age) || !(GENDERS as readonly string[]).includes(gender)) return null;
  return { age: age as AgeBucket, gender: gender as Gender };
}

export const PLACEMENT_LABEL: Record<string, string> = {
  facebook_feed: "Feed do Facebook",
  facebook_reels: "Reels do Facebook",
  facebook_marketplace: "Marketplace do Facebook",
  instagram_feed: "Feed do Instagram",
  instagram_stories: "Stories do Instagram",
  instagram_reels: "Reels do Instagram",
  instagram_explore: "Explorar do Instagram",
  instagram_profile: "Perfil do Instagram",
  facebook_stories: "Stories do Facebook",
  facebook_video_feeds: "Vídeos do Facebook",
  facebook_search: "Busca do Facebook",
  facebook_instream_video: "Vídeo in-stream do Facebook",
  facebook_right_column: "Coluna direita do Facebook",
  facebook_outros: "Outros do Facebook",
  instagram_outros: "Outros do Instagram",
  messenger_inbox: "Messenger",
  messenger_stories: "Stories do Messenger",
  messenger_outros: "Outros do Messenger",
  threads_feed: "Threads",
  threads_outros: "Threads",
  audience_network: "Audience Network",
};

export const DEVICE_LABEL: Record<string, string> = {
  android: "Android",
  iphone: "iPhone",
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
  connected_tv: "TV conectada",
  other: "Outros",
};

export const BR_STATES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

/** Rótulo de um valor de quebra ("25-34|female" → "25-34 · Mulheres"). Valor desconhecido volta como veio. */
export function breakdownLabel(dimension: BreakdownDimension, value: string): string {
  switch (dimension) {
    case "age":
      return value === "65+" ? "65 ou mais" : value;
    case "gender":
      return GENDER_LABEL[value as Gender] ?? value;
    case "age_gender": {
      const parsed = parseAgeGender(value);
      return parsed ? `${parsed.age} · ${GENDER_LABEL[parsed.gender]}` : value;
    }
    case "placement":
      return PLACEMENT_LABEL[value] ?? value;
    case "device":
      return DEVICE_LABEL[value] ?? value;
    case "region":
      return BR_STATES[value] ?? value;
    case "hour":
      return /^\d{2}$/.test(value) ? `${Number(value)}h` : value;
  }
}
