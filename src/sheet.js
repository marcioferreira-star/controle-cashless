import { google } from "googleapis";

/* =====================================================
   ID DA PLANILHA
===================================================== */
const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "18tagiBqebJEUEv61dxsnAcKcfk3tQ--jzJLpyAGt92E";

/* =====================================================
   AUTH
   Suporta 2 modos:
   1) LOCAL (novo): GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
   2) PRODUÇÃO/LEGADO: GOOGLE_SERVICE_ACCOUNT_JSON (JSON inteiro)
===================================================== */

function getCredentials() {
  // ✅ Modo legado / produção (JSON inteiro)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const obj = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    if (obj.private_key && typeof obj.private_key === "string") {
      obj.private_key = obj.private_key.replace(/\\n/g, "\n");
    }

    return obj;
  }

  // ✅ Modo novo (variáveis separadas no .env)
  const client_email = process.env.GOOGLE_CLIENT_EMAIL;
  let private_key = process.env.GOOGLE_PRIVATE_KEY;
  const project_id = process.env.GOOGLE_PROJECT_ID;

  if (!client_email || !private_key) {
    throw new Error(
      "Credenciais Google faltando. Configure:\n" +
        "- GOOGLE_CLIENT_EMAIL\n" +
        "- GOOGLE_PRIVATE_KEY\n" +
        "(opcional) GOOGLE_PROJECT_ID\n" +
        "Ou use GOOGLE_SERVICE_ACCOUNT_JSON."
    );
  }

  // garante \n correto mesmo se vier escapado
  private_key = private_key.replace(/\\n/g, "\n");

  return {
    type: "service_account",
    project_id,
    client_email,
    private_key,
  };
}

const credentials = getCredentials();

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    // drive é opcional. Se não precisar (criar/renomear/compartilhar arquivos), pode remover.
    "https://www.googleapis.com/auth/drive",
  ],
});

const sheets = google.sheets({ version: "v4", auth });

/* =====================================================
   🔵 CACHE simples de sheetId por nome (evita lentidão)
===================================================== */
const _sheetIdCache = new Map();

async function getSheetId(sheetName) {
  if (_sheetIdCache.has(sheetName)) return _sheetIdCache.get(sheetName);

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );

  const id = sheet?.properties?.sheetId;
  if (!id) return null;

  _sheetIdCache.set(sheetName, id);
  return id;
}

/* =====================================================
   🔵 LER PLANILHA
===================================================== */
export async function getSheetData(range) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    return res.data.values || [];
  } catch (error) {
    console.error("❌ Erro ao ler planilha:", error?.message || error);
    return [];
  }
}

/* =====================================================
   🔵 ATUALIZAR CÉLULA (rápido e estável)
===================================================== */
export async function updateSheetCell(range, value) {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[value]] },
    });
    return true;
  } catch (error) {
    console.error("❌ Erro ao atualizar célula:", error?.message || error);
    return false;
  }
}

/* =====================================================
   🔵 (LEGADO) ATUALIZAR CÉLULA preservando formatação
===================================================== */
export async function updateSheetCellPreserveFormat(sheetName, row, col, value) {
  try {
    const sheetId = await getSheetId(sheetName);
    if (!sheetId) {
      console.error("❌ Sheet não encontrado:", sheetName);
      return false;
    }

    const requests = [
      {
        updateCells: {
          start: {
            sheetId,
            rowIndex: row - 1,
            columnIndex: col - 1,
          },
          rows: [
            {
              values: [
                {
                  userEnteredValue: { stringValue: String(value ?? "") },
                },
              ],
            },
          ],
          fields: "userEnteredValue",
        },
      },
    ];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { requests },
    });

    return true;
  } catch (error) {
    console.error(
      "❌ Erro ao atualizar (preservando formato):",
      error?.message || error
    );
    return false;
  }
}

/* =====================================================
   🔵 APPEND (modo compatibilidade)
===================================================== */
export async function updateSheetAppend(range, values) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
    return true;
  } catch (error) {
    console.error("❌ Erro ao inserir linha:", error?.message || error);
    return false;
  }
}

/* =====================================================
   🔵 APPEND (multi-rows/geral)
===================================================== */
export async function appendToSheet(range, values) {
  try {
    const rows = Array.isArray(values?.[0]) ? values : [values];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });

    return true;
  } catch (error) {
    console.error("❌ Erro ao append na planilha:", error?.message || error);
    return false;
  }
}

/* =====================================================
   🔵 NOVO: BATCH UPDATE DE VÁRIAS CÉLULAS DE UMA VEZ
   - updates: Array<{ range: "'Aba'!A1", value: any }>
===================================================== */
export async function batchUpdateValues(updates) {
  if (!Array.isArray(updates) || updates.length === 0) return true;

  try {
    const data = updates.map((u) => ({
      range: u.range,
      values: [[u.value]],
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data,
      },
    });

    return true;
  } catch (error) {
    console.error("❌ Erro no batchUpdateValues:", error?.message || error);
    return false;
  }
}
