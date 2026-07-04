import { useState, useEffect, useCallback } from 'react'

// Extracts structured error info from an API response and logs the technical
// detail to the console so it's visible without being shown in the UI.
async function extractApiError(res) {
  let body = {}
  try { body = await res.json() } catch { /* response had no JSON body */ }

  const userMessage = body.error || `Error HTTP ${res.status}`
  const code = body.code || 'UNKNOWN_ERROR'
  const detail = body.detail || null

  console.error(
    `%c[Platam API] ${code} — HTTP ${res.status}`,
    'color: #EF4444; font-weight: bold;'
  )
  if (detail) console.error('Detalle técnico:', detail)
  if (!detail && body.error) console.error('Respuesta del servidor:', body)

  return new Error(userMessage)
}

export function useSheets() {
  const [processes, setProcesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProcesses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let res
      try {
        res = await fetch('/api/sheets')
      } catch (networkErr) {
        // fetch() itself throws only on network-level failures (no connection, CORS block, etc.)
        console.error('[Platam API] Error de red al llamar /api/sheets:', networkErr)
        throw new Error('No se pudo conectar con el servidor. Verifica que vercel dev esté corriendo.')
      }

      if (!res.ok) throw await extractApiError(res)

      const data = await res.json()
      setProcesses(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProcesses() }, [fetchProcesses])

  const updateCell = useCallback(async (sheetRow, field, value) => {
    setProcesses(prev =>
      prev.map(p => (p.sheetRow === sheetRow ? { ...p, [field]: value } : p))
    )

    let res
    try {
      res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetRow, field, value }),
      })
    } catch (networkErr) {
      console.error('[Platam API] Error de red al llamar /api/update:', networkErr)
      await fetchProcesses()
      throw new Error('No se pudo conectar con el servidor al intentar guardar.')
    }

    if (!res.ok) {
      const err = await extractApiError(res)
      await fetchProcesses()
      throw err
    }
  }, [fetchProcesses])

  return { processes, loading, error, retry: fetchProcesses, updateCell }
}
