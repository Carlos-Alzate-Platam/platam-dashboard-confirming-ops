import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { esAtencion } from '../constants'

const RADIUS = 44
const RADIUS_ATENCION = RADIUS * 1.4
const GAP = 24
const MARGIN = 32

const RISK_FILL = '#7F1D1D'
const RISK_STROKE = '#EF4444'
const NEUTRAL_FILL = '#1E2A50'
const NEUTRAL_STROKE = '#3A4278'

function ordenValue(p) {
  const n = parseInt(p.orden, 10)
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n
}

export default function BubbleMap({ processes, onSelect, selectedId }) {
  const svgRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!svgRef.current || !processes.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const containerWidth = svgRef.current.parentElement.clientWidth || 800
    const containerHeight = svgRef.current.parentElement.clientHeight || 600

    const cellSize = RADIUS_ATENCION * 2 + GAP
    const cols = Math.max(1, Math.floor((containerWidth - MARGIN * 2) / cellSize))

    const nodes = [...processes]
      .sort((a, b) => ordenValue(a) - ordenValue(b))
      .map((p, i) => ({
        ...p,
        col: i % cols,
        row: Math.floor(i / cols),
      }))

    const rows = Math.max(1, Math.ceil(nodes.length / cols))
    const contentHeight = rows * cellSize + MARGIN * 2
    const svgHeight = Math.max(containerHeight, contentHeight)

    svg
      .attr('width', containerWidth)
      .style('height', `${svgHeight}px`)

    const g = svg.append('g')

    const node = g
      .selectAll('g.bubble')
      .data(nodes)
      .join('g')
      .attr('class', 'bubble')
      .style('cursor', 'pointer')
      .attr('transform', d => {
        const x = MARGIN + cellSize / 2 + d.col * cellSize
        const y = MARGIN + cellSize / 2 + d.row * cellSize
        return `translate(${x},${y})`
      })
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
