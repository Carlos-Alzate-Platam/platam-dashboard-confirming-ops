import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { esAtencion, parseResponsables, colorForResponsable } from '../constants'

const RADIUS = 44
// Tamaño por Severidad (1/2/3) para procesos de Atención. Los saltos son
// deliberadamente grandes para que la diferencia sea evidente a simple
// vista, no sutil. Severidad ausente o inválida cae al nivel 1.
const SEVERIDAD_RADIUS = { 1: 58, 2: 76, 3: 96 }
const RADIUS_ATENCION_MAX = Math.max(...Object.values(SEVERIDAD_RADIUS))
const GAP = 24
const MARGIN_SIDE = 32
const MARGIN_TOP = 110 // deja espacio libre para la leyenda superior
const MARGIN_BOTTOM = 32

// Gradación de rojo por Severidad — de claro a oscuro e intenso, para que
// los tres niveles no se confundan entre sí a simple vista. El texto de la
// burbuja cambia a oscuro en el nivel 1 porque el fondo claro no tiene
// suficiente contraste con el texto claro que usan los niveles 2 y 3.
const SEVERIDAD_COLOR = {
  1: { fill: '#FCA5A5', stroke: '#F87171', text: '#7F1D1D' },
  2: { fill: '#DC2626', stroke: '#991B1B', text: '#FEF2F2' },
  3: { fill: '#7F1D1D', stroke: '#450A0A', text: '#FEF2F2' },
}
const NEUTRAL_FILL = '#1E2A50'
const NEUTRAL_STROKE = '#3A4278'
const NEUTRAL_TEXT = '#E2E8F0'
const ARROW_COLOR = '#8B96AE'
const ARROW_OPACITY = 0.35

// Etiqueta de Responsables encima de la burbuja. Tamaño de fuente fijo y
// pequeño (no escala con el radio) para que quepa incluso en la burbuja
// más chica; el límite de caracteres es una heurística simple, igual a la
// que ya usa el label de Nombre más abajo.
const RESPONSABLE_FONT_SIZE = '9px'
const RESPONSABLE_MAX_CHARS = 12
const RESPONSABLE_SEPARATOR_COLOR = '#8B96AE'

function ordenValue(p) {
  const n = parseInt(p.orden, 10)
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n
}

function severidadNivel(d) {
  const severidad = parseInt(d.severidad, 10)
  return SEVERIDAD_COLOR[severidad] ? severidad : 1
}

function radiusOf(d) {
  if (!esAtencion(d.tipo)) return RADIUS
  return SEVERIDAD_RADIUS[severidadNivel(d)]
}

function colorsOf(d) {
  if (!esAtencion(d.tipo)) return { fill: NEUTRAL_FILL, stroke: NEUTRAL_STROKE, text: NEUTRAL_TEXT }
  return SEVERIDAD_COLOR[severidadNivel(d)]
}

