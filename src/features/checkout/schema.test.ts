import { describe, expect, it } from "vitest";
import { CHECKOUT_MESSAGES, checkDetails, type CheckoutValues } from "./fields";
import { checkoutFormSchema, paymentInputSchema, planChangeSchema } from "./schema";

const valid: CheckoutValues = {
  fullName: "  Pessoa Teste ",
  email: " Pessoa@Loja.COM ",
  password: "Teste12345",
  company: " Loja Teste ",
  phone: "(71) 99957-5898",
  taxId: "529.982.247-25",
  acceptTerms: true,
  marketing: false,
};

const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]));

describe("dados do checkout", () => {
  it("normaliza o que vai para o banco", () => {
    const r = checkoutFormSchema({ newAccount: true }).safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      fullName: "Pessoa Teste",
      email: "pessoa@loja.com",
      password: "Teste12345",
      companyName: "Loja Teste",
      phone: "+5571999575898",
      taxId: "52998224725",
      marketing: false,
    });
  });

  it("CNPJ alfanumérico chega normalizado", () => {
    const r = checkoutFormSchema({ newAccount: true }).safeParse({ ...valid, taxId: "12.abc.345/01de-35" });
    expect(r.success && r.data.taxId).toBe("12ABC34501DE35");
  });

  it("CPF/CNPJ é opcional", () => {
    const r = checkoutFormSchema({ newAccount: true }).safeParse({ ...valid, taxId: "" });
    expect(r.success && r.data.taxId).toBeNull();
  });

  it("aponta todos os campos de uma vez, com as mensagens da tela", () => {
    const bad = { ...valid, fullName: "A", email: "sem-arroba", password: "curta", company: " ", phone: "123", taxId: "111.111.111-11", acceptTerms: false };
    const r = checkoutFormSchema({ newAccount: true }).safeParse(bad);
    expect(r.success).toBe(false);
    expect(issues(r)).toEqual({
      fullName: CHECKOUT_MESSAGES.fullName,
      email: CHECKOUT_MESSAGES.email,
      password: "Use pelo menos 8 caracteres.",
      company: CHECKOUT_MESSAGES.company,
      phone: CHECKOUT_MESSAGES.phone,
      taxId: CHECKOUT_MESSAGES.taxId,
      acceptTerms: CHECKOUT_MESSAGES.terms,
    });
    // a tela chega às mesmas mensagens sem zod
    expect(checkDetails(bad, { newAccount: true })).toEqual(issues(r));
  });

  it("com a conta aberta, e-mail e senha não são pedidos", () => {
    const r = checkoutFormSchema({ newAccount: false }).safeParse({ ...valid, email: "", password: "" });
    expect(r.success).toBe(true);
  });

  it("senha sem número não passa", () => {
    const r = checkoutFormSchema({ newAccount: true }).safeParse({ ...valid, password: "sóletrasaqui" });
    expect(issues(r).password).toBe("Inclua pelo menos um número.");
  });
});

describe("pagamento", () => {
  const card = { method: "card", brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 };

  it("aceita só bandeira, final e validade", () => {
    expect(paymentInputSchema.safeParse(card).success).toBe(true);
  });

  it("recusa o número do cartão ou o CVC", () => {
    expect(paymentInputSchema.safeParse({ ...card, number: "4242424242424242" }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ ...card, cvc: "123" }).success).toBe(false);
  });

  it("recusa final, mês e bandeira fora do formato", () => {
    expect(paymentInputSchema.safeParse({ ...card, last4: "42a2" }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ ...card, expMonth: 13 }).success).toBe(false);
    expect(paymentInputSchema.safeParse({ ...card, brand: "maestro" }).success).toBe(false);
  });
});

describe("troca de plano", () => {
  it("plano self-service, período e 3 a 200 projetos", () => {
    expect(planChangeSchema.safeParse({ tier: "pro", period: "anual", accounts: 3 }).success).toBe(true);
    expect(planChangeSchema.safeParse({ tier: "pro", period: "anual", accounts: 2 }).success).toBe(false);
    expect(planChangeSchema.safeParse({ tier: "pro", period: "anual", accounts: 200 }).success).toBe(true);
    expect(planChangeSchema.safeParse({ tier: "personalizado", period: "anual", accounts: 3 }).success).toBe(false);
    expect(planChangeSchema.safeParse({ tier: "pro", period: "anual", accounts: 0 }).success).toBe(false);
    expect(planChangeSchema.safeParse({ tier: "pro", period: "anual", accounts: 201 }).success).toBe(false);
    expect(planChangeSchema.safeParse({ tier: "pro", period: "anual", accounts: 2.5 }).success).toBe(false);
  });
});
