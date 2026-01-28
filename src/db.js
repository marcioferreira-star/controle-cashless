// db.js
import {
  getSheetData,
  appendToSheet,
  updateSheetCell,          // rápido (mantido para compat)
  batchUpdateValues         // ✅ novo: batch de updates
} from "./sheet.js";

const SHEET_NAME = "CONTROLE MAQUININHAS PAGSEGURO - INGRESSE";
const HISTORICO_SHEET = "HISTORICO MAQUINAS";
const EVENTOS_SHEET = "DADOS EVENTOS";

/* ============================================================
   🔵 CARREGAR LISTA DE MÁQUINAS (A → O)
============================================================ */
export async function getMaquinas() {
  try {
    const range = `'${SHEET_NAME}'!A2:O2000`;
    const dados = await getSheetData(range);

    if (!dados || dados.length === 0) return [];

    return dados.map((linha, i) => ({
      linha: i + 2,
      modelo: linha[1] || "-",
      serial: linha[2] || "-",
      status: linha[6] || "-",
      empresa: linha[8] || "-",
      idEvento: linha[9] || "-",
      nomeEvento: linha[10] || "-",
      produtora: linha[11] || "-",
      comercial: linha[12] || "-",
      dataSaida: linha[13] || "-",
      dataRetorno: linha[14] || "-"
    }));

  } catch (err) {
    console.error("❌ Erro ao carregar máquinas:", err);
    return [];
  }
}

/* ============================================================
   🔵 NOVO: MAPA serial → { linha, ... } (para evitar re-leituras)
============================================================ */
export async function getMaquinasIndex() {
  const arr = await getMaquinas();
  const map = new Map();
  for (const m of arr) {
    if (m.serial && m.serial !== "-") {
      map.set(String(m.serial).trim(), m);
    }
  }
  return map;
}

/* ============================================================
   🔵 RESUMO DASHBOARD
============================================================ */
export async function getResumo() {
  try {
    const maquinas = await getMaquinas();
    const hoje = new Date();

    const total = maquinas.length;

    const disponiveis = maquinas.filter(m =>
      (m.status || "").toLowerCase().includes("estoque")
    ).length;

    // Fixo conta como em uso (já está assim no seu código)
    const emUso = maquinas.filter(m => {
      const st = (m.status || "").toLowerCase().trim();
      return st.includes("em uso") || st === "fixo";
    }).length;

    // ✅ NOVO: fixas
    const fixas = maquinas.filter(m =>
      (m.status || "").toLowerCase().trim() === "fixo"
    ).length;

    // atrasadas só pra "Em Uso" (fixo não tem retorno)
    const atrasadas = maquinas.filter(m => {
      if (!m.dataRetorno || m.dataRetorno.length < 8) return false;
      if ((m.status || "").toLowerCase().trim() === "fixo") return false;

      const [d, mth, y] = m.dataRetorno.split("/");
      const dataRet = new Date(`${y}-${mth}-${d}`);

      return (m.status || "").toLowerCase().includes("em uso") && dataRet < hoje;
    }).length;

    // ✅ AGORA retorna fixas também
    return { total, disponiveis, emUso, fixas, atrasadas };

  } catch (err) {
    console.error("❌ Erro resumo:", err);
    return { total: 0, disponiveis: 0, emUso: 0, fixas: 0, atrasadas: 0 };
  }
}


/* ============================================================
   🔵 CONTAGEM POR STATUS
============================================================ */
export async function getStatusCount() {
  try {
    const maquinas = await getMaquinas();
    const mapa = {};

    maquinas.forEach(m => {
      const st = (m.status || "-").trim();
      mapa[st] = (mapa[st] || 0) + 1;
    });

    return mapa;

  } catch (err) {
    console.error("❌ Erro getStatusCount:", err);
    return null;
  }
}

/* ============================================================
   🔵 DISTRIBUIÇÃO POR EMPRESA
============================================================ */
export async function getEmpresaCount() {
  try {
    const maquinas = await getMaquinas();
    const mapa = {};

    maquinas.forEach(m => {
      const emp = m.empresa || "-";
      mapa[emp] = (mapa[emp] || 0) + 1;
    });

    return Object.keys(mapa).map(k => ({ nome: k, qtd: mapa[k] }));

  } catch (err) {
    console.error("❌ Erro getEmpresaCount:", err);
    return [];
  }
}

/* ============================================================
   🔵 LOCALIDADE
============================================================ */
export async function getLocalCount() {
  try {
    const maquinas = await getMaquinas();
    const mapa = {};

    maquinas.forEach(m => {
      const st = (m.status || "").toUpperCase();
      let local = "-";

      if (st.includes("SP")) local = "SP";
      else if (st.includes("RJ")) local = "RJ";
      else if (st.includes("URA")) local = "URA";

      mapa[local] = (mapa[local] || 0) + 1;
    });

    return Object.keys(mapa).map(k => ({ nome: k, qtd: mapa[k] }));

  } catch (err) {
    console.error("❌ Erro getLocalCount:", err);
    return [];
  }
}

