// ===================================================================
// CHARTS.JS — All tab render functions (Plotly-based)
// ===================================================================
// Depends on:
//   utils.js  — fmtUSD, fmtPct, fmtPctRaw, fmtNum, fmtX, fmtRatio, safeDiv,
//               weightedAvg, exportTableCSV, makeSortable, detectOverflow
//   data.js   — SECTOR_COLORS, SECTOR_LABELS, PROTOCOLS
//   filters.js — STATE, getFilteredProtocols, getFilteredMonthly, getFilteredQuarterly
// ===================================================================

// ===================================================================
// PLOTLY DEFAULTS
// ===================================================================
var PLOTLY_DARK = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { family: 'Inter, sans-serif', color: '#e8e8e8', size: 11 },
  margin: { t: 30, r: 20, b: 50, l: 60 },
  showlegend: true,
  legend: {
    bgcolor: 'rgba(0,0,0,0)',
    font: { size: 10, color: '#8a8a8a' },
    orientation: 'h',
    x: 0, y: -0.15
  }
};

var PLOTLY_XAXIS = {
  gridcolor: 'rgba(255,255,255,0.04)',
  linecolor: 'rgba(255,255,255,0.08)',
  tickfont: { size: 10, color: '#8a8a8a' },
  nticks: 8
};

var PLOTLY_YAXIS = {
  gridcolor: 'rgba(255,255,255,0.04)',
  linecolor: 'rgba(255,255,255,0.08)',
  tickfont: { size: 10, color: '#8a8a8a' },
  nticks: 6,
  zeroline: false
};

var PLOTLY_CONFIG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['toImage', 'sendDataToCloud', 'toggleSpikelines', 'hoverClosestCartesian', 'hoverCompareCartesian']
};

function plotlyLayout(overrides) {
  var base = JSON.parse(JSON.stringify(PLOTLY_DARK));
  if (overrides) {
    Object.keys(overrides).forEach(function (k) {
      if (typeof overrides[k] === 'object' && !Array.isArray(overrides[k]) && base[k]) {
        Object.assign(base[k], overrides[k]);
      } else {
        base[k] = overrides[k];
      }
    });
  }
  // Always merge xaxis/yaxis defaults
  base.xaxis = Object.assign({}, PLOTLY_XAXIS, base.xaxis || {});
  base.yaxis = Object.assign({}, PLOTLY_YAXIS, base.yaxis || {});
  return base;
}

// ===================================================================
// KPI HELPER
// ===================================================================
function setKPI(id, value, sub) {
  var el = document.getElementById(id);
  if (!el) return;
  var valEl = el.querySelector('.kpi-value');
  if (valEl) valEl.textContent = value;
  if (sub) {
    var subEl = el.querySelector('.kpi-sub');
    if (!subEl) {
      subEl = document.createElement('div');
      subEl.className = 'kpi-sub';
      subEl.style.cssText = 'font-size:10px;color:#8a8a8a;margin-top:2px;';
      el.appendChild(subEl);
    }
    subEl.textContent = sub;
  }
}

// ===================================================================
// EMPTY STATE
// ===================================================================
function showEmpty(containerId, message) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div class="empty-state"><div class="empty-icon">?</div><div>' +
    (message || 'No data available for current filters') + '</div></div>';
}

// ===================================================================
// TAB 1: REVENUE
// ===================================================================
function renderRevenueTab() {
  var protocols = getFilteredProtocols();

  if (protocols.length === 0) {
    setKPI('kpi-total-revenue', '—');
    setKPI('kpi-revenue-growth', '—');
    setKPI('kpi-median-take-rate', '—');
    setKPI('kpi-top-protocol', '—');
    showEmpty('chart-quarterly-revenue', 'No protocols match filters');
    showEmpty('chart-take-rate-heatmap');
    showEmpty('chart-revenue-consistency');
    showEmpty('chart-revenue-decomposition');
    showEmpty('chart-monthly-revenue');
    return;
  }

  // --- KPIs ---
  var latestRevs = [];
  var prevRevs = [];
  var takeRates = [];
  var topName = '—';
  var topRev = 0;

  protocols.forEach(function (p) {
    var m = getFilteredMonthly(p);
    if (m.length === 0) return;
    var latest = m[m.length - 1];
    latestRevs.push(latest.revenue);
    takeRates.push(latest.takeRate);
    if (latest.revenue > topRev) {
      topRev = latest.revenue;
      topName = p.name;
    }
    if (m.length > 1) prevRevs.push(m[m.length - 2].revenue);
  });

  var totalRev = latestRevs.reduce(function (s, v) { return s + v; }, 0);
  var prevTotal = prevRevs.reduce(function (s, v) { return s + v; }, 0);
  var growth = prevTotal > 0 ? (totalRev - prevTotal) / prevTotal : 0;
  takeRates.sort(function (a, b) { return a - b; });
  var medianTake = takeRates.length > 0
    ? takeRates[Math.floor(takeRates.length / 2)]
    : 0;

  setKPI('kpi-total-revenue', fmtUSD(totalRev));
  setKPI('kpi-revenue-growth', fmtPct(growth), 'MoM');
  setKPI('kpi-median-take-rate', fmtPct(medianTake));
  setKPI('kpi-top-protocol', topName, fmtUSD(topRev));

  // --- Chart 1: Quarterly Revenue (stacked bar) ---
  renderQuarterlyRevenue(protocols);

  // --- Chart 2: Take Rate Heatmap ---
  renderTakeRateHeatmap(protocols);

  // --- Chart 3: Revenue Consistency ---
  renderRevenueConsistency(protocols);

  // --- Chart 4: Revenue Decomposition ---
  renderRevenueDecomposition(protocols);

  // --- Chart 5: Monthly Revenue Time Series ---
  renderMonthlyRevenue(protocols);
}

