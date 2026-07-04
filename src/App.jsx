import { useState } from 'react'
import { useSheets } from './hooks/useSheets'
import NavTabs from './components/NavTabs'
import GestionTable from './components/GestionTable'
import BubbleMap from './components/BubbleMap'
import ProcessPanel from './components/ProcessPanel'

export default function App() {
  const { processes, loading, error, retry, updateCell } = useSheets()
  const [activeTab, setActiveTab] = useState('table')
  const [selectedProcess, setSelectedProcess] = useState(null)

  function handleTabChange(tab) {
    setActiveTab(tab)
    setSelectedProcess(null)
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="header-logo">Platam</div>
          <div className="header-subtitle">Confirming ops</div>
        </div>
        <NavTabs active={activeTab} onChange={handleTabChange} />
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
            {activeTab === 'table' && (
              <GestionTable processes={processes} onUpdate={updateCell} />
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
                      Proceso con riesgo identificado
                    </div>
                    <div className="legend-item">
                      <div className="legend-dot" style={{ background: '#3A4278' }} />
                      Sin riesgo clasificado
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
    </div>
  )
}
