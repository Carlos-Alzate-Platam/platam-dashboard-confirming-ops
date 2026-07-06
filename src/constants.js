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
  { key: 'severidad', label: 'Severidad', width: '110px' },
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
  // Encabezado visible como "Priorización" solo en esta vista; la columna
  // real en Sheets sigue llamándose Orden_02 (no se toca la lectura/escritura).
  { key: 'ordenSecundario', label: 'Priorización', width: '70px' },
  ...SHARED_COLUMNS,
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
