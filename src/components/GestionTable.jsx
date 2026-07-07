import { useState, useMemo, useCallback } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  EDITABLE_FIELDS,
  esRiesgo,
  ESTADO_STYLE,
  TIPO_STYLE,
  parseResponsables,
  colorForResponsable,
  buildUpdateEntry,
} from '../constants'

const NUMERIC_SORT_KEYS = ['orden', 'ordenSecundario']

// Update 1/2/3 (Project manager) no se sobreescriben: cada guardado agrega
// una entrada nueva con fecha, debajo del historial existente. Ver
// handleStartEdit/handleSave y buildUpdateEntry en constants.js.
const HISTORY_FIELDS = ['update1', 'update2', 'update3']

// Ancho de la columna del ícono de agarre (drag handle) — solo se usa en
// la vista Project manager cuando enableDragReorder está activo.
const DRAG_HANDLE_WIDTH = 36

function DragHandle({ attributes, listeners }) {
  return (
    <button
      type="button"
      className="drag-handle"
      aria-label="Arrastrar para reordenar"
      {...attributes}
      {...listeners}
    >
      <svg width="12" height="18" viewBox="0 0 12 18" fill="none" aria-hidden="true">
        <circle cx="3" cy="3" r="1.5" fill="currentColor" />
        <circle cx="9" cy="3" r="1.5" fill="currentColor" />
        <circle cx="3" cy="9" r="1.5" fill="currentColor" />
        <circle cx="9" cy="9" r="1.5" fill="currentColor" />
        <circle cx="3" cy="15" r="1.5" fill="currentColor" />
        <circle cx="9" cy="15" r="1.5" fill="currentColor" />
      </svg>
    </button>
  )
}

// Fila arrastrable para Project manager. Reutiliza exactamente el mismo
// renderCell que la fila estática — solo agrega el <tr> "sortable" de
// dnd-kit y la celda del drag handle a la izquierda.
function SortableRow({ process, columns, renderCell }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: process.sheetRow,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 2 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  return (
    <tr ref={setNodeRef} style={style}>
      <td
        className="drag-handle-cell sticky-col"
        style={{ left: 0, width: DRAG_HANDLE_WIDTH, minWidth: DRAG_HANDLE_WIDTH, maxWidth: DRAG_HANDLE_WIDTH }}
      >
        <DragHandle attributes={attributes} listeners={listeners} />
      </td>
      {columns.map(col => renderCell(process, col))}
    </tr>
  )
}

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

function TipoCell({ process, editCell, editValue, setEditValue, onStartEdit, onSave }) {
  const isEditing =
    editCell?.sheetRow === process.sheetRow && editCell?.field === 'tipo'

  if (isEditing) {
    return (
      <select
        className="edit-select"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={onSave}
        autoFocus
      >
        {EDITABLE_FIELDS.tipo.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    )
  }

  const style = TIPO_STYLE[process.tipo] || TIPO_STYLE.Proceso
  return (
    <span
      className="tipo-chip"
      style={{ background: style.bg, color: style.color }}
      onClick={() => onStartEdit(process, 'tipo')}
      title="Clic para editar"
    >
      {process.tipo || '—'}
    </span>
  )
}

function ResponsablesCell({ process, editCell, editValue, setEditValue, onStartEdit, onSave, onCancel }) {
  const isEditing =
    editCell?.sheetRow === process.sheetRow && editCell?.field === 'responsables'

  if (isEditing) {
    return (
      <input
        type="text"
        className="edit-input"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={onSave}
        onKeyDown={e => {
          if (e.key === 'Escape') onCancel()
          if (e.key === 'Enter') e.target.blur()
        }}
        autoFocus
      />
    )
  }

  const nombres = parseResponsables(process.responsables)
  if (!nombres.length) {
    return (
      <span
        className="responsables-cell empty"
        onClick={() => onStartEdit(process, 'responsables')}
        title="Clic para editar"
      >
        —
      </span>
    )
  }

  return (
    <span
      className="responsables-cell"
      onClick={() => onStartEdit(process, 'responsables')}
      title="Clic para editar"
    >
      {nombres.map((nombre, i) => {
        const style = colorForResponsable(nombre)
        return (
          <span
            key={`${nombre}-${i}`}
            className="responsable-chip"
            style={{ background: style.bg, color: style.color }}
          >
            {nombre}
          </span>
        )
      })}
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

// Campo de texto libre (una línea o textarea) o numérico sin dropdown.
function TextCell({
  process,
  field,
  editCell,
  editValue,
  setEditValue,
  onStartEdit,
  onSave,
  onCancel,
  multiline,
  type = 'text',
  displayClassName,
  placeholder,
}) {
  const isEditing =
    editCell?.sheetRow === process.sheetRow && editCell?.field === field

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          className="edit-textarea"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={onSave}
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
          placeholder={placeholder}
          autoFocus
        />
      )
    }
    return (
      <input
        type={type}
        className="edit-input"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={onSave}
        onKeyDown={e => {
          if (e.key === 'Escape') onCancel()
          if (e.key === 'Enter') e.target.blur()
        }}
        autoFocus
      />
    )
  }

  const value = process[field]
  return (
    <span
      className={`cell-editable${displayClassName ? ` ${displayClassName}` : ''}${!value ? ' empty' : ''}`}
      onClick={() => onStartEdit(process, field)}
      title={multiline && value ? value : 'Clic para editar'}
    >
      {value || '—'}
    </span>
  )
}

