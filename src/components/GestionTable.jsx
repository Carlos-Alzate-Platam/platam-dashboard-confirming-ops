import { useState, useMemo, useCallback } from 'react'
import { EDITABLE_FIELDS, esRiesgo, ESTADO_STYLE } from '../constants'

const NUMERIC_SORT_KEYS = ['orden', 'ordenSecundario']

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

function EstadoCell({ process, editCell, editValue, setEditValue, onStartEdit, onSave }) {
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
        {EDITABLE_FIELDS.estado.map(s => (
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

function SelectCell({ process, field, options, extraClass, editCell, editValue, setEditValue, onStartEdit, onSave }) {
  const isEditing =
    editCell?.sheetRow === process.sheetRow && editCell?.field === field

  if (isEditing) {
    return (
      <select
        className="edit-select"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={onSave}
        autoFocus
      >
        {options.map(o => (
          <option key={o || 'vacio'} value={o}>{o || '—'}</option>
        ))}
      </select>
    )
  }

  return (
    <span
      className={`cell-editable${extraClass ? ` ${extraClass}` : ''}`}
      onClick={() => onStartEdit(process, field)}
      title="Clic para editar"
    >
      {process[field] || '—'}
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

export default function GestionTable({ processes, onUpdate, onAddNew, columns, defaultSortKey }) {
  const [sortKey, setSortKey] = useState(defaultSortKey || 'orden')
  const [sortDir, setSortDir] = useState('asc')
  const [editCell, setEditCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const sorted = useMemo(() => {
    if (!sortKey) return processes
    return [...processes].sort((a, b) => {
      let aVal = a[sortKey] ?? ''
      let bVal = b[sortKey] ?? ''

      if (NUMERIC_SORT_KEYS.includes(sortKey)) {
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
    if (!(field in EDITABLE_FIELDS)) return
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

  function renderCell(process, col) {
    switch (col.key) {
      case 'orden':
        return <td key={col.key} data-label={col.label} className="cell-priority">{process.orden || '—'}</td>
      case 'ordenSecundario':
        return <td key={col.key} data-label={col.label} className="cell-priority">{process.ordenSecundario || '—'}</td>
      case 'nombre':
        return <td key={col.key} data-label={col.label} className="cell-name">{process.nombre || '—'}</td>
      case 'descripcion':
        return (
          <td key={col.key} data-label={col.label}>
            <span className="cell-desc" title={process.descripcion}>{process.descripcion || '—'}</span>
          </td>
        )
      case 'responsables':
        return <td key={col.key} data-label={col.label}>{process.responsables || '—'}</td>
      case 'naturaleza':
        return (
          <td key={col.key} data-label={col.label}>
            <SelectCell
              process={process}
              field="naturaleza"
              options={EDITABLE_FIELDS.naturaleza}
              extraClass={esRiesgo(process.naturaleza) ? 'risk' : 'empty'}
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
            />
          </td>
        )
      case 'tipoIntervencion':
        return (
          <td key={col.key} data-label={col.label}>
            <SelectCell
              process={process}
              field="tipoIntervencion"
              options={EDITABLE_FIELDS.tipoIntervencion}
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
            />
          </td>
        )
      case 'tipo':
        return (
          <td key={col.key} data-label={col.label}>
            <SelectCell
              process={process}
              field="tipo"
              options={EDITABLE_FIELDS.tipo}
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
            />
          </td>
        )
      case 'tratamiento':
        return (
          <td key={col.key} data-label={col.label}>
            <SelectCell
              process={process}
              field="tratamiento"
              options={EDITABLE_FIELDS.tratamiento}
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
            />
          </td>
        )
      case 'estado':
        return (
          <td key={col.key} data-label={col.label}>
            <EstadoCell
              process={process}
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
            />
          </td>
        )
      case 'notas':
        return (
          <td key={col.key} data-label={col.label}>
            <NotasCell
              process={process}
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </td>
        )
      default:
        return <td key={col.key} data-label={col.label}>{process[col.key] || '—'}</td>
    }
  }

  return (
    <div className="table-wrapper">
      <div className="table-toolbar">
        {saving ? <p className="saving-indicator">Guardando en Sheets...</p> : <span />}
        <button className="add-process-btn" onClick={onAddNew}>+ Nuevo proceso</button>
      </div>
      <p className="table-scroll-hint">Desliza horizontalmente para ver todas las columnas →</p>
      <table className="process-table">
        <thead>
          <tr>
            {columns.map(col => (
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
              {columns.map(col => renderCell(p, col))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
