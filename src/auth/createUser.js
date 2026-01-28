import fs from "fs";
import path from "path";
import readline from "readline";
import bcrypt from "bcryptjs";

const usersFile = path.join(process.cwd(), "src", "auth", "users.json");

// Garante que o arquivo exista
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([]));
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

(async () => {
  console.log("=== Criar Novo Usuário ===");

  const nome = await ask("Nome: ");
  const email = await ask("Email: ");
  const senha = await ask("Senha: ");

  const hash = bcrypt.hashSync(senha, 10);

  const users = JSON.parse(fs.readFileSync(usersFile));

  users.push({
    nome,
    email,
    senha: hash
  });

  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  console.log("\n✅ Usuário criado com sucesso!");
  console.log("➡ Agora você já pode logar no sistema.\n");

  rl.close();
})();
