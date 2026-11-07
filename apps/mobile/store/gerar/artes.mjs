// Gera as artes das lojas a partir de HTML no Chrome: ícones do app (iOS,
// Android adaptativo, splash), ícone e arte de destaque do Google Play e os
// prints com título (a partir de ../build/telas, de capturar.mjs).
//
//   node store/gerar/artes.mjs            (tudo)
//   node store/gerar/artes.mjs icones     (só ícones do app e gráficos)

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname; // apps/mobile/
const STORE = join(ROOT, "store");
const TELAS = join(STORE, "build/telas");
const TMP = join(tmpdir(), "vyz-artes");
mkdirSync(TMP, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FONT = "-apple-system,'SF Pro Display','Helvetica Neue',Arial,sans-serif";
const V = `<polygon points="22,22 43.28,22 48.71,45.52 29.53,45.52"/><polygon points="78,22 56.72,22 51.29,45.52 70.47,45.52"/><polygon points="31.5,51.68 68.5,51.68 60.08,78 39.92,78"/>`;

function render(name, w, h, body, out) {
  const html = join(TMP, `${name}.html`);
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}*{box-sizing:border-box}</style></head><body>${body}</body></html>`);
  rmSync(out, { force: true });
  // perfil próprio por arte; o Chrome às vezes sai com código ≠ 0 mesmo tendo salvo: vale o arquivo
  for (let tentativa = 0; tentativa < 3 && !existsSync(out); tentativa++) {
    try {
      execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--default-background-color=00000000", `--user-data-dir=${join(TMP, "perfil")}`, `--screenshot=${out}`, `--window-size=${w},${h}`, `file://${html}`], { stdio: "ignore" });
    } catch {}
  }
  if (!existsSync(out)) throw new Error(`Não gerou ${out}`);
  return out;
}
/** JPEG sem transparência (a App Store recusa print com canal alfa). */
const jpeg = (png, out) => execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "92", png, "--out", out], { stdio: "ignore" });
const mark = (size, vb, fill, bg = "", rx = 0) => `<svg width=${size} height=${size} viewBox='${vb}'>${bg ? `<rect x=-50 y=-50 width=200 height=200 rx=${rx} fill='${bg}'/>` : ""}<g fill='${fill}'>${V}</g></svg>`;

function icones() {
  const img = join(ROOT, "assets/images");
  const g = join(STORE, "graphics");
  mkdirSync(g, { recursive: true });
  render("icon", 1024, 1024, `<svg width=1024 height=1024 viewBox='0 0 100 100'><defs><linearGradient id=g x1=0 y1=0 x2=0 y2=1><stop offset=0 stop-color='#5A6428'/><stop offset=1 stop-color='#3F461B'/></linearGradient></defs><rect width=100 height=100 fill='url(#g)'/><g fill='#E8ECE1'>${V}</g></svg>`, join(img, "icon.png"));
  // Android adaptativo: o V dentro da zona segura (66% central)
  render("fg", 512, 512, mark(512, "-20 -20 140 140", "#E8ECE1"), join(img, "android-icon-foreground.png"));
  render("mono", 512, 512, mark(512, "-20 -20 140 140", "#FFFFFF"), join(img, "android-icon-monochrome.png"));
  render("bg", 512, 512, `<svg width=512 height=512><rect width=512 height=512 fill='#4B5320'/></svg>`, join(img, "android-icon-background.png"));
  render("splash", 512, 512, `<svg width=512 height=512 viewBox='0 0 100 100'><rect width=100 height=100 rx=22 fill='#4B5320'/><g fill='#E8ECE1'>${V}</g></svg>`, join(img, "splash-icon.png"));
  copyFileSync(join(img, "icon.png"), join(g, "icone-1024.png"));
  const play = render("play", 512, 512, `<svg width=512 height=512 viewBox='0 0 100 100'><rect width=100 height=100 fill='#4B5320'/><g fill='#E8ECE1'>${V}</g></svg>`, join(TMP, "play.png"));
  copyFileSync(play, join(g, "icone-play-512.png"));
  const feat = render(
    "feature",
    1024,
    500,
    `<div style="width:1024px;height:500px;background:radial-gradient(circle at 80% 30%,#2a2f17 0,#0E0F0D 60%);display:flex;align-items:center;gap:48px;padding:0 72px;font-family:${FONT}"><svg width=170 height=170 viewBox='0 0 100 100' style='flex:none'><rect width=100 height=100 rx=22 fill='#4B5320'/><g fill='#E8ECE1'>${V}</g></svg><div><div style='color:#F2F3EE;font-size:64px;font-weight:800;letter-spacing:-2px;line-height:1.02'>Seus números,<br><span style='color:#B5C477'>na palma da mão.</span></div><div style='color:#A7AA9F;font-size:26px;margin-top:18px;font-weight:500'>Todas as suas campanhas, com análises do VYZ</div></div></div>`,
    join(TMP, "feature.png"),
  );
  jpeg(feat, join(g, "arte-destaque-play-1024x500.jpg"));
  console.log("✓ ícones e gráficos");
}