function renderQuarterlyRevenue(protocols) {
  var traces = [];
  var allQuarters = new Set();

  protocols.forEach(function (p) {
    var q = getFilteredQuarterly(p);
    q.forEach(function (qtr) { allQuarters.add(qtr.quarter); });
  });

  var sortedQ = Array.from(allQuarters).sort();
  if (sortedQ.length === 0) { showEmpty('chart-quarterly-revenue'); return; }

  protocols.forEach(function (p) {
    var q = getFilteredQuarterly(p);
    var qMap = {};
    q.forEach(function (qtr) { qMap[qtr.quarter] = qtr.revenue; });
    var y = sortedQ.map(function (label) { return qMap[label] || 0; });

    traces.push({
      x: sortedQ,
      y: y,
      name: p.name,
      type: 'bar',
      marker: { color: SECTOR_COLORS[p.sector] || '#4a9eff' }
    });
  });

  Plotly.newPlot('chart-quarterly-revenue', traces, plotlyLayout({
    barmode: 'stack',
    xaxis: { categoryorder: 'array', categoryarray: sortedQ, title: '' },
    yaxis: { title: 'Revenue', tickprefix: '$', nticks: 6 }
  }), PLOTLY_CONFIG);
}

function renderTakeRateHeatmap(protocols) {
  var allMonths = new Set();
  protocols.forEach(function (p) {
    getFilteredMonthly(p).forEach(function (m) { allMonths.add(m.month); });
  });
  var sortedMonths = Array.from(allMonths).sort();
  if (sortedMonths.length === 0) { showEmpty('chart-take-rate-heatmap'); return; }

  var z = [];
  var yLabels = [];
  protocols.forEach(function (p) {
    var monthly = getFilteredMonthly(p);
    var monthMap = {};
    monthly.forEach(function (m) { monthMap[m.month] = m.takeRate; });
    var row = sortedMonths.map(function (mo) {
      return monthMap[mo] !== undefined ? monthMap[mo] * 100 : null;
    });
    z.push(row);
    yLabels.push(p.name);
  });

  Plotly.newPlot('chart-take-rate-heatmap', [{
    z: z,
    x: sortedMonths,
    y: yLabels,
    type: 'heatmap',
    colorscale: [
      [0, '#0a0a0a'],
      [0.25, '#1a3a5c'],
      [0.5, '#2a6ab0'],
      [0.75, '#4a9eff'],
      [1, '#8ac4ff']
    ],
    colorbar: {
      title: { text: 'Take Rate %', font: { size: 10, color: '#8a8a8a' } },
      tickfont: { size: 9, color: '#8a8a8a' },
      ticksuffix: '%'
    },
    hoverongaps: false,
    hovertemplate: '%{y}<br>%{x}<br>Take Rate: %{z:.2f}%<extra></extra>'
  }], plotlyLayout({
    margin: { t: 20, r: 100, b: 50, l: 120 },
    xaxis: { categoryorder: 'array', categoryarray: sortedMonths },
    yaxis: { autorange: 'reversed', nticks: protocols.length }
  }), PLOTLY_CONFIG);
}

