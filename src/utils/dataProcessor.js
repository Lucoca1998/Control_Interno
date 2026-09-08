import * as XLSX from 'xlsx';

/**
 * Combina valores existentes evitando sobrescribir con valores nulos o vacíos.
 */
const mergeValue = (current, next) => {
  if (current !== undefined && current !== null && current !== '') {
    return current;
  }
  return next;
};

const VALID_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const monthsEs = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateParts(year, month, day) {
  if (!year || !month || !day) return '';
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function normalizeDateValue(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return formatDateParts(parsed.y, parsed.m, parsed.d);
  }

  const text = String(value).trim();
  if (!text || text === 'nan' || text === 'None') return '';

  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  if (/^\d{5}$/.test(text)) {
    const parsed = XLSX.SSF.parse_date_code(Number(text));
    if (parsed) return formatDateParts(parsed.y, parsed.m, parsed.d);
  }

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return formatDateParts(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const dayFirstMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dayFirstMatch) {
    return formatDateParts(dayFirstMatch[3], dayFirstMatch[2], dayFirstMatch[1]);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return '';
}

function cleanCell(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  if (!text || text === 'nan' || text === 'None') return fallback;
  return text;
}

function getFirstValue(row, keys, fallback = '') {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = cleanCell(row[key], '');
      if (value !== '') return value;
    }
  }
  return fallback;
}

function getFirstRawValue(row, keys, fallback = '') {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      if (value !== null && value !== undefined && value !== '') return value;
    }
  }
  return fallback;
}

function normalizeId(value) {
  const cleaned = cleanCell(value, '');
  if (!cleaned) return '';
  return cleaned.replace(/\.0$/, '');
}

function getMercadoTruckCandidates(record) {
  return [
    record?.camion,
    record?.distribuidor,
    record?.carga,
    record?.asesor
  ].map(normalizeId).filter(Boolean);
}

function getMonthName(fecha) {
  if (!VALID_DATE_RE.test(fecha)) return 'Archivo Subido';
  const [, year, month] = fecha.match(/^(\d{4})-(\d{2})-\d{2}$/) || [];
  const monthIndex = Number(month) - 1;
  return `${monthsEs[monthIndex] || 'Mes'} ${year}`;
}

function getDisplayDate(fecha) {
  if (!VALID_DATE_RE.test(fecha)) return fecha || '';
  const [year, month, day] = fecha.split('-');
  return `${day}/${month}/${year}`;
}

function countInDateRange(list, startDate, endDate) {
  return (list || []).filter(item => item.fecha >= startDate && item.fecha <= endDate).length;
}

function getSortedValidDates(list) {
  return [...new Set((list || []).map(item => item.fecha).filter(fecha => VALID_DATE_RE.test(fecha)))].sort();
}

/**
 * Filter data by Mercado date range, Bodega date range, error type, advisor, and search query
 */
export function filterDataset(data, filters) {
  if (!data) return { mercado: [], bodega_camiones: [], bodega_observaciones: [], bodega_faltantes_sobrantes: [], loaded_files: [], available_dates: {} };

  const {
    mercadoDateStart,
    mercadoDateEnd,
    bodegaDateStart,
    bodegaDateEnd,
    errorType,
    advisor,
    searchQuery
  } = filters;

  const searchLower = (searchQuery || '').toLowerCase().trim();

  // 1. Filter Mercado
  const filteredMercado = (data.mercado || []).filter(item => {
    if (mercadoDateStart && item.fecha < mercadoDateStart) return false;
    if (mercadoDateEnd && item.fecha > mercadoDateEnd) return false;

    if (errorType && errorType !== 'TODOS') {
      if (item.tipo_clasificacion !== errorType && !item.motivo.includes(errorType)) return false;
    }

    if (advisor && advisor !== 'TODOS') {
      if (item.distribuidor !== advisor && item.asesor !== advisor) return false;
    }

    if (searchLower) {
      const matchText = `${item.mes} ${item.dia} ${item.distribuidor} ${item.producto_esperado} ${item.motivo} ${item.producto_entregado} ${item.lugar} ${item.observacion || ''}`.toLowerCase();
      if (!matchText.includes(searchLower)) return false;
    }

    return true;
  });

  // 2. Filter Bodega Camiones
  const filteredBodegaCamiones = (data.bodega_camiones || []).filter(item => {
    if (bodegaDateStart && item.fecha < bodegaDateStart) return false;
    if (bodegaDateEnd && item.fecha > bodegaDateEnd) return false;

    if (advisor && advisor !== 'TODOS') {
      if (item.usuario_bodega !== advisor && item.usuario_control !== advisor && item.usuario_despacho !== advisor) return false;
    }

    if (searchLower) {
      const matchText = `${item.fecha} ${item.camion} ${item.viaje} ${item.usuario_bodega} ${item.usuario_control} ${item.usuario_despacho}`.toLowerCase();
      if (!matchText.includes(searchLower)) return false;
    }

    return true;
  });

  // 3. Filter Bodega Observaciones
  const filteredBodegaObs = (data.bodega_observaciones || []).filter(item => {
    if (bodegaDateStart && item.fecha < bodegaDateStart) return false;
    if (bodegaDateEnd && item.fecha > bodegaDateEnd) return false;

    if (advisor && advisor !== 'TODOS' && item.usuario !== advisor) return false;

    if (searchLower) {
      const matchText = `${item.fecha} ${item.camion} ${item.descripcion} ${item.usuario}`.toLowerCase();
      if (!matchText.includes(searchLower)) return false;
    }

    return true;
  });

  // 4. Filter Bodega Faltantes/Sobrantes
  const filteredBodegaFS = (data.bodega_faltantes_sobrantes || []).filter(item => {
    if (bodegaDateStart && item.fecha < bodegaDateStart) return false;
    if (bodegaDateEnd && item.fecha > bodegaDateEnd) return false;

    if (advisor && advisor !== 'TODOS' && item.usuario !== advisor) return false;

    if (searchLower) {
      const matchText = `${item.fecha} ${item.camion} ${item.descripcion} ${item.usuario} ${item.tipo_fs}`.toLowerCase();
      if (!matchText.includes(searchLower)) return false;
    }

    return true;
  });

  return {
    mercado: filteredMercado,
    bodega_camiones: filteredBodegaCamiones,
    bodega_observaciones: filteredBodegaObs,
    bodega_faltantes_sobrantes: filteredBodegaFS,
    loaded_files: data.loaded_files || [],
    available_dates: data.available_dates || {}
  };
}

/**
 * Get Page 1 Combination Chart Data:
 * - Columns (Barras): Cantidad de Cargas Totales por Día
 * - Line (Línea): Cantidad de Cargas Observadas por Día
 * FIXED: totalCargas is guaranteed to be >= cargasObservadas so no 0 cargas vs 1 observada glitch occurs.
 */
