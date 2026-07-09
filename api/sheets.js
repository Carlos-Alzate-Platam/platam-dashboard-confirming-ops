const { google } = require('googleapis')
const { isAuthenticated } = require('./_lib/session')

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1_t64uj3iFNSNl-_SNGotD5bPb1a81QVA'
const SHEET_TAB = process.env.SHEET_TAB || 'Seguimiento'

// Builds a structured API error that the handler can serialize directly.
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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

// Maps Google API HTTP errors to descriptive messages.
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
      `Acceso denegado a la hoja de cálculo (ID: ${SPREADSHEET_ID}).`,
      `Comparte la hoja con el client_email de la cuenta de servicio y dale rol "Editor" (o "Viewer" para solo lectura). Respuesta de Google: ${googleMsg}`
    )
  }

  if (httpStatus === 404) {
    return apiError(
      404,
      'SPREADSHEET_NOT_FOUND',
      `Hoja de cálculo no encontrada (ID: ${SPREADSHEET_ID}).`,
      `Verifica que el SPREADSHEET_ID en las variables de entorno sea correcto y que la hoja exista. Respuesta de Google: ${googleMsg}`
    )
  }

  if (httpStatus === 429) {
    return apiError(
      429,
      'RATE_LIMITED',
      'Límite de solicitudes de Google Sheets API alcanzado.',
      `Espera unos segundos y recarga. Respuesta de Google: ${googleMsg}`
    )
  }

  return apiError(
    500,
    'GOOGLE_API_ERROR',
    'Error inesperado al comunicarse con Google Sheets API.',
    googleMsg
  )
}

function sendError(res, err) {
  const statusCode = err.statusCode || 500
  console.error(`[api/sheets] ${err.code || 'ERROR'} (HTTP ${statusCode}):`, err.detail || err.message)
  return res.status(statusCode).json({
    error: err.message,
    code: err.code || 'UNKNOWN_ERROR',
    detail: err.detail || null,
  })
}

// rows[0] es el encabezado; rows[i] para i>=1 es dato en sheet row i+1
// Columnas: A Orden, B Orden_02, C Nombre, D Tipo, E Severidad,
// F Descripción, G Responsables, H Naturaleza, I Tipo Intervención,
// J Tratamiento, K Estado, L Notas, M Update 1, N Update 2, O Update 3,
// P KPIs, Q Probabilidad, R Impacto, S Urgencia (fórmula de la hoja,
// solo lectura), T Control Preventivo, U Control Detectivo,
// V Control Correctivo, W Frecuencia Revisión, X Responsable Monitoreo
function mapRow(row, sheetRow) {
  return {
    sheetRow,
    orden: row[0] || '',
    ordenSecundario: row[1] || '',
    nombre: row[2] || '',
    tipo: row[3] || '',
    severidad: row[4] || '',
    descripcion: row[5] || '',
    responsables: row[6] || '',
    naturaleza: row[7] || '',
    tipoIntervencion: row[8] || '',
    tratamiento: row[9] || '',
    estado: row[10] || '',
    notas: row[11] || '',
    update1: row[12] || '',
    update2: row[13] || '',
    update3: row[14] || '',
    kpis: row[15] || '',
    probabilidad: row[16] || '',
    impacto: row[17] || '',
    urgencia: row[18] || '',
    controlPreventivo: row[19] || '',
    controlDetectivo: row[20] || '',
    controlCorrectivo: row[21] || '',
    frecuenciaRevision: row[22] || '',
    responsableMonitoreo: row[23] || '',
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido', code: 'METHOD_NOT_ALLOWED' })
  }

  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'No autenticado.', code: 'UNAUTHENTICATED' })
  }

  // Parseo manual del query string (en vez de depender de req.query) para
  // que este handler funcione igual bajo el runtime de Vercel y bajo un
  // http.Server plano.
  const sheetRowParam = new URL(req.url, 'http://localhost').searchParams.get('sheetRow')

  let auth
  try {
    auth = buildAuth()
  } catch (err) {
    return sendError(res, err)
  }

  const sheets = google.sheets({ version: 'v4', auth })

  // Consulta de una sola fila — usada tras editar Probabilidad/Impacto en
  // la vista Riesgos para traer el valor de Urgencia recién recalculado por
  // la fórmula de la hoja, sin releer la hoja completa (ver refetchRowUrgencia
  // en src/hooks/useSheets.js).
  if (sheetRowParam) {
    const sheetRow = parseInt(sheetRowParam, 10)
    if (Number.isNaN(sheetRow) || sheetRow < 2) {
      return res.status(400).json({
        error: `sheetRow inválido: "${sheetRowParam}".`,
        code: 'INVALID_SHEET_ROW',
        detail: 'sheetRow debe ser un número >= 2 (1 sería el encabezado).',
      })
    }

    let rowResponse
    try {
      rowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_TAB}!A${sheetRow}:X${sheetRow}`,
      })
    } catch (err) {
      return sendError(res, classifyGoogleError(err))
    }

    const row = (rowResponse.data.values || [])[0] || []
    return res.json({ process: mapRow(row, sheetRow) })
  }

  let response
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB}!A:X`,
    })
  } catch (err) {
    return sendError(res, classifyGoogleError(err))
  }

  const rows = response.data.values || []
  if (rows.length < 2) return res.json([])

  const processes = rows
    .slice(1)
    .map((row, i) => mapRow(row, i + 2)) // fila real en Sheets (1-indexed, +1 por encabezado)
    .filter(p => p.nombre || p.descripcion)

  res.json(processes)
}
