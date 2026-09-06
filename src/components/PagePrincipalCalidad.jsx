import { useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import { getQualityDashboardData } from '../utils/dataProcessor';
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  Camera,
  CheckCircle,
  Package,
  Percent,
  ShieldCheck,
  UploadCloud,
  X
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

function ErrorComparisonColumn({ title, items, tone, maxValue }) {
  return (
    <div className="glass-card quality-error-column">
      <h3>{title}</h3>
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

export default function PagePrincipalCalidad({ filteredData }) {
  const [comparisonMode, setComparisonMode] = useState('mensual');
  const [photos, setPhotos] = useState(loadStoredPhotos);
  const [photoNotice, setPhotoNotice] = useState('');

  const { mercado, bodega_observaciones, bodega_faltantes_sobrantes } = filteredData;

  const dashboard = useMemo(() => (
    getQualityDashboardData(mercado, bodega_observaciones, bodega_faltantes_sobrantes)
  ), [mercado, bodega_observaciones, bodega_faltantes_sobrantes]);

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
      detail: 'Llegaron al mercado',
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
    ...dashboard.marketErrors.map(item => item.value)
  );

  return (
    <div className="quality-page animate-fade-in">
      <section className="quality-page-header">
        <div>
          <h1>Dashboard de Control Interno de Calidad</h1>
          <p>Indicadores conectados a los datos cargados de bodega y reclamos de mercado.</p>
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

      <section className="quality-error-section">
        <ErrorComparisonColumn
          title="ERRORES EN PREPARADO"
          items={dashboard.preparedErrors}
          maxValue={maxErrorValue}
          tone="green"
        />
        <ErrorComparisonColumn
          title="ERRORES EN MERCADO"
          items={dashboard.marketErrors}
          maxValue={maxErrorValue}
          tone="red"
        />
      </section>

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
