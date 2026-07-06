const { isAuthenticated, buildSessionCookie, buildClearCookie } = require('./_lib/session')

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body)
    let data = ''
    req.on('data', chunk => (data += chunk))
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

module.exports = async function handler(req, res) {
  const CLAVE_ACCESO = process.env.CLAVE_ACCESO

  if (!CLAVE_ACCESO) {
    return res.status(500).json({
      ok: false,
      authenticated: false,
      error: 'La variable de entorno CLAVE_ACCESO no está definida en el servidor.',
      code: 'MISSING_ENV_VAR',
      detail: 'Agrégala en Vercel → Project Settings → Environment Variables.',
    })
  }

  if (req.method === 'GET') {
    return res.json({ authenticated: isAuthenticated(req) })
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', buildClearCookie())
    return res.json({ ok: true })
  }

  if (req.method === 'POST') {
    let body
    try {
      body = await parseBody(req)
    } catch {
      return res.status(400).json({
        ok: false,
        error: 'El cuerpo de la solicitud no es JSON válido.',
        code: 'INVALID_REQUEST_BODY',
      })
    }

    if (typeof body.password !== 'string' || body.password !== CLAVE_ACCESO) {
      return res.status(401).json({ ok: false, error: 'Clave incorrecta.', code: 'INVALID_PASSWORD' })
    }

    res.setHeader('Set-Cookie', buildSessionCookie())
    return res.json({ ok: true })
  }

  return res.status(405).json({ error: 'Método no permitido', code: 'METHOD_NOT_ALLOWED' })
}
