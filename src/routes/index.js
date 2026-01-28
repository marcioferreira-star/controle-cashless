// src/routes/index.js
import express from "express";
import { getMaquinas, getResumo } from "../db.js";

const router = express.Router();

/* ============================================================
   GET – Dashboard (Home)
============================================================ */
router.get("/", async (req, res) => {
  const inicio = Date.now();

  try {
    const maquinas = await getMaquinas();
    const resumo = await getResumo();

    console.log(
      `📊 /dashboard carregado: ${maquinas.length} máquinas (em ${Date.now() - inicio}ms)`
    );

    // Variáveis adicionais (para futuro: gráficos, alertas etc.)
    const porStatus = null;
    const porEmpresa = null;
    const porLocal = null;
    const enviosSeries = null;
    const topEventos = [];
    const alerts = [];

    res.render("index", {
      page: "dashboard",
      maquinas,
      resumo,

      // Segurança: o EJS sempre recebe as variáveis
      porStatus,
      porEmpresa,
      porLocal,
      enviosSeries,
      topEventos,
      alerts
    });

  } catch (error) {
    console.error("❌ Erro ao carregar dashboard:", error);

    res.render("index", {
      page: "dashboard",
      maquinas: [],

      resumo: {
        total: 0,
        disponiveis: 0,
        emUso: 0,
        atrasadas: 0
      },

      // Fallback seguro
      porStatus: null,
      porEmpresa: null,
      porLocal: null,
      enviosSeries: null,
      topEventos: [],
      alerts: []
    });
  }
});

export default router;
