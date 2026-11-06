// Cria as assinaturas do Vyzualize na App Store e no Google Play a partir de
// store/pacotes-lojas.csv (6 planos), sem tocar nos IDs. Idempotente: o que
// já existe é pulado (só o preço é conferido).
//
//   node store/gerar/produtos.mjs apple  [--dry]
//   node store/gerar/produtos.mjs google [--dry]
//
// Apple (App Store Connect > Usuários e acesso > Integrações > API da App Store Connect,
// chave de equipe com acesso "Gerente de app" ou "Admin"):
//   ASC_KEY_ID=XXXXXXXXXX ASC_ISSUER_ID=uuid ASC_KEY_PATH=~/.vyz/AuthKey_XXXX.p8
// Google, sem chave (a organização bloqueia chaves de conta de serviço): token
// temporário da conta revenuecat@ por impersonação, via gcloud:
//   PLAY_ACCESS_TOKEN=$(gcloud auth print-access-token \
//     --impersonate-service-account=revenuecat@vyzualize-513214.iam.gserviceaccount.com \
//     --scopes=https://www.googleapis.com/auth/androidpublisher)
// (alternativa, se um dia houver chave: PLAY_SA_JSON=~/.vyz/play-service-account.json)
// O Google exige que um .aab com a permissão de compras já tenha sido enviado
// (faixa de teste interno) antes de criar assinaturas.
//
// Segredos ficam fora do git (em ~/.vyz). Nada aqui é commitado com chave.

import { createSign, createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const APP_ID = "6831678959";          // App Store Connect
const PKG = "app.vyz.painel";
const GRUPO = "Vyzualize Planos";
const DRY = process.argv.includes("--dry");
const alvo = process.argv[2];
const exp = (p) => p.replace(/^~/, homedir());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- CSV ----------
const csv = readFileSync(new URL("../pacotes-lojas.csv", import.meta.url), "utf8").trim().split("\n");
const cols = csv.shift().split(",");
const produtos = csv.map((l) => {
  const v = l.match(/("[^"]*"|[^,]+)/g).map((s) => s.replace(/^"|"$/g, ""));
  const o = Object.fromEntries(cols.map((c, i) => [c, v[i]]));
  o.projetos = +o.ate_projetos; o.preco = +o.preco_brl; // o.plano: base | pro | avancado
  return o;
});
const TOTAL = 6;
if (produtos.length !== TOTAL) throw new Error(`esperava ${TOTAL} produtos, li ${produtos.length}`);
// Créditos (consumíveis), definidos pelo Gustavo em 06/11/2026: 1 crédito R$ 10, 5 créditos R$ 40.
// vyz_creditos_100/500 foram abandonados (não reusar nem enviar para revisão).
const CREDITOS = [
  { id: "vyz_creditos_1", nome: "1 crédito", preco: 10.0 },
  { id: "vyz_creditos_5", nome: "5 créditos", preco: 40.0 },
];
const RANK = { avancado: 0, pro: 1, base: 2 };
// Nível no grupo: 1 = maior. Avançado (1) > Padrão (2) > Básico (3); mensal e anual no mesmo nível.
const nivel = (p) => RANK[p.plano] + 1;
const descricao = (p) => `Até ${p.projetos} projetos, renovação ${p.periodo === "anual" ? "anual" : "mensal"}`;

// ---------- Apple ----------
function jwtApple() {
  const key = createPrivateKey(readFileSync(exp(process.env.ASC_KEY_PATH)));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: process.env.ASC_KEY_ID, typ: "JWT" });
  const body = b64({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" });
  const s = createSign("SHA256"); s.update(`${head}.${body}`);
  return `${head}.${body}.${s.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
let tok, tokAt = 0;
async function asc(method, path, body) {
  if (!tok || Date.now() - tokAt > 15 * 60e3) { tok = jwtApple(); tokAt = Date.now(); }
  for (let t = 0; t < 5; t++) {
    const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      method, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429 || r.status >= 500) { await sleep(5000 * (t + 1)); continue; }
    const j = r.status === 204 ? {} : await r.json();
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j.errors || j).slice(0, 400)}`);
    return j;
  }
  throw new Error(`limite de requisições em ${path}`);
}
async function todas(path) {
  let out = [], url = path;
  while (url) { const j = await asc("GET", url); out = out.concat(j.data); url = j.links?.next?.replace("https://api.appstoreconnect.apple.com", ""); }
  return out;
}

