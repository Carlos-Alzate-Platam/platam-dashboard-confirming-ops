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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido', code: 'METHOD_NOT_ALLOWED' })
  }

  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'No autenticado.', code: 'UNAUTHENTICATED' })
  }

  let auth
  try {
    auth = buildAuth()
  } catch (err) {
    return sendError(res, err)
  }

  let response
  try {
    const sheets = google.sheets({ version: 'v4', auth })
    response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB}!A:J`,
    })
  } catch (err) {
    return sendError(res, classifyGoogleError(err))
  }

  const rows = response.data.values || []
  if (rows.length < 2) return res.json([])

  // rows[0] es el encabezado; rows[i] para i>=1 es dato en sheet row i+1
  // Columnas: A Orden, B Nombre, C Tipo, D Descripción, E Responsables,
  // F Naturaleza, G Tipo Intervención, H Tratamiento, I Estado, J Notas
  const processes = rows
    .slice(1)
    .map((row, i) => ({
      sheetRow: i + 2, // fila real en Sheets (1-indexed, +1 por encabezado)
      orden: row[0] || '',
      nombre: row[1] || '',
      tipo: row[2] || '',
      descripcion: row[3] || '',
      responsables: row[4] || '',
      naturaleza: row[5] || '',
      tipoIntervencion: row[6] || '',
      tratamiento: row[7] || '',
      estado: row[8] || '',
      notas: row[9] || '',
    }))
    .filter(p => p.nombre || p.descripcion)

  res.json(processes)
}
