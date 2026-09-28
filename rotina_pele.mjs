import fs from "fs"; import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const ROOT = "/home/user/controle-cashless";
const P = {
  suavie: ["darrow_suavie", "Darrow Suavié"],
  effaclar: ["lrp_effaclar_serum", "Effaclar Sérum"],
  melab3: ["lrp_mela_b3", "Mela B3 Sérum"],
  kox: ["isdin_kox_eyes", "K-Ox Eyes"],
  anthelios: ["lrp_anthelios_airlicium", "Anthelios Airlicium+"],
  epidrat: ["mantecorp_epidrat_calm_b5", "Epidrat Calm B5"],
  zella: ["mantecorp_zella", "Zella gel"],
  eucerin: ["eucerin_epigenetic", "Eucerin Epigenetic"],
};
const missing = new Set();
const img = k => {
  const [f, label] = P[k];
  const hit = ["png","jpg","jpeg","webp","svg"].map(e => `assets/${f}.${e}`).find(p => fs.existsSync(path.join(ROOT, p)));
  if (hit) return `<div class="ph"><img src="file://${ROOT}/${hit}"></div>`;
  missing.add(label);
  return `<div class="ph ph-empty"><span>${label}</span></div>`;
};
const row = (n, keys, name, desc, cls="") => `
<div class="row ${cls}"><div class="num">${n}</div>
<div class="imgs">${keys.map(img).join("")}</div>
<div class="txt"><div class="name">${name}</div><div class="desc">${desc}</div></div></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1920px;background:#fff;font-family:Inter,"Liberation Sans",Arial,sans-serif;color:#1a1a1a;padding:52px 60px 40px;display:flex;flex-direction:column}
h1{font-size:50px;font-weight:800;letter-spacing:-1px}
.sub{font-size:22px;color:#777;margin-top:4px}
.sec{display:flex;align-items:center;gap:16px;margin:30px 0 6px}
.sec h2{font-size:34px;font-weight:800;text-transform:uppercase;letter-spacing:2px}
.sec .line{flex:1;height:2px;background:#e6e6e6}
.row{display:flex;align-items:center;gap:22px;padding:10px 0;border-bottom:1px solid #f0f0f0}
.row:last-child{border-bottom:none}
.num{width:48px;height:48px;border-radius:50%;background:#1a1a1a;color:#fff;font-weight:700;font-size:24px;display:flex;align-items:center;justify-content:center;flex:none}
.alt .num{background:#fff;color:#1a1a1a;border:2px solid #1a1a1a;font-size:17px}
.imgs{display:flex;gap:10px;flex:none;width:280px}
.ph{width:135px;height:135px;background:#fff;display:flex;align-items:center;justify-content:center;border:1px solid #eee;border-radius:10px;overflow:hidden}
.ph img{max-width:100%;max-height:100%;object-fit:contain}
.ph-empty{background:#d9d9d9;border:none}
.ph-empty span{font-size:15px;font-weight:700;color:#555;text-align:center;padding:8px;line-height:1.2}
.txt{flex:1}
.name{font-size:25px;font-weight:700;line-height:1.2}
.desc{font-size:21px;color:#555;line-height:1.35;margin-top:5px}
.tag{display:inline-block;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#fff;background:#1a1a1a;border-radius:4px;padding:2px 8px;margin-bottom:5px}
.foot{margin-top:auto;font-size:21px;color:#1a1a1a;background:#f4f4f4;border-radius:10px;padding:16px 22px;font-weight:500}
</style></head><body>
<h1>Rotina de cuidados com a pele</h1><div class="sub">Manhã e noite, nesta ordem</div>
<div class="sec"><h2>Manhã</h2><div class="line"></div></div>
${row(1,["suavie"],"Darrow Suavié <span style='font-weight:400;color:#888'>140 ml</span>","Lavar o rosto com água morna ou fria, secar sem esfregar")}
${row(2,["effaclar"],"La Roche-Posay Effaclar Sérum Ultra Concentrado","2 a 3 gotas no rosto, evitando os olhos; esperar 2 min")}
${row(3,["melab3","kox"],"Mela B3 sérum + ISDIN K-Ox Eyes","Misturar e aplicar ao redor dos olhos com toques leves")}
${row(4,["anthelios"],"Anthelios Airlicium+ FPS 80 gel-creme","Meia colher de chá no rosto, pálpebras e orelhas; reaplicar após o almoço")}
<div class="sec"><h2>Noite</h2><div class="line"></div></div>
${row(1,["suavie"],"Darrow Suavié","Remover protetor e oleosidade do dia")}
${row(2,["effaclar"],"Effaclar Sérum Ultra Concentrado","2 a 3 gotas, igual à manhã")}
${row(3,["melab3","kox"],"Mela B3 + K-Ox Eyes","Área dos olhos")}
${row(4,["epidrat"],"Mantecorp Epidrat Calm B5 balm","Camada fina no rosto todo (hidratante)")}
${row("5a",["zella"],"<span class='tag'>Noites ímpares</span><br>Zella gel 150 mg/g ácido azelaico","Tamanho de uma ervilha por cima do hidratante, evitar olhos e boca","alt")}
${row("5b",["eucerin"],"<span class='tag'>Noites pares</span><br>Eucerin Epigenetic sérum","No lugar do Zella","alt")}
<div class="foot">Zella por 3 meses, sempre em noites alternadas</div>
</body></html>`;
fs.writeFileSync(path.join(ROOT, "rotina_pele.html"), html);
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.goto("file://" + ROOT + "/rotina_pele.html", { waitUntil: "networkidle" });
await pg.evaluate(() => document.fonts.ready);
const over = await pg.evaluate(() => document.body.scrollHeight);
await pg.screenshot({ path: ROOT + "/rotina_pele.png" });
await b.close();
console.log("scrollHeight", over, "missing:", [...missing].join(", "));