function renderRevenueConsistency(protocols) {
  var items = protocols.map(function (p) {
    return { name: p.name, score: p.consistency || 0, sector: p.sector };
  }).sort(function (a, b) { return b.score - a.score; });

  if (items.length === 0) { showEmpty('chart-revenue-consistency'); return; }

  Plotly.newPlot('chart-revenue-consistency', [{
    y: items.map(function (i) { return i.name; }),
    x: items.map(function (i) { return i.score * 100; }),
    type: 'bar',
    orientation: 'h',
    marker: {
      color: items.map(function (i) { return SECTOR_COLORS[i.sector] || '#4a9eff'; })
    },
    hovertemplate: '%{y}: %{x:.1f}%<extra></extra>'
  }], plotlyLayout({
    margin: { l: 120, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Consistency Score %', range: [0, 100], ticksuffix: '%' },
    yaxis: { autorange: 'reversed' },
    showlegend: false
  }), PLOTLY_CONFIG);
}

function renderRevenueDecomposition(protocols) {
  // Populate protocol selector
  var select = document.getElementById('decomp-protocol-select');
  if (select) {
    var currentVal = STATE.decompProtocol;
    select.innerHTML = '';
    protocols.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === currentVal) opt.selected = true;
      select.appendChild(opt);
    });
    if (!currentVal && protocols.length > 0) {
      STATE.decompProtocol = protocols[0].id;
      select.value = protocols[0].id;
    }
    // Wire up change event (idempotent via replace)
    select.onchange = function () {
      STATE.decompProtocol = select.value;
      renderRevenueDecomposition(protocols);
      encodeStateToURL();
    };
  }

  var proto = protocols.find(function (p) { return p.id === STATE.decompProtocol; });
  if (!proto) proto = protocols[0];
  if (!proto) { showEmpty('chart-revenue-decomposition'); return; }

  var monthly = getFilteredMonthly(proto);
  if (monthly.length === 0) { showEmpty('chart-revenue-decomposition', 'No monthly data for ' + proto.name); return; }

  var months = monthly.map(function (m) { return m.month; });

  var traces = [
    {
      x: months, y: monthly.map(function (m) { return m.revenue; }),
      name: 'Revenue', type: 'bar',
      marker: { color: '#4a9eff' }
    },
    {
      x: months, y: monthly.map(function (m) { return m.costOfRevenue; }),
      name: 'Cost of Revenue', type: 'bar',
      marker: { color: '#ff5a54' }
    },
    {
      x: months, y: monthly.map(function (m) { return m.tokenIncentives; }),
      name: 'Token Incentives', type: 'bar',
      marker: { color: '#fb8b1e' }
    },
    {
      x: months, y: monthly.map(function (m) { return m.earnings; }),
      name: 'Earnings', type: 'scatter', mode: 'lines+markers',
      line: { color: '#4af6c3', width: 2 },
      marker: { size: 4 }
    }
  ];

  Plotly.newPlot('chart-revenue-decomposition', traces, plotlyLayout({
    barmode: 'group',
    xaxis: { categoryorder: 'array', categoryarray: months },
    yaxis: { title: 'USD', tickprefix: '$', nticks: 6 }
  }), PLOTLY_CONFIG);
}

function renderMonthlyRevenue(protocols) {
  var traces = [];
  protocols.forEach(function (p) {
    var monthly = getFilteredMonthly(p);
    if (monthly.length === 0) return;
    traces.push({
      x: monthly.map(function (m) { return m.date; }),
      y: monthly.map(function (m) { return m.revenue; }),
      name: p.name,
      type: 'scatter',
      mode: 'lines',
      line: { color: SECTOR_COLORS[p.sector] || '#4a9eff', width: 1.5 }
    });
  });

  if (traces.length === 0) { showEmpty('chart-monthly-revenue'); return; }

  Plotly.newPlot('chart-monthly-revenue', traces, plotlyLayout({
    yaxis: { title: 'Monthly Revenue', tickprefix: '$', nticks: 6 },
    legend: { orientation: 'h', x: 0, y: -0.2, font: { size: 9 } }
  }), PLOTLY_CONFIG);
}

