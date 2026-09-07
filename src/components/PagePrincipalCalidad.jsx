import { useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import { 
  getBodegaPeriodOptions, 
  getMercadoErrorDetails, 
  getMercadoPeriodOptions, 
  getQualityDashboardData 
} from '../utils/dataProcessor';
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  Camera,
  CheckCircle,
  ClipboardList,
  Package,
  Percent,
  ShieldCheck,
  UploadCloud,
  X,
  Calendar,
  Filter
} from 'lucide-react';

const PHOTO_STORAGE_KEY = 'coca_quality_error_photos_v1';

const PHOTO_SLOTS = [
  { id: 'producto', label: 'Producto' },
  { id: 'cantidad', label: 'Cantidad' },
  { id: 'pallet', label: 'Pallet' },
  { id: 'otro', label: 'Otro' }
];

function formatPercent(value) {
  const numeric = Number(value) || 0;
  return `${Number.isInteger(numeric) ? numeric.toFixed(0) : numeric.toFixed(1)}%`;
}

function formatDateLabel(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatPeriod(period) {
  if (!period?.start || !period?.end) return 'Periodo disponible';
  if (period.start === period.end) return `Periodo: ${formatDateLabel(period.start)}`;
  return `Periodo: ${formatDateLabel(period.start)} a ${formatDateLabel(period.end)}`;
}

function loadStoredPhotos() {
  try {
    return JSON.parse(window.localStorage.getItem(PHOTO_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function resolveSelectedPeriod(period, options) {
  const year = period.year || options.latest?.year || '';
  const months = options.monthsByYear[year] || [];
  const month = period.month === 'TODOS'
    ? 'TODOS'
    : months.some(item => item.value === period.month)
      ? period.month
      : months[months.length - 1]?.value || '';

  return { year, month, months };
}

// Multi-Date / Period Card Filter Component
function CardDateFilter({ 
  mode, 
  setMode, 
  selectedPeriod, 
  months, 
  years, 
  onYearChange, 
  onMonthChange, 
  selectedDates, 
  setSelectedDates, 
  availableDates, 
  prefix 
}) {
  const toggleDate = (dt) => {
    setSelectedDates(prev => prev.includes(dt) ? prev.filter(d => d !== dt) : [...prev, dt]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(15, 20, 30, 0.7)', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
      {/* Mode Toggle Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>FILTRAR POR:</span>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <button
            type="button"
            className={`btn ${mode === 'period' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
            onClick={() => setMode('period')}
          >
            Mes
          </button>
          <button
            type="button"
            className={`btn ${mode === 'multidate' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
            onClick={() => setMode('multidate')}
          >
            Múltiples Fechas {selectedDates.length > 0 && `(${selectedDates.length})`}
          </button>
        </div>
      </div>

      {mode === 'period' ? (
        <div className="quality-card-period-filter" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            Año:
            <select
              className="form-control"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
              value={selectedPeriod.year}
              onChange={(event) => onYearChange(event.target.value)}
              aria-label={`${prefix} año`}
            >
              {years.map(year => (
                <option value={year} key={year}>{year}</option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            Mes:
            <select
              className="form-control"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
              value={selectedPeriod.month}
              onChange={(event) => onMonthChange(event.target.value)}
              aria-label={`${prefix} mes`}
            >
              <option value="TODOS">Todos</option>
              {months.map(month => (
                <option value={month.value} key={month.value}>{month.label}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#60A5FA', fontWeight: 600 }}>
              {selectedDates.length === 0 ? 'Todas las fechas' : `${selectedDates.length} fechas seleccionadas`}
            </span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}
                onClick={() => setSelectedDates([...availableDates])}
              >
                Todas ({availableDates.length})
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}
                onClick={() => setSelectedDates([])}
              >
                Limpiar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxHeight: '80px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {availableDates.map(dt => {
              const isSelected = selectedDates.includes(dt);
              return (
                <button
                  key={dt}
                  type="button"
                  onClick={() => toggleDate(dt)}
                  style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '12px',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: isSelected ? '1px solid #E61D2B' : '1px solid var(--border-light)',
                    background: isSelected ? 'rgba(230, 29, 43, 0.35)' : 'rgba(15, 20, 30, 0.7)',
                    color: isSelected ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  {isSelected ? '✓ ' : ''}{formatDateLabel(dt)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorComparisonColumn({ title, items, tone, maxValue, filter }) {
  return (
    <div className="glass-card quality-error-column">
      <div className="quality-error-column-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {title}
        </h3>
        {filter}
      </div>
      <div className="quality-error-bars">
        {items.map(item => {
          const width = maxValue > 0 ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 4 : 0) : 0;

          return (
            <div className="quality-error-row" key={item.category}>
              <div className="quality-error-label">
                <span>{item.category}</span>
                <strong>{item.value.toLocaleString()}</strong>
              </div>
              <div className="quality-error-track" aria-label={`${item.category}: ${item.value} errores`}>
                <div className={`quality-error-fill ${tone}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MercadoErrorsCard({ title, breakdown, areaCounts, filter }) {
  const [showAll, setShowAll] = useState(false);

  const displayedMotivos = showAll ? breakdown : breakdown.slice(0, 5);
  const maxVal = breakdown.length > 0 ? breakdown[0].count : 1;
  const totalReclamos = breakdown.reduce((acc, curr) => acc + curr.count, 0);

  const renderAreaBadge = (area) => {
    if (area === 'Producción') return <span className="badge badge-produccion" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>Producción</span>;
    if (area === 'Comercialización') return <span className="badge badge-comercializacion" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>Comercialización</span>;
    if (area === 'Bodega') return <span className="badge badge-blue" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>Bodega</span>;
    return <span className="badge badge-faltante" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>Mercado</span>;
  };

  return (
    <div className="glass-card quality-error-column">
      <div className="quality-error-column-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: '#fff' }}>
            {title}
          </h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FF5252' }}>
            {totalReclamos.toLocaleString()} reclamos
          </span>
        </div>

        {/* Porcentajes por Área en este recuadro (Mercado, Bodega, Producción, Comercialización) */}
        {areaCounts && totalReclamos > 0 && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '0.4rem', 
            padding: '0.45rem 0.65rem', 
            background: 'rgba(15, 20, 30, 0.75)', 
            borderRadius: '8px', 
            border: '1px solid var(--border-light)',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>PORCENTAJE POR ÁREA:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              <span className="badge badge-faltante" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                Mercado: <strong>{areaCounts.mercadoPct}%</strong> ({areaCounts.mercado})
              </span>
              <span className="badge badge-blue" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                Bodega: <strong>{areaCounts.bodegaPct}%</strong> ({areaCounts.bodega})
              </span>
              <span className="badge badge-produccion" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                Producción: <strong>{areaCounts.produccionPct}%</strong> ({areaCounts.produccion})
              </span>
              <span className="badge badge-comercializacion" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                Comercialización: <strong>{areaCounts.comercializacionPct}%</strong> ({areaCounts.comercializacion})
              </span>
            </div>
          </div>
        )}

        {filter}
      </div>

      <div className="quality-error-bars">
        {displayedMotivos.length > 0 ? (
          displayedMotivos.map(item => {
            const width = maxVal > 0 ? Math.max((item.count / maxVal) * 100, 4) : 0;

            return (
              <div className="quality-error-row" key={item.motivo} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.3rem', padding: '0.45rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '170px' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#fff' }}>{item.motivo}</strong>
                    {renderAreaBadge(item.mainArea)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <strong style={{ color: '#FF5252', fontSize: '0.85rem' }}>{item.count.toLocaleString()}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({item.percentage}%)</span>
                  </div>
                </div>
                <div className="quality-error-track">
                  <div className="quality-error-fill red" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No hay reclamos de mercado para este filtro
          </div>
        )}
      </div>

      {breakdown.length > 5 && (
        <div style={{ textAlign: 'center', padding: '0.65rem 0 0.25rem 0', borderTop: '1px solid var(--border-light)', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ width: '100%', fontSize: '0.78rem', padding: '0.35rem' }}
            onClick={() => setShowAll(prev => !prev)}
          >
            {showAll ? 'Ver menos ▲' : `Ver todo (${breakdown.length} motivos) ▼`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PagePrincipalCalidad({ dataset }) {
  const [comparisonMode, setComparisonMode] = useState('mensual');
  
  // 1. ERRORES EN PREPARADO (Bodega) filter state (Supports Multi-Date & Month)
  const [bodegaFilterMode, setBodegaFilterMode] = useState('period'); // 'period' | 'multidate'
  const [bodegaPeriod, setBodegaPeriod] = useState({ year: '', month: '' });
  const [selectedBodegaDates, setSelectedBodegaDates] = useState([]);

  // 2. ERRORES EN MERCADO filter state (Supports Multi-Date & Month)
  const [mercadoFilterMode, setMercadoFilterMode] = useState('period'); // 'period' | 'multidate'
  const [mercadoPeriod, setMercadoPeriod] = useState({ year: '', month: '' });
  const [selectedMercadoDates, setSelectedMercadoDates] = useState([]);

  // 3. DETALLE DE ERRORES POR ÁREA filter state (SOLO POR MES)
  const [detallesMonthFilter, setDetallesMonthFilter] = useState('TODOS');

  const [photos, setPhotos] = useState(loadStoredPhotos);
  const [photoNotice, setPhotoNotice] = useState('');

  const { mercado, bodega_observaciones, bodega_faltantes_sobrantes } = dataset;

  // Available unique dates for Bodega
  const availableBodegaDates = useMemo(() => {
    const set = new Set();
    (bodega_observaciones || []).forEach(b => { if (b.fecha) set.add(b.fecha); });
    (bodega_faltantes_sobrantes || []).forEach(b => { if (b.fecha) set.add(b.fecha); });
    return Array.from(set).sort().reverse();
  }, [bodega_observaciones, bodega_faltantes_sobrantes]);

  // Available unique dates for Mercado
  const availableMercadoDates = useMemo(() => {
    const set = new Set();
    (mercado || []).forEach(m => { if (m.fecha) set.add(m.fecha); });
    return Array.from(set).sort().reverse();
  }, [mercado]);

  const mercadoPeriodOptions = useMemo(() => getMercadoPeriodOptions(mercado), [mercado]);
  const bodegaPeriodOptions = useMemo(() => (
    getBodegaPeriodOptions(bodega_observaciones, bodega_faltantes_sobrantes)
  ), [bodega_observaciones, bodega_faltantes_sobrantes]);

  const selectedMercado = resolveSelectedPeriod(mercadoPeriod, mercadoPeriodOptions);
  const selectedBodega = resolveSelectedPeriod(bodegaPeriod, bodegaPeriodOptions);

  // Active filters
  const activeBodegaFilter = useMemo(() => {
    if (bodegaFilterMode === 'multidate' && selectedBodegaDates.length > 0) {
      return { selectedDates: selectedBodegaDates };
    }
    return {
      year: selectedBodega.year,
      month: selectedBodega.month
    };
  }, [bodegaFilterMode, selectedBodegaDates, selectedBodega.year, selectedBodega.month]);

  const activeMercadoFilter = useMemo(() => {
    if (mercadoFilterMode === 'multidate' && selectedMercadoDates.length > 0) {
      return { selectedDates: selectedMercadoDates };
    }
    return {
      year: selectedMercado.year,
      month: selectedMercado.month
    };
  }, [mercadoFilterMode, selectedMercadoDates, selectedMercado.year, selectedMercado.month]);

  // Table filter: ONLY BY MONTH
  const activeDetallesFilter = useMemo(() => {
    if (detallesMonthFilter === 'TODOS' || !detallesMonthFilter) {
      return { year: '', month: 'TODOS' };
    }
    const [yearStr, monthStr] = detallesMonthFilter.split('-');
    return { year: yearStr, month: monthStr };
  }, [detallesMonthFilter]);

  const dashboard = useMemo(() => (
    getQualityDashboardData(mercado, bodega_observaciones, bodega_faltantes_sobrantes, {
      mercado: activeMercadoFilter,
      bodega: activeBodegaFilter
    })
  ), [mercado, bodega_observaciones, bodega_faltantes_sobrantes, activeMercadoFilter, activeMercadoFilter]);

  const mercadoDetails = useMemo(() => (
    getMercadoErrorDetails(mercado, activeDetallesFilter)
  ), [mercado, activeDetallesFilter]);

  const mercadoCardDetails = useMemo(() => (
    getMercadoErrorDetails(mercado, activeMercadoFilter)
  ), [mercado, activeMercadoFilter]);

  const persistPhotos = (nextPhotos) => {
    try {
      window.localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(nextPhotos));
      setPhotoNotice('');
    } catch {
      setPhotoNotice('La foto se muestra en esta sesión, pero el navegador no pudo guardarla localmente.');
    }
  };

  const handlePhotoUpload = (slotId, file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoNotice('Selecciona un archivo de imagen JPG, PNG o WebP.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotos(prev => {
        const nextPhotos = {
          ...prev,
          [slotId]: {
            name: file.name,
            url: reader.result,
            uploadedAt: new Date().toISOString()
          }
        };
        persistPhotos(nextPhotos);
        return nextPhotos;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (slotId) => {
    setPhotos(prev => {
      const nextPhotos = { ...prev };
      delete nextPhotos[slotId];
      persistPhotos(nextPhotos);
      return nextPhotos;
    });
  };

  const kpiCards = [
    {
      label: 'BODEGA',
      value: dashboard.kpis.bodega.toLocaleString(),
      detail: 'Errores prevenidos',
      icon: Package,
      tone: 'green'
    },
    {
      label: 'RECLAMOS',
      value: dashboard.kpis.reclamos.toLocaleString(),
      detail: `Mercado ${mercadoDetails.periodLabel}`,
      icon: AlertTriangle,
      tone: 'red'
    },
    {
      label: 'TOTAL',
      value: dashboard.kpis.total.toLocaleString(),
      detail: 'Bodega + Reclamos',
      icon: Calculator,
      tone: 'blue'
    },
    {
      label: 'PREVENCIÓN',
      value: formatPercent(dashboard.kpis.prevencionPct),
      detail: 'Bodega ÷ Total',
      icon: Percent,
      tone: 'amber'
    }
  ];

  const comparisonData = comparisonMode === 'mensual'
    ? dashboard.monthlyComparison
    : dashboard.dailyComparison;

  const hasComparisonData = [...comparisonData.bodegaSeries, ...comparisonData.mercadoSeries].some(value => value > 0);

  const comparisonOptions = {
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: { show: comparisonMode === 'diaria' },
      zoom: { enabled: comparisonMode === 'diaria' }
    },
    theme: { mode: 'dark' },
    colors: ['#22C55E', '#EF4444'],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: comparisonMode === 'mensual' ? '46%' : '78%',
        borderRadius: 4
      }
    },
    dataLabels: {
      enabled: comparisonMode === 'mensual',
      style: { colors: ['#F8FAFC'], fontFamily: 'Inter', fontWeight: 700 }
    },
    legend: { show: false },
    xaxis: {
      categories: comparisonData.categories,
      labels: {
        rotate: comparisonMode === 'mensual' ? 0 : -70,
        hideOverlappingLabels: true,
        trim: false,
        style: { colors: '#94A3B8', fontSize: comparisonMode === 'mensual' ? '12px' : '10px', fontFamily: 'Inter' }
      },
      tickAmount: comparisonMode === 'mensual' ? undefined : 18
    },
    yaxis: {
      title: {
        text: 'Cantidad de errores',
        style: { color: '#94A3B8', fontFamily: 'Outfit', fontWeight: 700 }
      },
      labels: { style: { colors: '#CBD5E1', fontFamily: 'Inter' } }
    },
    grid: { borderColor: 'rgba(255, 255, 255, 0.08)' },
    tooltip: {
      theme: 'dark',
      shared: true,
      intersect: false,
      x: {
        formatter: (_, opts) => (
          comparisonMode === 'diaria'
            ? comparisonData.dates?.[opts.dataPointIndex] || comparisonData.categories[opts.dataPointIndex]
            : `${comparisonData.categories[opts.dataPointIndex]} ${comparisonData.year}`
        )
      },
      y: { formatter: value => `${value || 0} errores` }
    }
  };

  const comparisonSeries = [
    { name: 'Bodega', data: comparisonData.bodegaSeries },
    { name: 'Mercado', data: comparisonData.mercadoSeries }
  ];

  const maxErrorValue = Math.max(
    1,
    ...dashboard.preparedErrors.map(item => item.value),
    ...mercadoDetails.categoryCounts.map(item => item.value)
  );

  const handleMercadoYearChange = (nextYear) => {
    const nextMonths = mercadoPeriodOptions.monthsByYear[nextYear] || [];
    setMercadoPeriod({
      year: nextYear,
      month: nextMonths[nextMonths.length - 1]?.value || ''
    });
  };

  const handleBodegaYearChange = (nextYear) => {
    const nextMonths = bodegaPeriodOptions.monthsByYear[nextYear] || [];
    setBodegaPeriod({
      year: nextYear,
      month: nextMonths[nextMonths.length - 1]?.value || ''
    });
  };

  return (
    <div className="quality-page animate-fade-in">
      <section className="quality-page-header">
        <div>
          <h1>Dashboard de Control Interno de Calidad</h1>
          <p>Indicadores conectados a los datos cargados de bodega, producción y reclamos de mercado.</p>
        </div>
        <div className="quality-status-badges">
          <span className="quality-live-badge">
            <CheckCircle size={16} />
            Datos dinámicos
          </span>
          <span className="quality-period-badge">
            {formatPeriod(dashboard.period)}
          </span>
        </div>
      </section>

      <section className="kpi-grid quality-kpi-grid">
        {kpiCards.map(card => {
          const Icon = card.icon;
          return (
            <article className={`glass-card kpi-card quality-kpi-card ${card.tone}`} key={card.label}>
              <div className="quality-kpi-topline">
                <div className="kpi-title">{card.label}</div>
                <Icon size={20} />
              </div>
              <div className="kpi-value">{card.value}</div>
              <div className="kpi-sub">{card.detail}</div>
            </article>
          );
        })}
      </section>

      {/* COMPARACIÓN POR MESES Y DÍAS */}
      <section className="glass-card">
        <div className="card-header quality-card-header">
          <div>
            <div className="card-title">
              <BarChart3 size={20} color="#E61D2B" />
              Menú de navegación
            </div>
            <p className="quality-card-caption">Comparación por meses {dashboard.monthlyComparison.year}</p>
          </div>

          <div className="quality-chart-legend" aria-label="Leyenda de series">
            <span><i className="legend-dot green" /> Bodega</span>
            <span><i className="legend-dot red" /> Mercado</span>
          </div>
        </div>

        <div className="card-body quality-comparison-body">
          <div className="quality-subnav" role="tablist" aria-label="Comparación por meses">
            <button
              className={`quality-subnav-btn ${comparisonMode === 'mensual' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={comparisonMode === 'mensual'}
              onClick={() => setComparisonMode('mensual')}
            >
              Comparación por Meses
            </button>
            <button
              className={`quality-subnav-btn ${comparisonMode === 'diaria' ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={comparisonMode === 'diaria'}
              onClick={() => setComparisonMode('diaria')}
            >
              Comparación de Meses 2
            </button>
          </div>

          {hasComparisonData ? (
            <Chart
              key={comparisonMode}
              options={comparisonOptions}
              series={comparisonSeries}
              type="bar"
              height={comparisonMode === 'mensual' ? 330 : 430}
            />
          ) : (
            <div className="quality-empty-state">No hay datos para MAY, JUN, JUL y AGO en el año seleccionado.</div>
          )}
        </div>
      </section>

      {/* CUADROS DE ERRORES EN PREPARADO (BODEGA) Y ERRORES EN MERCADO CON SELECCIÓN MÚLTIPLE DE FECHAS */}
      <section className="quality-error-section">
        
        {/* 1. ERRORES EN PREPARADO (BODEGA) - MULTI-FECHAS Y MES */}
        <ErrorComparisonColumn
          title="ERRORES EN PREPARADO (BODEGA)"
          items={dashboard.preparedErrors}
          maxValue={maxErrorValue}
          tone="green"
          filter={(
            <CardDateFilter
              mode={bodegaFilterMode}
              setMode={setBodegaFilterMode}
              selectedPeriod={selectedBodega}
              months={selectedBodega.months}
              years={bodegaPeriodOptions.years}
              onYearChange={handleBodegaYearChange}
              onMonthChange={(month) => setBodegaPeriod(prev => ({ ...prev, month }))}
              selectedDates={selectedBodegaDates}
              setSelectedDates={setSelectedBodegaDates}
              availableDates={availableBodegaDates}
              prefix="Errores en preparado"
            />
          )}
        />

        {/* 2. ERRORES EN MERCADO - MOTIVO REPORTE Y ÁREA CON MÚLTIPLES FECHAS Y VER TODO */}
        <MercadoErrorsCard
          title="ERRORES EN MERCADO"
          breakdown={mercadoCardDetails.breakdown}
          areaCounts={mercadoCardDetails.areaCounts}
          filter={(
            <CardDateFilter
              mode={mercadoFilterMode}
              setMode={setMercadoFilterMode}
              selectedPeriod={selectedMercado}
              months={selectedMercado.months}
              years={mercadoPeriodOptions.years}
              onYearChange={handleMercadoYearChange}
              onMonthChange={(month) => setMercadoPeriod(prev => ({ ...prev, month }))}
              selectedDates={selectedMercadoDates}
              setSelectedDates={setSelectedMercadoDates}
              availableDates={availableMercadoDates}
              prefix="Errores en mercado"
            />
          )}
        />
      </section>

      {/* DETALLE DE ERRORES POR ÁREA (BODEGA, PRODUCCIÓN, COMERCIALIZACIÓN & MERCADO) - FILTRO EXCLUSIVO POR MES */}
      <section className="glass-card">
        <div className="card-header quality-card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="card-title">
              <ClipboardList size={20} color="#E61D2B" />
              Detalle de Errores por Área (Bodega, Producción, Comercialización & Mercado)
            </div>
            <p className="quality-card-caption">
              Análisis consolidado mensual por área de responsabilidad | Periodo: <strong style={{ color: '#fff' }}>{mercadoDetails.periodLabel}</strong> ({mercadoDetails.total.toLocaleString()} reclamos)
            </p>
          </div>

          {/* FILTRO EXCLUSIVO POR MES */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(15, 20, 30, 0.8)', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            <Calendar size={16} color="#E61D2B" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>FILTRAR POR MES:</span>
            <select
              className="form-control"
              style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0.35rem 0.75rem', cursor: 'pointer', minWidth: '170px' }}
              value={detallesMonthFilter}
              onChange={(e) => setDetallesMonthFilter(e.target.value)}
            >
              <option value="TODOS">Todos los Meses</option>
              {mercadoPeriodOptions.years.flatMap(yr => 
                (mercadoPeriodOptions.monthsByYear[yr] || []).map(m => (
                  <option key={`${yr}-${m.value}`} value={`${yr}-${m.value}`}>
                    {m.label} {yr}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="card-body quality-market-detail-body">
          
          {/* KPI Area Breakdown Summary Cards */}
          <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="glass-card kpi-card" style={{ borderLeftColor: '#FF5252' }}>
              <div className="kpi-title">ERRORES EN MERCADO</div>
              <div className="kpi-value" style={{ color: '#FF5252' }}>
                {mercadoDetails.areaCounts.mercado.toLocaleString()}
              </div>
              <div className="kpi-sub" style={{ color: '#FF5252', fontWeight: 700 }}>
                {mercadoDetails.areaCounts.mercadoPct}% del total
              </div>
            </div>

            <div className="glass-card kpi-card blue">
              <div className="kpi-title">ERRORES EN BODEGA</div>
              <div className="kpi-value" style={{ color: '#60A5FA' }}>
                {mercadoDetails.areaCounts.bodega.toLocaleString()}
              </div>
              <div className="kpi-sub" style={{ color: '#60A5FA', fontWeight: 700 }}>
                {mercadoDetails.areaCounts.bodegaPct}% del total
              </div>
            </div>

            <div className="glass-card kpi-card" style={{ borderLeftColor: '#C084FC' }}>
              <div className="kpi-title">ERRORES EN PRODUCCIÓN</div>
              <div className="kpi-value" style={{ color: '#C084FC' }}>
                {mercadoDetails.areaCounts.produccion.toLocaleString()}
              </div>
              <div className="kpi-sub" style={{ color: '#C084FC', fontWeight: 700 }}>
                {mercadoDetails.areaCounts.produccionPct}% del total
              </div>
            </div>

            <div className="glass-card kpi-card amber">
              <div className="kpi-title">ERRORES EN COMERCIALIZACIÓN</div>
              <div className="kpi-value" style={{ color: '#FBBF24' }}>
                {mercadoDetails.areaCounts.comercializacion.toLocaleString()}
              </div>
              <div className="kpi-sub" style={{ color: '#FBBF24', fontWeight: 700 }}>
                {mercadoDetails.areaCounts.comercializacionPct}% del total
              </div>
            </div>
          </div>

          <div className="quality-market-detail-grid">
            <div className="table-container">
              <table className="custom-table quality-detail-table">
                <thead>
                  <tr>
                    <th>Error Detectado</th>
                    <th>Área Principal</th>
                    <th>Reclamos</th>
                    <th>% Total</th>
                    <th>Cantidad Reportada</th>
                    <th>Producto más repetido</th>
                    <th>Lugar</th>
                  </tr>
                </thead>
                <tbody>
                  {mercadoDetails.breakdown.length > 0 ? (
                    mercadoDetails.breakdown.map(error => (
                      <tr key={error.motivo}>
                        <td style={{ fontWeight: 800, color: '#fff' }}>{error.motivo}</td>
                        <td>
                          {error.mainArea === 'Producción' && <span className="badge badge-produccion">Producción</span>}
                          {error.mainArea === 'Comercialización' && <span className="badge badge-comercializacion">Comercialización</span>}
                          {error.mainArea === 'Bodega' && <span className="badge badge-blue">Bodega</span>}
                          {error.mainArea === 'Mercado' && <span className="badge badge-faltante">Mercado</span>}
                        </td>
                        <td style={{ fontWeight: 800, color: '#FF5252' }}>{error.count.toLocaleString()}</td>
                        <td style={{ fontWeight: 700 }}>{formatPercent(error.percentage)}</td>
                        <td>{error.quantity}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: '#F1F5F9' }}>{error.topProduct.label}</span>
                          <span className="quality-detail-muted"> ({error.topProduct.count})</span>
                        </td>
                        <td>
                          {error.topLocation.label}
                          <span className="quality-detail-muted"> ({error.topLocation.count})</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No hay reclamos registrados para el mes seleccionado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <aside className="quality-top-products">
              <h3>Productos con más reclamos</h3>
              {mercadoDetails.topProducts.length > 0 ? (
                mercadoDetails.topProducts.map(product => (
                  <div className="quality-top-product-row" key={product.product}>
                    <span>{product.product}</span>
                    <strong>{product.count}</strong>
                  </div>
                ))
              ) : (
                <p>Sin productos para este periodo.</p>
              )}
            </aside>
          </div>
        </div>
      </section>

      {/* FOTOS DE ERRORES */}
      <section className="glass-card">
        <div className="card-header">
          <div className="card-title">
            <Camera size={20} color="#E61D2B" />
            FOTOS DE ERRORES
          </div>
        </div>
        <div className="card-body">
          <div className="quality-photo-grid">
            {PHOTO_SLOTS.map(slot => {
              const photo = photos[slot.id];
              const inputId = `quality-photo-${slot.id}`;

              return (
                <article className="quality-photo-card" key={slot.id}>
                  <div className="quality-photo-title">{slot.label}</div>
                  <div className={`quality-photo-preview ${photo ? 'has-photo' : ''}`}>
                    {photo ? (
                      <img src={photo.url} alt={`Foto real de error: ${slot.label}`} />
                    ) : (
                      <div className="quality-photo-placeholder">
                        <Camera size={30} />
                        <span>Sin foto cargada</span>
                      </div>
                    )}
                  </div>
                  <div className="quality-photo-actions">
                    <input
                      id={inputId}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        handlePhotoUpload(slot.id, event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                    <label className="btn btn-outline quality-photo-upload" htmlFor={inputId}>
                      <UploadCloud size={16} />
                      {photo ? 'Cambiar foto' : 'Subir foto real'}
                    </label>
                    {photo && (
                      <button className="btn btn-outline quality-photo-remove" type="button" onClick={() => handleRemovePhoto(slot.id)}>
                        <X size={16} />
                        Quitar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {photoNotice && <div className="quality-photo-notice" role="alert">{photoNotice}</div>}
        </div>
      </section>

      <section className="quality-impact-grid">
        <article className="glass-card quality-impact-card green">
          <div className="quality-impact-label">
            <ShieldCheck size={20} />
            BODEGA
          </div>
          <strong>{dashboard.kpis.bodega.toLocaleString()}</strong>
          <span>Errores prevenidos</span>
        </article>
        <article className="glass-card quality-impact-card red">
          <div className="quality-impact-label">
            <AlertTriangle size={20} />
            MERCADO
          </div>
          <strong>{dashboard.kpis.reclamos.toLocaleString()}</strong>
          <span>Errores que llegaron al mercado</span>
        </article>
      </section>
    </div>
  );
}
