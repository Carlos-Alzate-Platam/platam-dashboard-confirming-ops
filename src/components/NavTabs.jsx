const TABS = [
  { key: 'procesos', label: 'Procesos' },
  { key: 'map', label: 'Mapa de procesos' },
  { key: 'riesgos', label: 'Riesgos' },
  { key: 'pm', label: 'Project manager' },
]

export default function NavTabs({ active, onChange }) {
  return (
    <nav className="nav-tabs" aria-label="Vistas">
      {TABS.map(tab => (
        <button
          key={tab.key}
          className={`nav-tab${active === tab.key ? ' active' : ''}`}
          onClick={() => onChange(tab.key)}
          aria-current={active === tab.key ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