// Offset acumulado (izquierda) de cada columna fija, sumando solo el ancho
// de las columnas fijas anteriores — las columnas no fijas de por medio
// (ej. Severidad) simplemente se deslizan por debajo al hacer scroll.
// `baseOffset` desplaza todo el cálculo cuando hay una columna adicional
// (el drag handle de Project manager) antes de las columnas fijas normales.
function useStickyOffsets(columns, baseOffset) {
  return useMemo(() => {
    let offset = baseOffset || 0
    const map = {}
    for (const col of columns) {
      if (!col.sticky) continue
      map[col.key] = offset
      offset += parseInt(col.width, 10) || 0
    }
    return map
  }, [columns, baseOffset])
}

export default function GestionTable({ processes, onUpdate, onAddNew, columns, defaultSortKey, enableDragReorder, onReorder }) {
  const [sortKey, setSortKey] = useState(defaultSortKey || 'orden')
  const [sortDir, setSortDir] = useState('asc')
  const [editCell, setEditCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const stickyOffsets = useStickyOffsets(columns, enableDragReorder ? DRAG_HANDLE_WIDTH : 0)
  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function stickyStyle(col) {
    if (!col.sticky) return undefined
    return { left: `${stickyOffsets[col.key]}px`, width: col.width, minWidth: col.width, maxWidth: col.width }
  }

  function stickyClassName(col, extra) {
    return [extra, col.sticky ? 'sticky-col' : null].filter(Boolean).join(' ') || undefined
  }

  const sorted = useMemo(() => {
    if (!sortKey) return processes
    return [...processes].sort((a, b) => {
      let aVal = a[sortKey] ?? ''
      let bVal = b[sortKey] ?? ''

      if (NUMERIC_SORT_KEYS.includes(sortKey)) {
        const aNum = parseInt(aVal)
        const bNum = parseInt(bVal)
        const aEmpty = isNaN(aNum)
        const bEmpty = isNaN(bNum)
        // Las celdas vacías (ej. Priorización sin asignar) siempre van al
        // final, sin importar la dirección del orden — no se mezclan con
        // los valores numéricos.
        if (aEmpty && bEmpty) return 0
        if (aEmpty) return 1
        if (bEmpty) return -1
        return sortDir === 'asc' ? aNum - bNum : bNum - aNum
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
    // Update 1/2/3 no se editan in-place: el textarea arranca vacío para
    // que el usuario solo escriba la entrada nueva, no reescriba el
    // historial ya guardado.
    setEditValue(HISTORY_FIELDS.includes(field) ? '' : (process[field] || ''))
  }

  const handleSave = useCallback(async () => {
    if (!editCell || saving) return
    const { sheetRow, field } = editCell

    if (HISTORY_FIELDS.includes(field)) {
      const nuevoTexto = editValue.trim()
      if (!nuevoTexto) {
        setEditCell(null)
        return
      }
      const proceso = processes.find(p => p.sheetRow === sheetRow)
      const valorFinal = buildUpdateEntry(proceso?.[field], nuevoTexto)
      setSaving(true)
      try {
        await onUpdate(sheetRow, field, valorFinal)
      } catch (err) {
        console.error('Error al guardar:', err)
      } finally {
        setSaving(false)
        setEditCell(null)
      }
      return
    }

    setSaving(true)
    try {
      await onUpdate(sheetRow, field, editValue)
    } catch (err) {
      console.error('Error al guardar:', err)
    } finally {
      setSaving(false)
      setEditCell(null)
    }
  }, [editCell, editValue, saving, onUpdate, processes])

  function handleCancel() {
    setEditCell(null)
    setEditValue('')
  }

  // Solo se usa cuando enableDragReorder está activo (Project manager).
  // Recalcula Priorización de forma secuencial (1, 2, 3...) únicamente para
  // las filas entre la posición de origen y la de destino — el resto de la
  // lista, incluidas las filas sin Priorización asignada que quedan al
  // final, no se toca.
  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sorted.findIndex(p => p.sheetRow === active.id)
    const newIndex = sorted.findIndex(p => p.sheetRow === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(sorted, oldIndex, newIndex)
    const lo = Math.min(oldIndex, newIndex)
    const hi = Math.max(oldIndex, newIndex)

    const changes = []
    for (let i = lo; i <= hi; i++) {
      const proc = reordered[i]
      const value = String(i + 1)
      if ((proc.ordenSecundario || '') !== value) {
        changes.push({ sheetRow: proc.sheetRow, field: 'ordenSecundario', value })
      }
    }
    if (!changes.length) return

    setSaving(true)
    try {
      await onReorder(changes)
    } catch (err) {
      console.error('Error al reordenar:', err)
    } finally {
      setSaving(false)
    }
  }

  function renderCell(process, col) {
    switch (col.key) {
      case 'orden':
        return (
          <td key={col.key} data-label={col.label} className={stickyClassName(col, 'cell-priority')} style={stickyStyle(col)}>
            {process.orden || '—'}
          </td>
        )
      case 'ordenSecundario':
        return (
          <td key={col.key} data-label={col.label} className={stickyClassName(col, 'cell-priority')} style={stickyStyle(col)}>
            <TextCell
              process={process}
              field="ordenSecundario"
              type="number"
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </td>
        )
      case 'nombre':
        return (
          <td key={col.key} data-label={col.label} className={stickyClassName(col)} style={stickyStyle(col)}>
            <TextCell
              process={process}
              field="nombre"
              displayClassName="cell-name"
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </td>
        )
      case 'descripcion':
        return (
          <td key={col.key} data-label={col.label} className={stickyClassName(col)} style={stickyStyle(col)}>
            <TextCell
              process={process}
              field="descripcion"
              multiline
              displayClassName="cell-desc"
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </td>
        )
      case 'responsables':
        return (
          <td key={col.key} data-label={col.label}>
            <ResponsablesCell
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
          <td key={col.key} data-label={col.label} className={stickyClassName(col)} style={stickyStyle(col)}>
            <TipoCell
              process={process}
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
            />
          </td>
        )
      case 'severidad':
        return (
          <td key={col.key} data-label={col.label}>
            <SelectCell
              process={process}
              field="severidad"
              options={EDITABLE_FIELDS.severidad}
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
            <TextCell
              process={process}
              field="notas"
              multiline
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </td>
        )
      case 'update1':
      case 'update2':
      case 'update3':
        return (
          <td key={col.key} data-label={col.label}>
            <TextCell
              process={process}
              field={col.key}
              multiline
              displayClassName="cell-history"
              placeholder="Nueva actualización..."
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </td>
        )
      case 'kpis':
        return (
          <td key={col.key} data-label={col.label}>
            <TextCell
              process={process}
              field="kpis"
              multiline
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
            {enableDragReorder && (
              <th
                className="sticky-col drag-handle-header"
                style={{ left: 0, width: DRAG_HANDLE_WIDTH, minWidth: DRAG_HANDLE_WIDTH, maxWidth: DRAG_HANDLE_WIDTH }}
                aria-label="Reordenar"
              />
            )}
            {columns.map(col => (
              <th
                key={col.key}
                className={stickyClassName(col)}
                style={col.sticky ? stickyStyle(col) : { minWidth: col.width }}
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                <SortIcon columnKey={col.key} sortKey={sortKey} sortDir={sortDir} />
              </th>
            ))}
          </tr>
        </thead>
        {enableDragReorder ? (
          <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map(p => p.sheetRow)} strategy={verticalListSortingStrategy}>
              <tbody>
                {sorted.map(p => (
                  <SortableRow key={p.sheetRow} process={p} columns={columns} renderCell={renderCell} />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        ) : (
          <tbody>
            {sorted.map(p => (
              <tr key={p.sheetRow}>
                {columns.map(col => renderCell(p, col))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  )
}
