import { google } from "googleapis";

/* =====================================================
   ID DA PLANILHA
===================================================== */
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "18tagiBqebJEUEv61dxsnAcKcfk3tQ--jzJLpyAGt92E";

/* =====================================================
   AUTH (PRODUÇÃO): via variável GOOGLE_SERVICE_ACCOUNT_JSON
   - No Railway/Render/etc você vai criar essa variável
   - Localmente, você pode setar ela usando seu credentials.json
===================================================== */
function getServiceAccountFromEnv() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      "Faltando GOOGLE_SERVICE_ACCOUNT_JSON no ambiente. " +
      "Em produção, crie a variável com o conteúdo do credentials.json. " +
      "Local: export/defina GOOGLE_SERVICE_ACCOUNT_JSON antes do npm start."
    );
  }

  // Algumas plataformas pedem o JSON em 1 linha; outras aceitam multiline.
  // Aqui garantimos que o private_key com '\n' funcione.
  const obj = JSON.parse(raw);

  if (obj.private_key && typeof obj.private_key === "string") {
    obj.private_key = obj.private_key.replace(/\\n/g, "\n");
  }

  return obj;
}

const serviceAccount = getServiceAccountFromEnv();

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ]
});

const sheets = google.sheets({ version: "v4", auth });

/* =====================================================
   🔵 CACHE simples de sheetId por nome (evita lentidão)
===================================================== */
const _sheetIdCache = new Map();

async function getSheetId(sheetName) {
  if (_sheetIdCache.has(sheetName)) return _sheetIdCache.get(sheetName);

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID
  });

  const sheet = meta.data.sheets?.find(s => s.properties?.title === sheetName);

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
      range
    });
    return res.data.values || [];
  } catch (error) {
    console.error("❌ Erro ao ler planilha:", error);
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
      requestBody: { values: [[value]] }
    });
    return true;
  } catch (error) {
    console.error("❌ Erro ao atualizar célula:", error);
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
            columnIndex: col - 1
          },
          rows: [
            {
              values: [
                {
                  userEnteredValue: { stringValue: String(value ?? "") }
                }
              ]
            }
          ],
          fields: "userEnteredValue"
        }
      }
    ];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { requests }
    });

    return true;
  } catch (error) {
    console.error("❌ Erro ao atualizar (preservando formato):", error);
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
      requestBody: { values: [values] }
    });
    return true;
  } catch (error) {
    console.error("❌ Erro ao inserir linha:", error);
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
      requestBody: { values: rows }
    });

    return true;
  } catch (error) {
    console.error("❌ Erro ao append na planilha:", error);
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
    const data = updates.map(u => ({
      range: u.range,
      values: [[u.value]]
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data
      }
    });

    return true;
  } catch (error) {
    console.error("❌ Erro no batchUpdateValues:", error);
    return false;
  }
}
