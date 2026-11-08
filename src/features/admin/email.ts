// Resumo de segunda do painel interno, em HTML simples (puro, testável).

import { delta, int, moneyText, pct, type AdminReport, type RevenueBlock, type Source } from "./types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function revenueRow(name: string, src: Source<RevenueBlock>): string {
  if (!src.ok) return `<tr><td style="padding:6px 8px">${name}</td><td colspan="4" style="padding:6px 8px;color:#777">${esc(src.reason)}</td></tr>`;
  const d = src.data;
  return `<tr><td style="padding:6px 8px">${name}</td><td style="padding:6px 8px">${esc(moneyText(d.mrr))}</td><td style="padding:6px 8px">${int(d.subscribers)}</td><td style="padding:6px 8px">${esc(moneyText(d.revenue30))}</td><td style="padding:6px 8px">${int(d.churned30)} · ${pct(d.churnRate)} · ${int(d.refundCount30)} reemb.</td></tr>`;
}

export function weeklyEmail(r: AdminReport): { subject: string; html: string; text: string } {
  const u = r.users.ok ? r.users.data : null;
  const g = r.ga4.ok ? r.ga4.data : null;
  const d = u ? delta(u.new7, u.newPrev7) : null;
  const subject = `VYZ · resumo da semana: ${u ? `${int(u.new7)} cadastros` : "usuários indisponíveis"}`;
  const lines = [
    u ? `Usuários: ${int(u.total)} no total, ${int(u.new7)} novos na semana (${d === null ? "sem base" : `${d >= 0 ? "+" : ""}${pct(d, 0)}`}), ${int(u.active7)} ativos em 7 dias, ${int(u.workspacesWithPlan)} workspaces com plano.` : `Usuários: ${r.users.ok ? "" : r.users.reason}`,
    g ? `GA4: ${int(g.active7)} ativos em 7 dias, ${int(g.newUsers28)} novos e ${int(g.sessions28)} sessões em 28 dias.` : `GA4: ${r.ga4.ok ? "" : r.ga4.reason}`,
  ];
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#1d1d1b;max-width:680px;margin:0 auto;padding:16px">
<h1 style="font-size:20px;margin:0 0 12px">Resumo da semana · Vyzualize</h1>
${lines.map((l) => `<p style="margin:0 0 8px;font-size:14px">${esc(l)}</p>`).join("")}
<h2 style="font-size:16px;margin:20px 0 8px">Receita por fonte</h2>
<table style="border-collapse:collapse;font-size:13px;width:100%"><thead><tr style="text-align:left;color:#555"><th style="padding:6px 8px">Fonte</th><th style="padding:6px 8px">MRR</th><th style="padding:6px 8px">Assinantes</th><th style="padding:6px 8px">Receita 30d</th><th style="padding:6px 8px">Churn · reembolsos</th></tr></thead><tbody>
${revenueRow("Site (Stripe)", r.stripe)}${revenueRow("App Store", r.appStore)}${revenueRow("Google Play", r.googlePlay)}${revenueRow("RevenueCat (lojas juntas)", r.revenueCat)}
</tbody></table>
<p style="font-size:12px;color:#777;margin-top:16px">O RevenueCat soma as duas lojas e não entra no total. Detalhes em https://vyzualize.com.br/interno</p>
</body></html>`;
  const text = [...lines, "", "Receita: veja o painel em https://vyzualize.com.br/interno"].join("\n");
  return { subject, html, text };
}