async function apple() {
  for (const v of ["ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_PATH"]) if (!process.env[v]) throw new Error(`defina ${v}`);
  // grupo
  const grupos = await todas(`/v1/apps/${APP_ID}/subscriptionGroups?limit=200`);
  let grupo = grupos.find((g) => g.attributes.referenceName === GRUPO);
  if (!grupo && !DRY) {
    grupo = (await asc("POST", "/v1/subscriptionGroups", { data: { type: "subscriptionGroups",
      attributes: { referenceName: GRUPO }, relationships: { app: { data: { type: "apps", id: APP_ID } } } } })).data;
    await asc("POST", "/v1/subscriptionGroupLocalizations", { data: { type: "subscriptionGroupLocalizations",
      attributes: { locale: "pt-BR", name: "Planos Vyzualize" },
      relationships: { subscriptionGroup: { data: { type: "subscriptionGroups", id: grupo.id } } } } });
  }
  console.log(`grupo: ${grupo ? grupo.id : "(criaria)"} ${GRUPO}`);
  const existentes = grupo ? await todas(`/v1/subscriptionGroups/${grupo.id}/subscriptions?limit=200`) : [];
  const porId = Object.fromEntries(existentes.map((s) => [s.attributes.productId, s]));

  let n = 0;
  for (const p of produtos) {
    n++;
    let sub = porId[p.product_id];
    const tag = `[${n}/${TOTAL}] ${p.product_id} R$ ${p.preco.toFixed(2)} nível ${nivel(p)}`;
    if (DRY) { console.log(`${sub ? "existe " : "criaria"} ${tag}`); continue; }
    if (!sub) {
      sub = (await asc("POST", "/v1/subscriptions", { data: { type: "subscriptions",
        attributes: { name: `${p.nome} · ${p.periodo}`, productId: p.product_id, familySharable: false, groupLevel: nivel(p),
          subscriptionPeriod: p.periodo === "anual" ? "ONE_YEAR" : "ONE_MONTH" },
        relationships: { group: { data: { type: "subscriptionGroups", id: grupo.id } } } } })).data;
      await asc("POST", "/v1/subscriptionLocalizations", { data: { type: "subscriptionLocalizations",
        attributes: { locale: "pt-BR", name: p.nome.slice(0, 30), description: descricao(p).slice(0, 45) },
        relationships: { subscription: { data: { type: "subscriptions", id: sub.id } } } } });
      await asc("POST", "/v1/subscriptionAvailabilities", { data: { type: "subscriptionAvailabilities",
        attributes: { availableInNewTerritories: false },
        relationships: { subscription: { data: { type: "subscriptions", id: sub.id } },
          availableTerritories: { data: [{ type: "territories", id: "BRA" }] } } } });
    }
    // preço no Brasil: ponto de preço igual ou o mais próximo acima
    const precos = await asc("GET", `/v1/subscriptions/${sub.id}/prices?include=subscriptionPricePoint&filter[territory]=BRA&limit=50`);
    const atual = precos.included?.find((i) => i.type === "subscriptionPricePoints");
    if (atual && Math.abs(+atual.attributes.customerPrice - p.preco) < 0.005) { console.log(`ok     ${tag}`); continue; }
    const pontos = await todas(`/v1/subscriptions/${sub.id}/pricePoints?filter[territory]=BRA&limit=200`);
    const ord = pontos.map((x) => ({ id: x.id, v: +x.attributes.customerPrice })).sort((a, b) => a.v - b.v);
    const ponto = ord.find((x) => x.v >= p.preco - 0.005) || ord[ord.length - 1];
    await asc("POST", "/v1/subscriptionPrices", { data: { type: "subscriptionPrices",
      attributes: { preserveCurrentPrice: false },
      relationships: { subscription: { data: { type: "subscriptions", id: sub.id } },
        subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: ponto.id } },
        territory: { data: { type: "territories", id: "BRA" } } } } });
    console.log(`${ponto.v === p.preco ? "criado" : `criado (preço Apple R$ ${ponto.v.toFixed(2)})`} ${tag}`);
  }
  // créditos
  const iaps = await todas(`/v1/apps/${APP_ID}/inAppPurchasesV2?limit=200`);
  for (const c of CREDITOS) {
    const ex = iaps.find((i) => i.attributes.productId === c.id);
    if (DRY) { console.log(`${ex ? "existe " : "criaria"} ${c.id} R$ ${c.preco.toFixed(2)}`); continue; }
    if (ex) { console.log(`existe ${c.id}`); continue; }
    const iap = (await asc("POST", "/v2/inAppPurchases", { data: { type: "inAppPurchases",
      attributes: { name: c.nome, productId: c.id, inAppPurchaseType: "CONSUMABLE" },
      relationships: { app: { data: { type: "apps", id: APP_ID } } } } })).data;
    await asc("POST", "/v1/inAppPurchaseLocalizations", { data: { type: "inAppPurchaseLocalizations",
      attributes: { locale: "pt-BR", name: c.nome, description: `${c.nome} para usar no Vyzualize` },
      relationships: { inAppPurchaseV2: { data: { type: "inAppPurchases", id: iap.id } } } } });
    await asc("POST", "/v1/inAppPurchaseAvailabilities", { data: { type: "inAppPurchaseAvailabilities",
      attributes: { availableInNewTerritories: false },
      relationships: { inAppPurchase: { data: { type: "inAppPurchases", id: iap.id } },
        availableTerritories: { data: [{ type: "territories", id: "BRA" }] } } } });
    const pts = (await todas(`/v2/inAppPurchases/${iap.id}/pricePoints?filter[territory]=BRA&limit=200`))
      .map((x) => ({ id: x.id, v: +x.attributes.customerPrice })).sort((a, b) => a.v - b.v);
    const pp = pts.find((x) => x.v >= c.preco - 0.005) || pts[pts.length - 1];
    await asc("POST", "/v1/inAppPurchasePriceSchedules", {
      data: { type: "inAppPurchasePriceSchedules", relationships: {
        inAppPurchase: { data: { type: "inAppPurchases", id: iap.id } },
        baseTerritory: { data: { type: "territories", id: "BRA" } },
        manualPrices: { data: [{ type: "inAppPurchasePrices", id: "${p0}" }] } } },
      included: [{ type: "inAppPurchasePrices", id: "${p0}", attributes: { startDate: null },
        relationships: { inAppPurchasePricePoint: { data: { type: "inAppPurchasePricePoints", id: pp.id } } } }] });
    console.log(`criado ${c.id} R$ ${pp.v.toFixed(2)}`);
  }
}

