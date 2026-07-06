const crypto = require('crypto')

const COOKIE_NAME = 'platam_session'
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000

function getSecret() {
  return process.env.CLAVE_ACCESO || ''
}

function parseCookies(header) {
  const cookies = {}
  if (!header) return cookies
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=')
    if (idx === -1) return
    const key = pair.slice(0, idx).trim()
    const value = pair.slice(idx + 1).trim()
    cookies[key] = decodeURIComponent(value)
  })
  return cookies
}

function sign(expiry) {
  return crypto.createHmac('sha256', getSecret()).update(String(expiry)).digest('hex')
}

// Token con formato "<expiryMs>.<firmaHmac>", firmado con CLAVE_ACCESO como
// secreto. Sin estado en el servidor: cualquier instancia serverless puede
// validarlo con solo conocer la variable de entorno.
function buildSessionCookie() {
  const expiry = Date.now() + SESSION_DURATION_MS
  const token = `${expiry}.${sign(expiry)}`
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_DURATION_MS / 1000}; HttpOnly; Secure; SameSite=Lax`
}

// Mismos atributos que buildSessionCookie (para que el navegador la
// reconozca como la misma cookie) pero con Max-Age=0, lo que le indica
// que la borre de inmediato.
function buildClearCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}

function isValidToken(token) {
  const secret = getSecret()
  if (!token || !secret) return false

  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) return false

  const expiryStr = token.slice(0, dotIndex)
  const sig = token.slice(dotIndex + 1)
  const expiry = Number(expiryStr)
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false

  const expected = sign(expiryStr)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false

  return crypto.timingSafeEqual(a, b)
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie)
  return isValidToken(cookies[COOKIE_NAME])
}

module.exports = {
  COOKIE_NAME,
  SESSION_DURATION_MS,
  parseCookies,
  buildSessionCookie,
  buildClearCookie,
  isValidToken,
  isAuthenticated,
}
