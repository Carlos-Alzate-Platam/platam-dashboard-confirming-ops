import { useState, useMemo } from 'react'
import { useSheets } from './hooks/useSheets'
import NavTabs from './components/NavTabs'
import GestionTable from './components/GestionTable'
import BubbleMap from './components/BubbleMap'
import ProcessPanel from './components/ProcessPanel'
import NewProcessModal from './components/NewProcessModal'
import ProcesoVistaToggle from './components/ProcesoVistaToggle'
import {
  COLUMNS_PROCESOS,
  COLUMNS_PM,
  COLUMNS_RIESGOS,
  esRiesgoVisibleEnTab,
  esVisibleEnVistaProceso,
  VISTA_PROCESO,
  ordenarPorOrdenAscendente,
  buildRenumeracionSecuencial,
} from './constants'

export default function App() {
  const { processes, loading, error, retry, refreshSilently, updateCell, batchUpdateCells, createProcess, deleteRow } = useSheets()
  const [activeTab, setActiveTab] = useState('procesos')
  const [selectedProcess, setSelectedProcess] = useState(null)
  const [newProcessDefaultTipo, setNewProcessDefaultTipo] = useState(null)
  // Filtro "Proceso Actual"/"Proceso Ideal" (Procesos y Mapa de procesos) —
  // se mantiene mientras el usuario navega la app en esta sesión, pero no
  // persiste entre recargas. Riesgos y Project manager no lo usan.
  const [procesoVista, setProcesoVista] = useState(VISTA_PROCESO.ACTUAL)
  // Solo se usa cuando el formulario se abrió desde el botón "+" de insertar
  // entre dos filas (vista Procesos) — ver openInsertRowModal más abajo.
  // null cuando el formulario se abrió desde "+ Nuevo proceso" (alta normal
  // al final de la lista, sin renumerar nada).
  const [insertPosition, setInsertPosition] = useState(null)

  const pmProcesses = useMemo(
    () => processes.filter(p => p.tipo === 'Atención'),
    [processes]
  )

  const riesgosProcesses = useMemo(
    () => processes.filter(p => esRiesgoVisibleEnTab(p.naturaleza)),
    [processes]
  )

  // Solo para Procesos y Mapa de procesos — Riesgos y Project manager siguen
  // su propia lógica de filtro sin importar Actual/Propuesto (ver arriba).
  const procesosVistaFiltrados = useMemo(
    () => processes.filter(p => esVisibleEnVistaProceso(p.tipo, procesoVista)),
    [processes, procesoVista]
  )

  // Si el proceso seleccionado en el Mapa deja de ser visible al cambiar el
  // filtro (ej. era Propuesto y se pasa a "Proceso Actual"), cierra el panel
  // en vez de dejarlo mostrando un proceso que ya no está en el mapa.
  function handleProcesoVistaChange(vista) {
    setProcesoVista(vista)
    setSelectedProcess(prev =>
      prev && !esVisibleEnVistaProceso(prev.tipo, vista) ? null : prev
    )
  }

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

  // Botón "+" entre dos filas consecutivas (vista Procesos, ordenada por
  // Orden). El nuevo Orden toma el valor de la fila de abajo (ej. entre 9 y
  // 10, la nueva queda en 10) y todas las filas con Orden >= ese valor se
  // corren +1 — ver handleCreateProcess, que aplica ese renumerado en un solo
  // batch antes de crear la fila nueva.
  function openInsertRowModal(beforeProcess, afterProcess) {
    const targetOrden = parseInt(afterProcess?.orden, 10)
    if (Number.isNaN(targetOrden)) return

    const renumberUpdates = processes
      .filter(p => {
        const n = parseInt(p.orden, 10)
        return !Number.isNaN(n) && n >= targetOrden
      })
      .map(p => ({ sheetRow: p.sheetRow, field: 'orden', value: String(parseInt(p.orden, 10) + 1) }))

    setInsertPosition({ targetOrden, renumberUpdates })
    setNewProcessDefaultTipo('Propuesto')
  }

  function closeNewProcessModal() {
    setNewProcessDefaultTipo(null)
    setInsertPosition(null)
  }

  // Alta normal ("+ Nuevo proceso") y alta por inserción entre filas
  // comparten el mismo formulario (NewProcessModal) — esta función es la
  // única diferencia: si viene de insertar, primero renumera en batch las
  // filas afectadas y luego crea la fila nueva con el Orden que quedó libre.
  async function handleCreateProcess(form) {
    if (insertPosition) {
      if (insertPosition.renumberUpdates.length) {
        await batchUpdateCells(insertPosition.renumberUpdates)
        // Evita repetir el renumerado si el usuario reintenta el envío tras
        // un error de red en createProcess más abajo.
        setInsertPosition(prev => (prev ? { ...prev, renumberUpdates: [] } : prev))
      }
      await createProcess({ ...form, orden: insertPosition.targetOrden })
    } else {
      await createProcess(form)
    }
  }

  // Botón de basura por fila (vista Procesos): confirma, renumera en batch
  // las filas restantes que quedan después del hueco (misma lógica de
  // renumerado que openInsertRowModal/handleRenumerar, ver constants.js) y
  // solo entonces borra la fila en Sheets. El renumerado se escribe antes de
  // borrar para que sus referencias a sheetRow sigan siendo válidas — borrar
  // la fila después no las invalida, solo desplaza filas hacia arriba.
  async function handleDeleteRow(process) {
    const nombre = process.nombre || 'este proceso'
    if (!window.confirm(`¿Seguro que quieres borrar "${nombre}"? Esta acción no se puede deshacer.`)) {
      return
    }

    const restantes = processes.filter(p => p.sheetRow !== process.sheetRow)
    const renumberUpdates = buildRenumeracionSecuencial(ordenarPorOrdenAscendente(restantes))

    try {
      if (renumberUpdates.length) {
        await batchUpdateCells(renumberUpdates)
      }
      await deleteRow(process.sheetRow)
    } catch (err) {
      console.error('Error al borrar el proceso:', err)
    }
  }

  // Botón "Renumerar" (vista Procesos): respaldo manual para corregir Orden
  // ante cualquier desincronización (ediciones directas en Sheets u otra
  // causa) — misma lógica de renumerado que usan el botón "+" y la basura.
  async function handleRenumerar() {
    const renumberUpdates = buildRenumeracionSecuencial(ordenarPorOrdenAscendente(processes))
    if (!renumberUpdates.length) return

    try {
      await batchUpdateCells(renumberUpdates)
    } catch (err) {
      console.error('Error al renumerar:', err)
    }
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
                processes={procesosVistaFiltrados}
                onUpdate={updateCell}
                onAddNew={() => openNewProcessModal('Proceso')}
                columns={COLUMNS_PROCESOS}
                defaultSortKey="orden"
                highlightRiesgo
                enableInsertRow
                onInsertRow={openInsertRowModal}
                enableDeleteRow
                onDeleteRow={handleDeleteRow}
                enableRenumerar
                onRenumerar={handleRenumerar}
                filterBar={<ProcesoVistaToggle value={procesoVista} onChange={setProcesoVista} />}
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
              <div className="map-view-container">
                <div className="map-toolbar">
                  <ProcesoVistaToggle value={procesoVista} onChange={handleProcesoVistaChange} />
                </div>
                <div className="map-view">
                  <div className="map-canvas">
                    <BubbleMap
                      processes={procesosVistaFiltrados}
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
                      <div className="legend-item">
                        <div className="legend-dot legend-dot-dashed" style={{ borderColor: '#818CF8' }} />
                        Propuesto
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
              </div>
            )}
          </>
        )}
      </main>

      {newProcessDefaultTipo && (
        <NewProcessModal
          defaultTipo={newProcessDefaultTipo}
          onCreate={handleCreateProcess}
          onClose={closeNewProcessModal}
        />
      )}
    </div>
  )
}
