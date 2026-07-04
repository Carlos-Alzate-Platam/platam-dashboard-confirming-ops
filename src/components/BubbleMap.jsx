import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { esRiesgo } from '../constants'

const RADIUS = 48
const RISK_FILL = '#7F1D1D'
const RISK_STROKE = '#EF4444'
const NEUTRAL_FILL = '#1E2A50'
const NEUTRAL_STROKE = '#3A4278'

export default function BubbleMap({ processes, onSelect, selectedId }) {
  const svgRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!svgRef.current || !processes.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth || 800
    const height = svgRef.current.clientHeight || 600

    const nodes = processes.map(p => ({ ...p }))

    const simulation = d3.forceSimulation(nodes)
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(RADIUS + 8))
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04))
      .force('charge', d3.forceManyBody().strength(10))

    const g = svg.append('g')

    const node = g
      .selectAll('g.bubble')
      .data(nodes)
      .join('g')
      .attr('class', 'bubble')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation()
        onSelectRef.current(d)
      })

    node
      .append('circle')
      .attr('r', RADIUS)
      .attr('fill', d => (esRiesgo(d.naturaleza) ? RISK_FILL : NEUTRAL_FILL))
      .attr('stroke', d => (esRiesgo(d.naturaleza) ? RISK_STROKE : NEUTRAL_STROKE))
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.9)

    // Glow for risk bubbles
    node
      .filter(d => esRiesgo(d.naturaleza))
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
      .attr('r', RADIUS + 5)
      .attr('fill', 'none')
      .attr('stroke', '#0FD6F5')
      .attr('stroke-width', 2)
      .attr('opacity', d => d.sheetRow === selectedId ? 1 : 0)
      .attr('pointer-events', 'none')

    // Click on background deselects
    svg.on('click', () => onSelectRef.current(null))

    simulation.on('tick', () => {
      node.attr('transform', d => {
        const x = Math.max(RADIUS + 8, Math.min(width - RADIUS - 8, d.x || width / 2))
        const y = Math.max(RADIUS + 8, Math.min(height - RADIUS - 8, d.y || height / 2))
        return `translate(${x},${y})`
      })
    })

    // Run a few ticks before first render to avoid initial overlap flash
    simulation.tick(30)
    node.attr('transform', d => {
      const x = Math.max(RADIUS + 8, Math.min(width - RADIUS - 8, d.x || width / 2))
      const y = Math.max(RADIUS + 8, Math.min(height - RADIUS - 8, d.y || height / 2))
      return `translate(${x},${y})`
    })

    return () => simulation.stop()
  }, [processes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update selection ring without rebuilding the simulation
  useEffect(() => {
    if (!svgRef.current) return
    d3.select(svgRef.current)
      .selectAll('.selection-ring')
      .attr('opacity', d => d.sheetRow === selectedId ? 1 : 0)
  }, [selectedId])

  return <svg ref={svgRef} />
}
