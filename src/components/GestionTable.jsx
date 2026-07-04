import { useState, useMemo, useCallback } from 'react'
import { COLUMNS, ESTADOS, ESTADO_STYLE, esRiesgo } from '../constants'

function SortIcon({ columnKey, sortKey, sortDir }) {
  if (sortKey !== columnKey) {
    return <span className="sort-icon">↕</span>
  }
  return (
    <span className="sort-icon active">
      {sortDir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

function EstadoCell({ process, editCell, editValue, setEditValue, onStartEdit, onSave, saving }) {
  const isEditing =
    editCell?.sheetRow === process.sheetRow && editCell?.field === 'estado'

  if (isEditing) {
    return (
      <select
        className="edit-select"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={onSave}
        autoFocus
      >
        {ESTADOS.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    )
  }

  const style = ESTADO_STYLE[process.estado] || { color: '#6B7280', bg: '#1A1E2A' }
  return (
    <span
      className="estado-chip"
      style={{ background: style.bg, color: style.color }}
      onClick={() => onStartEdit(process, 'estado')}
      title="Clic para editar"
    >
      {process.estado || '—'}
    </span>
  )
}

function NotasCell({ process, editCell, editValue, setEditValue, onStartEdit, onSave, onCancel }) {
  const isEditing =
    editCell?.sheetRow === process.sheetRow && editCell?.field === 'notas'

  if (isEditing) {
    return (
      <textarea
        className="edit-textarea"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={onSave}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
        autoFocus
      />
    )
  }

  return (
    <span
      className="cell-notas"
      onClick={() => onStartEdit(process, 'notas')}
      title={process.notas || 'Clic para agregar nota'}
    >
      {process.notas || <span style={{ color: 'var(--text-muted)' }}>—</span>}
    </span>
  )
}

export default function GestionTable({ processes, onUpdate }) {
  const [sortKey, setSortKey] = useState('prioridad')
  const [sortDir, setSortDir] = useState('asc')
  const [editCell, setEditCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const sorted = useMemo(() => {
    if (!sortKey) return processes
    return [...processes].sort((a, b) => {
      let aVal = a[sortKey] ?? ''
      let bVal = b[sortKey] ?? ''

      if (sortKey === 'prioridad') {
        const aNum = parseInt(aVal)
        const bNum = parseInt(bVal)
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDir === 'asc' ? aNum - bNum : bNum - aNum
        }
      }

      const cmp = String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [processes, sortKey, sortDir])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function handleStartEdit(process, field) {
    setEditCell({ sheetRow: process.sheetRow, field })
    setEditValue(process[field] || '')
  }

  const handleSave = useCallback(async () => {
    if (!editCell || saving) return
    const { sheetRow, field } = editCell
    setSaving(true)
    try {
      await onUpdate(sheetRow, field, editValue)
    } catch (err) {
      console.error('Error al guardar:', err)
    } finally {
      setSaving(false)
      setEditCell(null)
    }
  }, [editCell, editValue, saving, onUpdate])

  function handleCancel() {
    setEditCell(null)
    setEditValue('')
  }

  return (
    <div className="table-wrapper">
      {saving && <p className="saving-indicator">Guardando en Sheets...</p>}
      <table className="process-table">
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                style={{ minWidth: col.width }}
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                <SortIcon columnKey={col.key} sortKey={sortKey} sortDir={sortDir} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => (
            <tr key={p.sheetRow}>
              <td className="cell-priority">{p.prioridad || '—'}</td>
              <td className="cell-name">{p.nombre || '—'}</td>
              <td>
                <span className="cell-desc" title={p.descripcion}>{p.descripcion || '—'}</span>
              </td>
              <td>{p.responsables || '—'}</td>
              <td>
                <span className={`cell-naturaleza${esRiesgo(p.naturaleza) ? ' risk' : ' empty'}`}>
                  {p.naturaleza || '—'}
                </span>
              </td>
              <td>{p.tipoIntervencion || '—'}</td>
              <td>
                <EstadoCell
                  process={p}
                  editCell={editCell}
                  editValue={editValue}
                  setEditValue={setEditValue}
                  onStartEdit={handleStartEdit}
                  onSave={handleSave}
                  saving={saving}
                />
              </td>
              <td>
                <NotasCell
                  process={p}
                  editCell={editCell}
                  editValue={editValue}
                  setEditValue={setEditValue}
                  onStartEdit={handleStartEdit}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
