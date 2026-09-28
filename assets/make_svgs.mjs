// Ilustrações vetoriais das embalagens (sem acesso à internet para fotos oficiais).
import fs from "fs";
const W = 300, H = 300;
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/><defs><linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".10"/><stop offset=".25" stop-color="#fff" stop-opacity=".35"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient></defs><ellipse cx="150" cy="286" rx="70" ry="7" fill="#000" opacity=".08"/>${body}</svg>`;
const t = (x, y, s, txt, c, w = 700, ls = 0) => `<text x="${x}" y="${y}" font-family="Liberation Sans,Arial,sans-serif" font-size="${s}" font-weight="${w}" fill="${c}" text-anchor="middle" letter-spacing="${ls}">${txt}</text>`;
// frasco conta-gotas
const dropper = ({ glass, cap, label, lines }) => wrap(`
<rect x="132" y="22" width="36" height="46" rx="16" fill="${cap}"/>
<rect x="122" y="64" width="56" height="34" rx="4" fill="${cap}"/>
<rect x="92" y="96" width="116" height="184" rx="18" fill="${glass}"/>
<rect x="100" y="122" width="100" height="136" rx="6" fill="${label}"/>
${lines.join("")}
<rect x="92" y="96" width="116" height="184" rx="18" fill="url(#sh)"/>`);
// bisnaga (tampa embaixo)
const tube = ({ body, cap, lines, w = 110 }) => { const x = 150 - w / 2; return wrap(`
<path d="M${x - 6} 18 H${x + w + 6} V30 L${x + w} 44 V220 H${x} V44 L${x - 6} 30 Z" fill="${body}" stroke="#e2e2e2" stroke-width="1.5"/>
<rect x="${x + 6}" y="218" width="${w - 12}" height="62" rx="8" fill="${cap}"/>
${lines.join("")}
<rect x="${x}" y="30" width="${w}" height="190" fill="url(#sh)"/>`); };
// frasco com válvula pump
const pump = ({ body, cap, lines }) => wrap(`
<rect x="138" y="20" width="44" height="14" rx="4" fill="${cap}"/><rect x="176" y="24" width="30" height="8" rx="3" fill="${cap}"/>
<rect x="143" y="32" width="14" height="30" fill="${cap}"/><rect x="126" y="60" width="48" height="28" rx="5" fill="${cap}"/>
<rect x="98" y="86" width="104" height="194" rx="22" fill="${body}" stroke="#e2e2e2" stroke-width="1.5"/>
${lines.join("")}
<rect x="98" y="86" width="104" height="194" rx="22" fill="url(#sh)"/>`);
const LRP = "#0a5aa8";
const P = {
  darrow_suavie: pump({ body: "#f7f4fb", cap: "#dcdcdc", lines: [
    t(150, 140, 15, "DARROW", "#5a4a8a", 700, 2), `<rect x="112" y="152" width="76" height="2" fill="#b7a9dd"/>`,
    t(150, 186, 24, "Suavié", "#5a4a8a"), t(150, 210, 11, "sabonete líquido", "#7a6aa8", 400), t(150, 262, 11, "140 ml", "#7a6aa8", 400)] }),
  lrp_effaclar_serum: dropper({ glass: "#dfe8f1", cap: "#dcdcdc", label: "#ffffff", lines: [
    t(150, 142, 9, "LA ROCHE-POSAY", LRP, 700, 1), t(150, 176, 19, "EFFACLAR", LRP), t(150, 198, 15, "SÉRUM", LRP),
    t(150, 218, 9, "ULTRA CONCENTRADO", "#e3342f", 700), t(150, 250, 10, "30 ml", "#555", 400)] }),
  lrp_mela_b3: dropper({ glass: "#ffffff", cap: "#dcdcdc", label: "#ffffff", lines: [
    t(150, 142, 9, "LA ROCHE-POSAY", LRP, 700, 1), t(150, 180, 26, "MELA", "#1d1d1b"), t(150, 208, 22, "B3", "#b0467d"),
    t(150, 228, 11, "SÉRUM", "#1d1d1b", 400), t(150, 250, 10, "15 ml", "#555", 400)] }),
  isdin_kox_eyes: tube({ w: 84, body: "#f3f1ee", cap: "#c9b99a", lines: [
    t(150, 70, 13, "ISDIN", "#1d1d1b", 700, 2), t(150, 94, 9, "ISDINCEUTICS", "#8a7a5a", 700, 1),
    t(150, 136, 22, "K-Ox", "#1d1d1b"), t(150, 160, 18, "Eyes", "#1d1d1b", 400), t(150, 200, 10, "15 ml", "#555", 400)] }),
  lrp_anthelios_airlicium: tube({ body: "#ffffff", cap: "#f39200", lines: [
    t(150, 64, 9, "LA ROCHE-POSAY", LRP, 700, 1), t(150, 96, 19, "ANTHELIOS", "#1d1d1b"), t(150, 118, 13, "AIRLICIUM+", "#f39200"),
    `<circle cx="150" cy="158" r="24" fill="#f39200"/>`, t(150, 154, 10, "FPS", "#fff"), t(150, 170, 16, "80", "#fff"),
    t(150, 204, 10, "gel-creme · 40 g", "#555", 400)] }),
  mantecorp_epidrat_calm_b5: tube({ body: "#ffffff", cap: "#6fb7a6", lines: [
    t(150, 64, 10, "MANTECORP", "#2f7f6f", 700, 2), t(150, 102, 22, "Epidrat", "#1d1d1b"), t(150, 128, 20, "Calm B5", "#2f7f6f"),
    `<rect x="110" y="142" width="80" height="2" fill="#6fb7a6"/>`, t(150, 166, 12, "balm", "#555", 400), t(150, 204, 10, "50 ml", "#555", 400)] }),
  mantecorp_zella: tube({ body: "#ffffff", cap: "#1d1d1b", lines: [
    t(150, 64, 10, "MANTECORP", "#1d1d1b", 700, 2), t(150, 110, 32, "Zella", "#c2185b"), t(150, 138, 12, "ácido azelaico", "#555", 400),
    t(150, 160, 14, "150 mg/g", "#1d1d1b"), t(150, 204, 10, "gel · 30 g", "#555", 400)] }),
  eucerin_epigenetic: dropper({ glass: "#1f3b73", cap: "#e9eef6", label: "#1f3b73", lines: [
    t(150, 146, 15, "Eucerin", "#ffffff", 700), `<rect x="116" y="156" width="68" height="1.5" fill="#9fb4d8"/>`,
    t(150, 186, 14, "EPIGENETIC", "#ffffff"), t(150, 206, 12, "sérum", "#cfdaee", 400), t(150, 250, 10, "30 ml", "#cfdaee", 400)] }),
};
for (const [k, s] of Object.entries(P)) fs.writeFileSync(new URL(`./${k}.svg`, import.meta.url), s);