// ---------- Google ----------
async function tokenGoogle() {
  const sa = JSON.parse(readFileSync(exp(process.env.PLAY_SA_JSON), "utf8"));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const un = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher", aud: sa.token_uri, iat: now, exp: now + 3500 })}`;
  const s = createSign("RSA-SHA256"); s.update(un);
  const r = await fetch(sa.token_uri, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${un}.${s.sign(sa.private_key, "base64url")}` }) });
  const j = await r.json(); if (!j.access_token) throw new Error(`token Google: ${JSON.stringify(j)}`);
  return j.access_token;
}
async function google() {
  if (!process.env.PLAY_ACCESS_TOKEN && !process.env.PLAY_SA_JSON) throw new Error("defina PLAY_ACCESS_TOKEN (ou PLAY_SA_JSON)");
  const token = process.env.PLAY_ACCESS_TOKEN || await tokenGoogle();
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
  const call = async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j.error || j).slice(0, 400)}`);
    return j;
  };
  const existentes = new Set();
  let pt = "";
  do { const j = await call("GET", `/subscriptions?pageSize=200${pt ? `&pageToken=${pt}` : ""}`);
    (j.subscriptions || []).forEach((s) => existentes.add(s.productId)); pt = j.nextPageToken; } while (pt);

  let n = 0;
  for (const p of produtos) {
    n++;
    const bp = p.periodo; // "mensal" | "anual"
    const tag = `[${n}/${TOTAL}] ${p.product_id} R$ ${p.preco.toFixed(2)}`;
    if (DRY) { console.log(`${existentes.has(p.product_id) ? "existe " : "criaria"} ${tag}`); continue; }
    if (existentes.has(p.product_id)) { console.log(`existe ${tag}`); continue; }
    const [units, cents = "0"] = p.preco.toFixed(2).split(".");
    await call("POST", `/subscriptions?productId=${p.product_id}&regionsVersion.version=2022/02`, {
      packageName: PKG, productId: p.product_id,
      listings: [{ languageCode: "pt-BR", title: p.nome.slice(0, 55), benefits: [descricao(p).slice(0, 40)] }],
      basePlans: [{ basePlanId: bp, state: "DRAFT",
        autoRenewingBasePlanType: { billingPeriodDuration: bp === "anual" ? "P1Y" : "P1M",
          resubscribeState: "RESUBSCRIBE_STATE_ACTIVE", legacyCompatible: true },
        regionalConfigs: [{ regionCode: "BR", newSubscriberAvailability: true,
          price: { currencyCode: "BRL", units, nanos: +cents * 10_000_000 } }] }],
    });
    await call("POST", `/subscriptions/${p.product_id}/basePlans/${bp}:activate`, { packageName: PKG, productId: p.product_id, basePlanId: bp });
    console.log(`criado ${tag}`);
  }
  // créditos (produto único, consumível)
  for (const c of CREDITOS) {
    if (DRY) { console.log(`criaria ${c.id} R$ ${c.preco.toFixed(2)}`); continue; }
    try { await call("GET", `/inappproducts/${c.id}`); console.log(`existe ${c.id}`); continue; } catch {}
    await call("POST", `/inappproducts?autoConvertMissingPrices=true`, {
      packageName: PKG, sku: c.id, status: "active", purchaseType: "managedUser", defaultLanguage: "pt-BR",
      defaultPrice: { priceMicros: String(Math.round(c.preco * 1e6)), currency: "BRL" },
      listings: { "pt-BR": { title: c.nome, description: `${c.nome} para usar no Vyzualize` } } });
    console.log(`criado ${c.id} R$ ${c.preco.toFixed(2)}`);
  }
}

(alvo === "apple" ? apple() : alvo === "google" ? google() : Promise.reject(new Error("uso: produtos.mjs apple|google [--dry]")))
  .then(() => console.log(DRY ? "simulação concluída" : "concluído"))
  .catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
