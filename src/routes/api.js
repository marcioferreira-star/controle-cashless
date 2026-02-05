// src/routes/api.js
import express from "express";
import {
  getMaquinasIndex,
  getMaquinas,
  registrarMovimento,
  atualizarMaquinaPorSerial
} from "../db.js";

import { getSheetData, appendToSheet } from "../sheet.js";

const router = express.Router();

/* ======================================================
   Utils
====================================================== */
function hojeBR(date = new Date()) {
  const d = new Date(date);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function getUser(req) {
  return req.session?.user?.nome || "Sistema";
}

function parseSeriaisPayload(seriais) {
  // aceita:
  // - ["SERIAL1", "SERIAL2"]
  // - [{ serial: "X" }, { serial: "Y" }]
  if (!Array.isArray(seriais)) return [];
  return seriais
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") return String(item.serial || "").trim();
      return "";
    })
    .filter((s) => s);
}

function normalizarAcao(acao) {
  const a = String(acao || "").trim();

  // compat com telas antigas ("Envio SP", "Retorno RJ", "Envio Fixo")
  if (/envio/i.test(a) && /fixo/i.test(a)) return "ENVIO_FIXO";
  if (/envio/i.test(a)) return "ENVIO";
  if (/retorno/i.test(a)) return "RETORNO";

  // novo padrão
  const up = a.toUpperCase();
  if (["ENVIO", "ENVIO_FIXO", "RETORNO", "MANUTENCAO", "AJUSTE_STATUS"].includes(up)) return up;

  return up || "MOV";
}

function localFromAcao(acao) {
  const a = String(acao || "").toUpperCase();
  if (a.includes("SP")) return "SP";
  if (a.includes("RJ")) return "RJ";
  if (a.includes("URA")) return "URA";
  return "-";
}

