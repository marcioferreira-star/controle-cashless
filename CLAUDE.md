# controle-cashless

Sistema web de controle de maquininhas **cashless** da Ingresse: envio, retorno e status
de equipamentos para eventos. Irmão do **maquininhas-node** (que cuida das PagSeguro);
mesma arquitetura, planilha/abas e credenciais Google **diferentes**.

## Stack
- Node.js + Express + EJS (ESM — `"type": "module"`, use `import`, **nunca `require`**)
- Google Sheets como banco (service account, credenciais em **variáveis separadas** — ver abaixo)
- Sessão via **`cookie-session`** (cookie assinado, sem store em memória); usuários em `src/auth/users.json` (bcrypt)
- Deploy: **Vercel** (serverless, auto-deploy no push à `main`) — `https://controle-cashless.vercel.app`.
  Migrado do Render em 14/06/2026. Roda LOCAL via `npm start` (server.js → app.js).

## Estrutura
- `src/app.js` — configuração do Express (middlewares, sessão, rotas) — **exporta o `app`**
- `src/server.js` — entrypoint LOCAL (importa `app.js` e dá `listen`)
- `api/index.js` — handler serverless da Vercel (reusa o `app`)
- `vercel.json` — roteia tudo para a função + `includeFiles: src/**` (views EJS / estáticos)
- `src/db.js` — camada de dados + cache (TTL 15s) sobre as abas MAQUINAS/HISTORICO
- `src/sheet.js` — wrapper Google Sheets v4 (read/update/append/batch). Monta credenciais via `getCredentials()`
- `src/routes/` — login, index (dashboard), maquinas, envio, historico, api
- `src/views/` — EJS + partials · `src/auth/` — `authMiddleware.js`, `createUser.js`, `users.json`

## Planilha (2 abas) — schema PRÓPRIO (≠ maquininhas-node)
- **`MAQUINAS`** (`A2:K`): A=Serial, B=Código ID, C=Modelo, D=Patrimônio, E=Status,
  F=Local, G=Evento, H=Tipo, I=Observações, J=Criado em, K=Atualizado em (BR `dd/mm/aaaa`).
- **`HISTORICO`** (`A:I`): A=Data, B=Serial, C=Ação, D=Evento, E=Local,
  F=Status Anterior, G=Status Novo, H=Usuário, I=Observações.

Status reconhecidos: **ESTOQUE** (disponível), **EM USO**, **FIXO** (`getResumo`/`db.js`).
`atualizarMaquina(serial, patch)` resolve a linha **pelo serial** (index forçado) e sempre
carimba a coluna K "Atualizado em".

> O `SPREADSHEET_ID` real vem do `.env`/Vercel. O default no código (`sheet.js`) é só fallback.

## Variáveis de ambiente (.env / Vercel)
Credenciais Google em **campos separados** (NÃO é o JSON único do maquininhas-node):
- `GOOGLE_PROJECT_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY` — com `\n` escapado; o código faz `.replace(/\\n/g,"\n")` (`sheet.js`)
- `SPREADSHEET_ID`
- `SESSION_SECRET` — **definir em produção** (senão usa default inseguro com aviso no log)
- `NODE_ENV` — **não setar na Vercel** (ela já põe `production`; setar `development` desliga o cookie `secure`). Local usa `.env`.
- `PORT` — opcional, só local (default 3000). Ignorado em serverless.

`sheet.js` também aceita o modo legado `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON inteiro), se um dia preferir.
Na Vercel as vars estão em **Production + Preview**; Deployment Protection **desligada** (acesso via login do app).

## Rodar local
1. `.env` com as credenciais Google + `SPREADSHEET_ID` (já no `.gitignore`).
2. `npm install` → `npm run dev` (nodemon) ou `npm start`.
3. Criar usuário: `node src/auth/createUser.js`.

---

## Histórico de mudanças por agentes

### 2026-06-14 — migração para Vercel (serverless) + sessão em cookie — PR #1, branch `feat/deploy-vercel`
- **Motivo**: cortar custo do Render (pago por serviço); a Vercel Pro já estava paga.
- **Fix de sessão (essencial p/ serverless)**: trocado `express-session` (MemoryStore) por
  **`cookie-session`** — senão a sessão se perde entre invocações e o usuário desloga sozinho.
  Logout passou a usar `req.session = null` (cookie-session não tem `destroy()`).
- **Refactor**: `src/server.js` dividido em `src/app.js` (config, exporta `app`) + `src/server.js`
  (só o `listen` local). Novo `api/index.js` (handler serverless) e `vercel.json`
  (rewrite de tudo p/ a função + `includeFiles: src/**`).
- **Hardening** alinhado ao maquininhas-node: `trust proxy`, cookie `httpOnly`/`secure`(prod)/
  `sameSite=lax`/`maxAge` 8h, checagem CSRF de Origin/Referer nos POST/PUT/DELETE.
- **Validado em produção**: login OK, sessão persistiu na função serverless, **722 máquinas**
  lidas do Sheets (o `GOOGLE_PRIVATE_KEY` em var separada foi parseado certo), zero erro.
- **Render**: serviço **suspenso** (não deletado) como fallback; deletar quando 100% confiante.
