export const NATURALEZA_RIESGO = [
  'Riesgo de fraude o control',
  'Riesgo de compliance o regulatorio',
  'Cuello de botella operativo',
  'Vacío de proceso',
  'Dependencia de persona clave',
  'Deuda tecnológica',
]

export const TIPO_INTERVENCION = [
  'Automatización / Herramienta',
  'Rediseño de Control',
  'Definición Organizacional',
  'Solo documentación',
]

export const ESTADOS = [
  'Identificado',
  'En diseño',
  'En construcción',
  'En piloto',
  'Resuelto',
  'Bloqueado',
]

export const TRATAMIENTO = [
  'David',
  'Carlos',
  'Carlos + David',
  'Gerencia',
]

export const TIPO_PROCESO = [
  'Proceso',
  'Atención',
]

// Columnas compartidas por ambas vistas de tabla; solo cambia cuál de las
// dos columnas de orden va primero (Orden en Procesos, Orden_02 en PM).
const SHARED_COLUMNS = [
  { key: 'nombre', label: 'Nombre', width: '160px' },
  { key: 'tipo', label: 'Tipo', width: '110px' },
  { key: 'descripcion', label: 'Descripción', width: '240px' },
  { key: 'responsables', label: 'Responsables', width: '130px' },
  { key: 'naturaleza', label: 'Naturaleza', width: '180px' },
  { key: 'tipoIntervencion', label: 'Tipo intervención', width: '180px' },
  { key: 'tratamiento', label: 'Tratamiento', width: '130px' },
  { key: 'estado', label: 'Estado', width: '140px' },
  { key: 'notas', label: 'Notas', width: '220px' },
]

export const COLUMNS_PROCESOS = [
  { key: 'orden', label: 'Orden', width: '70px' },
  ...SHARED_COLUMNS,
]

export const COLUMNS_PM = [
  { key: 'ordenSecundario', label: 'Orden 02', width: '70px' },
  ...SHARED_COLUMNS,
]

// Campos editables desde el dashboard, con dropdown de opciones fijas cuando aplica.
export const EDITABLE_FIELDS = {
  tipo: TIPO_PROCESO,
  naturaleza: ['', ...NATURALEZA_RIESGO],
  tipoIntervencion: TIPO_INTERVENCION,
  tratamiento: TRATAMIENTO,
  estado: ESTADOS,
  notas: null, // texto libre
}

export function esRiesgo(naturaleza) {
  return Boolean(naturaleza && naturaleza.trim())
}

function normalizarTexto(str) {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '') // quita diacríticos (acentos) tras normalize('NFD')
}

export function esAtencion(tipo) {
  return Boolean(tipo) && normalizarTexto(tipo) === 'atencion'
}

export const ESTADO_STYLE = {
  Resuelto: { color: '#4AE54A', bg: '#0E2A14' },
  'En piloto': { color: '#2ADBA4', bg: '#0A2420' },
  'En construcción': { color: '#2ADBA4', bg: '#0A2420' },
  'En diseño': { color: '#0FD6F5', bg: '#071E28' },
  Identificado: { color: '#0FD6F5', bg: '#071E28' },
  Bloqueado: { color: '#6B7280', bg: '#1A1E2A' },
}