// ===================================================================
// TAB 2: REVENUE VS VALUATION
// ===================================================================
function renderValuationTab() {
  var protocols = getFilteredProtocols();

  if (protocols.length === 0) {
    setKPI('kpi-avg-ps', '—');
    setKPI('kpi-median-ps', '—');
    setKPI('kpi-most-overvalued', '—');
    setKPI('kpi-most-undervalued', '—');
    showEmpty('chart-ps-scatter');
    showEmpty('chart-ps-ranking');
    showEmpty('chart-ps-trends');
    return;
  }

  // Compute latest P/S for each protocol
  var psData = [];
  protocols.forEach(function (p) {
    var m = getFilteredMonthly(p);
    if (m.length === 0) return;
    var latest = m[m.length - 1];
    var annRev = latest.revenue * 12;
    var ps = safeDiv(latest.fdv, annRev, null);
    if (ps === null || ps <= 0) return;
    psData.push({
      name: p.name,
      id: p.id,
      sector: p.sector,
      ps: ps,
      revenue: latest.revenue,
      annRevenue: annRev,
      fdv: latest.fdv,
      circMcap: latest.circMcap
    });
  });

  // KPIs
  var psValues = psData.map(function (d) { return d.ps; });
  psValues.sort(function (a, b) { return a - b; });
  var avgPS = psValues.length > 0 ? psValues.reduce(function (s, v) { return s + v; }, 0) / psValues.length : 0;
  var medPS = psValues.length > 0 ? psValues[Math.floor(psValues.length / 2)] : 0;
  var overvalued = psData.length > 0 ? psData.reduce(function (a, b) { return a.ps > b.ps ? a : b; }) : null;
  var undervalued = psData.length > 0 ? psData.reduce(function (a, b) { return a.ps < b.ps ? a : b; }) : null;

  setKPI('kpi-avg-ps', fmtX(avgPS));
  setKPI('kpi-median-ps', fmtX(medPS));
  setKPI('kpi-most-overvalued', overvalued ? overvalued.name : '—', overvalued ? fmtX(overvalued.ps) + ' P/S' : '');
  setKPI('kpi-most-undervalued', undervalued ? undervalued.name : '—', undervalued ? fmtX(undervalued.ps) + ' P/S' : '');

  // --- Chart 1: P/S vs Revenue Scatter ---
  if (psData.length > 0) {
    // Group by sector for colored traces
    var sectorGroups = {};
    psData.forEach(function (d) {
      if (!sectorGroups[d.sector]) sectorGroups[d.sector] = [];
      sectorGroups[d.sector].push(d);
    });

    var scatterTraces = [];
    Object.keys(sectorGroups).forEach(function (sector) {
      var items = sectorGroups[sector];
      scatterTraces.push({
        x: items.map(function (d) { return d.annRevenue; }),
        y: items.map(function (d) { return d.ps; }),
        text: items.map(function (d) { return d.name; }),
        name: SECTOR_LABELS[sector] || sector,
        mode: 'markers+text',
        type: 'scatter',
        textposition: 'top center',
        textfont: { size: 9, color: '#8a8a8a' },
        marker: {
          size: items.map(function (d) { return Math.max(8, Math.min(30, Math.sqrt(d.fdv / 1e8) * 5)); }),
          color: SECTOR_COLORS[sector] || '#4a9eff',
          opacity: 0.8
        },
        hovertemplate: '%{text}<br>Ann. Revenue: $%{x:,.0f}<br>P/S: %{y:.1f}x<extra></extra>'
      });
    });

    Plotly.newPlot('chart-ps-scatter', scatterTraces, plotlyLayout({
      xaxis: { title: 'Annualized Revenue', tickprefix: '$', type: 'log',
        tickvals: [1e5, 1e6, 1e7, 1e8, 1e9, 1e10],
        ticktext: ['$100K', '$1M', '$10M', '$100M', '$1B', '$10B']
      },
      yaxis: { title: 'P/S Ratio', type: 'log',
        tickvals: [1, 5, 10, 50, 100, 500, 1000],
        ticktext: ['1x', '5x', '10x', '50x', '100x', '500x', '1000x']
      }
    }), PLOTLY_CONFIG);
  } else {
    showEmpty('chart-ps-scatter');
  }

  // --- Chart 2: P/S Ranking Bar ---
  var ranked = psData.slice().sort(function (a, b) { return b.ps - a.ps; });
  Plotly.newPlot('chart-ps-ranking', [{
    y: ranked.map(function (d) { return d.name; }),
    x: ranked.map(function (d) { return d.ps; }),
    type: 'bar',
    orientation: 'h',
    marker: {
      color: ranked.map(function (d) { return SECTOR_COLORS[d.sector] || '#4a9eff'; })
    },
    hovertemplate: '%{y}: %{x:.1f}x<extra></extra>'
  }], plotlyLayout({
    margin: { l: 120, r: 20, t: 20, b: 40 },
    xaxis: { title: 'P/S Ratio', ticksuffix: 'x' },
    yaxis: { autorange: 'reversed' },
    showlegend: false
  }), PLOTLY_CONFIG);

  // --- Chart 3: P/S Ratio Trends ---
  var trendTraces = [];
  protocols.forEach(function (p) {
    var monthly = getFilteredMonthly(p);
    if (monthly.length === 0) return;
    var dates = [];
    var psVals = [];
    monthly.forEach(function (m) {
      if (m.psRatio > 0) {
        dates.push(m.date);
        psVals.push(m.psRatio);
      }
    });
    if (dates.length > 0) {
      trendTraces.push({
        x: dates, y: psVals,
        name: p.name,
        type: 'scatter', mode: 'lines',
        line: { color: SECTOR_COLORS[p.sector] || '#4a9eff', width: 1.5 }
      });
    }
  });

  if (trendTraces.length > 0) {
    Plotly.newPlot('chart-ps-trends', trendTraces, plotlyLayout({
      yaxis: { title: 'P/S Ratio', ticksuffix: 'x', nticks: 6 },
      legend: { orientation: 'h', x: 0, y: -0.2, font: { size: 9 } }
    }), PLOTLY_CONFIG);
  } else {
    showEmpty('chart-ps-trends');
  }

  // --- Table: Valuation Summary ---
  var tbody = document.querySelector('#table-valuation tbody');
  if (tbody) {
    tbody.innerHTML = '';
    ranked.forEach(function (d) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + d.name + '</td>' +
        '<td>' + fmtUSD(d.circMcap) + '</td>' +
        '<td>' + fmtUSD(d.annRevenue) + '</td>' +
        '<td>' + fmtX(d.ps) + '</td>';
      tbody.appendChild(tr);
    });
    makeSortable(document.getElementById('table-valuation'));
  }
}

