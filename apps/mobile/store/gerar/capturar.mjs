// Captura as telas do app (versão web, `npx expo start --web` com o
// .env.production.local) no tamanho do iPhone 6,9" (440×956 @3x = 1320×2868),
// entrando com a conta de revisão. Saída: ../build/telas/*.png
// (Chrome sem a trava de CORS: o app web em localhost chama a API de produção.)
//
//   VYZ_EMAIL=... VYZ_SENHA=... node store/gerar/capturar.mjs

import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");
const OUT = new URL("../build/telas/", import.meta.url).pathname;
const BASE = process.env.BASE ?? "http://localhost:8081";
const EMAIL = process.env.VYZ_EMAIL;
const SENHA = process.env.VYZ_SENHA;
if (!EMAIL || !SENHA) throw new Error("Defina VYZ_EMAIL e VYZ_SENHA (conta de revisão).");
const META = process.env.DASH_META ?? "9339eb00-a3db-4758-9a7c-5cfa2fec1fa3";

mkdirSync(OUT, { recursive: true });
const profile = join(tmpdir(), "vyz-capturar");
rmSync(profile, { recursive: true, force: true });
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--remote-debugging-port=9334", "--hide-scrollbars", "--disable-web-security", "--window-size=440,956", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
let seq = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }).then((r) => r.result?.result?.value);
const go = (path) => send("Page.navigate", { url: BASE + path });
async function until(expr, ms = 40000) { for (let t = 0; t < ms; t += 300) { if (await ev(expr)) return; await sleep(300); } throw new Error(`Tempo esgotado: ${expr}`); }
const has = (txt) => `document.body.innerText.includes(${JSON.stringify(txt)})`;
const click = (txt) => ev(`(()=>{const e=[...document.querySelectorAll('[role=button],[role=tab],a,button')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(txt)}));e?.click();return !!e})()`);
const type = (i, v) => ev(`(()=>{const el=document.querySelectorAll('input')[${i}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(v)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
async function shot(name) {
  if (await ev(has("Encountered"))) throw new Error(`Erro na tela ${name}`);
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.result.data, "base64"));
  console.log("✓", name);
}
async function scrollTo(txt) { await ev(`(()=>{const e=[...document.querySelectorAll('div')].find(e=>e.textContent.trim()===${JSON.stringify(txt)});e?.scrollIntoView();return !!e})()`); await sleep(1200); }

let url;
for (let i = 0; i < 50 && !url; i++) { try { url = (await (await fetch("http://127.0.0.1:9334/json")).json()).find((x) => x.type === "page")?.webSocketDebuggerUrl; } catch {} if (!url) await sleep(200); }
if (!url) throw new Error("Chrome não abriu.");
ws = new WebSocket(url);
ws.on("message", (m) => { const d = JSON.parse(m); pending.get(d.id)?.(d); pending.delete(d.id); });
await new Promise((r, j) => { ws.once("open", r); ws.once("error", j); });
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 440, height: 956, deviceScaleFactor: 3, mobile: true });

try {
  await go("/entrar");
  await until(`document.querySelectorAll('input').length>=2`);
  await sleep(1500);
  await shot("0-entrar");
  await type(0, EMAIL);
  await type(1, SENHA);
  await click("Entrar");
  await until(has("RECEITA"));
  await sleep(5000);
  await shot("1-inicio");
  await click("Análises");
  await until(has("Pulso das contas"));
  await sleep(2000);
  await shot("2-analises");
  await go(`/dashboards/${META}`);
  await until(has("Campanhas"));
  await sleep(4000);
  await shot("3-dashboard");
  await scrollTo("Análise do VYZ");
  await shot("4-analise-campanhas");
  await go(`/vyz?q=${encodeURIComponent("Quanto investi esse mês?")}`);
  await until(has("Você investiu"));
  await sleep(2500);
  await shot("5-vyz");
} catch (err) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, "erro.png"), Buffer.from(r.result.data, "base64"));
  console.error(`Falhou (veja ${join(OUT, "erro.png")}):`, err.message, "\n", (await ev("document.body.innerText")).slice(0, 400));
  process.exitCode = 1;
} finally {
  ws.close();
  chrome.kill();
}