/* ============================================================
   🔵 ENVIO x RETORNO – últimos 30 dias
============================================================ */
export async function getEnviosRetornos30Dias() {
  try {
    const hist = await getHistorico();
    if (!hist || hist.length === 0) return null;

    const hoje = new Date();
    const dias = {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() - i);
      const key = d.toLocaleDateString("pt-BR");
      dias[key] = { envios: 0, retornos: 0 };
    }

    hist.forEach(r => {
      if (r.saida && dias[r.saida]) dias[r.saida].envios++;
      if (r.retorno && dias[r.retorno]) dias[r.retorno].retornos++;
    });

    return {
      labels: Object.keys(dias),
      envios: Object.values(dias).map(d => d.envios),
      retornos: Object.values(dias).map(d => d.retornos)
    };

  } catch (err) {
    console.error("❌ Erro getEnviosRetornos30Dias:", err);
    return null;
  }
}

/* ============================================================
   🔵 TOP EVENTOS
============================================================ */
export async function getTopEventos() {
  try {
    const maquinas = await getMaquinas();
    const mapa = {};

    maquinas.forEach(m => {
      if (!m.idEvento || m.idEvento === "-") return;
      mapa[m.idEvento] = (mapa[m.idEvento] || 0) + 1;
    });

    return Object.keys(mapa).map(id => ({
      id,
      nome: maquinas.find(x => x.idEvento == id)?.nomeEvento || "-",
      qtd: mapa[id]
    })).sort((a, b) => b.qtd - a.qtd);

  } catch (err) {
    console.error("❌ Erro getTopEventos:", err);
    return [];
  }
}

/* ============================================================
   🔵 BUSCAR DADOS DO EVENTO
============================================================ */
export async function getEventoInfo(idEvento) {
  try {
    const linhas = await getSheetData(`'${EVENTOS_SHEET}'!A2:D`);
    const alvo = String(idEvento).trim();

    const row = linhas.find(r => String(r[0]).trim() === alvo);

    if (!row) return null;

    return {
      id_evento: row[0],
      nome_evento: row[1] || "-",
      produtora: row[2] || "-",
      comercial: row[3] || "-"
    };

  } catch (err) {
    console.error("❌ Erro ao buscar dados do evento:", err);
    return null;
  }
}

/* ============================================================
   🔵 (LEGADO) ATUALIZAÇÕES unitárias rápidas
   (mantidas para compatibilidade se precisar)
============================================================ */
export async function atualizarDadosEvento(serial, eventoInfo) {
  const idx = await getMaquinasIndex();
  const m = idx.get(String(serial).trim());
  if (!m) return false;

  const ups = [
    { range: `'${SHEET_NAME}'!J${m.linha}`, value: eventoInfo.id_evento },
    { range: `'${SHEET_NAME}'!K${m.linha}`, value: eventoInfo.nome_evento },
    { range: `'${SHEET_NAME}'!L${m.linha}`, value: eventoInfo.produtora },
    { range: `'${SHEET_NAME}'!M${m.linha}`, value: eventoInfo.comercial }
  ];
  return await batchUpdateValues(ups);
}

export async function atualizarStatus(serial, novoStatus, dataRetorno = "-") {
  const idx = await getMaquinasIndex();
  const m = idx.get(String(serial).trim());
  if (!m) return false;

  const ups = [
    { range: `'${SHEET_NAME}'!G${m.linha}`, value: novoStatus },
    { range: `'${SHEET_NAME}'!O${m.linha}`, value: dataRetorno }
  ];
  return await batchUpdateValues(ups);
}

export async function atualizarDataSaida(serial, dataSaida) {
  const idx = await getMaquinasIndex();
  const m = idx.get(String(serial).trim());
  if (!m) return false;

  return await batchUpdateValues([
    { range: `'${SHEET_NAME}'!N${m.linha}`, value: dataSaida }
  ]);
}

/* ============================================================
   🔵 REGISTRAR MOVIMENTO (HISTÓRICO)
   - Aceita 1 linha (array simples) ou várias (array de arrays)
============================================================ */
export async function registrarMovimento(info) {
  try {
    // compat anterior (1 linha só)
    if (!Array.isArray(info)) {
      if (!info.serial) return false;
      const row = [
        info.serial,
        info.id_evento,
        info.acao,
        info.data_saida || "-",
        info.data_retorno || "-",
        info.statusFinal || "-",
        info.usuario || "Sistema",
        info.nome_evento || "-",
        info.produtora || "-",
        info.comercial || "-",
        info.observacao || "-"
      ];
      return await appendToSheet(`'${HISTORICO_SHEET}'!A:K`, row);
    }

    // novo: várias linhas de uma vez (já no formato A..K)
    return await appendToSheet(`'${HISTORICO_SHEET}'!A:K`, info);

  } catch (err) {
    console.error("❌ registrarMovimento erro:", err);
    return false;
  }
}

/* ============================================================
   🔵 HISTÓRICO COMPLETO
============================================================ */
export async function getHistorico() {
  try {
    const dados = await getSheetData(`'${HISTORICO_SHEET}'!A2:K20000`);
    if (!dados || dados.length === 0) return [];

    return dados.map(l => ({
      serial: l[0] || "-",
      evento: l[1] || "-",
      acao: l[2] || "-",
      saida: l[3] || "-",
      retorno: l[4] || "-",
      status: l[5] || "-",
      usuario: l[6] || "-",
      nome_evento: l[7] || "-",
      produtora: l[8] || "-",
      comercial: l[9] || "-",
      obs: l[10] || "-"
    }))
    .reverse();;

  } catch (err) {
    console.error("❌ Erro getHistorico:", err);
    return [];
  }
}
