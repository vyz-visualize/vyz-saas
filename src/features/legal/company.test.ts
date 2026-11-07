import { describe, expect, it } from "vitest";
import { COMPANY, companyIdentity } from "./company";

describe("identificação da empresa no rodapé", () => {
  it("com marcador, não aparece", () => {
    expect(companyIdentity()).toBeNull();
    expect(companyIdentity({ legalName: "Empresa Ltda", cnpj: "[CNPJ]" })).toBeNull();
    expect(companyIdentity({ legalName: "", cnpj: "00.000.000/0001-00" })).toBeNull();
  });
  it("preenchida, vira uma linha", () => {
    expect(companyIdentity({ legalName: "Empresa Ltda", cnpj: "00.000.000/0001-00" })).toBe("Empresa Ltda · CNPJ 00.000.000/0001-00");
  });
});

describe("e-mail de contato", () => {
  it("um só: suporte@ nos Termos, na Privacidade e no rodapé", () => {
    expect(COMPANY.supportEmail).toBe("suporte@vyzualize.com.br");
    expect(COMPANY.privacyEmail).toBe(COMPANY.supportEmail);
  });
});