export default function BubbleMap({ processes, onSelect, selectedId }) {
  const svgRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Redibuja en cada cambio de datos y también al redimensionar el
  // contenedor (resize de ventana o giro de pantalla en móvil), para que
  // el número de columnas de la cuadrícula siempre siga el ancho actual.
  useEffect(() => {
    if (!svgRef.current) return

    if (!processes.length) {
      d3.select(svgRef.current).selectAll('*').remove()
      return
    }

    const container = svgRef.current.parentElement

    function draw() {
      const svg = d3.select(svgRef.current)
      svg.selectAll('*').remove()

      const containerWidth = container.clientWidth || 800
      const containerHeight = container.clientHeight || 600

      const cellSize = RADIUS_ATENCION_MAX * 2 + GAP
      const cols = Math.max(1, Math.floor((containerWidth - MARGIN_SIDE * 2) / cellSize))

      const nodes = [...processes]
        .sort((a, b) => ordenValue(a) - ordenValue(b))
        .map((p, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          return {
            ...p,
            col,
            row,
            x: MARGIN_SIDE + cellSize / 2 + col * cellSize,
            y: MARGIN_TOP + cellSize / 2 + row * cellSize,
          }
        })

      const rows = Math.max(1, Math.ceil(nodes.length / cols))
      const contentHeight = MARGIN_TOP + rows * cellSize + MARGIN_BOTTOM
      const svgHeight = Math.max(containerHeight, contentHeight)

      svg
        .attr('width', containerWidth)
        .style('height', `${svgHeight}px`)

      const defs = svg.append('defs')
      defs.append('marker')
        .attr('id', 'sequence-arrow')
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 8)
        .attr('refY', 5)
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', 'M 0 0 L 10 5 L 0 10 z')
        .attr('fill', ARROW_COLOR)
        .attr('fill-opacity', ARROW_OPACITY)

      const g = svg.append('g')

      // Flechas de secuencia (Orden N -> Orden N+1), dibujadas debajo de las burbujas
      const arrows = g.append('g').attr('class', 'sequence-arrows')
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i]
        const b = nodes[i + 1]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (!dist) continue

        const ux = dx / dist
        const uy = dy / dist
        const startOffset = radiusOf(a) + 3
        const endOffset = radiusOf(b) + 10

        arrows
          .append('line')
          .attr('x1', a.x + ux * startOffset)
          .attr('y1', a.y + uy * startOffset)
          .attr('x2', b.x - ux * endOffset)
          .attr('y2', b.y - uy * endOffset)
          .attr('stroke', ARROW_COLOR)
          .attr('stroke-opacity', ARROW_OPACITY)
          .attr('stroke-width', 1.5)
          .attr('marker-end', 'url(#sequence-arrow)')
      }

      const node = g
        .selectAll('g.bubble')
        .data(nodes)
        .join('g')
        .attr('class', 'bubble')
        .style('cursor', 'pointer')
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .on('click', (event, d) => {
          event.stopPropagation()
          onSelectRef.current(d)
        })

      node
        .append('circle')
        .attr('r', d => radiusOf(d))
        .attr('fill', d => colorsOf(d).fill)
        .attr('stroke', d => colorsOf(d).stroke)
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.9)

      // Glow para burbujas de atención
      node
        .filter(d => esAtencion(d.tipo))
        .select('circle')
        .style('filter', 'drop-shadow(0 0 6px rgba(239,68,68,0.4))')

      // Label — two lines if needed
      node.each(function(d) {
        const label = d.nombre || ''
        const words = label.split(' ')
        const maxChars = 12

        const el = d3.select(this)
        const text = el.append('text')
          .attr('text-anchor', 'middle')
          .attr('fill', colorsOf(d).text)
          .attr('font-family', 'Lato, system-ui, sans-serif')
          .attr('font-size', '11px')
          .attr('font-weight', '700')
          .attr('pointer-events', 'none')

        if (label.length <= maxChars) {
          text.append('tspan').attr('x', 0).attr('dy', '0.35em').text(label)
        } else {
          // Simple two-line split
          const mid = Math.floor(words.length / 2) || 1
          const line1 = words.slice(0, mid).join(' ')
          const line2 = words.slice(mid).join(' ')
          text.append('tspan').attr('x', 0).attr('dy', '-0.6em').text(
            line1.length > 14 ? line1.slice(0, 13) + '…' : line1
          )
          text.append('tspan').attr('x', 0).attr('dy', '1.3em').text(
            line2.length > 14 ? line2.slice(0, 13) + '…' : line2
          )
        }
      })

      // Etiqueta de Responsables encima de la burbuja — mismo color que ya
      // se le asigna a cada persona en los chips de Responsables de las
      // tablas (colorForResponsable), para que el color sea consistente en
      // todo el dashboard, no uno nuevo inventado acá.
      node.each(function(d) {
        const nombres = parseResponsables(d.responsables)
        if (!nombres.length) return

        const visible = []
        let used = 0
        for (const nombre of nombres) {
          const addLen = nombre.length + (visible.length ? 2 : 0) // ", "
          if (visible.length && used + addLen > RESPONSABLE_MAX_CHARS) break
          visible.push(nombre)
          used += addLen
        }
        const hiddenCount = nombres.length - visible.length

        const el = d3.select(this)
        const text = el.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -(radiusOf(d) + 4))
          .attr('font-family', 'Lato, system-ui, sans-serif')
          .attr('font-size', RESPONSABLE_FONT_SIZE)
          .attr('font-weight', '700')
          .attr('pointer-events', 'none')

        visible.forEach((nombre, i) => {
          if (i > 0) {
            text.append('tspan').attr('fill', RESPONSABLE_SEPARATOR_COLOR).text(', ')
          }
          const soloUno = visible.length === 1 && hiddenCount === 0
          const display = soloUno && nombre.length > RESPONSABLE_MAX_CHARS
            ? nombre.slice(0, RESPONSABLE_MAX_CHARS - 1) + '…'
            : nombre
          text.append('tspan').attr('fill', colorForResponsable(nombre).bg).text(display)
        })

        if (hiddenCount > 0) {
          text.append('tspan').attr('fill', RESPONSABLE_SEPARATOR_COLOR).text(` +${hiddenCount}`)
        }
      })

      // Selection ring
      node
        .append('circle')
        .attr('class', 'selection-ring')
        .attr('r', d => radiusOf(d) + 5)
        .attr('fill', 'none')
        .attr('stroke', '#0FD6F5')
        .attr('stroke-width', 2)
        .attr('opacity', d => d.sheetRow === selectedId ? 1 : 0)
        .attr('pointer-events', 'none')

      // Click on background deselects
      svg.on('click', () => onSelectRef.current(null))
    }

    draw()

    const resizeObserver = new ResizeObserver(() => draw())
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [processes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update selection ring without rebuilding the grid
  useEffect(() => {
    if (!svgRef.current) return
    d3.select(svgRef.current)
      .selectAll('.selection-ring')
      .attr('opacity', d => d.sheetRow === selectedId ? 1 : 0)
  }, [selectedId])

  return <svg ref={svgRef} />
}
