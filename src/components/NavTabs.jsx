export default function NavTabs({ active, onChange }) {
  return (
    <nav className="nav-tabs" aria-label="Vistas">
      <button
        className={`nav-tab${active === 'table' ? ' active' : ''}`}
        onClick={() => onChange('table')}
        aria-current={active === 'table' ? 'page' : undefined}
      >
        Tabla de gestión
      </button>
      <button
        className={`nav-tab${active === 'map' ? ' active' : ''}`}
        onClick={() => onChange('map')}
        aria-current={active === 'map' ? 'page' : undefined}
      >
        Mapa de procesos
      </button>
    </nav>
  )
}
