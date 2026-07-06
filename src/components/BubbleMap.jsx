import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { esAtencion } from '../constants'

const RADIUS = 44
const RADIUS_ATENCION = RADIUS * 1.4
const GAP = 24
const MARGIN_SIDE = 32
const MARGIN_TOP = 110 // deja espacio libre para la leyenda superior
const MARGIN_BOTTOM = 32

const RISK_FILL = '#7F1D1D'
const RISK_STROKE = '#EF4444'
const NEUTRAL_FILL = '#1E2A50'
const NEUTRAL_STROKE = '#3A4278'
const ARROW_COLOR = '#8B96AE'
const ARROW_OPACITY = 0.35

function ordenValue(p) {
  const n = parseInt(p.orden, 10)
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n
}

function radiusOf(d) {
  return esAtencion(d.tipo) ? RADIUS_ATENCION : RADIUS
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

      const cellSize = RADIUS_ATENCION * 2 + GAP
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
        .attr('r', d => (esAtencion(d.tipo) ? RADIUS_ATENCION : RADIUS))
        .attr('fill', d => (esAtencion(d.tipo) ? RISK_FILL : NEUTRAL_FILL))
        .attr('stroke', d => (esAtencion(d.tipo) ? RISK_STROKE : NEUTRAL_STROKE))
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
          .attr('fill', '#E2E8F0')
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

      // Selection ring
      node
        .append('circle')
        .attr('class', 'selection-ring')
        .attr('r', d => (esAtencion(d.tipo) ? RADIUS_ATENCION + 5 : RADIUS + 5))
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
