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

export const PROBABILIDAD = ['Alta', 'Media', 'Baja']

export const IMPACTO = ['Alto', 'Medio', 'Bajo']

export const FRECUENCIA_REVISION = ['Semanal', 'Mensual', 'Trimestral', 'Semestral', 'Sin definir']

// Únicas dos naturalezas que hacen que una fila aparezca en la vista
// "Riesgos" — se recalcula en cada carga a partir de este valor, así que
// una fila deja de mostrarse ahí en cuanto su Naturaleza cambia a otra cosa.
export const NATURALEZA_RIESGOS_VISIBLES = [
  'Riesgo de fraude o control',
  'Riesgo de compliance o regulatorio',
]

export function esRiesgoVisibleEnTab(naturaleza) {
  return NATURALEZA_RIESGOS_VISIBLES.includes(naturaleza)
}

// Columnas compartidas por ambas vistas de tabla; solo cambia cuál de las
// dos columnas de orden va primero (Orden en Procesos, Orden_02 en PM).
// `sticky: true` marca las columnas fijas al hacer scroll horizontal — su
// ancho queda fijo (no solo mínimo) para que el offset acumulado de la
// siguiente columna fija sea siempre correcto.
const SHARED_COLUMNS = [
  { key: 'nombre', label: 'Nombre', width: '160px', sticky: true },
  { key: 'tipo', label: 'Tipo', width: '110px', sticky: true },
  { key: 'severidad', label: 'Severidad', width: '110px' },
  { key: 'descripcion', label: 'Descripción', width: '300px', sticky: true },
  { key: 'responsables', label: 'Responsables', width: '130px' },
  { key: 'naturaleza', label: 'Naturaleza', width: '180px' },
  { key: 'tipoIntervencion', label: 'Tipo intervención', width: '180px' },
  { key: 'tratamiento', label: 'Tratamiento', width: '130px' },
  { key: 'estado', label: 'Estado', width: '140px' },
  { key: 'notas', label: 'Notas', width: '220px' },
]

export const COLUMNS_PROCESOS = [
  { key: 'orden', label: 'Orden', width: '70px', sticky: true },
  ...SHARED_COLUMNS,
]

export const COLUMNS_PM = [
  // Encabezado visible como "Priorización" solo en esta vista; la columna
  // real en Sheets sigue llamándose Orden_02 (no se toca la lectura/escritura).
  { key: 'ordenSecundario', label: 'Priorización', width: '70px', sticky: true },
  ...SHARED_COLUMNS,
  // Solo en Project manager — no se agregan a SHARED_COLUMNS para que
  // Procesos no las muestre.
  { key: 'update1', label: 'Update 1', width: '220px' },
  { key: 'update2', label: 'Update 2', width: '220px' },
  { key: 'update3', label: 'Update 3', width: '220px' },
  { key: 'kpis', label: 'KPIs', width: '220px' },
]

// Vista "Riesgos" — filas de Seguimiento filtradas por Naturaleza (ver
// esRiesgoVisibleEnTab). No reutiliza SHARED_COLUMNS: el set y orden de
// columnas es propio de esta vista (columnas Q-X de la hoja).
export const COLUMNS_RIESGOS = [
  { key: 'orden', label: 'Orden', width: '70px', sticky: true },
  { key: 'nombre', label: 'Nombre', width: '160px', sticky: true },
  { key: 'descripcion', label: 'Descripción', width: '260px', sticky: true },
  { key: 'naturaleza', label: 'Naturaleza', width: '200px' },
  { key: 'estado', label: 'Estado', width: '140px' },
  { key: 'responsables', label: 'Responsables', width: '130px' },
  { key: 'tratamiento', label: 'Tratamiento', width: '130px' },
  { key: 'probabilidad', label: 'Probabilidad', width: '110px' },
  { key: 'impacto', label: 'Impacto', width: '110px' },
  { key: 'urgencia', label: 'Urgencia', width: '110px' },
  { key: 'controlPreventivo', label: 'Control preventivo', width: '220px' },
  { key: 'controlDetectivo', label: 'Control detectivo', width: '220px' },
  { key: 'controlCorrectivo', label: 'Control correctivo', width: '220px' },
  { key: 'frecuenciaRevision', label: 'Frecuencia revisión', width: '150px' },
  { key: 'responsableMonitoreo', label: 'Responsable monitoreo', width: '180px' },
]

