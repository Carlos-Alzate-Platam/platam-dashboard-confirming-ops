import { useState } from 'react'
import { TIPO_PROCESO, NATURALEZA_RIESGO, TIPO_INTERVENCION, TRATAMIENTO, ESTADOS } from '../constants'

const EMPTY_FORM = {
  nombre: '',
  tipo: 'Proceso',
  descripcion: '',
  responsables: '',
  naturaleza: '',
  tipoIntervencion: '',
  tratamiento: '',
  estado: ESTADOS[0],
  notas: '',
}

export default function NewProcessModal({ defaultTipo, onCreate, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, tipo: defaultTipo || EMPTY_FORM.tipo })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await onCreate(form)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Nuevo proceso</h2>
          <button className="panel-close" onClick={onClose} aria-label="Cerrar formulario">×</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              type="text"
              value={form.nombre}
              onChange={e => setField('nombre', e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" value={form.tipo} onChange={e => setField('tipo', e.target.value)}>
              {TIPO_PROCESO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="descripcion">Descripción</label>
            <textarea
              id="descripcion"
              value={form.descripcion}
              onChange={e => setField('descripcion', e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="responsables">Responsables</label>
            <input
              id="responsables"
              type="text"
              value={form.responsables}
              onChange={e => setField('responsables', e.target.value)}
              placeholder="Ej. Santiago, Erika..."
            />
          </div>

          <div className="form-field">
            <label htmlFor="naturaleza">Naturaleza</label>
            <select id="naturaleza" value={form.naturaleza} onChange={e => setField('naturaleza', e.target.value)}>
              <option value="">—</option>
              {NATURALEZA_RIESGO.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="tipoIntervencion">Tipo de intervención</label>
            <select
              id="tipoIntervencion"
              value={form.tipoIntervencion}
              onChange={e => setField('tipoIntervencion', e.target.value)}
            >
              <option value="">—</option>
              {TIPO_INTERVENCION.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="tratamiento">Tratamiento</label>
            <select id="tratamiento" value={form.tratamiento} onChange={e => setField('tratamiento', e.target.value)}>
              <option value="">—</option>
              {TRATAMIENTO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="estado">Estado</label>
            <select id="estado" value={form.estado} onChange={e => setField('estado', e.target.value)}>
              {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="notas">Notas</label>
            <textarea
              id="notas"
              value={form.notas}
              onChange={e => setField('notas', e.target.value)}
            />
          </div>

          {error && <p className="error-message">Error: {error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving || !form.nombre.trim()}>
              {saving ? 'Guardando...' : 'Guardar proceso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
