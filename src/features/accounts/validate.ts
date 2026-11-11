// Validação e máscara dos IDs de conta. Funções puras (testadas).

import type { FieldKind } from "./platforms";

export type Check = { ok: true; value: string } | { ok: false; error: string };

const digits = (raw: string) => raw.replace(/\D/g, "");

/** Máscara enquanto digita. */
export function maskId(kind: FieldKind, raw: string): string {
  switch (kind) {
    case "googleCustomer": {
      const d = digits(raw).slice(0, 10);
      return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join("-");
    }
    case "metaAccount": {
      const d = digits(raw).slice(0, 20);
      return d ? `act_${d}` : "";
    }
    case "metaBusiness":
    case "instagramAccount":
    case "facebookPage":
    case "ga4Property":
    case "digits":
      return digits(raw).slice(0, 20);
    case "ga4Measurement": {
      const body = raw.toUpperCase().replace(/^G-?/, "").replace(/[^A-Z0-9]/g, "").slice(0, 12);
      return body ? `G-${body}` : "";
    }
    case "text":
      return raw.slice(0, 60);
  }
}

/** Valida e normaliza. Campo vazio só passa se for opcional (tratado por quem chama). */
export function validateId(kind: FieldKind, raw: string): Check {
  const v = raw.trim();
  switch (kind) {
    case "metaAccount": {
      const d = digits(v.replace(/^act_/i, ""));
      if (!/^(act_)?\d+$/i.test(v.replace(/\s/g, ""))) return { ok: false, error: "Use act_ seguido só de dígitos (ou só os dígitos)." };
      if (d.length < 5 || d.length > 20) return { ok: false, error: "A conta de anúncio tem de 5 a 20 dígitos." };
      return { ok: true, value: `act_${d}` };
    }
    case "metaBusiness": {
      if (!/^\d{5,20}$/.test(v)) return { ok: false, error: "O ID do BM tem só dígitos (5 a 20)." };
      return { ok: true, value: v };
    }
    case "instagramAccount":
    case "facebookPage": {
      if (!/^\d{5,20}$/.test(v)) return { ok: false, error: "O ID tem só dígitos (5 a 20)." };
      return { ok: true, value: v };
    }
    case "googleCustomer": {
      if (!/^\d{3}-?\d{3}-?\d{4}$/.test(v)) return { ok: false, error: "Use o formato 123-456-7890." };
      const d = digits(v);
      return { ok: true, value: `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` };
    }
    case "ga4Property": {
      if (!/^\d{6,12}$/.test(v)) return { ok: false, error: "O ID da propriedade tem só dígitos (6 a 12)." };
      return { ok: true, value: v };
    }
    case "ga4Measurement": {
      const up = v.toUpperCase();
      if (!/^G-[A-Z0-9]{6,12}$/.test(up)) return { ok: false, error: "Use o formato G-XXXXXXX." };
      return { ok: true, value: up };
    }
    case "digits": {
      if (!/^\d{5,20}$/.test(v)) return { ok: false, error: "Use só dígitos (5 a 20)." };
      return { ok: true, value: v };
    }
    case "text": {
      if (v.length < 2) return { ok: false, error: "Preencha este campo." };
      return { ok: true, value: v };
    }
  }
}
