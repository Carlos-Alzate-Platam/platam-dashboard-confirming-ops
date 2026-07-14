import { VISTA_PROCESO } from '../constants'

const OPTIONS = [
  { value: VISTA_PROCESO.ACTUAL, label: 'Proceso Actual' },
  { value: VISTA_PROCESO.IDEAL, label: 'Proceso Ideal' },
]

// Selector de vista (Procesos, Mapa de procesos) — dos opciones mutuamente
// excluyentes, por eso es un toggle de selección única y no una fila de
// pills multi-selección como estado-filter-bar (Project manager).
export default function ProcesoVistaToggle({ value, onChange }) {
  return (
    <div className="vista-toggle" role="tablist" aria-label="Filtro de vista de proceso">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`vista-toggle-btn${value === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