/* ======================================================
   ✅ GET /api/test-nova-planilha
====================================================== */
router.get("/test-nova-planilha", async (req, res) => {
  try {
    const maquinas = await getSheetData("MAQUINAS!A1:J");

    const okWrite = await appendToSheet("HISTORICO!A:I", [
      hojeBR(),
      "TESTE-SERIAL",
      "TESTE",
      "Evento Teste",
      "Local Teste",
      "-",
      "-",
      getUser(req),
      "teste de escrita no histórico"
    ]);

    return res.json({
      ok: true,
      maquinas_lidas: maquinas.length,
      escrita_historico: okWrite
    });
  } catch (err) {
    console.error("❌ ERRO /api/test-nova-planilha:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/* ======================================================
   GET /api/maquinas
====================================================== */
router.get("/maquinas", async (req, res) => {
  try {
    const maquinas = await getMaquinas({ force: true });
    return res.json({ ok: true, maquinas });
  } catch (err) {
    console.error("❌ ERRO /api/maquinas:", err);
    return res.json({ ok: false, msg: "Erro ao carregar máquinas." });
  }
});

/* ======================================================
   POST /api/registrar-envio
   Novo modelo:
   - ENVIO / ENVIO_FIXO / RETORNO / MANUTENCAO
   - Atualiza MAQUINAS + registra HISTORICO
====================================================== */
router.post("/registrar-envio", async (req, res) => {
  try {
    const { acao, evento, local, observacoes, seriais } = req.body;

    const acaoNorm = normalizarAcao(acao);
    if (!acaoNorm) return res.json({ ok: false, msg: "Selecione a ação." });

    const listaSeriais = parseSeriaisPayload(seriais);
    if (listaSeriais.length === 0) {
      return res.json({ ok: false, msg: "Nenhuma máquina selecionada." });
    }

    const usuario = getUser(req);
    const idx = await getMaquinasIndex({ force: true });

    const erros = [];
    const histRows = [];

    for (const serial of listaSeriais) {
      const m = idx.get(serial);

      if (!m) {
        erros.push({ serial, step: "not-found" });
        continue;
      }

      const statusAnterior = m.status || "-";
      let statusNovo = statusAnterior;

      // ======== REGRA DE STATUS =========
      if (acaoNorm === "ENVIO") statusNovo = "Em Uso";
      else if (acaoNorm === "ENVIO_FIXO") statusNovo = "Fixo";
      else if (acaoNorm === "RETORNO") statusNovo = "Estoque";
      else if (acaoNorm === "MANUTENCAO") statusNovo = "Manutenção";

      // ======== PATCH NA MAQUINAS =========
      const patch = { status: statusNovo };

      if (acaoNorm === "RETORNO") {
        // ✅ no retorno: EVENTO limpa; LOCAL vira o estoque/local selecionado
        patch.evento = "-";
        patch.local = (local && String(local).trim())
          ? String(local).trim()
          : localFromAcao(acao); // tenta inferir se vier "Retorno SP" etc
      } else {
        // envio/manut: define evento/local se vierem
        if (evento !== undefined) patch.evento = evento || "-";
        if (local !== undefined) patch.local = local || "-";
      }

      if (observacoes !== undefined) patch.observacoes = observacoes || "-";

      const up = await atualizarMaquinaPorSerial(serial, patch);
      if (!up.ok) {
        erros.push({ serial, step: "update-maquinas", msg: up.msg || "Falha" });
        continue;
      }

      // ======== HISTORICO (A:I) =========
      histRows.push([
        hojeBR(),               // Data
        serial,                 // Serial
        acaoNorm,               // Ação
        (acaoNorm === "RETORNO") ? "-" : (evento || m.evento || "-"), // Evento
        (acaoNorm === "RETORNO") ? (patch.local || "-") : (local || m.local || "-"), // Local
        statusAnterior || "-",  // Status anterior
        statusNovo || "-",      // Status novo
        usuario,                // Usuário
        observacoes || "-"      // Observações
      ]);
    }

    if (histRows.length > 0) {
      const okHist = await registrarMovimento(histRows);
      if (!okHist) erros.push({ step: "historico-append" });
    }

    if (erros.length > 0) {
      return res.json({
        ok: false,
        msg: "Alguns itens não foram processados.",
        erros
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ ERRO /api/registrar-envio:", err);
    return res.json({ ok: false, msg: "Erro interno no servidor." });
  }
});

/* ======================================================
   POST /api/atualizar-status
   Atualiza só o status e registra histórico
====================================================== */
router.post("/atualizar-status", async (req, res) => {
  try {
    const { serial, status, evento, local, observacoes } = req.body;

    if (!serial?.trim()) return res.json({ ok: false, msg: "Serial obrigatório." });
    if (!status?.trim()) return res.json({ ok: false, msg: "Status obrigatório." });

    const idx = await getMaquinasIndex({ force: true });
    const m = idx.get(String(serial).trim());
    if (!m) return res.json({ ok: false, msg: "Serial não encontrado." });

    const usuario = getUser(req);
    const statusAnterior = m.status || "-";
    const statusNovo = String(status).trim();

    // Atualiza MAQUINAS (opcionalmente evento/local/obs)
    const patch = {
      status: statusNovo,
      ...(evento !== undefined ? { evento: evento || "-" } : {}),
      ...(local !== undefined ? { local: local || "-" } : {}),
      ...(observacoes !== undefined ? { observacoes: observacoes || "-" } : {})
    };

    const up = await atualizarMaquinaPorSerial(String(serial).trim(), patch);
    if (!up.ok) return res.json({ ok: false, msg: up.msg || "Falha ao atualizar." });

    // Histórico
    const okHist = await registrarMovimento([
      hojeBR(),
      String(serial).trim(),
      "AJUSTE_STATUS",
      (evento !== undefined ? (evento || "-") : (m.evento || "-")),
      (local !== undefined ? (local || "-") : (m.local || "-")),
      statusAnterior,
      statusNovo,
      usuario,
      observacoes || "-"
    ]);

    if (!okHist) return res.json({ ok: false, msg: "Atualizou, mas falhou ao registrar histórico." });

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ ERRO /api/atualizar-status:", err);
    return res.json({ ok: false, msg: "Erro interno no servidor." });
  }
});

export default router;
