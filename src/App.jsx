import React, { useState, useEffect, useMemo } from 'react';
import PagePrincipalCalidad from './components/PagePrincipalCalidad';
import Page1Operaciones from './components/Page1Operaciones';
import Page2TrazabilidadVS from './components/Page2TrazabilidadVS';
import Page3Ranking from './components/Page3Ranking';
import FileUploadModal from './components/FileUploadModal';
import { calculateAvailableDates, countRecordsInDateRange, filterDataset, getLatestComparableDateFilters, purgeDatesFromDataset } from './utils/dataProcessor';
import { 
  BarChart3, 
  GitCompare, 
  LayoutDashboard,
  Trophy, 
  UploadCloud
} from 'lucide-react';
import EditableTitle from './components/EditableTitle';

import { getStoredDataset, saveStoredDataset } from './utils/db';

export default function App() {
  const [activeTab, setActiveTab] = useState('principal');
  const [rawDataset, setRawDataset] = useState({ mercado: [], bodega_camiones: [], bodega_observaciones: [], bodega_faltantes_sobrantes: [], loaded_files: [], available_dates: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Global Filter State
  const [filters, setFilters] = useState({
    mercadoDateStart: '',
    mercadoDateEnd: '',
    bodegaDateStart: '',
    bodegaDateEnd: '',
    errorType: 'TODOS',
    advisor: 'TODOS',
    searchQuery: ''
  });

  // Fetch / restore dataset from persistent IndexedDB or fallback to public/data.json
  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      try {
        // 1. First priority: Check if user has saved data in persistent IndexedDB
        const storedDataset = await getStoredDataset();
        if (storedDataset && (
          (storedDataset.mercado && storedDataset.mercado.length > 0) ||
          (storedDataset.bodega_camiones && storedDataset.bodega_camiones.length > 0) ||
          (storedDataset.loaded_files && storedDataset.loaded_files.length > 0)
        )) {
          console.log("Restaurando dataset persistente de IndexedDB:", storedDataset.loaded_files?.length, "archivos");
          setRawDataset(storedDataset);
          setFilters(prev => ({
            ...prev,
            ...getLatestComparableDateFilters(storedDataset)
          }));
          setIsLoading(false);
          return;
        }

        // 2. Only if no saved dataset exists (fresh launch), load initial public/data.json
        console.log("Inicializando dataset base desde data.json...");
        const dataUrl = `${import.meta.env.BASE_URL}data.json`;
        const response = await fetch(dataUrl);
        if (!response.ok) {
          throw new Error(`Status HTTP: ${response.status}`);
        }
        const data = await response.json();
        const initialFiles = data.loaded_files && data.loaded_files.length > 0 ? data.loaded_files : [
          {
            fileName: 'Cruces y Faltantes Mercado.xlsx',
            fileType: 'Mercado (Cruces & Reclamos)',
            recordsCount: (data.mercado || []).length,
            startDate: 'Enero 2026',
            endDate: 'Actualidad'
          }
        ];
        const nextData = {
          ...data,
          loaded_files: initialFiles,
          available_dates: calculateAvailableDates(data)
        };

        // Immediately persist to IndexedDB so subsequent reloads restore everything
        await saveStoredDataset(nextData);

        setRawDataset(nextData);
        setFilters(prev => ({
          ...prev,
          ...getLatestComparableDateFilters(nextData)
        }));
      } catch (err) {
        console.error("Error cargando dataset:", err);
        setLoadError("No se pudo inicializar los datos del dashboard.");
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const filteredData = useMemo(() => {
    return filterDataset(rawDataset, filters);
  }, [rawDataset, filters]);

  const allAdvisorNames = useMemo(() => {
    const set = new Set();
    (rawDataset.mercado || []).forEach(m => {
      if (m.distribuidor) set.add(m.distribuidor);
      if (m.asesor) set.add(m.asesor);
    });
    (rawDataset.bodega_camiones || []).forEach(b => { 
      if (b.usuario_bodega) set.add(b.usuario_bodega);
      if (b.usuario_control) set.add(b.usuario_control);
      if (b.usuario_despacho) set.add(b.usuario_despacho);
    });
    return Array.from(set).filter(n => n && n !== 'Sin Usuario' && n !== 'Sin Nombre').sort();
  }, [rawDataset]);

  const handleDataUploaded = (newParsedData) => {
    const results = Array.isArray(newParsedData) ? newParsedData : [newParsedData];
    if (results.length === 0) return;

    setRawDataset(prev => {
      let allMercado = [];
      let allCamiones = [];
      let allObs = [];
      let allFS = [];
      const newFilesMeta = [];

      for (const res of results) {
        const m = res.mercado || [];
        const bc = res.bodega_camiones || [];
        const bo = res.bodega_observaciones || [];
        const bfs = res.bodega_faltantes_sobrantes || [];
        const count = m.length + bc.length + bo.length + bfs.length;
        if (count === 0) continue;

        allMercado = [...allMercado, ...m];
        allCamiones = [...allCamiones, ...bc];
        allObs = [...allObs, ...bo];
        allFS = [...allFS, ...bfs];

        const dates = [...m, ...bc, ...bo, ...bfs].map(i => i.fecha).filter(Boolean).sort();
        newFilesMeta.push({
          fileName: res.fileName || 'Archivo Subido',
          fileType: m.length > 0 ? 'Mercado' : 'Bodega Informe',
          recordsCount: count,
          startDate: dates[0] || 'Nuevo',
          endDate: dates[dates.length - 1] || 'Nuevo'
        });
      }

      const newFileNames = new Set(newFilesMeta.map(f => f.fileName));
      const remainingOldFiles = (prev.loaded_files || []).filter(f => !newFileNames.has(f.fileName));

      const nextDataset = {
        mercado: [...allMercado, ...(prev.mercado || [])],
        bodega_camiones: [...allCamiones, ...(prev.bodega_camiones || [])],
        bodega_observaciones: [...allObs, ...(prev.bodega_observaciones || [])],
        bodega_faltantes_sobrantes: [...allFS, ...(prev.bodega_faltantes_sobrantes || [])],
        loaded_files: [...newFilesMeta, ...remainingOldFiles]
      };

      const finalDataset = {
        ...nextDataset,
        available_dates: calculateAvailableDates(nextDataset)
      };

      saveStoredDataset(finalDataset).catch(error => console.error('No se pudo guardar el dataset:', error));
      return finalDataset;
    });
  };

  const handleFileRemoved = (fileName) => {
    setRawDataset(prev => {
      const isCrucesDefault = fileName === 'Cruces y Faltantes Mercado.xlsx' || fileName.toLowerCase().includes('cruces');
      
      const nextMercado = (prev.mercado || []).filter(item => {
        if (item.source_file) return item.source_file !== fileName;
        if (isCrucesDefault) return false;
        return true;
      });

      const nextCamiones = (prev.bodega_camiones || []).filter(item => item.source_file !== fileName);
      const nextObservaciones = (prev.bodega_observaciones || []).filter(item => item.source_file !== fileName);
      const nextFaltantes = (prev.bodega_faltantes_sobrantes || []).filter(item => item.source_file !== fileName);
      const nextFiles = (prev.loaded_files || []).filter(file => file.fileName !== fileName);

      const nextDataset = {
        mercado: nextMercado,
        bodega_camiones: nextCamiones,
        bodega_observaciones: nextObservaciones,
        bodega_faltantes_sobrantes: nextFaltantes,
        loaded_files: nextFiles
      };

      const finalDataset = {
        ...nextDataset,
        available_dates: calculateAvailableDates(nextDataset)
      };
      saveStoredDataset(finalDataset).catch(error => console.error('No se pudo guardar el dataset:', error));
      return finalDataset;
    });
  };

  const handleDatesDeleted = (startDate, endDate) => {
    const finalEndDate = endDate || startDate;
    const summary = countRecordsInDateRange(rawDataset, startDate, finalEndDate);
    if (summary.total > 0) {
      setRawDataset(prev => {
        const nextDataset = purgeDatesFromDataset(prev, startDate, finalEndDate);
        saveStoredDataset(nextDataset).catch(error => console.error('No se pudo guardar el dataset:', error));
        return nextDataset;
      });
    }
    return summary;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navbar */}
      <header className="navbar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}embol-logo.png`} alt="Embol" className="logo-badge" />
          <div>
            <EditableTitle id="navbar_brand_title" defaultTitle="Control Interno Coca-Cola" tag="div" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }} />
            <EditableTitle id="navbar_brand_subtitle" defaultTitle="Operaciones, Reclamos & Trazabilidad" tag="div" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} />
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'principal' ? 'active' : ''}`}
            onClick={() => setActiveTab('principal')}
          >
            <LayoutDashboard size={18} />
            Principal
          </button>

          <button
            className={`tab-btn ${activeTab === 'operaciones' ? 'active' : ''}`}
            onClick={() => setActiveTab('operaciones')}
          >
            <BarChart3 size={18} />
            Pag 1: Operaciones Internas
          </button>

          <button
            className={`tab-btn ${activeTab === 'vs_trazabilidad' ? 'active' : ''}`}
            onClick={() => setActiveTab('vs_trazabilidad')}
          >
            <GitCompare size={18} />
            Pag 2: Control Bodega VS Mercado
          </button>

          <button
            className={`tab-btn ${activeTab === 'ranking' ? 'active' : ''}`}
            onClick={() => setActiveTab('ranking')}
          >
            <Trophy size={18} />
            Pag 3: Ranking & Tendencias
          </button>
        </nav>

        {/* File Upload Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => setIsUploadOpen(true)}>
            <UploadCloud size={18} />
            Subir Archivos & Fechas
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '1600px', width: '100%', margin: '0 auto' }}>
        
        {/* Loading Spinner */}
        {isLoading && (
          <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #E61D2B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>Cargando datos operacionales Coca-Cola...</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Consolidando Mercado y Bodega por mes y fecha</p>
          </div>
        )}

        {loadError && !isLoading && (
          <div style={{ padding: '1rem 1.5rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px', color: '#FCA5A5', marginBottom: '1.5rem' }}>
            {loadError}
          </div>
        )}

        {!isLoading && (
          <>
            {activeTab === 'principal' && (
              <PagePrincipalCalidad
                dataset={rawDataset}
              />
            )}

            {activeTab === 'operaciones' && (
              <Page1Operaciones
                filteredData={filteredData}
                filters={filters}
                setFilters={setFilters}
                allAdvisors={allAdvisorNames}
              />
            )}

            {activeTab === 'vs_trazabilidad' && (
              <Page2TrazabilidadVS
                filteredData={filteredData}
              />
            )}

            {activeTab === 'ranking' && (
              <Page3Ranking
                filteredData={filteredData}
              />
            )}
          </>
        )}
      </main>

      <footer style={{ padding: '1.25rem 2rem', borderTop: '1px solid var(--border-light)', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', background: 'rgba(11, 14, 20, 0.95)' }}>
        Dashboard de Control Interno y Auditoría de Operaciones Diarias | Coca-Cola Bolivia © {new Date().getFullYear()}
      </footer>

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDataUploaded={handleDataUploaded}
        onDatesDeleted={handleDatesDeleted}
        onFileRemoved={handleFileRemoved}
        loadedFiles={rawDataset.loaded_files}
        availableDates={rawDataset.available_dates}
      />

    </div>
  );
}