// ===================================================================
// TAB 3: RETENTION & SEASONALITY
// ===================================================================
function renderRetentionTab() {
  var protocols = getFilteredProtocols();

  if (protocols.length === 0) {
    setKPI('kpi-avg-retention', '—');
    setKPI('kpi-best-retention', '—');
    setKPI('kpi-worst-month', '—');
    setKPI('kpi-best-month', '—');
    showEmpty('chart-retention-heatmap');
    showEmpty('chart-retention-trends');
    showEmpty('chart-seasonality');
    showEmpty('chart-cohort');
    return;
  }

  // Compute retention metrics from cohorts
  var retentionData = [];
  protocols.forEach(function (p) {
    if (!p.cohorts || p.cohorts.length === 0) return;
    var avgM3 = p.cohorts.reduce(function (s, c) {
      return s + (c[3] !== undefined ? c[3] : 0);
    }, 0) / p.cohorts.length;
    retentionData.push({ name: p.name, sector: p.sector, retention: avgM3, cohorts: p.cohorts });
  });

  retentionData.sort(function (a, b) { return b.retention - a.retention; });

  // KPIs
  var avgRet = retentionData.length > 0
    ? retentionData.reduce(function (s, d) { return s + d.retention; }, 0) / retentionData.length
    : 0;
  var bestRet = retentionData.length > 0 ? retentionData[0] : null;

  // Seasonality: find best/worst calendar months across all protocols
  var monthRevTotals = {};
  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  protocols.forEach(function (p) {
    getFilteredMonthly(p).forEach(function (m) {
      var mo = m.calMonth;
      if (!monthRevTotals[mo]) monthRevTotals[mo] = [];
      monthRevTotals[mo].push(m.revenue);
    });
  });

  var monthAvgs = {};
  Object.keys(monthRevTotals).forEach(function (mo) {
    var vals = monthRevTotals[mo];
    monthAvgs[mo] = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
  });

  var overallAvg = 0;
  var monthKeys = Object.keys(monthAvgs);
  if (monthKeys.length > 0) {
    overallAvg = monthKeys.reduce(function (s, k) { return s + monthAvgs[k]; }, 0) / monthKeys.length;
  }

  var bestMonth = null;
  var worstMonth = null;
  monthKeys.forEach(function (mo) {
    var ratio = overallAvg > 0 ? monthAvgs[mo] / overallAvg : 1;
    if (!bestMonth || ratio > bestMonth.ratio) bestMonth = { mo: mo, ratio: ratio };
    if (!worstMonth || ratio < worstMonth.ratio) worstMonth = { mo: mo, ratio: ratio };
  });

  setKPI('kpi-avg-retention', fmtPct(avgRet), 'Month 3');
  setKPI('kpi-best-retention', bestRet ? bestRet.name : '—', bestRet ? fmtPct(bestRet.retention) : '');
  setKPI('kpi-worst-month', worstMonth ? monthNames[worstMonth.mo] : '—', worstMonth ? fmtPct(worstMonth.ratio - 1) + ' vs avg' : '');
  setKPI('kpi-best-month', bestMonth ? monthNames[bestMonth.mo] : '—', bestMonth ? '+' + fmtPct(bestMonth.ratio - 1) + ' vs avg' : '');

  // --- Chart 1: Retention Heatmap ---
  var heatZ = [];
  var heatY = [];
  var heatX = [];
  for (var ci = 0; ci < 12; ci++) { heatX.push('M' + ci); }

  retentionData.forEach(function (d) {
    heatY.push(d.name);
    // Average across cohorts for each month
    var row = [];
    for (var mi = 0; mi < 12; mi++) {
      var sum = 0;
      var count = 0;
      d.cohorts.forEach(function (c) {
        if (c[mi] !== undefined) { sum += c[mi]; count++; }
      });
      row.push(count > 0 ? sum / count * 100 : null);
    }
    heatZ.push(row);
  });

  Plotly.newPlot('chart-retention-heatmap', [{
    z: heatZ, x: heatX, y: heatY,
    type: 'heatmap',
    colorscale: [
      [0, '#1a0a0a'],
      [0.25, '#5c1a1a'],
      [0.5, '#b05a2a'],
      [0.75, '#4af6c3'],
      [1, '#22ffaa']
    ],
    colorbar: {
      title: { text: 'Retention %', font: { size: 10, color: '#8a8a8a' } },
      tickfont: { size: 9, color: '#8a8a8a' },
      ticksuffix: '%'
    },
    hoverongaps: false,
    hovertemplate: '%{y}<br>%{x}<br>Retention: %{z:.1f}%<extra></extra>'
  }], plotlyLayout({
    margin: { t: 20, r: 100, b: 40, l: 120 },
    yaxis: { autorange: 'reversed' }
  }), PLOTLY_CONFIG);

  // --- Chart 2: Retention Trends (M3 over time) ---
  // Approximate: use last N cohorts' M3 value
  var retTraces = [];
  protocols.forEach(function (p) {
    if (!p.cohorts || p.cohorts.length < 2) return;
    var monthly = getFilteredMonthly(p);
    var m3Vals = p.cohorts.map(function (c) { return c[3] !== undefined ? c[3] * 100 : null; });
    // Align cohorts to latest months
    var startIdx = Math.max(0, monthly.length - p.cohorts.length);
    var dates = [];
    var vals = [];
    for (var i = 0; i < m3Vals.length && startIdx + i < monthly.length; i++) {
      if (m3Vals[i] !== null) {
        dates.push(monthly[startIdx + i].date);
        vals.push(m3Vals[i]);
      }
    }
    if (dates.length > 0) {
      retTraces.push({
        x: dates, y: vals,
        name: p.name,
        type: 'scatter', mode: 'lines',
        line: { color: SECTOR_COLORS[p.sector] || '#4a9eff', width: 1.5 }
      });
    }
  });

  if (retTraces.length > 0) {
    Plotly.newPlot('chart-retention-trends', retTraces, plotlyLayout({
      yaxis: { title: 'M3 Retention %', ticksuffix: '%', nticks: 6, range: [0, 100] }
    }), PLOTLY_CONFIG);
  } else {
    showEmpty('chart-retention-trends');
  }

  // --- Chart 3: Seasonality Pattern ---
  var seasonData = monthNames.map(function (name, idx) {
    var ratio = overallAvg > 0 && monthAvgs[idx] ? (monthAvgs[idx] / overallAvg - 1) * 100 : 0;
    return { name: name, ratio: ratio };
  });

  Plotly.newPlot('chart-seasonality', [{
    x: monthNames,
    y: seasonData.map(function (d) { return d.ratio; }),
    type: 'bar',
    marker: {
      color: seasonData.map(function (d) { return d.ratio >= 0 ? '#4af6c3' : '#ff5a54'; })
    },
    hovertemplate: '%{x}: %{y:+.1f}% vs avg<extra></extra>'
  }], plotlyLayout({
    xaxis: { categoryorder: 'array', categoryarray: monthNames },
    yaxis: { title: '% vs Average', ticksuffix: '%', nticks: 6 },
    showlegend: false
  }), PLOTLY_CONFIG);

  // --- Chart 4: Cohort Analysis (first protocol) ---
  var cohortProto = protocols[0];
  if (cohortProto && cohortProto.cohorts && cohortProto.cohorts.length > 0) {
    var cohortTraces = [];
    var nCohorts = Math.min(6, cohortProto.cohorts.length);
    var startC = cohortProto.cohorts.length - nCohorts;
    for (var ci2 = startC; ci2 < cohortProto.cohorts.length; ci2++) {
      var cohort = cohortProto.cohorts[ci2];
      cohortTraces.push({
        x: cohort.map(function (_, i) { return 'M' + i; }),
        y: cohort.map(function (v) { return v * 100; }),
        name: 'Cohort ' + (ci2 + 1),
        type: 'scatter', mode: 'lines+markers',
        line: { width: 1.5 },
        marker: { size: 4 }
      });
    }

    Plotly.newPlot('chart-cohort', cohortTraces, plotlyLayout({
      title: { text: cohortProto.name + ' Cohorts', font: { size: 12 } },
      xaxis: { title: 'Month' },
      yaxis: { title: 'Retention %', ticksuffix: '%', range: [0, 105], nticks: 6 },
      legend: { orientation: 'h', x: 0, y: -0.2, font: { size: 9 } }
    }), PLOTLY_CONFIG);
  } else {
    showEmpty('chart-cohort');
  }
}

