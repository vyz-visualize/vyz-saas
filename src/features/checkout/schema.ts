// Entradas das Server Actions de cobrança, validadas com zod no servidor. Os
// dados do checkout usam as mesmas regras da tela (fields.ts) e a senha, o
// passwordSchema do acesso. O cartão chega só como bandeira, final e
// validade: qualquer campo a mais é recusado.

import { z } from "zod";
import { passwordSchema } from "@/features/auth/password";
import { CARD_BRANDS } from "./card";
import { checkDetails } from "./fields";
import { normalizePhone } from "./phone";
import { normalizeTaxId } from "./tax-id";

const field = (max: number) => z.string().max(max);

/** Formulário do /assinar. `newAccount` = sem sessão (pede e-mail e senha). */
export function checkoutFormSchema({ newAccount }: { newAccount: boolean }) {
  return z
    .object({
      fullName: field(200),
      email: field(320),
      password: field(200),
      company: field(200),
      phone: field(40),
      taxId: field(40),
      acceptTerms: z.boolean(),
      marketing: z.boolean(),
    })
    .superRefine((v, ctx) => {
      // todos os campos de uma vez (a tela marca cada um); a senha pelo passwordSchema
      const errors = checkDetails(v, { newAccount });
      delete errors.password;
      if (newAccount) {
        const password = passwordSchema.safeParse(v.password);
        if (!password.success) errors.password = password.error.issues[0]?.message;
      }
      for (const [path, message] of Object.entries(errors)) if (message) ctx.addIssue({ code: "custom", path: [path], message });
    })
    .transform((v) => ({
      fullName: v.fullName.trim(),
      email: v.email.trim().toLowerCase(),
      password: v.password,
      companyName: v.company.trim(),
      phone: normalizePhone(v.phone),
      taxId: normalizeTaxId(v.taxId) || null,
      marketing: v.marketing,
    }));
}

export const paymentInputSchema = z
  .object({
    method: z.literal("card"),
    brand: z.enum(CARD_BRANDS),
    last4: z.string().regex(/^\d{4}$/),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(2000).max(2100),
  })
  .strict();

export type PaymentInput = z.input<typeof paymentInputSchema>;

export const planChangeSchema = z
  .object({
    tier: z.enum(["base", "pro", "avancado"]),
    period: z.enum(["mensal", "anual"]),
  })
  .strict();

export type PlanChangeInput = z.input<typeof planChangeSchema>;