// Campos editables desde el dashboard, con dropdown de opciones fijas cuando
// aplica (null = texto/número libre). Orden queda fuera a propósito: es de
// solo lectura.
export const EDITABLE_FIELDS = {
  ordenSecundario: null, // número libre, sin validar unicidad
  nombre: null,
  tipo: TIPO_PROCESO,
  severidad: ['', '1', '2', '3'], // solo aplica a Tipo = "Atención"; vacío para "Proceso"
  descripcion: null,
  responsables: null,
  naturaleza: ['', ...NATURALEZA_RIESGO],
  tipoIntervencion: TIPO_INTERVENCION,
  tratamiento: TRATAMIENTO,
  estado: ESTADOS,
  notas: null, // texto libre
  update1: null, // texto libre; ver buildUpdateEntry para el formato de guardado
  update2: null,
  update3: null,
  kpis: null, // texto libre, sin historial acumulado
  probabilidad: PROBABILIDAD,
  impacto: IMPACTO,
  // urgencia queda fuera a propósito: se calcula con una fórmula en la
  // propia hoja de Google Sheets a partir de Probabilidad e Impacto — el
  // dashboard solo la lee, nunca la escribe.
  controlPreventivo: null,
  controlDetectivo: null,
  controlCorrectivo: null,
  frecuenciaRevision: FRECUENCIA_REVISION,
  responsableMonitoreo: null,
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

// Rojo queda reservado exclusivamente para Tipo = Atención.
export const TIPO_STYLE = {
  Atención: { bg: '#EF4444', color: '#FFFFFF' },
  Proceso: { bg: '#D1D5DB', color: '#1F2937' },
}

// Urgencia (Riesgos) es de solo lectura — el valor lo calcula una fórmula
// en la propia hoja a partir de Probabilidad e Impacto. El color solo
// refleja ese valor, no lo interpreta ni lo recalcula.
export const URGENCIA_STYLE = {
  Alta: { bg: '#EF4444', color: '#FFFFFF' },
  Media: { bg: '#F59E0B', color: '#402B00' },
  Baja: { bg: '#4AE54A', color: '#0A2410' },
}

// Paleta de colores para chips de Responsables — nunca rojo (reservado para
// riesgo/Atención). Cada nombre se asigna de forma determinística vía hash,
// así el mismo responsable siempre recibe el mismo color.
const RESPONSABLE_PALETTE = [
  { bg: '#4AE54A', color: '#0A2410' },
  { bg: '#FACC15', color: '#402B00' },
  { bg: '#0FD6F5', color: '#062730' },
  { bg: '#2ADBA4', color: '#062E24' },
  { bg: '#A78BFA', color: '#2E1065' },
  { bg: '#F472B6', color: '#500724' },
  { bg: '#FB923C', color: '#431407' },
  { bg: '#60A5FA', color: '#0B2545' },
]

export function parseResponsables(responsables) {
  return (responsables || '')
    .split(',')
    .map(nombre => nombre.trim())
    .filter(Boolean)
}

export function colorForResponsable(nombre) {
  const key = normalizarTexto(nombre)
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % RESPONSABLE_PALETTE.length
  return RESPONSABLE_PALETTE[index]
}

const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatFechaCorta(date) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mmm = MESES_ABREV[date.getMonth()]
  const yyyy = date.getFullYear()
  return `${dd} ${mmm} ${yyyy}`
}

// Antepone la fecha actual entre corchetes a un texto nuevo (formato
// [DD mmm AAAA]) y lo agrega debajo del contenido previo de la celda,
// separado por salto de línea, en vez de sobreescribirlo — así Update 1/2/3
// acumulan un historial cronológico dentro de la misma celda.
export function buildUpdateEntry(previousValue, newText) {
  const entry = `[${formatFechaCorta(new Date())}] ${newText}`
  return previousValue && previousValue.trim() ? `${previousValue}\n${entry}` : entry
}
