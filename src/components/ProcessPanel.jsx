import { esRiesgoVisibleEnTab } from '../constants'

function Field({ label, value, isRisk }) {
  return (
    <div className="panel-field">
      <label>{label}</label>
      {value ? (
        isRisk ? (
          <div className="risk-badge">
            <span className="risk-dot" />
            {value}
          </div>
        ) : (
          <p>{value}</p>
        )
      ) : (
        <p className="empty">—</p>
      )}
    </div>
  )
}

export default function ProcessPanel({ process, onClose }) {
  if (!process) return null

  const riesgo = esRiesgoVisibleEnTab(process.naturaleza)

  return (
    <aside className="process-panel" aria-label="Detalle del proceso">
      <div className="panel-header">
        <h2 className="panel-title">{process.nombre || 'Sin nombre'}</h2>
        <button className="panel-close" onClick={onClose} aria-label="Cerrar panel">
          ×
        </button>
      </div>
      <div className="panel-body">
        <Field label="Descripción" value={process.descripcion} />
        <Field
          label="Naturaleza"
          value={process.naturaleza}
          isRisk={riesgo}
        />
        <Field label="Tipo de intervención" value={process.tipoIntervencion} />
        <Field label="Responsables" value={process.responsables} />
        <Field label="Tratamiento" value={process.tratamiento} />
      </div>
    </aside>
  )
}
