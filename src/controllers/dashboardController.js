// src/controllers/dashboardController.js
const maquinasData = require("../db"); // usa o que vem do db.js

exports.getDashboard = (req, res) => {
  const hoje = new Date();

  const total = maquinasData.length;

  const disponiveis = maquinasData.filter(m =>
    m.status && m.status.toLowerCase().includes("estoque")
  ).length;

  const emUso = maquinasData.filter(m =>
    m.status && m.status.toLowerCase().includes("em uso")
  ).length;

  const atrasadas = maquinasData.filter(m => {
    if (!m.status || !m.dataRetorno) return false;
    const dataRetorno = new Date(m.dataRetorno);
    return m.status.toLowerCase().includes("em uso") && dataRetorno < hoje;
  }).length;

  res.render("index", {
    page: "dashboard",
    total,
    disponiveis,
    emUso,
    atrasadas,
  });
};
