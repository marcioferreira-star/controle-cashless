// src/routes/api.js
import express from "express";
import {
  registrarMovimento,
  getEventoInfo,
  getHistorico,
  getMaquinasIndex
} from "../db.js";

import { batchUpdateValues } from "../sheet.js";

const router = express.Router();

const SHEET_NAME = "CONTROLE MAQUININHAS PAGSEGURO - INGRESSE";

/* ======================================================
   Utils
====================================================== */
function hojeBR() {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = String(hoje.getMonth() + 1).padStart(2, "0");
  const d = String(hoje.getDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
}

function toBR(dateStr) {
  if (!dateStr) return "-";
  const onlyDate = String(dateStr).slice(0, 10);
  const [y, m, d] = onlyDate.split("-");
  if (!y || !m || !d) return "-";
  return `${d}/${m}/${y}`;
}

function parseBRDateToTime(br) {
  if (!br || br === "-") return 0;
  const [d, m, y] = String(br).split("/");
  if (!d || !m || !y) return 0;
  return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
}

function getUltimoEnvio(registros) {
  const envios = (registros || []).filter(r =>
    String(r.acao || "").includes("Envio")
  );

  if (envios.length === 0) return null;

  let ultimo = envios[0];
  let maior = parseBRDateToTime(ultimo.saida);

  for (const r of envios) {
    const t = parseBRDateToTime(r.saida);
    if (t >= maior) {
      ultimo = r;
      maior = t;
    }
  }

  return ultimo;
}

function temOrigemControle(maquina) {
  const id = String(maquina?.idEvento || "").trim();
  return id && id !== "-" && id !== "0";
}

/* ======================================================
   POST /api/registrar-envio
====================================================== */
router.post("/registrar-envio", async (req, res) => {
  try {
    const {
      id_evento,
      acao,
      dt_saida,
      dt_retorno,
      obs,
      seriais,
      obs_origem
    } = req.body;

    if (!acao) return res.json({ ok: false, msg: "Selecione a ação." });

    if (!Array.isArray(seriais) || seriais.length === 0) {
      return res.json({ ok: false, msg: "Nenhuma máquina selecionada." });
    }

    const isEnvio = acao.includes("Envio");
    const isRetorno = acao.includes("Retorno");
    const isEnvioFixo = acao === "Envio Fixo";

    let eventoInfo = null;

    /* ============================
       FLUXO DE ENVIO
    ============================ */
    if (isEnvio) {
      if (!id_evento?.trim())
        return res.json({ ok: false, msg: "Informe o ID do evento." });

      if (!dt_saida)
        return res.json({ ok: false, msg: "Data de saída obrigatória." });

      if (!isEnvioFixo && !dt_retorno)
        return res.json({ ok: false, msg: "Data de retorno obrigatória." });

      eventoInfo = await getEventoInfo(id_evento);

      if (!eventoInfo) {
        return res.json({
          ok: false,
          msg: `O ID ${id_evento} não existe na aba DADOS EVENTOS.`
        });
      }
    }

    /* ============================
       CARREGAMENTOS ÚNICOS
    ============================ */
    const historicoCompleto = isRetorno ? await getHistorico() : [];
    const idxMaquinas = await getMaquinasIndex();

    const hoje = hojeBR();
    const autor = req.session.user?.nome || "Sistema";

    const valueUpdates = [];
    const historicoRows = [];
    const pendenciasPopup = [];
    const erros = [];

    /* ============================
       LOOP PRINCIPAL
       - aceita:
         seriais: [{serial, linha}]
         seriais: ["SERIAL"] (compat/popup/testes)
    ============================ */
    for (const item of seriais) {
      let serial = "";
      let linha = 0;

      if (typeof item === "string") {
        serial = String(item).trim();
      } else if (item && typeof item === "object") {
        serial = String(item.serial || "").trim();
        linha = Number(item.linha || 0);
      }

      if (!serial) {
        erros.push({ step: "invalid-serial", item });
        continue;
      }

      // Se não veio linha, usa o index
      const maquina = idxMaquinas.get(serial);

      if (!maquina) {
        erros.push({ serial, step: "not-found" });
        continue;
      }

      if (!linha) linha = Number(maquina.linha || 0);

      if (!linha) {
        erros.push({ serial, step: "no-line" });
        continue;
      }

      /* =========================================
           FLUXO DE RETORNO
      ========================================= */
      if (isRetorno) {
        const statusFinal = acao.replace("Retorno", "Estoque");

        let origem = null;

        if (temOrigemControle(maquina)) {
          origem = {
            evento: String(maquina.idEvento || "-"),
            nome_evento: String(maquina.nomeEvento || "-"),
            produtora: String(maquina.produtora || "-"),
            comercial: String(maquina.comercial || "-"),
            saida: String(maquina.dataSaida || "-")
          };
        } else {
          const registros = historicoCompleto.filter(
            h => String(h.serial || "").trim() === serial
          );
          const ultimoEnvio = getUltimoEnvio(registros);

          if (ultimoEnvio) {
            origem = {
              evento: ultimoEnvio.evento,
              nome_evento: ultimoEnvio.nome_evento,
              produtora: ultimoEnvio.produtora,
              comercial: ultimoEnvio.comercial,
              saida: ultimoEnvio.saida
            };
          }
        }

        // 1) retorno sem origem -> popup
        if (!origem && !obs_origem) {
          pendenciasPopup.push(serial);
          continue;
        }

        // 2) retorno órfão com origem manual
        if (!origem && obs_origem) {
          historicoRows.push([
            serial,
            "-",
            acao,
            "-",
            hoje,
            statusFinal,
            autor,
            "-",
            "-",
            "-",
            obs_origem
          ]);

          valueUpdates.push(
            { range: `'${SHEET_NAME}'!G${linha}`, value: statusFinal },
            { range: `'${SHEET_NAME}'!O${linha}`, value: hoje },
            { range: `'${SHEET_NAME}'!J${linha}`, value: "-" },
            { range: `'${SHEET_NAME}'!K${linha}`, value: "-" },
            { range: `'${SHEET_NAME}'!L${linha}`, value: "-" },
            { range: `'${SHEET_NAME}'!M${linha}`, value: "-" }
          );

          continue;
        }

        // 3) retorno normal
        historicoRows.push([
          serial,
          origem.evento,
          acao,
          origem.saida,
          hoje,
          statusFinal,
          autor,
          origem.nome_evento,
          origem.produtora,
          origem.comercial,
          obs || "-"
        ]);

        valueUpdates.push(
          { range: `'${SHEET_NAME}'!G${linha}`, value: statusFinal },
          { range: `'${SHEET_NAME}'!O${linha}`, value: hoje },
          { range: `'${SHEET_NAME}'!J${linha}`, value: origem.evento },
          { range: `'${SHEET_NAME}'!K${linha}`, value: origem.nome_evento },
          { range: `'${SHEET_NAME}'!L${linha}`, value: origem.produtora },
          { range: `'${SHEET_NAME}'!M${linha}`, value: origem.comercial }
        );

        continue;
      }

      /* =========================================
           FLUXO DE ENVIO (NORMAL / FIXO)
      ========================================= */
      const dataSaidaBR = toBR(dt_saida);
      const dataRetornoBR = isEnvioFixo ? "-" : toBR(dt_retorno);
      const statusFinal = isEnvioFixo ? "Fixo" : acao.replace("Envio", "Em Uso");

      historicoRows.push([
        serial,
        id_evento,
        acao,
        dataSaidaBR,
        dataRetornoBR,
        statusFinal,
        autor,
        eventoInfo.nome_evento,
        eventoInfo.produtora,
        eventoInfo.comercial,
        obs || "-"
      ]);

      valueUpdates.push(
        { range: `'${SHEET_NAME}'!G${linha}`, value: statusFinal },
        { range: `'${SHEET_NAME}'!O${linha}`, value: dataRetornoBR },
        { range: `'${SHEET_NAME}'!N${linha}`, value: dataSaidaBR },
        { range: `'${SHEET_NAME}'!J${linha}`, value: eventoInfo.id_evento },
        { range: `'${SHEET_NAME}'!K${linha}`, value: eventoInfo.nome_evento },
        { range: `'${SHEET_NAME}'!L${linha}`, value: eventoInfo.produtora },
        { range: `'${SHEET_NAME}'!M${linha}`, value: eventoInfo.comercial }
      );
    }

    /* ======================================================
       POPUP
    ======================================================= */
    if (pendenciasPopup.length > 0) {
      return res.json({
        ok: false,
        needsPopup: true,
        seriais: pendenciasPopup,
        msg: "Alguns seriais não possuem histórico de envio."
      });
    }

    /* ======================================================
       SALVAR HISTÓRICO
    ======================================================= */
    if (historicoRows.length > 0) {
      const okHist = await registrarMovimento(historicoRows);
      if (!okHist) erros.push({ step: "historico-append" });
    }

    /* ======================================================
       BATCH UPDATE
    ======================================================= */
    if (valueUpdates.length > 0) {
      const okBatch = await batchUpdateValues(valueUpdates);
      if (!okBatch) erros.push({ step: "values-batch-update" });
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
====================================================== */
router.post("/atualizar-status", async (req, res) => {
  try {
    const { serial, status } = req.body;

    if (!serial?.trim()) return res.json({ ok: false, msg: "Serial obrigatório." });
    if (!status?.trim()) return res.json({ ok: false, msg: "Status obrigatório." });

    const idx = await getMaquinasIndex();
    const m = idx.get(String(serial).trim());

    if (!m) return res.json({ ok: false, msg: "Serial não encontrado." });

    const updates = [];
    updates.push({ range: `'${SHEET_NAME}'!G${m.linha}`, value: status });

    if (status === "Fixo") {
      updates.push({ range: `'${SHEET_NAME}'!O${m.linha}`, value: "-" });
    }

    if (status.startsWith("Estoque")) {
      updates.push(
        { range: `'${SHEET_NAME}'!J${m.linha}`, value: "-" },
        { range: `'${SHEET_NAME}'!K${m.linha}`, value: "-" },
        { range: `'${SHEET_NAME}'!L${m.linha}`, value: "-" },
        { range: `'${SHEET_NAME}'!M${m.linha}`, value: "-" },
        { range: `'${SHEET_NAME}'!O${m.linha}`, value: "-" }
      );
    }

    const ok = await batchUpdateValues(updates);
    if (!ok) return res.json({ ok: false, msg: "Falha ao atualizar." });

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ ERRO /api/atualizar-status:", err);
    return res.json({ ok: false, msg: "Erro interno no servidor." });
  }
});

/* ======================================================
   GET /api/maquinas
====================================================== */
router.get("/maquinas", async (req, res) => {
  try {
    const idx = await getMaquinasIndex();
    const maquinas = Array.from(idx.values());
    return res.json({ ok: true, maquinas });
  } catch (err) {
    console.error("❌ ERRO /api/maquinas:", err);
    return res.json({ ok: false, msg: "Erro ao carregar máquinas." });
  }
});

export default router;
