// src/routes/envio.js
import express from "express";
import { getMaquinas } from "../db.js";

const router = express.Router();

/* ============================================================
   GET – Página Envio / Retorno
============================================================ */
router.get("/", async (req, res) => {
  try {
    // ✅ força ler do Google Sheets (ignora cache)
    const maquinas = await getMaquinas({ force: true });

    const listaSegura = Array.isArray(maquinas) ? maquinas : [];

    console.log(`🔵 /envio → Máquinas carregadas: ${listaSegura.length}`);

    res.render("envio", {
      page: "envio",
      maquinas: listaSegura
    });

  } catch (err) {
    console.error("❌ Erro ao carregar máquinas na rota /envio:");
    console.error(err.stack || err);

    res.render("envio", {
      page: "envio",
      maquinas: []
    });
  }
});

export default router;
