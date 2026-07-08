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

  // `silent` se usa al navegar entre pestañas: refresca `processes` desde
  // Sheets en segundo plano sin tocar `loading`/`error`, para que las vistas
  // ya cargadas no parpadeen ni muestren el spinner de carga completa. Un
  // fallo en modo silencioso solo se registra en consola — la vista sigue
  // mostrando los datos que ya tenía.
  const fetchProcesses = useCallback(async (opts = {}) => {
    const { silent = false } = opts
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      let res
      try {
        res = await fetch('/api/sheets')
      } catch (networkErr) {
        // fetch() itself throws only on network-level failures (no connection, CORS block, etc.)
        console.error('[Platam API] Error de red al llamar /api/sheets:', networkErr)
        if (silent) return
        throw new Error('No se pudo conectar con el servidor. Verifica que vercel dev esté corriendo.')
      }

      if (!res.ok) {
        const err = await extractApiError(res)
        if (silent) return
        throw err
      }

      const data = await res.json()
      setProcesses(data)
    } catch (err) {
      if (!silent) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const refreshSilently = useCallback(() => fetchProcesses({ silent: true }), [fetchProcesses])

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

  // Aplica varios cambios de una sola vez (ej. reordenar por drag & drop en
  // Project manager) con una sola llamada batch a Sheets. Optimista: aplica
  // los cambios en memoria antes de llamar a la API y, si falla, revierte
  // exactamente al estado previo a la operación.
  const batchUpdateCells = useCallback(async (updates) => {
    if (!updates || !updates.length) return

    let previous
    setProcesses(prev => {
      previous = prev
      const byRow = new Map(updates.map(u => [u.sheetRow, u]))
      return prev.map(p => {
        const change = byRow.get(p.sheetRow)
        return change ? { ...p, [change.field]: change.value } : p
      })
    })

    let res
    try {
      res = await fetch('/api/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
    } catch (networkErr) {
      console.error('[Platam API] Error de red al llamar /api/batch-update:', networkErr)
      setProcesses(previous)
      throw new Error('No se pudo conectar con el servidor al intentar guardar el nuevo orden.')
    }

    if (!res.ok) {
      const err = await extractApiError(res)
      setProcesses(previous)
      throw err
    }
  }, [])

  const createProcess = useCallback(async (fields) => {
    let res
    try {
      res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
    } catch (networkErr) {
      console.error('[Platam API] Error de red al llamar /api/create:', networkErr)
      throw new Error('No se pudo conectar con el servidor al intentar crear el proceso.')
    }

    if (!res.ok) throw await extractApiError(res)

    const { process } = await res.json()
    setProcesses(prev => [...prev, process])
    return process
  }, [])

  return { processes, loading, error, retry: fetchProcesses, refreshSilently, updateCell, batchUpdateCells, createProcess }
}
