import { describe, expect, it } from "vitest";
import { COMPANY, companyIdentity, controllerText } from "./company";

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

describe("a empresa nos textos legais", () => {
  it("com marcador, só o nome: nenhum marcador aparece na página", () => {
    expect(controllerText({ legalName: "[RAZÃO SOCIAL]", cnpj: "[CNPJ]", address: "[ENDEREÇO COMPLETO]" })).toBe("a Vyzualize");
    expect(controllerText({ legalName: "Empresa Ltda", cnpj: "[CNPJ]", address: "Rua A" })).toBe("a Vyzualize");
  });
  it("preenchida, cita razão social, CNPJ e sede", () => {
    expect(controllerText({ legalName: "Empresa Ltda", cnpj: "00.000.000/0001-00", address: "Rua A, 1" })).toBe("a Empresa Ltda, inscrita no CNPJ 00.000.000/0001-00, com sede em Rua A, 1");
    expect(controllerText({ legalName: "Empresa Ltda", cnpj: "00.000.000/0001-00", address: "[ENDEREÇO COMPLETO]" })).toBe("a Empresa Ltda, inscrita no CNPJ 00.000.000/0001-00");
  });
});