// ===================================================================
// TAB 4: LTV & INCENTIVES
// ===================================================================
function renderLTVTab() {
  var protocols = getFilteredProtocols();

  if (protocols.length === 0) {
    setKPI('kpi-avg-ltv-cac', '—');
    setKPI('kpi-best-ltv-cac', '—');
    setKPI('kpi-avg-arpu', '—');
    setKPI('kpi-total-incentives', '—');
    showEmpty('chart-ltv-cac');
    showEmpty('chart-arpu');
    showEmpty('chart-incentives');
    return;
  }

  // Compute LTV, CAC, ARPU for each protocol
  var ltvData = [];
  var totalIncentives = 0;

  protocols.forEach(function (p) {
    var monthly = getFilteredMonthly(p);
    if (monthly.length === 0) return;

    var latest = monthly[monthly.length - 1];
    var monthlyARPU = latest.arpu || 0;

    // Retention months from cohorts
    var retMonths = 1;
    if (p.cohorts && p.cohorts.length > 0) {
      var avgCohort = [];
      for (var mi = 0; mi < 12; mi++) {
        var sum = 0;
        var cnt = 0;
        p.cohorts.forEach(function (c) {
          if (c[mi] !== undefined) { sum += c[mi]; cnt++; }
        });
        avgCohort.push(cnt > 0 ? sum / cnt : 0);
      }
      retMonths = avgCohort.reduce(function (s, v) { return s + v; }, 0);
    }

    // LTV = monthly ARPU × total retention months (area under curve)
    var ltv = monthlyARPU * retMonths;

    // CAC = trailing 3-month avg incentives / estimated new users
    var tail3 = monthly.slice(-3);
    var avgIncentives = tail3.reduce(function (s, m) { return s + m.tokenIncentives; }, 0) / tail3.length;
    var avgDAU = tail3.reduce(function (s, m) { return s + m.dau; }, 0) / tail3.length;
    var estNewUsers = avgDAU * 0.2; // assume 20% are new
    var cac = estNewUsers > 0 ? avgIncentives / estNewUsers : 0;

    var ltvCac = cac > 0 ? ltv / cac : 0;

    totalIncentives += monthly.reduce(function (s, m) { return s + m.tokenIncentives; }, 0);

    ltvData.push({
      name: p.name,
      id: p.id,
      sector: p.sector,
      ltv: ltv,
      cac: cac,
      ltvCac: ltvCac,
      arpu: monthlyARPU,
      retMonths: retMonths
    });
  });

  ltvData.sort(function (a, b) { return b.ltvCac - a.ltvCac; });

  // KPIs
  var avgLtvCac = ltvData.length > 0
    ? ltvData.reduce(function (s, d) { return s + d.ltvCac; }, 0) / ltvData.length
    : 0;
  var bestLtvCac = ltvData.length > 0 ? ltvData[0] : null;
  var avgArpu = ltvData.length > 0
    ? ltvData.reduce(function (s, d) { return s + d.arpu; }, 0) / ltvData.length
    : 0;

  setKPI('kpi-avg-ltv-cac', fmtX(avgLtvCac));
  setKPI('kpi-best-ltv-cac', bestLtvCac ? bestLtvCac.name : '—', bestLtvCac ? fmtX(bestLtvCac.ltvCac) : '');
  setKPI('kpi-avg-arpu', fmtUSD(avgArpu, false));
  setKPI('kpi-total-incentives', fmtUSD(totalIncentives));

  // --- Chart 1: LTV / CAC Ratio ---
  Plotly.newPlot('chart-ltv-cac', [{
    y: ltvData.map(function (d) { return d.name; }),
    x: ltvData.map(function (d) { return Math.min(d.ltvCac, 50); }),
    type: 'bar',
    orientation: 'h',
    marker: {
      color: ltvData.map(function (d) {
        return d.ltvCac >= 3 ? '#4af6c3' : d.ltvCac >= 1 ? '#fbbf24' : '#ff5a54';
      })
    },
    hovertemplate: '%{y}: %{x:.1f}x<extra></extra>'
  }], plotlyLayout({
    margin: { l: 120, r: 20, t: 20, b: 40 },
    xaxis: { title: 'LTV / CAC', ticksuffix: 'x' },
    yaxis: { autorange: 'reversed' },
    showlegend: false,
    shapes: [{
      type: 'line', x0: 3, x1: 3, y0: -0.5, y1: ltvData.length - 0.5,
      line: { color: '#fbbf24', width: 1, dash: 'dash' }
    }],
    annotations: [{
      x: 3, y: -0.8, text: '3x threshold', showarrow: false,
      font: { size: 9, color: '#fbbf24' }
    }]
  }), PLOTLY_CONFIG);

  // --- Chart 2: ARPU by Protocol ---
  var arpuSorted = ltvData.slice().sort(function (a, b) { return b.arpu - a.arpu; });
  Plotly.newPlot('chart-arpu', [{
    y: arpuSorted.map(function (d) { return d.name; }),
    x: arpuSorted.map(function (d) { return d.arpu; }),
    type: 'bar',
    orientation: 'h',
    marker: {
      color: arpuSorted.map(function (d) { return SECTOR_COLORS[d.sector] || '#4a9eff'; })
    },
    hovertemplate: '%{y}: $%{x:,.2f}<extra></extra>'
  }], plotlyLayout({
    margin: { l: 120, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Monthly ARPU', tickprefix: '$' },
    yaxis: { autorange: 'reversed' },
    showlegend: false
  }), PLOTLY_CONFIG);

  // --- Chart 3: Token Incentives Over Time ---
  var incTraces = [];
  protocols.forEach(function (p) {
    var monthly = getFilteredMonthly(p);
    if (monthly.length === 0) return;
    incTraces.push({
      x: monthly.map(function (m) { return m.date; }),
      y: monthly.map(function (m) { return m.tokenIncentives; }),
      name: p.name,
      type: 'scatter', mode: 'lines',
      line: { color: SECTOR_COLORS[p.sector] || '#4a9eff', width: 1.5 },
      stackgroup: 'one'
    });
  });

  if (incTraces.length > 0) {
    Plotly.newPlot('chart-incentives', incTraces, plotlyLayout({
      yaxis: { title: 'Token Incentives', tickprefix: '$', nticks: 6 },
      legend: { orientation: 'h', x: 0, y: -0.2, font: { size: 9 } }
    }), PLOTLY_CONFIG);
  } else {
    showEmpty('chart-incentives');
  }

  // --- Table: LTV & Incentives Summary ---
  var tbody = document.querySelector('#table-ltv tbody');
  if (tbody) {
    tbody.innerHTML = '';
    ltvData.forEach(function (d) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + d.name + '</td>' +
        '<td>' + fmtUSD(d.ltv, false) + '</td>' +
        '<td>' + fmtUSD(d.cac, false) + '</td>' +
        '<td>' + fmtX(d.ltvCac) + '</td>';
      tbody.appendChild(tr);
    });
    makeSortable(document.getElementById('table-ltv'));
  }
}

