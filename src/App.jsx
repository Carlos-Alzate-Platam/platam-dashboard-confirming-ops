import { useState, useMemo } from 'react'
import { useSheets } from './hooks/useSheets'
import NavTabs from './components/NavTabs'
import GestionTable from './components/GestionTable'
import BubbleMap from './components/BubbleMap'
import ProcessPanel from './components/ProcessPanel'
import NewProcessModal from './components/NewProcessModal'
import { COLUMNS_PROCESOS, COLUMNS_PM, COLUMNS_RIESGOS, esRiesgoVisibleEnTab } from './constants'

export default function App() {
  const { processes, loading, error, retry, refreshSilently, updateCell, batchUpdateCells, createProcess } = useSheets()
  const [activeTab, setActiveTab] = useState('procesos')
  const [selectedProcess, setSelectedProcess] = useState(null)
  const [newProcessDefaultTipo, setNewProcessDefaultTipo] = useState(null)

  const pmProcesses = useMemo(
    () => processes.filter(p => p.tipo === 'Atención'),
    [processes]
  )

  const riesgosProcesses = useMemo(
    () => processes.filter(p => esRiesgoVisibleEnTab(p.naturaleza)),
    [processes]
  )

  function handleTabChange(tab) {
    setActiveTab(tab)
    setSelectedProcess(null)
    // Refresca desde Sheets al entrar a una pestaña, para que un campo
    // compartido editado desde otra vista se vea al día sin recargar todo.
    refreshSilently()
  }

  function openNewProcessModal(defaultTipo) {
    setNewProcessDefaultTipo(defaultTipo)
  }

  function closeNewProcessModal() {
    setNewProcessDefaultTipo(null)
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
    } finally {
      window.location.reload()
    }
  }

  return (
    <div className="app">
      <header className="header">
        <img
          className="header-logo-img"
          src="https://rnpfthuoxyvuozcqpjlj.supabase.co/storage/v1/object/public/Brand%20Platam/logo_platam_conf_dark.png"
          alt="Platam Confirming"
        />
        <NavTabs active={activeTab} onChange={handleTabChange} />
        <button className="logout-btn" onClick={handleLogout}>Cerrar sesión</button>
      </header>

      <main className="main">
        {loading && (
          <div className="center-state">
            <div className="spinner" />
            <span>Cargando procesos...</span>
          </div>
        )}

        {!loading && error && (
          <div className="center-state">
            <span className="error-message">Error: {error}</span>
            <button className="retry-btn" onClick={retry}>Reintentar</button>
          </div>
        )}

        {!loading && !error && processes.length === 0 && (
          <div className="center-state">
            <span>Sin procesos registrados en la hoja.</span>
          </div>
        )}

        {!loading && !error && processes.length > 0 && (
          <>
            {activeTab === 'procesos' && (
              <GestionTable
                processes={processes}
                onUpdate={updateCell}
                onAddNew={() => openNewProcessModal('Proceso')}
                columns={COLUMNS_PROCESOS}
                defaultSortKey="orden"
                highlightRiesgo
              />
            )}

            {activeTab === 'pm' && (
              <GestionTable
                processes={pmProcesses}
                onUpdate={updateCell}
                onAddNew={() => openNewProcessModal('Atención')}
                columns={COLUMNS_PM}
                defaultSortKey="ordenSecundario"
                enableDragReorder
                onReorder={batchUpdateCells}
                enableEstadoFilter
                hideAddButton
                highlightRiesgo
              />
            )}

            {activeTab === 'riesgos' && (
              <GestionTable
                processes={riesgosProcesses}
                onUpdate={updateCell}
                columns={COLUMNS_RIESGOS}
                defaultSortKey="orden"
                hideAddButton
              />
            )}

            {activeTab === 'map' && (
              <div className="map-view">
                <div className="map-canvas">
                  <BubbleMap
                    processes={processes}
                    onSelect={setSelectedProcess}
                    selectedId={selectedProcess?.sheetRow}
                  />
                  <div className="map-legend">
                    <div className="legend-item">
                      <div className="legend-dot" style={{ background: '#EF4444' }} />
                      Atención
                    </div>
                    <div className="legend-item">
                      <div className="legend-dot" style={{ background: '#3A4278' }} />
                      Proceso
                    </div>
                  </div>
                  <div className="map-hint">Haz clic en una burbuja para ver el detalle</div>
                </div>
                {selectedProcess && (
                  <ProcessPanel
                    process={selectedProcess}
                    onClose={() => setSelectedProcess(null)}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>

      {newProcessDefaultTipo && (
        <NewProcessModal
          defaultTipo={newProcessDefaultTipo}
          onCreate={createProcess}
          onClose={closeNewProcessModal}
        />
      )}
    </div>
  )
}
