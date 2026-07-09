const { google } = require('googleapis')
const { isAuthenticated } = require('./_lib/session')

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1_t64uj3iFNSNl-_SNGotD5bPb1a81QVA'
const SHEET_TAB = process.env.SHEET_TAB || 'Seguimiento'

// Urgencia (columna S, fórmula de la hoja) se deja fuera a propósito: es de
// solo lectura. Orden (columna A) sí se incluye, pero solo para el
// renumerado automático del flujo "+" de insertar fila entre dos existentes
// (vista Procesos) — nunca se expone como celda editable en la tabla
// (ver EDITABLE_FIELDS en src/constants.js, que la excluye a propósito).
// Debe coincidir exactamente con el mapeo de api/update.js.
const FIELD_TO_COLUMN = {
  orden: 'A',
  ordenSecundario: 'B',
  nombre: 'C',
  tipo: 'D',
  severidad: 'E',
  descripcion: 'F',
  responsables: 'G',
  naturaleza: 'H',
  tipoIntervencion: 'I',
  tratamiento: 'J',
  estado: 'K',
  notas: 'L',
  update1: 'M',
  update2: 'N',
  update3: 'O',
  kpis: 'P',
  probabilidad: 'Q',
  impacto: 'R',
  controlPreventivo: 'T',
  controlDetectivo: 'U',
  controlCorrectivo: 'V',
  frecuenciaRevision: 'W',
  responsableMonitoreo: 'X',
}

function apiError(statusCode, code, error, detail) {
  const err = new Error(error)
  err.statusCode = statusCode
  err.code = code
  err.detail = detail || null
  return err
}

function buildAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (!raw) {
    throw apiError(
      500,
      'MISSING_ENV_VAR',
      'La variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON no está definida.',
      'Agrégala en .env.local (desarrollo) o en Vercel → Project Settings → Environment Variables.'
    )
  }

  let credentials
  try {
    credentials = JSON.parse(raw)
  } catch (e) {
    throw apiError(
      500,
      'INVALID_CREDENTIALS_JSON',
      'GOOGLE_SERVICE_ACCOUNT_JSON no es JSON válido.',
      `Asegúrate de pegar el contenido completo del archivo .json sin modificaciones. Detalle del parser: ${e.message}`
    )
  }

  const requiredFields = ['type', 'client_email', 'private_key']
  const missing = requiredFields.filter(k => !credentials[k])
  if (missing.length) {
    throw apiError(
      500,
      'INCOMPLETE_CREDENTIALS',
      `Credenciales incompletas — faltan campos requeridos: ${missing.join(', ')}.`,
      'Asegúrate de usar el archivo JSON completo descargado desde Google Cloud → Service Accounts.'
    )
  }

  if (credentials.type !== 'service_account') {
    throw apiError(
      500,
      'WRONG_CREDENTIAL_TYPE',
      `Tipo de credencial incorrecto: "${credentials.type}". Se esperaba "service_account".`,
      'El archivo JSON debe ser de una cuenta de servicio, no de OAuth2 ni de otra fuente.'
    )
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function classifyGoogleError(err) {
  const httpStatus = err?.response?.status
  const googleMsg =
    err?.response?.data?.error?.message ||
    err?.response?.data?.error_description ||
    err?.message

  if (httpStatus === 401 || /invalid_grant|UNAUTHENTICATED/.test(err?.message)) {
    return apiError(
      401,
      'GOOGLE_AUTH_FAILED',
      'Autenticación fallida con Google Sheets API.',
      `La cuenta de servicio puede tener la clave privada incorrecta o revocada. Respuesta de Google: ${googleMsg}`
    )
  }

  if (httpStatus === 403) {
    return apiError(
      403,
      'GOOGLE_PERMISSION_DENIED',
      `Permiso denegado para escribir en la hoja (ID: ${SPREADSHEET_ID}).`,
      `La cuenta de servicio necesita rol "Editor" en la hoja. Compártela desde Google Sheets → Compartir. Respuesta de Google: ${googleMsg}`
    )
  }

  if (httpStatus === 404) {
    return apiError(
      404,
      'SPREADSHEET_NOT_FOUND',
      `Hoja de cálculo no encontrada (ID: ${SPREADSHEET_ID}).`,
      `Verifica que el SPREADSHEET_ID en las variables de entorno sea correcto. Respuesta de Google: ${googleMsg}`
    )
  }

  if (httpStatus === 429) {
    return apiError(
      429,
      'RATE_LIMITED',
      'Límite de solicitudes de Google Sheets API alcanzado.',
      `Espera unos segundos y vuelve a intentarlo. Respuesta de Google: ${googleMsg}`
    )
  }

  return apiError(
    500,
    'GOOGLE_API_ERROR',
    'Error inesperado al escribir en Google Sheets API.',
    googleMsg
  )
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body)
    let data = ''
    req.on('data', chunk => (data += chunk))
    req.on('end', () => {
      try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

function sendError(res, err) {
  const statusCode = err.statusCode || 500
  console.error(`[api/batch-update] ${err.code || 'ERROR'} (HTTP ${statusCode}):`, err.detail || err.message)
  return res.status(statusCode).json({
    error: err.message,
    code: err.code || 'UNKNOWN_ERROR',
    detail: err.detail || null,
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido', code: 'METHOD_NOT_ALLOWED' })
  }

  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'No autenticado.', code: 'UNAUTHENTICATED' })
  }

  let body
  try {
    body = await parseBody(req)
  } catch {
    return res.status(400).json({
      error: 'El cuerpo de la solicitud no es JSON válido.',
      code: 'INVALID_REQUEST_BODY',
      detail: 'El frontend debe enviar Content-Type: application/json con un body JSON.',
    })
  }

  const { updates } = body

  if (!Array.isArray(updates) || !updates.length) {
    return res.status(400).json({
      error: 'Faltan parámetros en la solicitud.',
      code: 'MISSING_PARAMS',
      detail: 'Se requiere "updates": un arreglo con al menos un elemento {sheetRow, field, value}.',
    })
  }

  for (const item of updates) {
    const { sheetRow, field, value } = item || {}

    if (typeof sheetRow !== 'number' || sheetRow < 2) {
      return res.status(400).json({
        error: `sheetRow inválido: ${sheetRow}. Debe ser un número >= 2.`,
        code: 'INVALID_SHEET_ROW',
        detail: 'sheetRow=1 sería el encabezado, que nunca debe editarse desde el dashboard.',
      })
    }

    if (!field || value === undefined) {
      return res.status(400).json({
        error: 'Faltan parámetros en un elemento de "updates".',
        code: 'MISSING_PARAMS',
        detail: `Se recibió: ${JSON.stringify(item)}. Se requieren: sheetRow (número), field, value.`,
      })
    }

    if (!FIELD_TO_COLUMN[field]) {
      return res.status(400).json({
        error: `Campo no editable desde el dashboard: "${field}".`,
        code: 'FIELD_NOT_EDITABLE',
        detail: `Solo se permite editar: ${Object.keys(FIELD_TO_COLUMN).join(', ')}.`,
      })
    }
  }

  let auth
  try {
    auth = buildAuth()
  } catch (err) {
    return sendError(res, err)
  }

  const data = updates.map(({ sheetRow, field, value }) => ({
    range: `${SHEET_TAB}!${FIELD_TO_COLUMN[field]}${sheetRow}`,
    values: [[value]],
  }))

  try {
    const sheets = google.sheets({ version: 'v4', auth })
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data,
      },
    })
  } catch (err) {
    return sendError(res, classifyGoogleError(err))
  }

  res.json({ ok: true, updated: updates.length })
}