export function getPage1CombinationChartData(bodegaCamiones, bodegaObsList, bodegaFSList, mercadoList) {
  const dateMap = {};
  const bodegaTruckDates = new Set();

  const ensureDate = (fecha) => {
    if (!dateMap[fecha]) {
      dateMap[fecha] = {
        date: fecha,
        totalCargasMap: new Set(),
        cargasObservadasMap: new Set()
      };
    }
    return dateMap[fecha];
  };

  (bodegaCamiones || []).forEach(c => {
    if (!c.fecha) return;
    const obj = ensureDate(c.fecha);
    const camion = normalizeId(c.camion);
    const viaje = normalizeId(c.viaje) || 'A';
    const loadKey = camion ? `${camion}_${viaje}` : `SIN_CAMION_${obj.totalCargasMap.size + 1}`;
    obj.totalCargasMap.add(loadKey);
    if (camion) bodegaTruckDates.add(`${c.fecha}_${camion}`);
  });

  (bodegaObsList || []).forEach(o => {
    if (!o.fecha) return;
    const obj = ensureDate(o.fecha);
    const camion = normalizeId(o.camion);
    obj.cargasObservadasMap.add(camion || `OBS_${obj.cargasObservadasMap.size + 1}`);
  });

  (bodegaFSList || []).forEach(fs => {
    if (!fs.fecha) return;
    const obj = ensureDate(fs.fecha);
    const camion = normalizeId(fs.camion);
    obj.cargasObservadasMap.add(camion || `FS_${obj.cargasObservadasMap.size + 1}`);
  });

  (mercadoList || []).forEach(m => {
    if (!m.fecha) return;
    const matchedTruck = getMercadoTruckCandidates(m).find(camion => bodegaTruckDates.has(`${m.fecha}_${camion}`));
    if (!matchedTruck) return;
    const obj = ensureDate(m.fecha);
    obj.cargasObservadasMap.add(matchedTruck);
  });

  const sortedDates = Object.keys(dateMap).sort();
  const slicedDates = sortedDates.slice(-45);

  return {
    categories: slicedDates,
    cargasTotalesSeries: slicedDates.map(d => {
      const obj = dateMap[d];
      const obsCount = obj.cargasObservadasMap.size;
      return Math.max(obj.totalCargasMap.size, obsCount);
    }),
    cargasObservadasSeries: slicedDates.map(d => dateMap[d].cargasObservadasMap.size)
  };
}

/**
 * Legacy alias for Page 3 trend line chart
 */
export function getCombinedChartData(mercadoList, bodegaObsList, bodegaFSList) {
  const dateMap = {};

  (mercadoList || []).forEach(m => {
    if (!m.fecha) return;
    if (!dateMap[m.fecha]) dateMap[m.fecha] = { date: m.fecha, mercadoErrors: 0, bodegaErrors: 0 };
    dateMap[m.fecha].mercadoErrors += 1;
  });

  (bodegaObsList || []).forEach(b => {
    if (!b.fecha) return;
    if (!dateMap[b.fecha]) dateMap[b.fecha] = { date: b.fecha, mercadoErrors: 0, bodegaErrors: 0 };
    dateMap[b.fecha].bodegaErrors += 1;
  });

  (bodegaFSList || []).forEach(b => {
    if (!b.fecha) return;
    if (!dateMap[b.fecha]) dateMap[b.fecha] = { date: b.fecha, mercadoErrors: 0, bodegaErrors: 0 };
    dateMap[b.fecha].bodegaErrors += 1;
  });

  const sortedDates = Object.keys(dateMap).sort();
  const slicedDates = sortedDates.slice(-45);

  return {
    categories: slicedDates,
    mercadoSeries: slicedDates.map(d => dateMap[d].mercadoErrors),
    bodegaSeries: slicedDates.map(d => dateMap[d].bodegaErrors)
  };
}

/**
 * Compute Quantities & Percentages for Page 1 KPIs
 */
export function getPage1Metrics(mercadoList, bodegaCamiones, bodegaObsList, bodegaFSList) {
  const totalMercado = (mercadoList || []).length;
  const totalBodegaObs = (bodegaObsList || []).length + (bodegaFSList || []).length;

  const totalErrores = totalMercado + totalBodegaObs;
  const mercadoPct = totalErrores > 0 ? ((totalMercado / totalErrores) * 100).toFixed(1) : 0;
  const bodegaPct = totalErrores > 0 ? ((totalBodegaObs / totalErrores) * 100).toFixed(1) : 0;

  const totalLoadSet = new Set();
  const bodegaTruckDates = new Set();
  (bodegaCamiones || []).forEach(c => {
    const fecha = c.fecha;
    const camion = normalizeId(c.camion);
    if (!fecha || !camion) return;
    const viaje = normalizeId(c.viaje) || 'A';
    totalLoadSet.add(`${fecha}_${camion}_${viaje}`);
    bodegaTruckDates.add(`${fecha}_${camion}`);
  });

  const observedSet = new Set();
  (bodegaObsList || []).forEach(o => {
    const camion = normalizeId(o.camion);
    if (o.fecha && camion) observedSet.add(`${o.fecha}_${camion}`);
  });
  (bodegaFSList || []).forEach(fs => {
    const camion = normalizeId(fs.camion);
    if (fs.fecha && camion) observedSet.add(`${fs.fecha}_${camion}`);
  });
  (mercadoList || []).forEach(m => {
    if (!m.fecha) return;
    const matchedTruck = getMercadoTruckCandidates(m).find(camion => bodegaTruckDates.has(`${m.fecha}_${camion}`));
    if (matchedTruck) observedSet.add(`${m.fecha}_${matchedTruck}`);
  });

  const cargasObservadasCount = observedSet.size;
  const totalCargas = Math.max(totalLoadSet.size, cargasObservadasCount);
  const cargasObservadasPct = totalCargas > 0 ? ((cargasObservadasCount / totalCargas) * 100).toFixed(1) : 0;

  return {
    totalCargas,
    totalMercado,
    mercadoPct,
    totalBodegaObs,
    bodegaPct,
    cargasObservadasCount,
    cargasObservadasPct
  };
}

/**
 * Compute VS Metrics between Bodega and Mercado
 */
export function getVSMetrics(mercadoList, bodegaObsList, bodegaFSList) {
  const totalMercado = (mercadoList || []).length;
  const totalBodega = (bodegaObsList || []).length + (bodegaFSList || []).length;
  const totalErrores = totalMercado + totalBodega;
  const mercadoPct = totalErrores > 0 ? ((totalMercado / totalErrores) * 100).toFixed(1) : '0.0';
  const bodegaPct = totalErrores > 0 ? ((totalBodega / totalErrores) * 100).toFixed(1) : '0.0';
  
  let procedeCount = 0;
  let noProcedeCount = 0;

  (mercadoList || []).forEach(m => {
    if (m.resultado === 'Procede' || !m.resultado) procedeCount++;
    else noProcedeCount++;
  });

  const procedePercentage = totalMercado > 0 ? ((procedeCount / totalMercado) * 100).toFixed(1) : 0;

  return {
    totalMercado,
    totalBodega,
    totalErrores,
    mercadoPct,
    bodegaPct,
    procedeCount,
    noProcedeCount,
    procedePercentage,
    winner: totalBodega < totalMercado ? 'Bodega' : 'Mercado'
  };
}