// ===================================================================
// TAB 5: MARGINS & VALUATION
// ===================================================================
function renderMarginsTab() {
  var protocols = getFilteredProtocols();

  if (protocols.length === 0) {
    setKPI('kpi-avg-margin', '—');
    setKPI('kpi-highest-margin', '—');
    setKPI('kpi-avg-ps-margin', '—');
    setKPI('kpi-total-tvl', '—');
    showEmpty('chart-margins');
    showEmpty('chart-margin-trends');
    showEmpty('chart-tvl-composition');
    return;
  }

  // Compute margin data
  var marginData = [];
  var totalTVL = 0;

  protocols.forEach(function (p) {
    var monthly = getFilteredMonthly(p);
    if (monthly.length === 0) return;
    var latest = monthly[monthly.length - 1];
    var grossMargin = latest.grossMargin || 0;
    var netMargin = latest.netMargin || 0;
    totalTVL += latest.tvl || 0;

    marginData.push({
      name: p.name,
      id: p.id,
      sector: p.sector,
      grossMargin: grossMargin,
      netMargin: netMargin,
      revenue: latest.revenue,
      expenses: latest.costOfRevenue + latest.tokenIncentives,
      tvl: latest.tvl || 0,
      psRatio: latest.psRatio || 0
    });
  });

  marginData.sort(function (a, b) { return b.grossMargin - a.grossMargin; });

  // KPIs — revenue-weighted average margin
  var wAvgMargin = weightedAvg(
    marginData,
    function (d) { return d.grossMargin; },
    function (d) { return d.revenue; }
  );
  var highestMargin = marginData.length > 0 ? marginData[0] : null;
  var wAvgPS = weightedAvg(
    marginData.filter(function (d) { return d.psRatio > 0; }),
    function (d) { return d.psRatio; },
    function (d) { return d.revenue; }
  );

  setKPI('kpi-avg-margin', fmtPct(wAvgMargin), 'Revenue-weighted');
  setKPI('kpi-highest-margin', highestMargin ? highestMargin.name : '—', highestMargin ? fmtPct(highestMargin.grossMargin) : '');
  setKPI('kpi-avg-ps-margin', fmtX(wAvgPS), 'Revenue-weighted');
  setKPI('kpi-total-tvl', fmtUSD(totalTVL));

  // --- Chart 1: Margin Comparison (grouped bar) ---
  var names = marginData.map(function (d) { return d.name; });
  Plotly.newPlot('chart-margins', [
    {
      y: names,
      x: marginData.map(function (d) { return d.grossMargin * 100; }),
      name: 'Gross Margin',
      type: 'bar',
      orientation: 'h',
      marker: { color: '#4a9eff' },
      hovertemplate: '%{y}: %{x:.1f}%<extra>Gross</extra>'
    },
    {
      y: names,
      x: marginData.map(function (d) { return d.netMargin * 100; }),
      name: 'Net Margin',
      type: 'bar',
      orientation: 'h',
      marker: { color: '#4af6c3' },
      hovertemplate: '%{y}: %{x:.1f}%<extra>Net</extra>'
    }
  ], plotlyLayout({
    barmode: 'group',
    margin: { l: 120, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Margin %', ticksuffix: '%', nticks: 6, range: [-100, 100] },
    yaxis: { autorange: 'reversed' }
  }), PLOTLY_CONFIG);

  // --- Chart 2: Margin Trends ---
  var mTrendTraces = [];
  protocols.forEach(function (p) {
    var monthly = getFilteredMonthly(p);
    if (monthly.length === 0) return;
    mTrendTraces.push({
      x: monthly.map(function (m) { return m.date; }),
      y: monthly.map(function (m) { return m.grossMargin * 100; }),
      name: p.name,
      type: 'scatter', mode: 'lines',
      line: { color: SECTOR_COLORS[p.sector] || '#4a9eff', width: 1.5 }
    });
  });

  if (mTrendTraces.length > 0) {
    Plotly.newPlot('chart-margin-trends', mTrendTraces, plotlyLayout({
      yaxis: { title: 'Gross Margin %', ticksuffix: '%', nticks: 6, range: [-100, 100] },
      legend: { orientation: 'h', x: 0, y: -0.2, font: { size: 9 } }
    }), PLOTLY_CONFIG);
  } else {
    showEmpty('chart-margin-trends');
  }

  // --- Chart 3: TVL Composition (stacked area) ---
  var tvlTraces = [];
  protocols.forEach(function (p) {
    var monthly = getFilteredMonthly(p);
    if (monthly.length === 0) return;
    tvlTraces.push({
      x: monthly.map(function (m) { return m.date; }),
      y: monthly.map(function (m) { return m.tvl; }),
      name: p.name,
      type: 'scatter', mode: 'lines',
      line: { color: SECTOR_COLORS[p.sector] || '#4a9eff', width: 0 },
      fill: 'tonexty',
      stackgroup: 'one'
    });
  });

  if (tvlTraces.length > 0) {
    Plotly.newPlot('chart-tvl-composition', tvlTraces, plotlyLayout({
      yaxis: { title: 'TVL', tickprefix: '$', nticks: 6 },
      legend: { orientation: 'h', x: 0, y: -0.2, font: { size: 9 } }
    }), PLOTLY_CONFIG);
  } else {
    showEmpty('chart-tvl-composition');
  }

  // --- Table: Margins & Valuation Summary ---
  var tbody = document.querySelector('#table-margins tbody');
  if (tbody) {
    tbody.innerHTML = '';
    marginData.forEach(function (d) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + d.name + '</td>' +
        '<td>' + fmtUSD(d.revenue) + '</td>' +
        '<td>' + fmtUSD(d.expenses) + '</td>' +
        '<td>' + fmtPct(d.grossMargin) + '</td>';
      tbody.appendChild(tr);
    });
    makeSortable(document.getElementById('table-margins'));
  }
}
