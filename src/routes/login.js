// src/routes/login.js
import express from "express";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

/* ============================================================
   RESOLVER CAMINHO ABSOLUTO DO users.json
============================================================ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Arquivo real onde ficam os usuários
const usersFile = path.join(__dirname, "../auth/users.json");

/* ============================================================
   CARREGAR USUÁRIOS
============================================================ */
function loadUsers() {
  try {
    if (!fs.existsSync(usersFile)) return [];
    const raw = fs.readFileSync(usersFile, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("❌ Erro lendo users.json:", err);
    return [];
  }
}

/* ============================================================
   GET /login
============================================================ */
router.get("/login", (req, res) => {
  res.render("login", { page: "login", erro: null });
});

/* ============================================================
   POST /login
============================================================ */
router.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  const users = loadUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.render("login", {
      page: "login",
      erro: "Usuário não encontrado."
    });
  }

  const ok = await bcrypt.compare(senha, user.senha); // Campo certo no JSON

  if (!ok) {
    return res.render("login", {
      page: "login",
      erro: "Senha incorreta."
    });
  }

  // Sessão salva — acessível em qualquer EJS via res.locals.user
  req.session.user = {
    nome: user.nome,
    email: user.email
  };

  return res.redirect("/");
});

/* ============================================================
   LOGOUT
============================================================ */
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

export default router;
