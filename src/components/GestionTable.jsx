import { useState, useMemo, useCallback, Fragment } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  EDITABLE_FIELDS,
  esRiesgo,
  esRiesgoVisibleEnTab,
  ESTADOS,
  ESTADO_STYLE,
  TIPO_STYLE,
  URGENCIA_STYLE,
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
function SortableRow({ process, columns, renderCell, className }) {
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
    <tr ref={setNodeRef} style={style} className={className}>
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

// Fila de filtros por Estado — solo se usa en Project manager cuando
// enableEstadoFilter está activo. Selección múltiple: sin nada activo se
// muestran todas las filas (comportamiento actual).
function EstadoFilterBar({ activeEstados, onToggle }) {
  return (
    <div className="estado-filter-bar">
      {ESTADOS.map(estado => {
        const style = ESTADO_STYLE[estado] || { color: '#6B7280', bg: '#1A1E2A' }
        const isActive = activeEstados.includes(estado)
        return (
          <button
            key={estado}
            type="button"
            className={`estado-filter-pill${isActive ? ' active' : ''}`}
            style={isActive ? { background: style.bg, color: style.color, borderColor: style.color } : undefined}
            onClick={() => onToggle(estado)}
          >
            {estado}
          </button>
        )
      })}
    </div>
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
      style={{ background: style.bg, color: style.color, border: style.border }}
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

// Fondo rojo sutil para filas de riesgo formal (Procesos, Project manager)
// — se activa por prop porque no todas las vistas que usan GestionTable
// deben resaltarlo (ej. Riesgos, donde toda fila ya es riesgo por diseño).
function riskRowClassName(process, highlightRiesgo) {
  return highlightRiesgo && esRiesgoVisibleEnTab(process.naturaleza) ? 'risk-row' : undefined
}

export default function GestionTable({ processes, onUpdate, onAddNew, columns, defaultSortKey, enableDragReorder, onReorder, enableEstadoFilter, hideAddButton, highlightRiesgo, enableInsertRow, onInsertRow, enableDeleteRow, onDeleteRow, enableRenumerar, onRenumerar }) {
  const [sortKey, setSortKey] = useState(defaultSortKey || 'orden')
  const [sortDir, setSortDir] = useState('asc')
  const [editCell, setEditCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeEstados, setActiveEstados] = useState([])
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

  // Solo se usa cuando enableEstadoFilter está activo (Project manager).
  // Filtra sobre la lista ya ordenada, así el drag-and-drop y el
  // ordenamiento operan siempre sobre las mismas filas visibles.
  const visibleRows = useMemo(() => {
    if (!activeEstados.length) return sorted
    return sorted.filter(p => activeEstados.includes(p.estado))
  }, [sorted, activeEstados])

  function handleToggleEstado(estado) {
    setActiveEstados(prev =>
      prev.includes(estado) ? prev.filter(e => e !== estado) : [...prev, estado]
    )
  }

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

    const oldIndex = visibleRows.findIndex(p => p.sheetRow === active.id)
    const newIndex = visibleRows.findIndex(p => p.sheetRow === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(visibleRows, oldIndex, newIndex)
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
            {enableDeleteRow ? (
              <span className="orden-cell-content">
                <span>{process.orden || '—'}</span>
                <button
                  type="button"
                  className="delete-row-btn"
                  aria-label={`Borrar ${process.nombre || 'proceso'}`}
                  title="Borrar proceso"
                  onClick={() => onDeleteRow(process)}
                >
                  <svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden="true">
                    <path
                      d="M1.5 3.5H11.5M4.5 3.5V2C4.5 1.44772 4.94772 1 5.5 1H7.5C8.05228 1 8.5 1.44772 8.5 2V3.5M5.5 6.5V10.5M7.5 6.5V10.5M2.5 3.5L3 12C3 12.5523 3.44772 13 4 13H9C9.55228 13 10 12.5523 10 12L10.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </span>
            ) : (
              process.orden || '—'
            )}
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
      case 'probabilidad':
        return (
          <td key={col.key} data-label={col.label}>
            <SelectCell
              process={process}
              field="probabilidad"
              options={EDITABLE_FIELDS.probabilidad}
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
            />
          </td>
        )
      case 'impacto':
        return (
          <td key={col.key} data-label={col.label}>
            <SelectCell
              process={process}
              field="impacto"
              options={EDITABLE_FIELDS.impacto}
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
            />
          </td>
        )
      case 'frecuenciaRevision':
        return (
          <td key={col.key} data-label={col.label}>
            <SelectCell
              process={process}
              field="frecuenciaRevision"
              options={EDITABLE_FIELDS.frecuenciaRevision}
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
            />
          </td>
        )
      case 'controlPreventivo':
      case 'controlDetectivo':
      case 'controlCorrectivo':
        return (
          <td key={col.key} data-label={col.label}>
            <TextCell
              process={process}
              field={col.key}
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
      case 'responsableMonitoreo':
        return (
          <td key={col.key} data-label={col.label}>
            <TextCell
              process={process}
              field="responsableMonitoreo"
              editCell={editCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </td>
        )
      case 'urgencia': {
        // Solo lectura (fórmula de la hoja): mismo estilo visual que los
        // chips de Tipo/Estado, pero sin onClick ni cursor de edición.
        const style = URGENCIA_STYLE[process.urgencia] || { bg: '#D1D5DB', color: '#1F2937' }
        return (
          <td key={col.key} data-label={col.label}>
            {process.urgencia ? (
              <span className="urgencia-chip" style={{ background: style.bg, color: style.color }}>
                {process.urgencia}
              </span>
            ) : '—'}
          </td>
        )
      }
      default:
        return <td key={col.key} data-label={col.label}>{process[col.key] || '—'}</td>
    }
  }

  return (
    <div className="table-wrapper">
      <div className="table-toolbar">
        {saving ? <p className="saving-indicator">Guardando en Sheets...</p> : <span />}
        {(enableRenumerar || !hideAddButton) && (
          <div className="table-toolbar-actions">
            {enableRenumerar && (
              <button type="button" className="renumerar-btn" onClick={onRenumerar}>Renumerar</button>
            )}
            {!hideAddButton && (
              <button className="add-process-btn" onClick={onAddNew}>+ Nuevo proceso</button>
            )}
          </div>
        )}
      </div>
      {enableEstadoFilter && (
        <EstadoFilterBar activeEstados={activeEstados} onToggle={handleToggleEstado} />
      )}
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
            <SortableContext items={visibleRows.map(p => p.sheetRow)} strategy={verticalListSortingStrategy}>
              <tbody>
                {visibleRows.map(p => (
                  <SortableRow
                    key={p.sheetRow}
                    process={p}
                    columns={columns}
                    renderCell={renderCell}
                    className={riskRowClassName(p, highlightRiesgo)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        ) : (
          <tbody>
            {visibleRows.map((p, i) => {
              // El botón "+" para insertar entre dos filas solo tiene sentido
              // cuando la tabla está ordenada por Orden — es la única columna
              // cuya secuencia visual coincide con la posición que se va a
              // renumerar. Al reordenar por otra columna, se oculta.
              const showInsertGap =
                enableInsertRow && sortKey === 'orden' && i < visibleRows.length - 1
              return (
                <Fragment key={p.sheetRow}>
                  <tr
                    className={[
                      riskRowClassName(p, highlightRiesgo),
                      enableInsertRow && i % 2 === 1 ? 'row-zebra' : null,
                    ].filter(Boolean).join(' ') || undefined}
                  >
                    {columns.map(col => renderCell(p, col))}
                  </tr>
                  {showInsertGap && (
                    <tr className="insert-gap-row">
                      <td colSpan={columns.length} className="insert-gap-cell">
                        <span className="insert-gap-hit">
                          <button
                            type="button"
                            className="insert-row-btn"
                            aria-label="Insertar proceso aquí"
                            title="Insertar proceso aquí"
                            onClick={() => onInsertRow(p, visibleRows[i + 1])}
                          >
                            +
                          </button>
                        </span>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        )}
      </table>
    </div>
  )
}