const PRINTS = [
  ["1-inicio", "Suas contas, <span>num toque.</span>", "As campanhas de todos os clientes, com o número que importa logo na entrada."],
  ["3-dashboard", "Arraste o dedo, <span>leia cada dia.</span>", "Receita, ROAS, CPA e investimento com gráficos feitos para o celular."],
  ["2-analises", "O VYZ aponta <span>o que mudou.</span>", "Alertas e oportunidades das suas campanhas, sem abrir planilha."],
  ["4-analise-campanhas", "Saiba onde <span>escalar e cortar.</span>", "Campanhas, criativos e públicos lado a lado, com o filtro num toque."],
  ["5-vyz", "Pergunte em <span>português.</span>", "\"Quanto investi esse mês?\" O VYZ responde com os seus números."],
];
const SIZES = [
  ["ios-6.9", 1320, 2868],
  ["android-phone", 1080, 1920],
];

function prints() {
  for (const [dir, w, h] of SIZES) {
    const out = join(STORE, "screenshots", dir);
    mkdirSync(out, { recursive: true });
    PRINTS.forEach(([tela, title, sub], i) => {
      const src = join(TELAS, `${tela}.png`);
      if (!existsSync(src)) throw new Error(`Falta ${src}: rode capturar.mjs antes.`);
      const body = `<div style="width:${w}px;height:${h}px;background:radial-gradient(120% 60% at 50% 0%,#2b3118 0%,#0E0F0D 55%);font-family:${FONT};display:flex;flex-direction:column;align-items:center">
<div style="height:${w * 0.09}px"></div>
<div style="color:#F2F3EE;font-weight:800;letter-spacing:-0.03em;text-align:center;line-height:1.05;font-size:${w * 0.083}px;padding:0 6%">${title.replace("<span>", "<span style='color:#B5C477'>")}</div>
<div style="color:#A7AA9F;text-align:center;font-weight:500;font-size:${w * 0.036}px;margin-top:${w * 0.025}px;padding:0 10%">${sub}</div>
<div style="margin-top:${w * 0.07}px;width:78%;flex:1;overflow:hidden;background:#0E0F0D;border-radius:${w * 0.07}px ${w * 0.07}px 0 0;border:${w * 0.012}px solid #1b1d18;border-bottom:0;box-shadow:0 ${w * 0.016}px ${w * 0.04}px rgba(0,0,0,.6)"><img src="file://${src}" style="width:100%;display:block"></div></div>`;
      jpeg(render(`p-${dir}-${i}`, w, h, body, join(TMP, `p-${dir}-${i}.png`)), join(out, `0${i + 1}.jpg`));
    });
    console.log(`✓ prints ${dir} (${w}×${h})`);
  }
}

icones();
if (process.argv[2] !== "icones") prints();