/**
 * Traceability Records linking Mercado and Bodega Loads
 * FIXED: Guarantees full match of exact Mercado Complaints & Bodega Novedades
 */
export function getTraceabilityRecords(mercadoList, bodegaCamiones, bodegaObs, bodegaFS) {
  const truckIndex = {};

  const addUserCount = (item, role, incoming) => {
    const cleanIncoming = cleanCell(incoming, '');
    if (!cleanIncoming || ['sin dato', 'sin usuario', 'none', 'nan'].includes(cleanIncoming.toLowerCase())) return;
    item.user_counts[role][cleanIncoming] = (item.user_counts[role][cleanIncoming] || 0) + 1;
  };

  const choosePrimaryUser = (counts) => {
    const candidates = Object.entries(counts);
    if (candidates.length === 0) return 'Sin dato';
    candidates.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return candidates[0][0];
  };

  const getOrCreate = (fecha, camionRaw = '') => {
    const camion = normalizeId(camionRaw) || 'GENERAL';
    const key = `${fecha}_${camion}`;
    if (!truckIndex[key]) {
      truckIndex[key] = {
        fecha: fecha,
        camion,
        viaje: 'A',
        usuario_bodega: 'Sin dato',
        usuario_control: 'Sin dato',
        usuario_despacho: 'Sin dato',
        cajas: 0,
        user_counts: { bodega: {}, control: {}, despacho: {} },
        observaciones_bodega: [],
        mercado_reports: []
      };
    }
    return truckIndex[key];
  };

  (bodegaCamiones || []).forEach(c => {
    if (!c.fecha || !c.camion) return;
    const item = getOrCreate(c.fecha, c.camion);
    item.viaje = item.viaje === 'A' ? (cleanCell(c.viaje, 'A') || 'A') : item.viaje;
    addUserCount(item, 'bodega', c.usuario_bodega);
    addUserCount(item, 'control', c.usuario_control);
    addUserCount(item, 'despacho', c.usuario_despacho);
    item.cajas += Number(c.cajas) || 0;
  });

  (bodegaObs || []).forEach(obs => {
    if (!obs.fecha) return;
    const item = getOrCreate(obs.fecha, obs.camion || 'GENERAL');
    item.viaje = item.viaje === 'A' ? (cleanCell(obs.viaje, 'A') || 'A') : item.viaje;
    item.observaciones_bodega.push(obs);
  });

  (bodegaFS || []).forEach(fs => {
    if (!fs.fecha) return;
    const item = getOrCreate(fs.fecha, fs.camion || 'GENERAL');
    item.viaje = item.viaje === 'A' ? (cleanCell(fs.viaje, 'A') || 'A') : item.viaje;
    item.observaciones_bodega.push(fs);
  });

  (mercadoList || []).forEach(m => {
    if (!m.fecha) return;
    const keyId = getMercadoTruckCandidates(m)[0] || 'MERCADO';
    const item = getOrCreate(m.fecha, keyId);
    item.mercado_reports.push(m);
  });

  Object.values(truckIndex).forEach(item => {
    item.usuario_bodega = choosePrimaryUser(item.user_counts.bodega);
    item.usuario_control = choosePrimaryUser(item.user_counts.control);
    item.usuario_despacho = choosePrimaryUser(item.user_counts.despacho);
    delete item.user_counts;
  });

  // Keep every load in the audit table so the three responsible roles are visible
  // even when that load has no reported discrepancy.
  const traceList = Object.values(truckIndex);
  return traceList
    .sort((a, b) => {
      const byDate = String(b.fecha).localeCompare(String(a.fecha));
      if (byDate !== 0) return byDate;
      const byIssues = (b.mercado_reports.length + b.observaciones_bodega.length) - (a.mercado_reports.length + a.observaciones_bodega.length);
      if (byIssues !== 0) return byIssues;
      return String(a.camion).localeCompare(String(b.camion), undefined, { numeric: true });
    })
    .slice(0, 300);
}

/**
 * Advisor Leaderboard & Top Products for Internal Control
 */
