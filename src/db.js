// src/db.js
import { getSheetData, appendToSheet, batchUpdateValues } from "./sheet.js";

/* =========================================================
   CONFIGURAÇÃO DAS ABAS
========================================================= */
const MAQUINAS_SHEET = "MAQUINAS";
const HISTORICO_SHEET = "HISTORICO";

/* =========================================================
   DATA (BR) - dd/mm/aaaa
========================================================= */
function hojeBR(date = new Date()) {
  const d = new Date(date);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function normalizarDataBR(valor) {
  if (!valor || valor === "-") return "-";
  const s = String(valor).trim();

  // já está BR
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  // ISO / parseável
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return hojeBR(dt);

  return s; // fallback
}

/* =========================================================
   CACHE (performance)
========================================================= */
const CACHE = {
  maquinas: { ts: 0, data: [] },
  index: { ts: 0, map: new Map() },
  ttlMs: 15_000
};

function now() {
  return Date.now();
}

function isFresh(ts) {
  return ts && now() - ts < CACHE.ttlMs;
}

/* =========================================================
   LER MAQUINAS (A:K)
   A Serial | B Codigo ID | C Modelo | D Patrimônio | E Status
   F Local | G Evento | H Tipo | I Observações | J Criado em | K Atualizado em
========================================================= */
export async function getMaquinas(options = {}) {
  const force = typeof options === "boolean" ? options : !!options.force;

  if (!force && isFresh(CACHE.maquinas.ts)) {
    return CACHE.maquinas.data;
  }

  const rows = await getSheetData(`'${MAQUINAS_SHEET}'!A2:K`);

  const maquinas = (rows || []).map((r, i) => ({
  linha: i + 2,
  serial: r[0] || "-",
  codigoId: r[1] || "-", 
  modelo: r[2] || "-",
  patrimonio: r[3] || "-",
  status: r[4] || "-",
  local: r[5] || "-",
  evento: r[6] || "-",
  tipo: r[7] || "-",
  observacoes: r[8] || "-",
  criadoEm: normalizarDataBR(r[9] || "-"),
  atualizadoEm: normalizarDataBR(r[10] || "-")
  }));

  CACHE.maquinas = { ts: now(), data: maquinas };
  CACHE.index = { ts: 0, map: new Map() }; // invalida index

  return maquinas;
}

/* =========================================================
   INDEX POR SERIAL
========================================================= */
export async function getMaquinasIndex(options = {}) {
  const force = typeof options === "boolean" ? options : !!options.force;

  if (!force && isFresh(CACHE.index.ts)) {
    return CACHE.index.map;
  }

  const maquinas = await getMaquinas({ force });
  const map = new Map();

  maquinas.forEach((m) => {
    const serial = String(m.serial || "").trim();
    if (serial && serial !== "-") map.set(serial, m);
  });

  CACHE.index = { ts: now(), map };
  return map;
}

/* =========================================================
   ATUALIZAR MAQUINA (patch)
   - aceita chaves: status, local, evento, tipo, observacoes
   - compat: localAtual/eventoAtual
   - sempre atualiza coluna J "Atualizado em" (BR)
========================================================= */
export async function atualizarMaquina(serial, patch = {}) {
  const idx = await getMaquinasIndex({ force: true });
  const m = idx.get(String(serial).trim());

  if (!m) return { ok: false, msg: "Serial não encontrado." };

  // compat aliases
  if (patch.localAtual !== undefined && patch.local === undefined) patch.local = patch.localAtual;
  if (patch.eventoAtual !== undefined && patch.evento === undefined) patch.evento = patch.eventoAtual;

  const batch = [];

if (patch.status !== undefined)
  batch.push({ range: `'${MAQUINAS_SHEET}'!E${m.linha}`, value: patch.status || "-" });

if (patch.local !== undefined)
  batch.push({ range: `'${MAQUINAS_SHEET}'!F${m.linha}`, value: patch.local || "-" });

if (patch.evento !== undefined)
  batch.push({ range: `'${MAQUINAS_SHEET}'!G${m.linha}`, value: patch.evento || "-" });

if (patch.tipo !== undefined)
  batch.push({ range: `'${MAQUINAS_SHEET}'!H${m.linha}`, value: patch.tipo || "-" });

if (patch.observacoes !== undefined)
  batch.push({ range: `'${MAQUINAS_SHEET}'!I${m.linha}`, value: patch.observacoes || "-" });

// ✅ sempre atualiza a data em BR
batch.push({ range: `'${MAQUINAS_SHEET}'!K${m.linha}`, value: hojeBR() });

  const ok = await batchUpdateValues(batch);
  if (!ok) return { ok: false, msg: "Falha ao atualizar a planilha." };

  // invalida cache
  CACHE.maquinas.ts = 0;
  CACHE.index.ts = 0;

  return { ok: true };
}

// compat: nome usado no api.js
export async function atualizarMaquinaPorSerial(serial, patch = {}) {
  return await atualizarMaquina(serial, patch);
}

/* =========================================================
   REGISTRAR HISTÓRICO (A:I)
   A Data | B Serial | C Ação | D Evento | E Local
   F Status Anterior | G Status Novo | H Usuário | I Observações
========================================================= */
export async function registrarHistorico({
  serial,
  acao,
  evento,
  local,
  statusAnterior,
  statusNovo,
  usuario,
  observacoes
}) {
  const row = [
    hojeBR(),
    serial,
    acao || "-",
    evento || "-",
    local || "-",
    statusAnterior || "-",
    statusNovo || "-",
    usuario || "Sistema",
    observacoes || "-"
  ];

  return await appendToSheet(`'${HISTORICO_SHEET}'!A:I`, row);
}

/* =========================================================
   COMPAT: registrarMovimento (aceita 1 linha ou várias)
   - se já vier no formato A:I, apenas garante data BR
========================================================= */
export async function registrarMovimento(linhas) {
  const rows = Array.isArray(linhas?.[0]) ? linhas : [linhas];

  // já no formato novo A:I
  if (rows[0]?.length === 9) {
    const fixed = rows.map((r) => {
      const out = [...r];
      out[0] = normalizarDataBR(out[0] || hojeBR());
      return out;
    });

    return await appendToSheet(`'${HISTORICO_SHEET}'!A:I`, fixed);
  }

  // formato antigo → adapta mínimo
  const adapted = rows.map((r) => ([
    hojeBR(),
    r[0] || "-",
    r[2] || "MOV",
    r[3] || r[1] || "-",
    r[4] || "-",
    r[5] || "-",
    r[6] || "-",
    r[7] || "Sistema",
    r[8] || "-"
  ]));

  return await appendToSheet(`'${HISTORICO_SHEET}'!A:I`, adapted);
}

/* =========================================================
   LER HISTÓRICO
========================================================= */
export async function getHistorico() {
  const rows = await getSheetData(`'${HISTORICO_SHEET}'!A2:I`);

  return (rows || []).map((r) => ({
    data: normalizarDataBR(r[0]),
    serial: r[1] || "-",
    acao: r[2] || "-",
    evento: r[3] || "-",
    local: r[4] || "-",
    statusAnterior: r[5] || "-",
    statusNovo: r[6] || "-",
    usuario: r[7] || "-",
    observacoes: r[8] || "-"
  }));
}

/* =========================================================
   RESUMO (compat index.ejs antigo)
========================================================= */
export async function getResumo() {
  const maquinas = await getMaquinas();

  const total = maquinas.length;

  const disponiveis = maquinas.filter((m) =>
    String(m.status).toUpperCase().includes("ESTOQUE")
  ).length;

  const emUso = maquinas.filter((m) =>
    String(m.status).toUpperCase().includes("EM USO")
  ).length;

  const fixas = maquinas.filter((m) =>
    String(m.status).toUpperCase().trim() === "FIXO"
  ).length;

  return {
    total,
    disponiveis,
    disponiveisSP: 0,
    disponiveisRJ: 0,
    disponiveisURA: 0,
    emUso,
    fixas,
    atrasadas: 0
  };
}
