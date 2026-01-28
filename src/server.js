import "dotenv/config";

// src/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";

// Rotas
import loginRoutes from "./routes/login.js";
import indexRoutes from "./routes/index.js";
import maquinasRoutes from "./routes/maquinas.js";
import envioRoutes from "./routes/envio.js";
import apiRoutes from "./routes/api.js";
import historicoRoutes from "./routes/historico.js";

// Middleware de autenticação
import { requireLogin } from "./auth/authMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ============================================================
   MIDDLEWARES BÁSICOS
============================================================ */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ============================================================
   SESSÃO (SEGURA PARA PRODUÇÃO)
============================================================ */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "super-secret-ingresse",
    resave: false,
    saveUninitialized: false,
  })
);

/* ============================================================
   USER GLOBAL PARA TODAS AS VIEWS
============================================================ */
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

/* ============================================================
   ARQUIVOS ESTÁTICOS
============================================================ */
app.use(express.static(path.join(__dirname, "public")));

/* ============================================================
   VIEW ENGINE
============================================================ */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

/* ============================================================
   ROTAS PÚBLICAS (LOGIN)
============================================================ */
app.use("/", loginRoutes);

/* ============================================================
   ROTAS PRIVADAS (EXIGEM LOGIN)
============================================================ */
app.use("/", requireLogin, indexRoutes);
app.use("/maquinas", requireLogin, maquinasRoutes);
app.use("/envio", requireLogin, envioRoutes);
app.use("/historico", requireLogin, historicoRoutes);
app.use("/api", requireLogin, apiRoutes);

/* ============================================================
   INICIAR SERVIDOR (LOCAL + PRODUÇÃO)
============================================================ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