export function getAdvisorRanking(mercadoList, bodegaCamiones, bodegaObs, bodegaFS) {
  const advisorStats = {};

  const isRegisteredUser = (value) => {
    const normalized = cleanCell(value, '').toUpperCase();
    return Boolean(normalized && !['SIN USUARIO', 'SIN DATO', 'NONE', 'NAN'].includes(normalized));
  };

  const touchAdvisor = (name) => {
    if (!isRegisteredUser(name)) return null;
    const cleanName = name.toUpperCase().trim();
    if (!advisorStats[cleanName]) {
      advisorStats[cleanName] = {
        name: cleanName,
        totalRegistros: 0,
        observacionesDetalle: []
      };
    }
    return advisorStats[cleanName];
  };

  (mercadoList || []).forEach(m => {
    const adv = touchAdvisor(m.distribuidor || m.asesor);
    if (adv) {
      adv.totalRegistros++;
      adv.observacionesDetalle.push(`${m.motivo}: ${m.producto_esperado}`);
    }
  });

  (bodegaCamiones || []).forEach(b => {
    if (b.usuario_bodega) {
      const adv = touchAdvisor(b.usuario_bodega);
      if (adv) { adv.totalRegistros++; }
    }
    if (b.usuario_control) {
      const adv = touchAdvisor(b.usuario_control);
      if (adv) { adv.totalRegistros++; }
    }
    if (b.usuario_despacho) {
      const adv = touchAdvisor(b.usuario_despacho);
      if (adv) { adv.totalRegistros++; }
    }
  });

  (bodegaObs || []).forEach(o => {
    if (o.usuario) {
      const adv = touchAdvisor(o.usuario);
      if (adv && o.descripcion) {
        adv.observacionesDetalle.push(o.descripcion);
      }
    }
  });

  const advisorArray = Object.values(advisorStats);
  const top5Active = [...advisorArray].sort((a, b) => b.totalRegistros - a.totalRegistros).slice(0, 5);
  const bottom5Active = [...advisorArray]
    .sort((a, b) => a.totalRegistros - b.totalRegistros || a.name.localeCompare(b.name))
    .slice(0, 5);

  const unregisteredRoles = [
    { label: 'SIN REGISTRO - ARMADO', role: 'Armado', count: (bodegaCamiones || []).filter(b => !isRegisteredUser(b.usuario_bodega)).length },
    { label: 'SIN REGISTRO - CONTROL', role: 'Control', count: (bodegaCamiones || []).filter(b => !isRegisteredUser(b.usuario_control)).length },
    { label: 'SIN REGISTRO - DESPACHO', role: 'Despacho', count: (bodegaCamiones || []).filter(b => !isRegisteredUser(b.usuario_despacho)).length }
  ].filter(item => item.count > 0);

  const productErrorMap = {};
  (mercadoList || []).forEach(m => {
    const prod = m.producto_esperado || 'PRODUCTO DESCONOCIDO';
    if (!productErrorMap[prod]) productErrorMap[prod] = { name: prod, count: 0, tipo: m.motivo };
    productErrorMap[prod].count += 1;
  });

  (bodegaFS || []).forEach(fs => {
    const prod = fs.descripcion || 'PRODUCTO DESCONOCIDO';
    if (!productErrorMap[prod]) productErrorMap[prod] = { name: prod, count: 0, tipo: fs.tipo_fs || 'Faltante' };
    productErrorMap[prod].count += 1;
  });

  const top5CriticalProducts = Object.values(productErrorMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const motivoMap = {};
  (mercadoList || []).forEach(m => {
    const mot = m.motivo || 'NO ESPECIFICADO';
    motivoMap[mot] = (motivoMap[mot] || 0) + 1;
  });

  const topMotivos = Object.entries(motivoMap)
    .map(([motivo, count]) => ({ motivo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  return {
    allAdvisors: advisorArray,
    top5Active,
    bottom5Active,
    unregisteredRoles,
    top5CriticalProducts,
    topMotivos
  };
}

/**
 * Purge Date Range from Dataset
 */
export function calculateAvailableDates(dataset) {
  const mercadoDates = getSortedValidDates(dataset?.mercado);
  const bodegaDates = getSortedValidDates([
    ...(dataset?.bodega_camiones || []),
    ...(dataset?.bodega_observaciones || []),
    ...(dataset?.bodega_faltantes_sobrantes || [])
  ]);

  return {
    mercado_start: mercadoDates[0] || '',
    mercado_end: mercadoDates[mercadoDates.length - 1] || '',
    bodega_start: bodegaDates[0] || '',
    bodega_end: bodegaDates[bodegaDates.length - 1] || ''
  };
}

export function countRecordsInDateRange(dataset, startDate, endDate) {
  if (!dataset || !startDate || !endDate) {
    return { mercado: 0, bodega_camiones: 0, bodega_observaciones: 0, bodega_faltantes_sobrantes: 0, total: 0 };
  }

  const from = startDate <= endDate ? startDate : endDate;
  const to = startDate <= endDate ? endDate : startDate;

  const summary = {
    mercado: countInDateRange(dataset.mercado, from, to),
    bodega_camiones: countInDateRange(dataset.bodega_camiones, from, to),
    bodega_observaciones: countInDateRange(dataset.bodega_observaciones, from, to),
    bodega_faltantes_sobrantes: countInDateRange(dataset.bodega_faltantes_sobrantes, from, to)
  };

  return {
    ...summary,
    total: summary.mercado + summary.bodega_camiones + summary.bodega_observaciones + summary.bodega_faltantes_sobrantes
  };
}

export function purgeDatesFromDataset(dataset, startDate, endDate) {
  if (!dataset || !startDate || !endDate) return dataset;

  const from = startDate <= endDate ? startDate : endDate;
  const to = startDate <= endDate ? endDate : startDate;
  const isBetween = (dtStr) => dtStr >= from && dtStr <= to;

  const nextDataset = {
    ...dataset,
    mercado: (dataset.mercado || []).filter(m => !isBetween(m.fecha)),
    bodega_camiones: (dataset.bodega_camiones || []).filter(b => !isBetween(b.fecha)),
    bodega_observaciones: (dataset.bodega_observaciones || []).filter(o => !isBetween(o.fecha)),
    bodega_faltantes_sobrantes: (dataset.bodega_faltantes_sobrantes || []).filter(fs => !isBetween(fs.fecha))
  };

  const hasRemainingRecords = [
    nextDataset.mercado,
    nextDataset.bodega_camiones,
    nextDataset.bodega_observaciones,
    nextDataset.bodega_faltantes_sobrantes
  ].some(records => records.length > 0);

  return {
    ...nextDataset,
    loaded_files: hasRemainingRecords ? (nextDataset.loaded_files || []) : [],
    available_dates: calculateAvailableDates(nextDataset)
  };
}

/**
 * Parse client-side uploaded Excel files
 */
// eslint-disable-next-line no-unused-vars
function parseUploadedExcelFileLegacy(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const workbook = XLSX.read(buffer, { type: 'array' });

        const isBodega = workbook.SheetNames.includes('Camiones') || workbook.SheetNames.includes('Informe observaciones');

        let newMercado = [];
        let newBodegaCamiones = [];

        if (isBodega) {
          if (workbook.SheetNames.includes('Camiones')) {
            const sheet = workbook.Sheets['Camiones'];
            const rows = XLSX.utils.sheet_to_json(sheet);
            newBodegaCamiones = rows.map(r => ({
              sucursal: r['Sucursal'] || '11-COCHABAMBA',
              fecha: r['Fecha'] ? String(r['Fecha']) : '',
              camion: String(r['Camión'] || r['Camion'] || ''),
              viaje: r['Viaje'] || 'A',
              estado_carga: r['Estado carga'] || 'Despachado',
              usuario_bodega: r['Usuario bodega'] || '',
              usuario_control: r['Usuario control'] || '',
              usuario_despacho: r['Usuario despacho'] || '',
              cajas: Number(r['Cajas']) || 0
            }));
          }
        } else {
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet);
          newMercado = rows.map((r, idx) => {
            const dtStr = r['FECHA'] ? String(r['FECHA']).slice(0, 10) : new Date().toISOString().slice(0, 10);
            return {
              id: `UP_${Date.now()}_${idx}`,
              fecha: dtStr,
              mes: 'Archivo Subido',
              dia: dtStr,
              distribuidor: r['DISTRIBUIDOR'] || r['CARGA'] || r['ASESOR'] || 'Asesor Registrado',
              asesor: r['DISTRIBUIDOR'] || r['CARGA'] || r['ASESOR'] || 'Asesor Registrado',
              producto_esperado: r['DETALLE SKU'] || r['SKU'] || 'PRODUCTO REPORTE',
              motivo: r['MOTIVO REPORTE'] || r['MOTIVO'] || 'FALTANTE BODEGA',
              cantidad: Number(r['CANT.']) || Number(r['CANTIDAD']) || 1,
              unidad: r['UNIDAD'] || 'BOT.',
              producto_entregado: r['DETALLE SKU2'] || '-',
              lugar: r['LUGAR DEL REPORTE'] || 'BODEGA',
              resultado: r['RESULTADO'] || 'Procede',
              tipo_clasificacion: (r['MOTIVO REPORTE'] || '').includes('SOBRANTE') ? 'Sobrante' : (r['MOTIVO REPORTE'] || '').includes('CRUCE') ? 'Cruce' : 'Faltante'
            };
          });
        }

        resolve({
          mercado: newMercado,
          bodega_camiones: newBodegaCamiones,
          fileName: file.name
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export async function parseUploadedExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

        const findSheet = (...names) => workbook.SheetNames.find(sheetName => (
          names.some(name => sheetName.trim().toLowerCase() === name.toLowerCase())
        ));

        const readRows = (sheetName) => XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
        const camionesSheet = findSheet('Camiones');
        const observacionesSheet = findSheet('Informe observaciones');
        const faltantesSheet = findSheet('Informe faltantes y sobrantes');
        const isBodega = Boolean(camionesSheet || observacionesSheet || faltantesSheet);

        let newMercado = [];
        let newBodegaCamiones = [];
        let newBodegaObservaciones = [];
        let newBodegaFS = [];

        if (isBodega) {
          if (camionesSheet) {
            newBodegaCamiones = readRows(camionesSheet).map(row => ({
              source_file: file.name,
              sucursal: getFirstValue(row, ['Sucursal'], '11-COCHABAMBA'),
              fecha: normalizeDateValue(getFirstRawValue(row, ['Fecha', 'FECHA'])),
              camion: normalizeId(getFirstValue(row, ['Camion', 'Camión', 'CamiÃ³n', 'Camin'])),
              viaje: getFirstValue(row, ['Viaje'], 'A'),
              estado_carga: getFirstValue(row, ['Estado carga'], 'Despachado'),
              usuario_bodega: getFirstValue(row, ['Usuario bodega'], 'Sin Usuario'),
              usuario_control: getFirstValue(row, ['Usuario control'], 'Sin Usuario'),
              usuario_despacho: getFirstValue(row, ['Usuario despacho'], 'Sin Usuario'),
              cajas: Number(getFirstValue(row, ['Cajas'], 0)) || 0
            })).filter(row => row.fecha && row.camion);
          }

          if (observacionesSheet) {
            newBodegaObservaciones = readRows(observacionesSheet).map(row => ({
              source_file: file.name,
              sucursal: getFirstValue(row, ['Sucursal'], '11'),
              fecha: normalizeDateValue(getFirstRawValue(row, ['Fecha', 'FECHA'])),
              camion: normalizeId(getFirstValue(row, ['Camion', 'Camión', 'CamiÃ³n', 'Camin'])),
              viaje: getFirstValue(row, ['Viaje'], 'A'),
              id_pallet: getFirstValue(row, ['ID_Pallet', 'ID Pallet']),
              descripcion: getFirstValue(row, ['Descripcion', 'Descripción', 'DescripciÃ³n', 'Descripcin']),
              origen: getFirstValue(row, ['Origen'], 'Control'),
              usuario: getFirstValue(row, ['Usuario'], 'Sin Usuario')
            })).filter(row => row.fecha && (row.camion || row.descripcion));
          }

          if (faltantesSheet) {
            newBodegaFS = readRows(faltantesSheet).map(row => ({
              source_file: file.name,
              sucursal: getFirstValue(row, ['Sucursal'], '11'),
              fecha: normalizeDateValue(getFirstRawValue(row, ['Fecha', 'FECHA'])),
              camion: normalizeId(getFirstValue(row, ['Camion', 'Camión', 'CamiÃ³n', 'Camin'])),
              viaje: getFirstValue(row, ['Viaje'], 'A'),
              id_pallet: getFirstValue(row, ['ID_Pallet', 'ID Pallet']),
              cod_articulo: getFirstValue(row, ['Cod. articulo', 'Cod. artículo', 'Cod. artÃ­culo', 'Cod. artculo']),
              descripcion: getFirstValue(row, ['Descripcion', 'Descripción', 'DescripciÃ³n', 'Descripcin']),
              cajas: Number(getFirstValue(row, ['Cajas'], 0)) || 0,
              botellas: Number(getFirstValue(row, ['Botellas'], 0)) || 0,
              tipo_fs: getFirstValue(row, ['DescripcionFS', 'DescripciónFS', 'DescripciÃ³nFS', 'DescripcinFS'], 'Faltante'),
              usuario: getFirstValue(row, ['Usuario'], 'Sin Usuario'),
              origen: getFirstValue(row, ['Origen'], 'Control')
            })).filter(row => row.fecha && (row.camion || row.descripcion));
          }
        } else {
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
          newMercado = rows.map((row, idx) => {
            const fecha = normalizeDateValue(getFirstRawValue(row, ['FECHA', 'Fecha'])) || new Date().toISOString().slice(0, 10);
            const motivo = getFirstValue(row, ['MOTIVO REPORTE', 'MOTIVO', 'Motivo'], 'FALTANTE BODEGA');
            const distribuidor = normalizeId(getFirstValue(row, ['DISTRIBUIDOR', 'CARGA', 'ASESOR', 'Distribuidor', 'Carga', 'Asesor'], 'Asesor Registrado'));
            const productoEntregado = getFirstValue(row, ['DETALLE SKU2', 'SKU2', 'PRODUCTO ENTREGADO'], '-');

            return {
              id: `UP_${Date.now()}_${idx}`,
              source_file: file.name,
              fecha,
              mes: getMonthName(fecha),
              dia: getDisplayDate(fecha),
              distribuidor,
              asesor: distribuidor,
              carga: normalizeId(getFirstValue(row, ['CARGA', 'Carga'], distribuidor)),
              producto_esperado: getFirstValue(row, ['DETALLE SKU', 'SKU', 'PRODUCTO ESPERADO'], 'PRODUCTO REPORTE'),
              motivo,
              cantidad: Number(getFirstValue(row, ['CANT.', 'CANTIDAD', 'Cantidad'], 1)) || 1,
              unidad: getFirstValue(row, ['UNIDAD', 'Unidad'], 'BOT.'),
              producto_entregado: productoEntregado === 'nan' ? '-' : productoEntregado,
              lugar: getFirstValue(row, ['LUGAR DEL REPORTE', 'LUGAR', 'Lugar'], 'BODEGA'),
              resultado: getFirstValue(row, ['RESULTADO', 'Resultado'], 'Procede'),
              observacion: getFirstValue(row, ['OBSERVACION', 'OBSERVACIÓN', 'OBSERVACIÃ“N', 'Accion', 'Acción', 'AcciÃ³n'], ''),
              tipo_clasificacion: motivo.toUpperCase().includes('SOBRANTE')
                ? 'Sobrante'
                : motivo.toUpperCase().includes('CRUCE')
                  ? 'Cruce'
                  : motivo.toUpperCase().includes('VAC')
                    ? 'Vacía'
                    : 'Faltante'
            };
          }).filter(row => row.fecha);
        }

        resolve({
          mercado: newMercado,
          bodega_camiones: newBodegaCamiones,
          bodega_observaciones: newBodegaObservaciones,
          bodega_faltantes_sobrantes: newBodegaFS,
          fileName: file.name
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

const QUALITY_MONTHS = [
  { month: 5, label: 'MAY' },
  { month: 6, label: 'JUN' },
  { month: 7, label: 'JUL' },
  { month: 8, label: 'AGO' }
];

const QUALITY_ERROR_CATEGORIES = ['Faltante', 'Sobrante', 'Cruce'];

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getQualityErrorRecords(mercadoList, bodegaObsList, bodegaFSList) {
  return {
    mercado: (mercadoList || []).map(record => ({ ...record, source: 'mercado' })),
    bodega: [
      ...(bodegaObsList || []).map(record => ({ ...record, source: 'bodega_observacion' })),
      ...(bodegaFSList || []).map(record => ({ ...record, source: 'bodega_faltante_sobrante' }))
    ]
  };
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function getRecordText(record) {
  return normalizeSearchText([
    record?.motivo,
    record?.tipo_clasificacion,
    record?.descripcion,
    record?.tipo_fs,
    record?.producto_esperado,
    record?.producto_entregado,
    record?.id_pallet,
    record?.origen
  ].filter(Boolean).join(' '));
}

function classifyQualityError(record) {
  const text = getRecordText(record);

  if (text.includes('SOBRANTE') || /^S[.\s0-9]/.test(text)) return 'Sobrante';
  if (text.includes('CRUCE') || /^C[.\s0-9]/.test(text) || text.includes(' X ')) return 'Cruce';
  return 'Faltante';
}

function getLatestComparisonYear(records) {
  const preferredYears = records
    .map(record => record.fecha)
    .filter(fecha => VALID_DATE_RE.test(fecha))
    .map(fecha => ({ year: Number(fecha.slice(0, 4)), month: Number(fecha.slice(5, 7)) }))
    .filter(date => QUALITY_MONTHS.some(item => item.month === date.month))
    .map(date => date.year);

  if (preferredYears.length > 0) return Math.max(...preferredYears);

  const allYears = records
    .map(record => record.fecha)
    .filter(fecha => VALID_DATE_RE.test(fecha))
    .map(fecha => Number(fecha.slice(0, 4)));

  return allYears.length > 0 ? Math.max(...allYears) : new Date().getFullYear();
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function createMonthKey(year, month) {
  return `${year}-${pad2(month)}`;
}

function createDateKey(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function countRecordsByMonth(records, year) {
  const monthCounts = {};
  QUALITY_MONTHS.forEach(({ month }) => {
    monthCounts[createMonthKey(year, month)] = 0;
  });

  records.forEach(record => {
    if (!VALID_DATE_RE.test(record.fecha)) return;
    const monthKey = record.fecha.slice(0, 7);
    if (Object.prototype.hasOwnProperty.call(monthCounts, monthKey)) {
      monthCounts[monthKey] += 1;
    }
  });

  return monthCounts;
}

function countRecordsByDay(records, year) {
  const dayCounts = {};
  QUALITY_MONTHS.forEach(({ month }) => {
    const days = getDaysInMonth(year, month);
    for (let day = 1; day <= days; day++) {
      dayCounts[createDateKey(year, month, day)] = 0;
    }
  });

  records.forEach(record => {
    if (Object.prototype.hasOwnProperty.call(dayCounts, record.fecha)) {
      dayCounts[record.fecha] += 1;
    }
  });

  return dayCounts;
}

function countQualityCategories(records) {
  const counts = QUALITY_ERROR_CATEGORIES.reduce((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {});

  records.forEach(record => {
    counts[classifyQualityError(record)] += 1;
  });

  return QUALITY_ERROR_CATEGORIES.map(category => ({
    category,
    value: counts[category]
  }));
}

function countMapValue(map, key) {
  const finalKey = key || 'Sin dato';
  map[finalKey] = (map[finalKey] || 0) + 1;
}

function sumMapValue(map, key, value) {
  const finalKey = key || 'Sin dato';
  map[finalKey] = (map[finalKey] || 0) + (Number(value) || 0);
}

function getTopMapEntry(map) {
  const entries = Object.entries(map);
  if (entries.length === 0) return { label: 'Sin dato', count: 0 };
  const [label, count] = entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { label, count };
}

function formatMonthLabel(month) {
  const monthIndex = Number(month) - 1;
  return MONTH_LABELS[monthIndex] || `Mes ${month}`;
}

function getDateCoverage(records) {
  const dates = records
    .map(record => record.fecha)
    .filter(fecha => VALID_DATE_RE.test(fecha))
    .sort();

  return {
    start: dates[0] || '',
    end: dates[dates.length - 1] || ''
  };
}

function getRequestedPeriod(periodFilter) {
  const year = Number(periodFilter?.year);
  if (!year) return null;

  const month = periodFilter?.month === 'TODOS' ? 0 : Number(periodFilter?.month);

  if (month) {
    return {
      start: createDateKey(year, month, 1),
      end: createDateKey(year, month, getDaysInMonth(year, month)),
      isAligned: true,
      filterType: 'month'
    };
  }

  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    isAligned: true,
    filterType: 'year'
  };
}

function getComparablePeriod(mercadoRecords, bodegaRecords) {
  const mercadoCoverage = getDateCoverage(mercadoRecords);
  const bodegaCoverage = getDateCoverage(bodegaRecords);

  if (mercadoCoverage.start && bodegaCoverage.start) {
    const start = mercadoCoverage.start > bodegaCoverage.start ? mercadoCoverage.start : bodegaCoverage.start;
    const end = mercadoCoverage.end < bodegaCoverage.end ? mercadoCoverage.end : bodegaCoverage.end;

    if (start <= end) {
      return { start, end, isAligned: true };
    }
  }

  const fallbackCoverage = getDateCoverage([...mercadoRecords, ...bodegaRecords]);
  return {
    ...fallbackCoverage,
    isAligned: false
  };
}

function filterRecordsToPeriod(records, period) {
  if (!period) return records || [];

  if (Array.isArray(period.selectedDates) && period.selectedDates.length > 0) {
    const datesSet = new Set(period.selectedDates);
    return (records || []).filter(r => VALID_DATE_RE.test(r.fecha) && datesSet.has(r.fecha));
  }

  if (period.start && period.end) {
    const from = period.start <= period.end ? period.start : period.end;
    const to = period.start <= period.end ? period.end : period.start;
    return (records || []).filter(r => (
      VALID_DATE_RE.test(r.fecha) &&
      r.fecha >= from &&
      r.fecha <= to
    ));
  }

  const req = getRequestedPeriod(period);
  if (req && req.start && req.end) {
    return (records || []).filter(r => (
      VALID_DATE_RE.test(r.fecha) &&
      r.fecha >= req.start &&
      r.fecha <= req.end
    ));
  }

  return records || [];
}

function getPeriodLabel(periodFilter, period) {
  const year = Number(periodFilter?.year);
  const month = periodFilter?.month === 'TODOS' ? 0 : Number(periodFilter?.month);

  if (year && month) return `${formatMonthLabel(month)} ${year}`;
  if (year) return `${year}`;
  if (period?.start && period?.end) return `${period.start} a ${period.end}`;
  return 'Periodo disponible';
}

function createYearPeriod(year) {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  };
}

function getPeriodOptions(records) {
  const periodMap = {};

  (records || []).forEach(record => {
    if (!VALID_DATE_RE.test(record.fecha)) return;
    const year = record.fecha.slice(0, 4);
    const month = Number(record.fecha.slice(5, 7));
    if (!periodMap[year]) periodMap[year] = new Set();
    periodMap[year].add(month);
  });

  const years = Object.keys(periodMap).sort((a, b) => Number(b) - Number(a));
  const monthsByYear = years.reduce((acc, year) => {
    acc[year] = [...periodMap[year]]
      .sort((a, b) => a - b)
      .map(month => ({
        value: String(month),
        label: formatMonthLabel(month)
      }));
    return acc;
  }, {});

  const latestYear = years[0] || '';
  const latestMonth = latestYear && monthsByYear[latestYear]?.length
    ? monthsByYear[latestYear][monthsByYear[latestYear].length - 1].value
    : '';

  return {
    years,
    monthsByYear,
    latest: latestYear ? { year: latestYear, month: latestMonth } : null
  };
}

export function getMercadoPeriodOptions(mercadoList) {
  return getPeriodOptions(mercadoList);
}

export function getBodegaPeriodOptions(bodegaObsList, bodegaFSList) {
  return getPeriodOptions([
    ...(bodegaObsList || []),
    ...(bodegaFSList || [])
  ]);
}

export function classifyAreaResponsibility(record) {
  const text = normalizeSearchText([
    record?.motivo,
    record?.tipo_clasificacion,
    record?.descripcion,
    record?.tipo_fs,
    record?.producto_esperado,
    record?.producto_entregado,
    record?.observacion,
    record?.lugar
  ].filter(Boolean).join(' '));

  if (
    text.includes('PRODUCCION') || text.includes('PRODUCCIÓN') ||
    text.includes('PLANTA') || text.includes('FABRICA') || text.includes('FÁBRICA') ||
    text.includes('VACIA') || text.includes('VACIO') || text.includes('SIN LIQUIDO') || text.includes('SIN LÍQUIDO') ||
    text.includes('MERMA') || text.includes('TAPA') || text.includes('TAPAS') ||
    text.includes('ROTA') || text.includes('ROTURA') || text.includes('PINCHADA') || text.includes('ETIQUETA') ||
    text.includes('DEFECTUOSO') || text.includes('VENCIDA') || text.includes('VENCIDO') || text.includes('LLENADO') ||
    text.includes('ABIERTO') || text.includes('MAL ESTADO')
  ) {
    return 'Producción';
  }

  if (
    text.includes('BODEGA') || text.includes('PICKING') || text.includes('ARMADO') ||
    text.includes('PALLET') || text.includes('PALET') || text.includes('ALMACEN') || text.includes('ALMACÉN') ||
    text.includes('CONTROL INTERNO')
  ) {
    return 'Bodega';
  }

  return 'Mercado';
}

export function getMercadoErrorDetails(mercadoList, periodFilter = {}) {
  let filteredRecords = mercadoList || [];

  if (Array.isArray(periodFilter.selectedDates) && periodFilter.selectedDates.length > 0) {
    const datesSet = new Set(periodFilter.selectedDates);
    filteredRecords = filteredRecords.filter(r => datesSet.has(r.fecha));
  } else if (periodFilter.start && periodFilter.end) {
    const from = periodFilter.start <= periodFilter.end ? periodFilter.start : periodFilter.end;
    const to = periodFilter.start <= periodFilter.end ? periodFilter.end : periodFilter.start;
    filteredRecords = filteredRecords.filter(r => VALID_DATE_RE.test(r.fecha) && r.fecha >= from && r.fecha <= to);
  } else {
    const requestedPeriod = getRequestedPeriod(periodFilter);
    if (requestedPeriod) {
      filteredRecords = filterRecordsToPeriod(mercadoList || [], requestedPeriod);
    }
  }

  const total = filteredRecords.length;
  const motivoMap = {};
  const productMap = {};
  const areaCounts = {
    Bodega: 0,
    Producción: 0,
    Mercado: 0
  };

  filteredRecords.forEach(record => {
    const motivo = cleanCell(record.motivo, 'NO ESPECIFICADO').toUpperCase();
    const motivoKey = normalizeSearchText(motivo) || 'NO ESPECIFICADO';
    const product = cleanCell(record.producto_esperado, 'Producto no especificado').toUpperCase();
    const area = classifyAreaResponsibility(record);

    areaCounts[area] = (areaCounts[area] || 0) + 1;

    if (!motivoMap[motivoKey]) {
      motivoMap[motivoKey] = {
        motivo,
        classificationCounts: {},
        productCounts: {},
        locationCounts: {},
        quantityByUnit: {},
        areaCounts: { Bodega: 0, Producción: 0, Mercado: 0 },
        count: 0
      };
    }

    motivoMap[motivoKey].count += 1;
    motivoMap[motivoKey].areaCounts[area] = (motivoMap[motivoKey].areaCounts[area] || 0) + 1;
    countMapValue(motivoMap[motivoKey].classificationCounts, cleanCell(record.tipo_clasificacion, classifyQualityError(record)));
    countMapValue(motivoMap[motivoKey].productCounts, product);
    countMapValue(motivoMap[motivoKey].locationCounts, cleanCell(record.lugar, 'Sin lugar'));
    sumMapValue(motivoMap[motivoKey].quantityByUnit, cleanCell(record.unidad, 'unid.'), record.cantidad || 1);
    countMapValue(productMap, product);
  });

  const breakdown = Object.values(motivoMap)
    .map(item => {
      const topProduct = getTopMapEntry(item.productCounts);
      const topLocation = getTopMapEntry(item.locationCounts);
      const topClassification = getTopMapEntry(item.classificationCounts);
      
      const mainArea = Object.entries(item.areaCounts)
        .sort((a, b) => b[1] - a[1])[0][0];

      const quantities = Object.entries(item.quantityByUnit)
        .sort((a, b) => b[1] - a[1])
        .map(([unit, value]) => `${value.toLocaleString()} ${unit}`)
        .slice(0, 2)
        .join(' / ');

      return {
        motivo: item.motivo,
        classification: topClassification.label,
        mainArea,
        count: item.count,
        percentage: total > 0 ? Number(((item.count / total) * 100).toFixed(1)) : 0,
        quantity: quantities || `${item.count.toLocaleString()} reg.`,
        topProduct,
        topLocation,
        bodegaCount: item.areaCounts.Bodega || 0,
        bodegaPct: item.count > 0 ? Number(((item.areaCounts.Bodega / item.count) * 100).toFixed(0)) : 0,
        produccionCount: item.areaCounts.Producción || 0,
        produccionPct: item.count > 0 ? Number(((item.areaCounts.Producción / item.count) * 100).toFixed(0)) : 0,
        mercadoCount: item.areaCounts.Mercado || 0,
        mercadoPct: item.count > 0 ? Number(((item.areaCounts.Mercado / item.count) * 100).toFixed(0)) : 0
      };
    })
    .sort((a, b) => b.count - a.count || a.motivo.localeCompare(b.motivo));

  const topProducts = Object.entries(productMap)
    .map(([product, count]) => ({ product, count }))
    .sort((a, b) => b.count - a.count || a.product.localeCompare(b.product))
    .slice(0, 8);

  const getAreaPeriodLabel = () => {
    if (Array.isArray(periodFilter.selectedDates) && periodFilter.selectedDates.length > 0) {
      if (periodFilter.selectedDates.length === 1) return `Fecha: ${getDisplayDate(periodFilter.selectedDates[0])}`;
      return `${periodFilter.selectedDates.length} Fechas Seleccionadas`;
    }
    if (periodFilter.start && periodFilter.end) {
      return `${getDisplayDate(periodFilter.start)} a ${getDisplayDate(periodFilter.end)}`;
    }
    return getPeriodLabel(periodFilter, getRequestedPeriod(periodFilter));
  };

  return {
    total,
    periodLabel: getAreaPeriodLabel(),
    categoryCounts: countQualityCategories(filteredRecords),
    breakdown,
    topProducts,
    uniqueProductsCount: Object.keys(productMap).length,
    topReason: breakdown[0] || null,
    areaCounts: {
      bodega: areaCounts.Bodega,
      bodegaPct: total > 0 ? Number(((areaCounts.Bodega / total) * 100).toFixed(1)) : 0,
      produccion: areaCounts.Producción,
      produccionPct: total > 0 ? Number(((areaCounts.Producción / total) * 100).toFixed(1)) : 0,
      mercado: areaCounts.Mercado,
      mercadoPct: total > 0 ? Number(((areaCounts.Mercado / total) * 100).toFixed(1)) : 0
    }
  };
}

/**
 * Datos consolidados para la página principal de control interno de calidad.
 */
export function getQualityDashboardData(mercadoList, bodegaObsList, bodegaFSList, periodFilters = {}) {
  const records = getQualityErrorRecords(mercadoList, bodegaObsList, bodegaFSList);
  const fallbackPeriod = getComparablePeriod(records.mercado, records.bodega);
  const mercadoFilter = periodFilters.mercado || periodFilters;
  const bodegaFilter = periodFilters.bodega || periodFilters;
  const mercadoPeriod = getRequestedPeriod(mercadoFilter) || fallbackPeriod;
  const bodegaPeriod = getRequestedPeriod(bodegaFilter) || fallbackPeriod;
  const mercadoComparable = filterRecordsToPeriod(records.mercado, mercadoPeriod);
  const bodegaComparable = filterRecordsToPeriod(records.bodega, bodegaPeriod);
  const bodegaTotal = bodegaComparable.length;
  const reclamosTotal = mercadoComparable.length;
  const total = bodegaTotal + reclamosTotal;
  const prevencionPct = total > 0 ? Number(((bodegaTotal / total) * 100).toFixed(1)) : 0;
  const comparisonYear = Number(mercadoFilter?.year || bodegaFilter?.year) || getLatestComparisonYear([...records.mercado, ...records.bodega]);
  const comparisonPeriod = createYearPeriod(comparisonYear);
  const bodegaComparison = filterRecordsToPeriod(records.bodega, comparisonPeriod);
  const mercadoComparison = filterRecordsToPeriod(records.mercado, comparisonPeriod);
  const mercadoValidosComparison = mercadoComparison.filter(record => normalizeSearchText(record.resultado) === 'VALIDO');

  const bodegaMonthCounts = countRecordsByMonth(bodegaComparison, comparisonYear);
  const mercadoMonthCounts = countRecordsByMonth(mercadoComparison, comparisonYear);
  const mercadoValidosMonthCounts = countRecordsByMonth(mercadoValidosComparison, comparisonYear);
  const monthlyComparison = {
    year: comparisonYear,
    categories: QUALITY_MONTHS.map(item => item.label),
    bodegaSeries: QUALITY_MONTHS.map(item => bodegaMonthCounts[createMonthKey(comparisonYear, item.month)] || 0),
    mercadoSeries: QUALITY_MONTHS.map(item => mercadoMonthCounts[createMonthKey(comparisonYear, item.month)] || 0),
    mercadoValidosSeries: QUALITY_MONTHS.map(item => mercadoValidosMonthCounts[createMonthKey(comparisonYear, item.month)] || 0)
  };

  const bodegaDayCounts = countRecordsByDay(bodegaComparison, comparisonYear);
  const mercadoDayCounts = countRecordsByDay(mercadoComparison, comparisonYear);
  const mercadoValidosDayCounts = countRecordsByDay(mercadoValidosComparison, comparisonYear);
  const dailyKeys = QUALITY_MONTHS.flatMap(({ month, label }) => {
    const days = getDaysInMonth(comparisonYear, month);
    return Array.from({ length: days }, (_, index) => ({
      key: createDateKey(comparisonYear, month, index + 1),
      label: `${label} ${pad2(index + 1)}`
    }));
  });

  const dailyComparison = {
    year: comparisonYear,
    categories: dailyKeys.map(item => item.label),
    dates: dailyKeys.map(item => item.key),
    bodegaSeries: dailyKeys.map(item => bodegaDayCounts[item.key] || 0),
    mercadoSeries: dailyKeys.map(item => mercadoDayCounts[item.key] || 0),
    mercadoValidosSeries: dailyKeys.map(item => mercadoValidosDayCounts[item.key] || 0)
  };

  return {
    kpis: {
      bodega: bodegaTotal,
      reclamos: reclamosTotal,
      total,
      prevencionPct
    },
    monthlyComparison,
    dailyComparison,
    preparedErrors: countQualityCategories(bodegaComparable),
    marketErrors: countQualityCategories(mercadoComparable),
    periods: {
      mercado: mercadoPeriod,
      bodega: bodegaPeriod
    },
    period: mercadoPeriod.start === bodegaPeriod.start && mercadoPeriod.end === bodegaPeriod.end
      ? mercadoPeriod
      : fallbackPeriod
  };
}

export function getLatestComparableDateFilters(dataset) {
  const bodegaRecords = [
    ...(dataset?.bodega_observaciones || []),
    ...(dataset?.bodega_faltantes_sobrantes || [])
  ];
  const mercadoRecords = dataset?.mercado || [];
  const bodegaDates = getSortedValidDates(bodegaRecords);
  const mercadoDates = getSortedValidDates(mercadoRecords);
  const latestBodegaDate = bodegaDates[bodegaDates.length - 1];
  const latestMercadoDate = mercadoDates[mercadoDates.length - 1];
  const anchorDate = latestBodegaDate || latestMercadoDate || '';

  if (!anchorDate) {
    return {
      mercadoDateStart: '',
      mercadoDateEnd: '',
      bodegaDateStart: '',
      bodegaDateEnd: ''
    };
  }

  const year = Number(anchorDate.slice(0, 4));
  const month = Number(anchorDate.slice(5, 7));
  const start = createDateKey(year, month, 1);
  const end = createDateKey(year, month, getDaysInMonth(year, month));

  return {
    mercadoDateStart: start,
    mercadoDateEnd: end,
    bodegaDateStart: start,
    bodegaDateEnd: end
  };
}
