/* ==========================================================================
   charts.js  —  Plotly chart rendering for crypto analytics dashboard
   --------------------------------------------------------------------------
   Globals (loaded before this file):
     SECTOR_COLORS, SECTOR_LABELS, PROTOCOLS                       (data.js)
     STATE, getFilteredProtocols, getFilteredMonthly,
       getFilteredQuarterly                                        (filters.js)
     fmtUSD, fmtPct, fmtX, fmtRatio, fmtNum, fmtTrend, safeDiv,
       weightedAvg, exportTableCSV, makeSortable, detectOverflow,
       changeClass, changeStr                                      (utils.js)
     Plotly                                                        (CDN)
   ========================================================================== */

/* ══════════════════════════════════════════════════════════════════════════
   1.  PLOTLY DEFAULTS
   ══════════════════════════════════════════════════════════════════════════ */

var PLOTLY_LAYOUT = {
  font:  { family: 'Inter, system-ui, sans-serif', size: 12, color: '#c8c8c8' },
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  margin: { t: 32, r: 24, b: 56, l: 64 },
  showlegend: true,
  legend: { orientation: 'h', y: -0.18, x: 0.5, xanchor: 'center', font: { size: 11 } },
  xaxis: { gridcolor: 'rgba(255,255,255,0.06)', zerolinecolor: 'rgba(255,255,255,0.1)' },
  yaxis: { gridcolor: 'rgba(255,255,255,0.06)', zerolinecolor: 'rgba(255,255,255,0.1)' },
  hoverlabel: { bgcolor: '#1a1a2e', bordercolor: '#333', font: { size: 12 } },
  autosize: true
};

var PLOTLY_CONFIG = {
  displayModeBar: true,
  modeBarButtonsToRemove: [
    'zoom2d','pan2d','select2d','lasso2d',
    'zoomIn2d','zoomOut2d','autoScale2d','resetScale2d'
  ],
  displaylogo: false,
  responsive: true
};

/* ══════════════════════════════════════════════════════════════════════════
   2.  HELPERS
   ══════════════════════════════════════════════════════════════════════════ */

/** Return Plotly layout overrides based on current light/dark theme */
function getPlotlyTheme() {
  var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    font: { color: isDark ? '#c8c8c8' : '#333333' },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: {
      gridcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
      zerolinecolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)'
    },
    yaxis: {
      gridcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
      zerolinecolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)'
    },
    hoverlabel: {
      bgcolor: isDark ? '#1a1a2e' : '#ffffff',
      bordercolor: isDark ? '#333' : '#ddd',
      font: { size: 12, color: isDark ? '#e8e8e8' : '#333' }
    }
  };
}

/** Deep-copy PLOTLY_LAYOUT, merge theme overrides, then merge caller overrides */
function layoutWith(overrides) {
  var base = JSON.parse(JSON.stringify(PLOTLY_LAYOUT));

  // Merge theme overrides first
  var theme = getPlotlyTheme();
  Object.keys(theme).forEach(function (k) {
    if ((k === 'xaxis' || k === 'yaxis' || k === 'yaxis2') && typeof theme[k] === 'object' && base[k]) {
      Object.assign(base[k], theme[k]);
    } else if (k === 'font' && base[k]) {
      Object.assign(base[k], theme[k]);
    } else if (k === 'hoverlabel' && base[k]) {
      Object.assign(base[k], theme[k]);
    } else {
      base[k] = theme[k];
    }
  });

  // Then merge caller overrides on top
  Object.keys(overrides).forEach(function (k) {
    if ((k === 'xaxis' || k === 'yaxis' || k === 'yaxis2') && typeof overrides[k] === 'object' && base[k]) {
      Object.assign(base[k], overrides[k]);
    } else {
      base[k] = overrides[k];
    }
  });
  return base;
}

/** Show empty-state placeholder in a container; returns true */
function emptyState(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return true;
  el.innerHTML = '<div class="empty-state">No data available for current filters</div>';
  return true;
}

/** True when every trace has an empty y / z / values array */
function tracesEmpty(traces) {
  if (!traces || traces.length === 0) return true;
  return traces.every(function (t) {
    if (t.y && Array.isArray(t.y) && t.y.length > 0) return false;
    if (t.z && Array.isArray(t.z) && t.z.length > 0) return false;
    if (t.values && Array.isArray(t.values) && t.values.length > 0) return false;
    return true;
  });
}

/** Plotly.react with automatic empty-state guard */
function safeReact(id, traces, layout, config) {
  if (tracesEmpty(traces)) { emptyState(id); return; }
  Plotly.react(id, traces, layout, config || PLOTLY_CONFIG);
}

/** Set a KPI card's innerHTML */
function setKpi(id, label, value, extra) {
  var el = document.getElementById(id);
  if (!el) return;
  var h = '<div class="kpi-label">' + label + '</div>';
  h += '<div class="kpi-value">' + value + '</div>';
  if (extra) h += '<div class="kpi-change ' + (extra.cls || '') + '">' + extra.text + '</div>';
  el.innerHTML = h;
}

/** Inject info-tip icon into the panel header that wraps chartId */
function addTooltip(chartId, tip) {
  var el = document.getElementById(chartId);
  if (!el) return;
  var panel = el.closest('.chart-panel');
  if (!panel) return;
  var h3 = panel.querySelector('.panel-header h3');
  if (!h3 || h3.querySelector('.info-tip')) return;
  h3.innerHTML += ' <i class="info-tip" data-tip="' + tip.replace(/"/g, '&quot;') + '">i</i>';
}

/** Add CSV export button to the panel header that wraps tableId */
function addExportBtn(tableId, filename) {
  var tbl = document.getElementById(tableId);
  if (!tbl) return;
  var panel = tbl.closest('.chart-panel');
  if (!panel) return;
  var hdr = panel.querySelector('.panel-header');
  if (!hdr || hdr.querySelector('.export-btn')) return;
  var btn = document.createElement('button');
  btn.className = 'export-btn';
  btn.textContent = 'CSV';
  btn.onclick = function () { exportTableCSV(tbl, filename || 'export'); };
  hdr.appendChild(btn);
}

/** Sort quarter strings "2024 Q1" chronologically */
function _qsort(a, b) {
  var ap = a.split(' Q'), bp = b.split(' Q');
  var d = Number(ap[0]) - Number(bp[0]);
  return d !== 0 ? d : Number(ap[1]) - Number(bp[1]);
}

/** Sector color for a protocol object */
function _sc(p) { return SECTOR_COLORS[p.sector] || '#888'; }

/** Clamp margin pct to [-300, 100] */
function _clampM(ratio) { return Math.max(-300, Math.min(100, ratio * 100)); }

/** Collect per-protocol latest-month data */
function _collect() {
  var protocols = getFilteredProtocols();
  return protocols.map(function (p) {
    var mo = getFilteredMonthly(p);
    var q  = getFilteredQuarterly(p);
    return {
      p: p,
      mo: mo,
      q: q,
      last: mo.length > 0 ? mo[mo.length - 1] : null,
      prev: mo.length > 1 ? mo[mo.length - 2] : null
    };
  });
}

/** Collect per-protocol data for top N protocols only (by latest revenue) */
function _collectTop(n) {
  var protocols = getTopFilteredProtocols(n);
  return protocols.map(function (p) {
    var mo = getFilteredMonthly(p);
    var q  = getFilteredQuarterly(p);
    return {
      p: p,
      mo: mo,
      q: q,
      last: mo.length > 0 ? mo[mo.length - 1] : null,
      prev: mo.length > 1 ? mo[mo.length - 2] : null
    };
  });
}

/**
 * Compute momentum signals for a protocol based on its monthly data.
 * Returns: { mom1: MoM%, mom3: 3-month growth%, streak: consecutive up/down months,
 *            signal: 'strong-up'|'up'|'neutral'|'down'|'strong-down',
 *            signalColor: CSS color, signalLabel: display text }
 */
function computeMomentum(monthly) {
  var result = { mom1: 0, mom3: 0, streak: 0, signal: 'neutral',
    signalColor: 'var(--text-muted)', signalLabel: 'Neutral' };
  if (!monthly || monthly.length < 2) return result;

  var latest = monthly[monthly.length - 1];
  var prev   = monthly[monthly.length - 2];

  /* mom1: MoM growth */
  if (prev.revenue > 0) {
    result.mom1 = (latest.revenue - prev.revenue) / prev.revenue;
  }

  /* mom3: 3-month growth */
  if (monthly.length >= 4) {
    var prev3 = monthly[monthly.length - 4];
    if (prev3.revenue > 0) {
      result.mom3 = (latest.revenue - prev3.revenue) / prev3.revenue;
    }
  }

  /* streak: consecutive months of positive or negative MoM growth from latest backwards */
  var streak = 0;
  for (var i = monthly.length - 1; i >= 1; i--) {
    var curRev  = monthly[i].revenue;
    var prevRev = monthly[i - 1].revenue;
    var diff = curRev - prevRev;
    if (i === monthly.length - 1) {
      /* First iteration — set direction */
      if (diff > 0) { streak = 1; }
      else if (diff < 0) { streak = -1; }
      else { break; }
    } else {
      if (diff > 0 && streak > 0) { streak++; }
      else if (diff < 0 && streak < 0) { streak--; }
      else { break; }
    }
  }
  result.streak = streak;

  /* signal classification */
  if (result.mom1 > 0.15 && result.mom3 > 0.30 && streak >= 3) {
    result.signal = 'strong-up';
    result.signalColor = 'var(--accent-teal)';
    result.signalLabel = 'Strong Up';
  } else if (result.mom1 < -0.15 && result.mom3 < -0.30 && streak <= -3) {
    result.signal = 'strong-down';
    result.signalColor = 'var(--accent-red)';
    result.signalLabel = 'Strong Down';
  } else if (result.mom1 > 0 && result.mom3 > 0) {
    result.signal = 'up';
    result.signalColor = '#4a9eff';
    result.signalLabel = 'Up';
  } else if (result.mom1 < 0 && result.mom3 < 0) {
    result.signal = 'down';
    result.signalColor = 'var(--accent-orange)';
    result.signalLabel = 'Down';
  } else {
    result.signal = 'neutral';
    result.signalColor = 'var(--text-muted)';
    result.signalLabel = 'Neutral';
  }

  return result;
}

/** Average retention months from cohort matrix */
function _retMonths(cohorts) {
  if (!cohorts || cohorts.length === 0) return 1;
  var t = 0;
  cohorts.forEach(function (c) { c.forEach(function (r) { t += r; }); });
  return t / cohorts.length;
}

/** Estimate new users: DAU * (1 - avg M1 retention) */
function _estNewUsers(dau, cohorts) {
  if (!cohorts || cohorts.length === 0 || dau <= 0) return 0;
  var avgM1 = cohorts.reduce(function (s, c) { return s + (c[1] || 0); }, 0) / cohorts.length;
  return Math.max(1, Math.round(dau * (1 - avgM1)));
}

/* ══════════════════════════════════════════════════════════════════════════
   3.  renderRevenueTab
   ══════════════════════════════════════════════════════════════════════════ */

function renderRevenueTab() {
  var all = _collect();
  var top25 = _collectTop(25);
  var wd  = all.filter(function (d) { return d.last !== null; });

  /* ── KPIs (use all protocols) ──────────────────────────────────── */
  var totalRev = wd.reduce(function (s, d) { return s + d.last.revenue; }, 0);
  var prevRev  = all.reduce(function (s, d) { return s + (d.prev ? d.prev.revenue : 0); }, 0);
  var mom      = prevRev > 0 ? (totalRev - prevRev) / prevRev : null;
  var trend    = fmtTrend(mom);
  var trendStr = trend.html || trend.text || '—';

  var avgTR = weightedAvg(
    wd.map(function (d) { return d.last; }),
    function (m) { return m.takeRate; },
    function (m) { return m.revenue; }
  );

  var top = wd.reduce(function (b, d) {
    return d.last.revenue > (b ? b.last.revenue : 0) ? d : b;
  }, null);

  setKpi('kpi-total-revenue', 'Total Revenue (Latest Mo.)', fmtUSD(totalRev),
    mom !== null ? { text: trendStr + ' MoM', cls: changeClass(mom) } : null);
  setKpi('kpi-revenue-growth',
    'Avg Take Rate <i class="info-tip" data-tip="Revenue &divide; Fees. The percentage of total user-paid fees retained by the protocol.">i</i>',
    fmtPct(avgTR));
  setKpi('kpi-median-take-rate', 'Protocols Tracked', String(wd.length));
  setKpi('kpi-top-protocol', 'Top Protocol', top ? top.p.name : '—',
    top ? { text: fmtUSD(top.last.revenue) + '/mo', cls: 'positive' } : null);

  /* ── Tooltips ─────────────────────────────────────────────────────── */
  addTooltip('chart-take-rate-heatmap',
    'Revenue \u00f7 Fees. The percentage of total user-paid fees retained by the protocol.');
  addTooltip('chart-revenue-consistency',
    '1 minus the coefficient of variation (std/mean). Higher = more predictable revenue.');
  addTooltip('chart-monthly-revenue',
    'Monthly revenue per protocol on a log scale.');

  /* ── Charts (top 25 for dense visuals) ─────────────────────────── */
  _revenueQuarterly(top25);
  _revenueTakeRateHeatmap(top25);
  _revenueConsistency(top25);
  _revenueDecomposition(all);
  _revenueTimeSeries(top25);
  _revenueMomentum(top25);
}

/* ----- Quarterly Revenue (span-2, FIRST panel) ----- */
function _revenueQuarterly(all) {
  var qSet = {};
  all.forEach(function (d) {
    d.q.forEach(function (qr) { qSet[qr.quarter] = true; });
  });
  var sortedQ = Object.keys(qSet).sort(_qsort);
  if (sortedQ.length === 0) { emptyState('chart-quarterly-revenue'); return; }

  var traces = all.map(function (d) {
    var map = {};
    d.q.forEach(function (qr) { map[qr.quarter] = qr.revenue; });
    return {
      x: sortedQ,
      y: sortedQ.map(function (q) { return map[q] || 0; }),
      name: d.p.name,
      type: 'bar',
      marker: { color: _sc(d.p) },
      hovertemplate: d.p.name + '<br>%{x}: %{y:$,.0f}<extra></extra>'
    };
  });

  safeReact('chart-quarterly-revenue', traces, layoutWith({
    barmode: 'stack',
    xaxis: { categoryorder: 'array', categoryarray: sortedQ },
    yaxis: { tickformat: '$,.0s', nticks: 6 },
    legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center', font: { size: 10 } }
  }));
}

/* ----- Take Rate Heatmap ----- */
function _revenueTakeRateHeatmap(all) {
  var wd = all.filter(function (d) { return d.mo.length > 0; });
  if (wd.length === 0) { emptyState('chart-take-rate-heatmap'); return; }

  var mSet = {};
  wd.forEach(function (d) { d.mo.forEach(function (m) { mSet[m.month] = true; }); });
  var months = Object.keys(mSet).sort();
  var names  = wd.map(function (d) { return d.p.name; });
  var z = wd.map(function (d) {
    var bm = {};
    d.mo.forEach(function (m) { bm[m.month] = m.takeRate * 100; });
    return months.map(function (mo) { return bm[mo] !== undefined ? bm[mo] : null; });
  });

  safeReact('chart-take-rate-heatmap', [{
    x: months, y: names, z: z,
    type: 'heatmap',
    name: 'Take Rate (%)',
    colorscale: [[0,'#0d1117'],[0.25,'#1a3a5c'],[0.5,'#4a9eff'],[0.75,'#80c4ff'],[1,'#e0f0ff']],
    hoverongaps: false,
    hovertemplate: '%{y}<br>%{x}: %{z:.1f}%<extra></extra>',
    colorbar: { title: '%', ticksuffix: '%', len: 0.8 }
  }], layoutWith({
    margin: { t: 24, r: 80, b: 48, l: 120 },
    yaxis: { autorange: 'reversed' }
  }));

  var wrap = document.getElementById('chart-take-rate-heatmap');
  if (wrap) { var pw = wrap.parentElement; if (pw) detectOverflow(pw); }
}

/* ----- Revenue Consistency (height: 350) ----- */
function _revenueConsistency(all) {
  var sorted = all.filter(function (d) { return d.p.consistency !== undefined; })
    .sort(function (a, b) { return (b.p.consistency || 0) - (a.p.consistency || 0); });
  if (sorted.length === 0) { emptyState('chart-revenue-consistency'); return; }

  safeReact('chart-revenue-consistency', [{
    x: sorted.map(function (d) { return d.p.name; }),
    y: sorted.map(function (d) { return d.p.consistency; }),
    name: 'Consistency Score',
    type: 'bar',
    marker: { color: sorted.map(function (d) { return _sc(d.p); }) },
    hovertemplate: '%{x}: %{y:.3f}<extra></extra>'
  }], layoutWith({
    height: 350,
    yaxis: { title: 'Score', range: [0, 1] },
    xaxis: { tickangle: -45 },
    showlegend: false
  }));
}

/* ----- Revenue Decomposition (protocol selector) ----- */
function _revenueDecomposition(all) {
  var protocols = getFilteredProtocols();
  var select   = document.getElementById('decomp-protocol-select');

  /* determine selected protocol */
  var sorted = protocols.slice().sort(function (a, b) {
    var ar = 0, br = 0;
    var am = getFilteredMonthly(a), bm = getFilteredMonthly(b);
    if (am.length) ar = am[am.length - 1].revenue;
    if (bm.length) br = bm[bm.length - 1].revenue;
    return br - ar;
  });

  var sel = STATE.decompProtocol;
  if (!sel || !sorted.find(function (p) { return p.name === sel; })) {
    sel = sorted.length > 0 ? sorted[0].name : null;
    STATE.decompProtocol = sel;
  }

  /* populate dropdown */
  if (select) {
    select.innerHTML = '';
    sorted.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.name; o.textContent = p.name;
      if (p.name === sel) o.selected = true;
      select.appendChild(o);
    });
    select.onchange = function () {
      STATE.decompProtocol = select.value;
      _revenueDecomposition(all);
    };
  }

  /* update panel header with protocol name */
  var cEl = document.getElementById('chart-revenue-decomposition');
  if (cEl) {
    var pan = cEl.closest('.chart-panel');
    if (pan) {
      var h3 = pan.querySelector('.panel-header h3');
      if (h3) h3.textContent = 'Revenue Decomposition' + (sel ? ': ' + sel : '');
    }
  }

  if (!sel) { emptyState('chart-revenue-decomposition'); return; }
  var sp = sorted.find(function (p) { return p.name === sel; });
  if (!sp) { emptyState('chart-revenue-decomposition'); return; }

  var mo = getFilteredMonthly(sp);
  if (mo.length === 0) { emptyState('chart-revenue-decomposition'); return; }

  /* x values MUST be month strings, never numeric indices */
  var xM = mo.map(function (m) { return m.month; });

  safeReact('chart-revenue-decomposition', [
    { x: xM, y: mo.map(function (m) { return m.fees; }),
      name: 'Total Fees', type: 'bar', marker: { color: 'rgba(74,158,255,0.3)' } },
    { x: xM, y: mo.map(function (m) { return m.revenue; }),
      name: 'Revenue', type: 'bar', marker: { color: '#4a9eff' } },
    { x: xM, y: mo.map(function (m) { return m.tokenIncentives; }),
      name: 'Token Incentives', type: 'scatter', mode: 'lines+markers',
      line: { color: '#ff5a54', width: 2 }, marker: { size: 4 } },
    { x: xM, y: mo.map(function (m) { return m.earnings; }),
      name: 'Earnings', type: 'scatter', mode: 'lines+markers',
      line: { color: '#4af6c3', width: 2 }, marker: { size: 4 } }
  ], layoutWith({
    barmode: 'overlay',
    yaxis: { tickformat: '$,.0s', nticks: 6 },
    xaxis: { type: 'category' }
  }));
}

/* ----- Monthly Revenue Time Series (log scale) ----- */
function _revenueTimeSeries(all) {
  var wd = all.filter(function (d) { return d.mo.length > 0; });
  if (wd.length === 0) { emptyState('chart-monthly-revenue'); return; }

  var traces = wd.map(function (d) {
    return {
      x: d.mo.map(function (m) { return m.month; }),
      y: d.mo.map(function (m) { return Math.max(m.revenue, 1); }),
      name: d.p.name,
      type: 'scatter', mode: 'lines+markers',
      line: { color: _sc(d.p), width: 2 }, marker: { size: 4 },
      hovertemplate: d.p.name + '<br>%{x}: %{y:$,.0f}<extra></extra>'
    };
  });

  safeReact('chart-monthly-revenue', traces, layoutWith({
    yaxis: {
      type: 'log',
      tickvals: [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9],
      ticktext: ['$1K','$10K','$100K','$1M','$10M','$100M','$1B']
    },
    xaxis: { type: 'category' },
    legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center', font: { size: 10 } }
  }));
}

/* ----- Revenue Momentum Signals (horizontal bar chart by 3-month growth) ----- */
function _revenueMomentum(all) {
  var wd = all.filter(function (d) { return d.mo.length >= 4; });
  if (wd.length === 0) { emptyState('chart-momentum-signals'); return; }

  /* Compute momentum for each protocol and sort by mom3 */
  var items = wd.map(function (d) {
    var m = computeMomentum(d.mo);
    return { name: d.p.name, mom3: m.mom3, signal: m.signal, signalColor: m.signalColor };
  });
  items.sort(function (a, b) { return b.mom3 - a.mom3; });

  /* Build horizontal bar chart: mom3 (3-month revenue growth) per protocol */
  var names = items.map(function (d) { return d.name; });
  var vals  = items.map(function (d) { return d.mom3 * 100; });

  /* Color bars by signal */
  var signalColorMap = {
    'strong-up': 'rgba(74,246,195,0.8)',
    'up': 'rgba(74,158,255,0.8)',
    'neutral': 'rgba(100,100,100,0.5)',
    'down': 'rgba(251,139,30,0.8)',
    'strong-down': 'rgba(255,90,84,0.8)'
  };
  var colors = items.map(function (d) { return signalColorMap[d.signal] || 'rgba(100,100,100,0.5)'; });

  safeReact('chart-momentum-signals', [{
    y: names,
    x: vals,
    type: 'bar',
    orientation: 'h',
    marker: { color: colors },
    hovertemplate: '%{y}<br>3-Mo Growth: %{x:.1f}%<extra></extra>'
  }], layoutWith({
    margin: { t: 24, r: 24, b: 48, l: 120 },
    xaxis: { title: '3-Month Revenue Growth (%)', tickformat: '.0f', ticksuffix: '%', zeroline: true, zerolinecolor: 'rgba(255,255,255,0.2)', zerolinewidth: 2 },
    yaxis: { autorange: 'reversed', type: 'category' },
    showlegend: false,
    height: Math.max(300, items.length * 28 + 80)
  }));

  addTooltip('chart-momentum-signals',
    '3-month revenue growth per protocol. Bar color reflects momentum signal: green=up, blue=moderate up, orange=down, red=strong down.');
}

/* ══════════════════════════════════════════════════════════════════════════
   4.  renderValuationTab
   ══════════════════════════════════════════════════════════════════════════ */

function renderValuationTab() {
  var all = _collect();
  var top25 = _collectTop(25);
  var wd  = all.filter(function (d) { return d.last !== null; });
  /* Exclude fdv===0 for valuation metrics */
  var wf  = wd.filter(function (d) { return d.last.fdv > 0; });
  var wfTop = top25.filter(function (d) { return d.last !== null && d.last.fdv > 0; });

  /* ── KPIs (all protocols) ──────────────────────────────────────── */
  var avgPS = weightedAvg(
    wf.map(function (d) { return d.last; }),
    function (m) { return m.psRatio; },
    function (m) { return m.revenue; }
  );

  var psVals = wf.map(function (d) { return d.last.psRatio; }).sort(function (a,b) { return a-b; });
  var medPS  = psVals.length > 0 ? psVals[Math.floor(psVals.length / 2)] : 0;

  /* Cheapest P/S — exclude psRatio===0 */
  var withPS   = wf.filter(function (d) { return d.last.psRatio > 0; });
  var cheapest = withPS.reduce(function (b, d) {
    return (!b || d.last.psRatio < b.last.psRatio) ? d : b;
  }, null);

  var priciest = wf.reduce(function (b, d) {
    return (!b || d.last.psRatio > b.last.psRatio) ? d : b;
  }, null);

  setKpi('kpi-avg-ps',
    'Avg P/S Ratio <i class="info-tip" data-tip="Price-to-Sales: Fully diluted valuation &divide; annualized revenue">i</i>',
    fmtX(avgPS));
  setKpi('kpi-median-ps', 'Median P/S', fmtX(medPS));
  setKpi('kpi-most-overvalued', 'Most Expensive (P/S)',
    priciest ? priciest.p.name : '—',
    priciest ? { text: fmtX(priciest.last.psRatio), cls: 'negative' } : null);
  setKpi('kpi-most-undervalued', 'Cheapest P/S',
    cheapest ? cheapest.p.name : '—',
    cheapest ? { text: fmtX(cheapest.last.psRatio), cls: 'positive' } : null);

  /* ── Tooltips ─────────────────────────────────────────────────────── */
  addTooltip('chart-ps-scatter',
    'Price-to-Sales: Fully diluted valuation &divide; annualized revenue');
  addTooltip('chart-ps-ranking',
    'Price-to-Sales: Fully diluted valuation &divide; annualized revenue');

  /* ── Charts (scatter uses all; bars/lines use top 25) ──────────── */
  _valPSScatter(wf);
  _valPSRanking(wfTop);
  _valPSTrends(top25);
  _valTable(wf);
}

/* ----- P/S vs Revenue Scatter ----- */
function _valPSScatter(wf) {
  if (wf.length === 0) { emptyState('chart-ps-scatter'); return; }
  var bySec = {};
  wf.forEach(function (d) {
    var s = d.p.sector;
    if (!bySec[s]) bySec[s] = [];
    bySec[s].push(d);
  });

  var traces = Object.keys(bySec).map(function (sec) {
    var items = bySec[sec];
    return {
      x: items.map(function (d) { return d.last.revenue * 12; }),
      y: items.map(function (d) { return d.last.psRatio; }),
      text: items.map(function (d) { return d.p.name; }),
      name: SECTOR_LABELS[sec] || sec,
      type: 'scatter', mode: 'markers+text',
      textposition: 'top center',
      textfont: { size: 10, color: '#aaa' },
      marker: {
        color: SECTOR_COLORS[sec] || '#888',
        size: items.map(function (d) {
          return Math.max(8, Math.min(40, Math.sqrt(d.last.tvl || 0) / 1000));
        }),
        opacity: 0.8
      },
      hovertemplate: '%{text}<br>Ann. Rev: %{x:$,.0f}<br>P/S: %{y:.1f}x<extra></extra>'
    };
  });

  safeReact('chart-ps-scatter', traces, layoutWith({
    xaxis: { title: 'Annualized Revenue', tickformat: '$,.0s', type: 'log' },
    yaxis: { title: 'P/S Ratio', tickformat: ',.0f', ticksuffix: 'x' }
  }));
}

/* ----- P/S Ranking Bar ----- */
function _valPSRanking(wf) {
  var sorted = wf.slice().sort(function (a,b) { return a.last.psRatio - b.last.psRatio; });
  if (sorted.length === 0) { emptyState('chart-ps-ranking'); return; }

  safeReact('chart-ps-ranking', [{
    x: sorted.map(function (d) { return d.p.name; }),
    y: sorted.map(function (d) { return d.last.psRatio; }),
    name: 'P/S Ratio',
    type: 'bar',
    marker: { color: sorted.map(function (d) { return _sc(d.p); }) },
    hovertemplate: '%{x}: %{y:.1f}x<extra></extra>'
  }], layoutWith({
    yaxis: { title: 'P/S Ratio', tickformat: ',.0f', ticksuffix: 'x' },
    xaxis: { tickangle: -45 },
    showlegend: false
  }));
}

/* ----- P/S Time Series ----- */
function _valPSTrends(all) {
  var wd = all.filter(function (d) { return d.mo.length > 0; });
  if (wd.length === 0) { emptyState('chart-ps-trends'); return; }

  var traces = wd.map(function (d) {
    var valid = d.mo.filter(function (m) { return m.fdv > 0; });
    return {
      x: valid.map(function (m) { return m.month; }),
      y: valid.map(function (m) { return m.psRatio; }),
      name: d.p.name,
      type: 'scatter', mode: 'lines',
      line: { color: _sc(d.p), width: 2 },
      hovertemplate: d.p.name + '<br>%{x}: %{y:.1f}x<extra></extra>'
    };
  });

  safeReact('chart-ps-trends', traces, layoutWith({
    yaxis: { title: 'P/S Ratio', tickformat: ',.0f', ticksuffix: 'x' },
    xaxis: { type: 'category' }
  }));
}

/* ----- Valuation Summary Table ----- */
function _valTable(wf) {
  var tbody = document.querySelector('#table-valuation tbody');
  if (!tbody) return;
  var sorted = wf.slice().sort(function (a,b) { return a.last.psRatio - b.last.psRatio; });
  var h = '';
  sorted.forEach(function (d) {
    h += '<tr><td class="protocol-link" data-pid="' + d.p.id + '">' + d.p.name + '</td>'
       + '<td>' + fmtUSD(d.last.fdv) + '</td>'
       + '<td>' + fmtUSD(d.last.revenue * 12) + '</td>'
       + '<td>' + fmtX(d.last.psRatio) + '</td></tr>';
  });
  tbody.innerHTML = h;
  tbody.querySelectorAll('.protocol-link').forEach(function (el) {
    el.addEventListener('click', function () {
      if (typeof showProtocolDetail === 'function') showProtocolDetail(el.dataset.pid);
    });
  });
  addExportBtn('table-valuation', 'valuation-summary');
  makeSortable(document.getElementById('table-valuation'));
}

/* ══════════════════════════════════════════════════════════════════════════
   5.  renderRetentionTab
   ══════════════════════════════════════════════════════════════════════════ */

function renderRetentionTab() {
  var all = _collect();
  var wd  = all.filter(function (d) { return d.mo.length > 0; });

  /* ── KPIs ─────────────────────────────────────────────────────────── */
  var avgSticky = weightedAvg(
    wd,
    function (d) { return d.p.stickyIndex || 0; },
    function (d) { return d.last ? d.last.revenue : 0; }
  );

  /* Best 6-month retention */
  wd.forEach(function (d) {
    if (d.p.cohorts && d.p.cohorts.length > 0) {
      d._r6 = d.p.cohorts.reduce(function (s,c) { return s + (c[6]||0); }, 0) / d.p.cohorts.length;
    } else { d._r6 = 0; }
  });
  var bestRet = wd.reduce(function (b, d) { return (!b || d._r6 > b._r6) ? d : b; }, null);

  /* Seasonality */
  var sRev = {}, sCnt = {};
  wd.forEach(function (d) {
    d.mo.forEach(function (m) {
      var c = m.calMonth;
      sRev[c] = (sRev[c]||0) + m.revenue;
      sCnt[c] = (sCnt[c]||0) + 1;
    });
  });
  var mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var sAvg = []; for (var i=0;i<12;i++) sAvg.push(sCnt[i] ? sRev[i]/sCnt[i] : 0);
  var posAvg = sAvg.filter(function(v){return v>0;});
  var bestMi = sAvg.indexOf(Math.max.apply(null, sAvg));
  var worstMi = posAvg.length > 0 ? sAvg.indexOf(Math.min.apply(null, posAvg)) : 0;

  setKpi('kpi-avg-retention',
    'Avg Sticky Rev. Index <i class="info-tip" data-tip="min(revenue_t, revenue_t-1) &divide; max(revenue_t, revenue_t-1) averaged across all months. 1.0 = perfectly stable.">i</i>',
    avgSticky.toFixed(3));
  setKpi('kpi-best-retention', 'Best 6-Mo Retention',
    bestRet ? bestRet.p.name : '—',
    bestRet ? { text: fmtPct(bestRet._r6), cls: 'positive' } : null);
  setKpi('kpi-worst-month', 'Weakest Month', mNames[worstMi] || '—');
  setKpi('kpi-best-month', 'Strongest Month', mNames[bestMi] || '—');

  /* ── Tooltips ─────────────────────────────────────────────────────── */
  addTooltip('chart-retention-heatmap',
    'Cohort retention heatmap: % of M0 users retained per subsequent month.');
  addTooltip('chart-seasonality',
    'Average revenue by calendar month across all protocols.');

  /* ── Charts (top 25 for dense visuals) ─────────────────────────── */
  var top25 = _collectTop(25);
  _retHeatmap(top25);
  _retTrends(top25);
  _retSeason(sAvg, mNames);
  _retCohort(top25);
}

/* ----- Retention Heatmap ----- */
function _retHeatmap(all) {
  var wp = all.filter(function (d) { return d.p.cohorts && d.p.cohorts.length > 0; });
  if (wp.length === 0) { emptyState('chart-retention-heatmap'); return; }

  var mLbl = []; for (var i=0;i<=11;i++) mLbl.push('M'+i);
  var names = wp.map(function (d) { return d.p.name; });
  var z = wp.map(function (d) {
    var avg = [];
    for (var m=0;m<=11;m++) {
      var s=0,c=0;
      d.p.cohorts.forEach(function (co) { if (co[m]!==undefined){s+=co[m];c++;} });
      avg.push(c>0 ? s/c*100 : 0);
    }
    return avg;
  });

  safeReact('chart-retention-heatmap', [{
    x: mLbl, y: names, z: z,
    type: 'heatmap', name: 'Retention (%)',
    colorscale: [[0,'#1a0000'],[0.25,'#5c1a1a'],[0.5,'#b8860b'],[0.75,'#4af6c3'],[1,'#00ff88']],
    hoverongaps: false,
    hovertemplate: '%{y}<br>%{x}: %{z:.1f}%<extra></extra>',
    colorbar: { title: '%', ticksuffix: '%', len: 0.8 }
  }], layoutWith({
    margin: { t: 24, r: 80, b: 48, l: 120 },
    yaxis: { autorange: 'reversed' }
  }));

  var el = document.getElementById('chart-retention-heatmap');
  if (el) { var w = el.parentElement; if (w) detectOverflow(w); }
}

/* ----- Retention Trends (M6 by cohort index) ----- */
function _retTrends(all) {
  var wp = all.filter(function (d) { return d.p.cohorts && d.p.cohorts.length > 0; });
  if (wp.length === 0) { emptyState('chart-retention-trends'); return; }

  var traces = wp.map(function (d) {
    var m6 = d.p.cohorts.map(function (c) { return (c[6]||0)*100; });
    return {
      x: d.p.cohorts.map(function (_,i) { return 'Cohort '+(i+1); }),
      y: m6,
      name: d.p.name + ' (M6)',
      type: 'scatter', mode: 'lines+markers',
      line: { color: _sc(d.p), width: 2 }, marker: { size: 4 }
    };
  });

  safeReact('chart-retention-trends', traces, layoutWith({
    yaxis: { title: 'M6 Retention', tickformat: '.0f', ticksuffix: '%', range: [0,100] },
    xaxis: { type: 'category' }
  }));
}

/* ----- Seasonality ----- */
function _retSeason(sAvg, mNames) {
  if (sAvg.every(function (v) { return v===0; })) { emptyState('chart-seasonality'); return; }

  var maxV = Math.max.apply(null, sAvg);
  var posMin = Math.min.apply(null, sAvg.filter(function(v){return v>0;}));

  safeReact('chart-seasonality', [{
    x: mNames,
    y: sAvg,
    name: 'Avg Revenue',
    type: 'bar',
    marker: { color: sAvg.map(function (v) {
      return v===maxV ? '#4af6c3' : v===posMin ? '#ff5a54' : '#4a9eff';
    })},
    hovertemplate: '%{x}: %{y:$,.0f}<extra></extra>'
  }], layoutWith({
    yaxis: { tickformat: '$,.0s', nticks: 6 },
    showlegend: false,
    xaxis: { categoryorder: 'array', categoryarray: mNames }
  }));
}

/* ----- Cohort Curves ----- */
function _retCohort(all) {
  var wp = all.filter(function (d) { return d.p.cohorts && d.p.cohorts.length > 0; });
  if (wp.length === 0) { emptyState('chart-cohort'); return; }

  var mLbl = []; for (var i=0;i<=11;i++) mLbl.push('M'+i);
  var traces = wp.map(function (d) {
    var avg = [];
    for (var m=0;m<=11;m++) {
      var s=0; d.p.cohorts.forEach(function(c){s+=(c[m]||0);}); avg.push(s/d.p.cohorts.length*100);
    }
    return {
      x: mLbl, y: avg,
      name: d.p.name,
      type: 'scatter', mode: 'lines+markers',
      line: { color: _sc(d.p), width: 2 }, marker: { size: 4 },
      hovertemplate: d.p.name + '<br>%{x}: %{y:.1f}%<extra></extra>'
    };
  });

  safeReact('chart-cohort', traces, layoutWith({
    yaxis: { title: 'Retention %', tickformat: '.0f', ticksuffix: '%', range: [0,105], rangemode: 'tozero' },
    xaxis: { title: 'Months Since Acquisition', type: 'category' }
  }));
}

/* ══════════════════════════════════════════════════════════════════════════
   6.  renderLTVTab
   ══════════════════════════════════════════════════════════════════════════ */

function renderLTVTab() {
  var all = _collect();
  var wd  = all.filter(function (d) { return d.last !== null && d.mo.length >= 3; });

  /* ── Compute LTV, CAC, LTV/CAC per protocol ──────────────────────── */
  wd.forEach(function (d) {
    /* Monthly ARPU (already monthly, NOT annualized) */
    var avgArpu = d.last.arpu || 0;
    /* Average retention months from cohort data */
    var retMo = _retMonths(d.p.cohorts);
    /* LTV = monthlyARPU * retentionMonths */
    d._ltv = avgArpu * retMo;

    /* CAC = trailing-3-month avg incentives / trailing-3-month avg new users */
    var l3 = d.mo.slice(-3);
    var avgInc = l3.reduce(function (s,m) { return s + (m.tokenIncentives||0); }, 0) / l3.length;
    var avgNU  = l3.reduce(function (s,m) { return s + _estNewUsers(m.dau, d.p.cohorts); }, 0) / l3.length;
    d._cac = avgNU > 0 ? avgInc / avgNU : 0;
    d._ltvCac = d._cac > 0 ? d._ltv / d._cac : 0;

    /* Incentive ratio for table */
    var lR = d.last.revenue, lI = d.last.tokenIncentives || 0;
    if (lR === 0 && lI > 0) {
      d._incStr = 'N/A';
    } else {
      d._incStr = fmtPct(safeDiv(lI, lR, 0));
    }
  });

  /* ── KPIs ─────────────────────────────────────────────────────────── */
  var validLC = wd.filter(function (d) { return d._ltvCac > 0; });
  var avgLC   = validLC.length > 0
    ? validLC.reduce(function (s,d) { return s + d._ltvCac; }, 0) / validLC.length
    : 0;
  var bestLC = validLC.reduce(function (b,d) { return (!b || d._ltvCac > b._ltvCac) ? d : b; }, null);

  var avgArpu = weightedAvg(
    wd.map(function (d) { return d.last; }),
    function (m) { return m.arpu; },
    function (m) { return m.revenue; }
  );

  var totalInc = wd.reduce(function (s,d) {
    return s + d.mo.reduce(function (ms,m) { return ms + (m.tokenIncentives||0); }, 0);
  }, 0);

  /* Positive Earnings (Latest Month) */
  var posEarn = wd.filter(function (d) { return d.last.earnings > 0; }).length;

  setKpi('kpi-avg-ltv-cac',
    'Avg LTV/CAC <i class="info-tip" data-tip="Estimated user lifetime value: monthly ARPU &times; average retention months">i</i>',
    fmtX(avgLC));
  setKpi('kpi-best-ltv-cac', 'Best LTV/CAC',
    bestLC ? bestLC.p.name : '—',
    bestLC ? { text: fmtX(bestLC._ltvCac), cls: 'positive' } : null);
  setKpi('kpi-avg-arpu', 'Avg Monthly ARPU', fmtUSD(avgArpu));
  setKpi('kpi-total-incentives',
    'Positive Earnings (Latest Month)',
    String(posEarn) + ' / ' + wd.length,
    { text: 'protocols with positive earnings', cls: posEarn > wd.length/2 ? 'positive' : 'negative' });

  /* ── Tooltips ─────────────────────────────────────────────────────── */
  addTooltip('chart-ltv-cac',
    'Estimated customer acquisition cost: trailing 3-month avg incentives &divide; estimated new users');
  addTooltip('chart-arpu', 'Average revenue per user (monthly) by protocol.');
  addTooltip('chart-incentives',
    'Cumulative token incentive spending over time across all protocols.');

  /* ── Charts (top 25 for dense visuals, table uses all) ──────────── */
  var top25 = _collectTop(25);
  var wdTop = top25.filter(function (d) { return d.last !== null && d.mo.length >= 3; });
  // Compute LTV for top-25 display subset
  wdTop.forEach(function (d) {
    var avgArpu = d.last.arpu || 0;
    var retMo = _retMonths(d.p.cohorts);
    d._ltv = avgArpu * retMo;
    var l3 = d.mo.slice(-3);
    var avgInc = l3.reduce(function (s,m) { return s + (m.tokenIncentives||0); }, 0) / l3.length;
    var avgNU  = l3.reduce(function (s,m) { return s + _estNewUsers(m.dau, d.p.cohorts); }, 0) / l3.length;
    d._cac = avgNU > 0 ? avgInc / avgNU : 0;
    d._ltvCac = d._cac > 0 ? d._ltv / d._cac : 0;
  });
  _ltvCACChart(wdTop);
  _ltvARPUChart(wdTop);
  _ltvIncentivesChart(top25);
  _ltvTable(wd);
}

/* ----- LTV / CAC Bar ----- */
function _ltvCACChart(wd) {
  var sorted = wd.filter(function (d) { return d._ltvCac > 0; })
    .sort(function (a,b) { return b._ltvCac - a._ltvCac; });
  if (sorted.length === 0) { emptyState('chart-ltv-cac'); return; }

  safeReact('chart-ltv-cac', [{
    x: sorted.map(function (d) { return d.p.name; }),
    y: sorted.map(function (d) { return d._ltvCac; }),
    name: 'LTV / CAC',
    type: 'bar',
    marker: { color: sorted.map(function (d) { return d._ltvCac >= 1 ? '#4af6c3' : '#ff5a54'; }) },
    hovertemplate: '%{x}: %{y:.2f}x<extra></extra>'
  }], layoutWith({
    yaxis: { title: 'LTV / CAC Ratio', tickformat: ',.1f', ticksuffix: 'x' },
    xaxis: { tickangle: -45 },
    showlegend: false,
    shapes: [{
      type: 'line', x0: -0.5, x1: sorted.length - 0.5,
      y0: 1, y1: 1,
      line: { color: '#fbbf24', width: 2, dash: 'dash' }
    }]
  }));
}

/* ----- ARPU Bar ----- */
function _ltvARPUChart(wd) {
  var sorted = wd.slice().sort(function (a,b) { return (b.last.arpu||0)-(a.last.arpu||0); });
  if (sorted.length === 0) { emptyState('chart-arpu'); return; }

  safeReact('chart-arpu', [{
    x: sorted.map(function (d) { return d.p.name; }),
    y: sorted.map(function (d) { return d.last.arpu; }),
    name: 'Monthly ARPU',
    type: 'bar',
    marker: { color: sorted.map(function (d) { return _sc(d.p); }) },
    hovertemplate: '%{x}: %{y:$,.2f}<extra></extra>'
  }], layoutWith({
    yaxis: { title: 'Monthly ARPU', tickformat: '$,.0s', nticks: 6 },
    xaxis: { tickangle: -45 },
    showlegend: false
  }));
}

/* ----- Cumulative Incentives ----- */
function _ltvIncentivesChart(all) {
  var wd = all.filter(function (d) { return d.mo.length > 0; });
  if (wd.length === 0) { emptyState('chart-incentives'); return; }

  var traces = wd.map(function (d) {
    var cum = [], run = 0;
    d.mo.forEach(function (m) { run += (m.tokenIncentives||0); cum.push(run); });
    return {
      x: d.mo.map(function (m) { return m.month; }),
      y: cum,
      name: d.p.name,
      type: 'scatter', mode: 'lines',
      line: { color: _sc(d.p), width: 2 },
      stackgroup: 'one',
      hovertemplate: d.p.name + '<br>%{x}: %{y:$,.0f}<extra></extra>'
    };
  });

  safeReact('chart-incentives', traces, layoutWith({
    yaxis: { title: 'Cumulative Incentives', tickformat: '$,.0s', nticks: 6 },
    xaxis: { type: 'category' }
  }));
}

/* ----- LTV & Incentives Table ----- */
function _ltvTable(wd) {
  var tbody = document.querySelector('#table-ltv tbody');
  if (!tbody) return;
  var sorted = wd.slice().sort(function (a,b) { return (b._ltvCac||0)-(a._ltvCac||0); });
  var h = '';
  sorted.forEach(function (d) {
    h += '<tr><td class="protocol-link" data-pid="' + d.p.id + '">' + d.p.name + '</td>'
       + '<td>' + fmtUSD(d._ltv) + '</td>'
       + '<td>' + (d._cac > 0 ? fmtUSD(d._cac) : '—') + '</td>'
       + '<td>' + (d._ltvCac > 0 ? fmtX(d._ltvCac) : '—') + '</td></tr>';
  });
  tbody.innerHTML = h;
  tbody.querySelectorAll('.protocol-link').forEach(function (el) {
    el.addEventListener('click', function () {
      if (typeof showProtocolDetail === 'function') showProtocolDetail(el.dataset.pid);
    });
  });
  addExportBtn('table-ltv', 'ltv-incentives');
  makeSortable(document.getElementById('table-ltv'));
}

/* ══════════════════════════════════════════════════════════════════════════
   7.  renderMarginsTab
   ══════════════════════════════════════════════════════════════════════════ */

function renderMarginsTab() {
  var all = _collect();
  var wd  = all.filter(function (d) { return d.last !== null; });

  /* ── KPIs ─────────────────────────────────────────────────────────── */
  var avgGM = weightedAvg(
    wd.map(function (d) { return d.last; }),
    function (m) { return m.grossMargin; },
    function (m) { return m.revenue; }
  );
  var avgNM = weightedAvg(
    wd.map(function (d) { return d.last; }),
    function (m) { return m.netMargin; },
    function (m) { return m.revenue; }
  );

  var bestM = wd.reduce(function (b,d) {
    return (!b || d.last.netMargin > b.last.netMargin) ? d : b;
  }, null);

  var totalTvl = wd.reduce(function (s,d) { return s + (d.last.tvl||0); }, 0);

  /* Positive Earnings (Latest Month) */
  var posEarn = wd.filter(function (d) { return d.last.earnings > 0; }).length;

  setKpi('kpi-avg-margin', 'Avg Gross Margin', fmtPct(avgGM));
  setKpi('kpi-highest-margin',
    'Positive Earnings (Latest Month)',
    String(posEarn) + ' / ' + wd.length,
    { text: 'protocols', cls: posEarn > wd.length/2 ? 'positive' : 'negative' });
  setKpi('kpi-avg-ps-margin',
    'Avg Net Margin <i class="info-tip" data-tip="Earnings &divide; Revenue. For L1s, token incentives include block rewards (issuance), not traditional operating expenses.">i</i>',
    '<span style="color:' + (avgNM>=0 ? 'var(--accent-teal)' : 'var(--accent-red)') + '">' + fmtPct(avgNM) + '</span>');
  setKpi('kpi-total-tvl', 'Total TVL', fmtUSD(totalTvl));

  /* ── Tooltips ─────────────────────────────────────────────────────── */
  addTooltip('chart-margins',
    'Earnings &divide; Revenue. For L1s, token incentives include block rewards (issuance), not traditional operating expenses.');
  addTooltip('chart-margin-trends',
    'Monthly gross and net margin trends. Clamped to [-300%, 100%].');

  /* ── Charts (top 25 for dense visuals, table uses all) ──────────── */
  var top25 = _collectTop(25);
  var wdTop = top25.filter(function (d) { return d.last !== null; });
  _marginsComparison(wdTop);
  _marginsTrends(top25);
  _marginsTVL(wdTop);
  var needFootnote = _marginsTable(wd);

  /* L1 footnote */
  if (needFootnote) {
    var tbl = document.getElementById('table-margins');
    if (tbl) {
      var panel = tbl.closest('.chart-panel');
      if (panel && !panel.querySelector('.l1-footnote')) {
        var fn = document.createElement('p');
        fn.className = 'footnote l1-footnote';
        fn.style.cssText = 'font-size:11px;color:var(--text-muted);padding:4px 12px;';
        fn.innerHTML = '&dagger; L1 net margins below -500% reflect token issuance (block rewards), not traditional operating losses.';
        panel.appendChild(fn);
      }
    }
  }
}

/* ----- Margin Comparison (Gross + Net, clamped range) ----- */
function _marginsComparison(wd) {
  var sorted = wd.slice().sort(function (a,b) { return (b.last.grossMargin||0)-(a.last.grossMargin||0); });
  if (sorted.length === 0) { emptyState('chart-margins'); return; }

  safeReact('chart-margins', [
    {
      x: sorted.map(function (d) { return d.p.name; }),
      y: sorted.map(function (d) { return _clampM(d.last.grossMargin); }),
      name: 'Gross Margin',
      type: 'bar',
      marker: { color: 'rgba(74,158,255,0.7)' },
      hovertemplate: '%{x}: %{y:.1f}%<extra>Gross Margin</extra>'
    },
    {
      x: sorted.map(function (d) { return d.p.name; }),
      y: sorted.map(function (d) { return _clampM(d.last.netMargin); }),
      name: 'Net Margin',
      type: 'bar',
      marker: { color: sorted.map(function (d) {
        return d.last.netMargin >= 0 ? 'rgba(74,246,195,0.7)' : 'rgba(255,90,84,0.7)';
      })},
      hovertemplate: '%{x}: %{y:.1f}%<extra>Net Margin</extra>'
    }
  ], layoutWith({
    barmode: 'group',
    yaxis: { title: 'Margin', tickformat: '.0f', ticksuffix: '%', range: [-300, 100] },
    xaxis: { tickangle: -45 }
  }));
}

/* ----- Margin Trends ----- */
function _marginsTrends(all) {
  var wd = all.filter(function (d) { return d.mo.length > 0; });
  if (wd.length === 0) { emptyState('chart-margin-trends'); return; }

  var traces = [];
  wd.forEach(function (d) {
    traces.push({
      x: d.mo.map(function (m) { return m.month; }),
      y: d.mo.map(function (m) { return _clampM(m.grossMargin); }),
      name: d.p.name + ' (Gross)',
      type: 'scatter', mode: 'lines',
      line: { color: _sc(d.p), width: 2 },
      hovertemplate: d.p.name + '<br>%{x}: %{y:.1f}%<extra>Gross</extra>'
    });
    traces.push({
      x: d.mo.map(function (m) { return m.month; }),
      y: d.mo.map(function (m) { return _clampM(m.netMargin); }),
      name: d.p.name + ' (Net)',
      type: 'scatter', mode: 'lines',
      line: { color: _sc(d.p), width: 1, dash: 'dash' },
      hovertemplate: d.p.name + '<br>%{x}: %{y:.1f}%<extra>Net</extra>',
      showlegend: false
    });
  });

  safeReact('chart-margin-trends', traces, layoutWith({
    yaxis: { title: 'Margin', tickformat: '.0f', ticksuffix: '%', range: [-300, 100] },
    xaxis: { type: 'category' }
  }));
}

/* ----- TVL Composition Pie ----- */
function _marginsTVL(wd) {
  var sorted = wd.filter(function (d) { return (d.last.tvl||0) > 0; })
    .sort(function (a,b) { return (b.last.tvl||0)-(a.last.tvl||0); });
  if (sorted.length === 0) { emptyState('chart-tvl-composition'); return; }

  safeReact('chart-tvl-composition', [{
    labels: sorted.map(function (d) { return d.p.name; }),
    values: sorted.map(function (d) { return d.last.tvl; }),
    name: 'TVL',
    type: 'pie',
    marker: { colors: sorted.map(function (d) { return _sc(d.p); }) },
    textinfo: 'label+percent',
    textposition: 'inside',
    hovertemplate: '%{label}<br>TVL: %{value:$,.0f}<br>%{percent}<extra></extra>',
    hole: 0.35
  }], layoutWith({
    showlegend: false,
    margin: { t: 20, r: 20, b: 20, l: 20 }
  }));
}

/* ----- Financial Summary Table (returns true if L1 footnote needed) ----- */
function _marginsTable(wd) {
  var tbody = document.querySelector('#table-margins tbody');
  if (!tbody) return false;

  var l1fn = false;
  var sorted = wd.slice().sort(function (a,b) { return (b.last.revenue||0)-(a.last.revenue||0); });
  var h = '';
  sorted.forEach(function (d) {
    var rev = d.last.revenue;
    var exp = (d.last.tokenIncentives||0) + (d.last.costOfRevenue||0);
    var nm  = d.last.netMargin;
    var nmD = fmtPct(nm);
    var isL1 = d.p.sector === 'l1';

    /* L1 net margin < -5 (i.e. < -500%): append dagger */
    if (isL1 && nm < -5) { nmD += ' &dagger;'; l1fn = true; }

    var col = nm >= 0 ? 'var(--accent-teal)' : 'var(--accent-red)';
    h += '<tr><td class="protocol-link" data-pid="' + d.p.id + '">' + d.p.name + '</td>'
       + '<td>' + fmtUSD(rev) + '</td>'
       + '<td>' + fmtUSD(exp) + '</td>'
       + '<td style="color:'+col+'">' + nmD + '</td></tr>';
  });
  tbody.innerHTML = h;
  tbody.querySelectorAll('.protocol-link').forEach(function (el) {
    el.addEventListener('click', function () {
      if (typeof showProtocolDetail === 'function') showProtocolDetail(el.dataset.pid);
    });
  });
  addExportBtn('table-margins', 'financial-summary');
  makeSortable(document.getElementById('table-margins'));
  return l1fn;
}

/* ══════════════════════════════════════════════════════════════════════════
   8.  renderCompareTab — Protocol Comparison
   ══════════════════════════════════════════════════════════════════════════ */

function renderCompareTab() {
  // Get selected protocol IDs from the dropdowns
  var selects = document.querySelectorAll('.compare-select');
  var selectedIds = [];
  selects.forEach(function (sel) {
    if (sel.value) selectedIds.push(sel.value);
  });

  if (selectedIds.length < 2) {
    // Show helper message
    var container = document.getElementById('compare-kpis');
    if (container) container.innerHTML = '<div class="empty-state">Select at least 2 protocols to compare</div>';
    ['chart-compare-revenue', 'chart-compare-ps', 'chart-compare-margins'].forEach(emptyState);
    var tbody0 = document.querySelector('#table-compare tbody');
    if (tbody0) tbody0.innerHTML = '';
    return;
  }

  // Collect data for selected protocols
  var protocols = selectedIds.map(function (id) {
    if (!STATE.data[id]) return null;
    var p = STATE.data[id];
    var mo = getFilteredMonthly(p);
    return { p: p, mo: mo, last: mo.length > 0 ? mo[mo.length - 1] : null };
  }).filter(Boolean);

  if (protocols.length < 2) {
    var container2 = document.getElementById('compare-kpis');
    if (container2) container2.innerHTML = '<div class="empty-state">Select at least 2 protocols to compare</div>';
    ['chart-compare-revenue', 'chart-compare-ps', 'chart-compare-margins'].forEach(emptyState);
    return;
  }

  // COMPARE COLORS - use distinct colors
  var compareColors = ['#4a9eff', '#fb8b1e', '#4af6c3', '#a78bfa'];

  // KPI comparison cards - show side-by-side KPIs
  var kpiEl = document.getElementById('compare-kpis');
  if (kpiEl) {
    var cols = protocols.length;
    kpiEl.style.gridTemplateColumns = '120px ' + ('1fr '.repeat(cols));

    var metrics = [
      { label: 'Revenue (Monthly)', fn: function(l) { return fmtUSD(l ? l.revenue : 0); } },
      { label: 'FDV', fn: function(l) { return fmtUSD(l ? l.fdv : 0); } },
      { label: 'P/S Ratio', fn: function(l) { return fmtX(l ? l.psRatio : 0); } },
      { label: 'TVL', fn: function(l) { return fmtUSD(l ? l.tvl : 0); } },
      { label: 'DAU', fn: function(l) { return fmtNum(l ? l.dau : 0); } },
      { label: 'Gross Margin', fn: function(l) { return fmtPct(l ? l.grossMargin : 0); } },
      { label: 'Net Margin', fn: function(l) { return fmtPct(l ? l.netMargin : 0); } },
      { label: 'Take Rate', fn: function(l) { return fmtPct(l ? l.takeRate : 0); } }
    ];

    var h = '';
    // Header row
    h += '<div class="compare-row compare-header"><div class="compare-label">Protocol</div>';
    protocols.forEach(function (d, i) {
      h += '<div class="compare-val" style="color:' + compareColors[i] + ';font-weight:600">' + d.p.name + '</div>';
    });
    h += '</div>';

    // Metric rows
    metrics.forEach(function (m) {
      h += '<div class="compare-row"><div class="compare-label">' + m.label + '</div>';
      protocols.forEach(function (d) {
        h += '<div class="compare-val">' + m.fn(d.last) + '</div>';
      });
      h += '</div>';
    });
    kpiEl.innerHTML = h;
  }

  // Revenue comparison chart (line chart)
  var revTraces = protocols.map(function (d, i) {
    return {
      x: d.mo.map(function (m) { return m.month; }),
      y: d.mo.map(function (m) { return m.revenue; }),
      name: d.p.name,
      type: 'scatter', mode: 'lines+markers',
      line: { color: compareColors[i], width: 2 }, marker: { size: 4 },
      hovertemplate: d.p.name + '<br>%{x}: %{y:$,.0f}<extra></extra>'
    };
  });
  safeReact('chart-compare-revenue', revTraces, layoutWith({
    yaxis: { tickformat: '$,.0s', nticks: 6 },
    xaxis: { type: 'category' }
  }));

  // P/S Ratio comparison
  var psTraces = protocols.map(function (d, i) {
    var valid = d.mo.filter(function (m) { return m.fdv > 0; });
    return {
      x: valid.map(function (m) { return m.month; }),
      y: valid.map(function (m) { return m.psRatio; }),
      name: d.p.name,
      type: 'scatter', mode: 'lines+markers',
      line: { color: compareColors[i], width: 2 }, marker: { size: 4 },
      hovertemplate: d.p.name + '<br>%{x}: %{y:.1f}x<extra></extra>'
    };
  });
  safeReact('chart-compare-ps', psTraces, layoutWith({
    yaxis: { title: 'P/S Ratio', tickformat: ',.0f', ticksuffix: 'x' },
    xaxis: { type: 'category' }
  }));

  // Margin comparison (grouped bar)
  var marginTraces = [];
  protocols.forEach(function (d, i) {
    if (d.last) {
      marginTraces.push({
        x: ['Gross Margin', 'Net Margin', 'Take Rate'],
        y: [(d.last.grossMargin || 0) * 100, Math.max(-300, (d.last.netMargin || 0) * 100), (d.last.takeRate || 0) * 100],
        name: d.p.name,
        type: 'bar',
        marker: { color: compareColors[i] },
        hovertemplate: d.p.name + '<br>%{x}: %{y:.1f}%<extra></extra>'
      });
    }
  });
  safeReact('chart-compare-margins', marginTraces, layoutWith({
    barmode: 'group',
    yaxis: { tickformat: '.0f', ticksuffix: '%' },
    showlegend: true
  }));

  // Summary table
  var tbody = document.querySelector('#table-compare tbody');
  var thead = document.querySelector('#table-compare thead tr');
  if (tbody && thead) {
    thead.innerHTML = '<th>Metric</th>';
    protocols.forEach(function (d) { thead.innerHTML += '<th>' + d.p.name + '</th>'; });

    var rows = [
      ['Sector', protocols.map(function(d){ return (SECTOR_LABELS[d.p.sector] || d.p.sector); })],
      ['Chains', protocols.map(function(d){ return d.p.chains.join(', '); })],
      ['Revenue', protocols.map(function(d){ return fmtUSD(d.last ? d.last.revenue : 0); })],
      ['FDV', protocols.map(function(d){ return fmtUSD(d.last ? d.last.fdv : 0); })],
      ['P/S', protocols.map(function(d){ return fmtX(d.last ? d.last.psRatio : 0); })],
      ['TVL', protocols.map(function(d){ return fmtUSD(d.last ? d.last.tvl : 0); })],
      ['DAU', protocols.map(function(d){ return fmtNum(d.last ? d.last.dau : 0); })],
      ['ARPU', protocols.map(function(d){ return d.last ? '$' + (d.last.arpu||0).toFixed(2) : '\u2014'; })],
      ['Consistency', protocols.map(function(d){ return (d.p.consistency||0).toFixed(3); })]
    ];

    var th = '';
    rows.forEach(function (r) {
      th += '<tr><td style="font-weight:500">' + r[0] + '</td>';
      r[1].forEach(function (v) { th += '<td>' + v + '</td>'; });
      th += '</tr>';
    });
    tbody.innerHTML = th;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   9.  renderScreenerTab — Full-page sortable/filterable protocol table
   ══════════════════════════════════════════════════════════════════════════ */

function renderScreenerTab() {
  var protocols = getFilteredProtocols();
  var tbody = document.querySelector('#table-screener tbody');
  if (!tbody) return;

  var countEl = document.getElementById('screener-count');
  if (countEl) countEl.textContent = protocols.length + ' protocols';

  // Build rows with sortable data
  var rows = protocols.map(function (p) {
    var mo = getFilteredMonthly(p);
    var last = mo.length > 0 ? mo[mo.length - 1] : null;
    var prev = mo.length > 1 ? mo[mo.length - 2] : null;
    var revGrowth = (last && prev && prev.revenue > 0) ? (last.revenue - prev.revenue) / prev.revenue : null;
    var momentum = computeMomentum(mo);

    return {
      p: p,
      name: p.name,
      sector: p.sector,
      revenue: last ? last.revenue : 0,
      revGrowth: revGrowth,
      fees: last ? last.fees : 0,
      takeRate: last ? last.takeRate : 0,
      fdv: last ? last.fdv : 0,
      ps: last ? last.psRatio : 0,
      tvl: last ? last.tvl : 0,
      dau: last ? last.dau : 0,
      grossMargin: last ? last.grossMargin : 0,
      netMargin: last ? last.netMargin : 0,
      consistency: p.consistency || 0,
      mom1: momentum.mom1,
      signal: momentum.signal,
      signalLabel: momentum.signalLabel,
      signalColor: momentum.signalColor
    };
  });

  // Sort by revenue descending by default
  rows.sort(function (a, b) { return b.revenue - a.revenue; });

  var h = '';
  rows.forEach(function (r) {
    var color = SECTOR_COLORS[r.sector] || '#6b7280';
    var sLabel = SECTOR_LABELS[r.sector] || r.sector;
    var growthCls = r.revGrowth !== null ? (r.revGrowth >= 0 ? 'positive' : 'negative') : '';
    var gmCls = r.grossMargin >= 0 ? 'positive' : 'negative';
    var nmCls = r.netMargin >= 0 ? 'positive' : 'negative';

    h += '<tr>';
    h += '<td class="protocol-link" data-pid="' + r.p.id + '" style="font-weight:500;cursor:pointer;color:var(--accent-blue)">' + r.name + '</td>';
    h += '<td style="font-family:var(--font-sans)"><span class="sector-dot" style="background:' + color + '"></span>' + sLabel + '</td>';
    h += '<td>' + fmtUSD(r.revenue) + '</td>';
    h += '<td class="' + growthCls + '">' + (r.revGrowth !== null ? fmtPct(r.revGrowth) : '\u2014') + '</td>';
    h += '<td>' + fmtUSD(r.fees) + '</td>';
    h += '<td>' + fmtPct(r.takeRate) + '</td>';
    h += '<td>' + fmtUSD(r.fdv) + '</td>';
    h += '<td>' + fmtX(r.ps) + '</td>';
    h += '<td>' + fmtUSD(r.tvl) + '</td>';
    h += '<td>' + fmtNum(r.dau) + '</td>';
    h += '<td class="' + gmCls + '">' + fmtPct(r.grossMargin) + '</td>';
    h += '<td class="' + nmCls + '">' + fmtPct(r.netMargin) + '</td>';
    h += '<td>' + r.consistency.toFixed(3) + '</td>';
    var momCls = r.mom1 >= 0 ? 'positive' : 'negative';
    h += '<td class="' + momCls + '">' + fmtPct(r.mom1) + '</td>';
    h += '<td><span class="signal-badge ' + r.signal + '">' + r.signalLabel + '</span></td>';
    h += '</tr>';
  });
  tbody.innerHTML = h;

  // Make protocol names clickable
  tbody.querySelectorAll('.protocol-link').forEach(function (el) {
    el.addEventListener('click', function () {
      if (typeof showProtocolDetail === 'function') showProtocolDetail(el.dataset.pid);
    });
  });

  // Make sortable
  makeSortable(document.getElementById('table-screener'));

  // CSV export
  var csvBtn = document.getElementById('screener-csv');
  if (csvBtn) {
    csvBtn.onclick = function () {
      exportTableCSV(document.getElementById('table-screener'), 'protocol-screener');
    };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   10.  renderSectorsTab — Sector Analytics
   ══════════════════════════════════════════════════════════════════════════ */

function renderSectorsTab() {
  /* ── Gather all protocols (ignore sector filter so we see all sectors) ── */
  var allProtocols = STATE.data ? Object.values(STATE.data) : [];

  /* Respect chain filter only */
  if (STATE.chain !== 'all') {
    allProtocols = allProtocols.filter(function (p) {
      return p.chains && p.chains.indexOf(STATE.chain) !== -1;
    });
  }

  if (allProtocols.length === 0) {
    ['chart-sector-revenue-quarterly', 'chart-sector-revenue-share',
     'chart-sector-growth', 'chart-sector-margins'].forEach(emptyState);
    return;
  }

  /* ── Build per-sector aggregations ───────────────────────────────────── */
  var sectorData = {};

  allProtocols.forEach(function (p) {
    var sec = p.sector || 'other';
    if (!sectorData[sec]) {
      sectorData[sec] = {
        protocols: [],
        totalRevenue: 0,
        totalTvl: 0,
        psValues: [],
        grossMargins: [],
        netMargins: [],
        latestRevenue: 0,
        prevRevenue: 0
      };
    }
    var sd = sectorData[sec];
    sd.protocols.push(p);

    var mo = getFilteredMonthly(p);
    var last = mo.length > 0 ? mo[mo.length - 1] : null;
    var prev = mo.length > 1 ? mo[mo.length - 2] : null;

    if (last) {
      sd.totalRevenue += last.revenue;
      sd.totalTvl += (last.tvl || 0);
      sd.latestRevenue += last.revenue;
      if (last.psRatio > 0) sd.psValues.push(last.psRatio);
      sd.grossMargins.push({ val: last.grossMargin, w: last.revenue });
      sd.netMargins.push({ val: last.netMargin, w: last.revenue });
    }
    if (prev) {
      sd.prevRevenue += prev.revenue;
    }
  });

  /* Compute derived metrics per sector */
  var sectors = Object.keys(sectorData);
  var sectorMetrics = [];

  sectors.forEach(function (sec) {
    var sd = sectorData[sec];
    var count = sd.protocols.length;
    var avgRev = count > 0 ? sd.totalRevenue / count : 0;

    var wGM = weightedAvg(
      sd.grossMargins,
      function (d) { return d.val; },
      function (d) { return d.w; }
    );

    var wNM = weightedAvg(
      sd.netMargins,
      function (d) { return d.val; },
      function (d) { return d.w; }
    );

    var avgPS = sd.psValues.length > 0
      ? sd.psValues.reduce(function (s, v) { return s + v; }, 0) / sd.psValues.length
      : 0;

    var momGrowth = sd.prevRevenue > 0
      ? (sd.latestRevenue - sd.prevRevenue) / sd.prevRevenue
      : null;

    sectorMetrics.push({
      sector: sec,
      label: SECTOR_LABELS[sec] || sec,
      color: SECTOR_COLORS[sec] || '#888',
      count: count,
      totalRevenue: sd.totalRevenue,
      avgRevenue: avgRev,
      totalTvl: sd.totalTvl,
      avgPS: avgPS,
      avgGrossMargin: wGM,
      avgNetMargin: wNM,
      momGrowth: momGrowth,
      protocols: sd.protocols
    });
  });

  /* Sort by total revenue descending */
  sectorMetrics.sort(function (a, b) { return b.totalRevenue - a.totalRevenue; });

  /* ── KPIs ─────────────────────────────────────────────────────────────── */
  var totalRev = sectorMetrics.reduce(function (s, d) { return s + d.totalRevenue; }, 0);
  var totalProto = sectorMetrics.reduce(function (s, d) { return s + d.count; }, 0);

  var fastestGrowing = sectorMetrics.filter(function (d) { return d.momGrowth !== null; })
    .reduce(function (best, d) {
      return (!best || d.momGrowth > best.momGrowth) ? d : best;
    }, null);

  var highestMargin = sectorMetrics.reduce(function (best, d) {
    return (!best || d.avgGrossMargin > best.avgGrossMargin) ? d : best;
  }, null);

  setKpi('kpi-sector-total-revenue', 'Total Revenue (All Sectors)', fmtUSD(totalRev));
  setKpi('kpi-sector-fastest-growing', 'Fastest Growing Sector',
    fastestGrowing ? fastestGrowing.label : '\u2014',
    fastestGrowing ? { text: fmtPct(fastestGrowing.momGrowth) + ' MoM', cls: changeClass(fastestGrowing.momGrowth) } : null);
  setKpi('kpi-sector-highest-margin', 'Highest Margin Sector',
    highestMargin ? highestMargin.label : '\u2014',
    highestMargin ? { text: fmtPct(highestMargin.avgGrossMargin) + ' gross', cls: 'positive' } : null);
  setKpi('kpi-sector-total-protocols', 'Total Protocols', String(totalProto));

  /* ── Tooltips ─────────────────────────────────────────────────────────── */
  addTooltip('chart-sector-revenue-quarterly',
    'Quarterly revenue aggregated by sector. Each sector bar sums all protocol revenues in that sector.');
  addTooltip('chart-sector-revenue-share',
    'Latest month revenue share by sector as a percentage of total.');
  addTooltip('chart-sector-growth',
    'Month-over-month revenue growth by sector.');
  addTooltip('chart-sector-margins',
    'Revenue-weighted average gross and net margin by sector.');

  /* ── Charts ───────────────────────────────────────────────────────────── */
  _sectorRevenueQuarterly(allProtocols, sectorMetrics);
  _sectorRevenueShare(sectorMetrics);
  _sectorGrowthRates(sectorMetrics);
  _sectorMarginsChart(sectorMetrics);
  _sectorSummaryTable(sectorMetrics);
}

/* ----- Quarterly Revenue by Sector (stacked bar, span-2) ----- */
function _sectorRevenueQuarterly(allProtocols, sectorMetrics) {
  var qBySector = {};
  var qSet = {};

  allProtocols.forEach(function (p) {
    var sec = p.sector || 'other';
    var mo = getFilteredMonthly(p);
    var quarterly = buildQuarterly(mo);

    quarterly.forEach(function (qr) {
      qSet[qr.quarter] = true;
      if (!qBySector[sec]) qBySector[sec] = {};
      if (!qBySector[sec][qr.quarter]) qBySector[sec][qr.quarter] = 0;
      qBySector[sec][qr.quarter] += qr.revenue;
    });
  });

  var sortedQ = Object.keys(qSet).sort(_qsort);
  if (sortedQ.length === 0) { emptyState('chart-sector-revenue-quarterly'); return; }

  var traces = sectorMetrics.map(function (sm) {
    var qData = qBySector[sm.sector] || {};
    return {
      x: sortedQ,
      y: sortedQ.map(function (q) { return qData[q] || 0; }),
      name: sm.label,
      type: 'bar',
      marker: { color: sm.color },
      hovertemplate: sm.label + '<br>%{x}: %{y:$,.0f}<extra></extra>'
    };
  });

  safeReact('chart-sector-revenue-quarterly', traces, layoutWith({
    barmode: 'stack',
    xaxis: { categoryorder: 'array', categoryarray: sortedQ },
    yaxis: { tickformat: '$,.0s', nticks: 6 },
    legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center', font: { size: 10 } }
  }));
}

/* ----- Sector Revenue Share (pie/donut) ----- */
function _sectorRevenueShare(sectorMetrics) {
  var withRev = sectorMetrics.filter(function (d) { return d.totalRevenue > 0; });
  if (withRev.length === 0) { emptyState('chart-sector-revenue-share'); return; }

  safeReact('chart-sector-revenue-share', [{
    labels: withRev.map(function (d) { return d.label; }),
    values: withRev.map(function (d) { return d.totalRevenue; }),
    name: 'Revenue Share',
    type: 'pie',
    marker: { colors: withRev.map(function (d) { return d.color; }) },
    textinfo: 'label+percent',
    textposition: 'inside',
    hovertemplate: '%{label}<br>Revenue: %{value:$,.0f}<br>%{percent}<extra></extra>',
    hole: 0.35
  }], layoutWith({
    showlegend: false,
    margin: { t: 20, r: 20, b: 20, l: 20 }
  }));
}

/* ----- Sector Growth Rates (bar chart) ----- */
function _sectorGrowthRates(sectorMetrics) {
  var withGrowth = sectorMetrics.filter(function (d) { return d.momGrowth !== null; });
  if (withGrowth.length === 0) { emptyState('chart-sector-growth'); return; }

  withGrowth.sort(function (a, b) { return b.momGrowth - a.momGrowth; });

  safeReact('chart-sector-growth', [{
    x: withGrowth.map(function (d) { return d.label; }),
    y: withGrowth.map(function (d) { return d.momGrowth * 100; }),
    name: 'MoM Growth',
    type: 'bar',
    marker: { color: withGrowth.map(function (d) {
      return d.momGrowth >= 0 ? d.color : 'rgba(255,90,84,0.7)';
    })},
    hovertemplate: '%{x}: %{y:.1f}%<extra></extra>'
  }], layoutWith({
    yaxis: { title: 'MoM Growth', tickformat: '.0f', ticksuffix: '%' },
    xaxis: { tickangle: -45 },
    showlegend: false
  }));
}

/* ----- Sector Margins (grouped bar: gross + net) ----- */
function _sectorMarginsChart(sectorMetrics) {
  var withData = sectorMetrics.filter(function (d) { return d.count > 0; });
  if (withData.length === 0) { emptyState('chart-sector-margins'); return; }

  safeReact('chart-sector-margins', [
    {
      x: withData.map(function (d) { return d.label; }),
      y: withData.map(function (d) { return _clampM(d.avgGrossMargin); }),
      name: 'Gross Margin',
      type: 'bar',
      marker: { color: 'rgba(74,158,255,0.7)' },
      hovertemplate: '%{x}: %{y:.1f}%<extra>Gross Margin</extra>'
    },
    {
      x: withData.map(function (d) { return d.label; }),
      y: withData.map(function (d) { return _clampM(d.avgNetMargin); }),
      name: 'Net Margin',
      type: 'bar',
      marker: { color: withData.map(function (d) {
        return d.avgNetMargin >= 0 ? 'rgba(74,246,195,0.7)' : 'rgba(255,90,84,0.7)';
      })},
      hovertemplate: '%{x}: %{y:.1f}%<extra>Net Margin</extra>'
    }
  ], layoutWith({
    barmode: 'group',
    yaxis: { title: 'Margin', tickformat: '.0f', ticksuffix: '%', range: [-300, 100] },
    xaxis: { tickangle: -45 },
    legend: { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center', font: { size: 11 } }
  }));
}

/* ----- Sector Summary Table ----- */
function _sectorSummaryTable(sectorMetrics) {
  var tbody = document.querySelector('#table-sector-summary tbody');
  if (!tbody) return;

  var h = '';
  sectorMetrics.forEach(function (d) {
    var gmCls = d.avgGrossMargin >= 0 ? 'positive' : 'negative';
    var nmCls = d.avgNetMargin >= 0 ? 'positive' : 'negative';

    h += '<tr>';
    h += '<td style="font-weight:500"><span class="sector-dot" style="background:' + d.color + '"></span>' + d.label + '</td>';
    h += '<td>' + d.count + '</td>';
    h += '<td>' + fmtUSD(d.totalRevenue) + '</td>';
    h += '<td>' + fmtUSD(d.avgRevenue) + '</td>';
    h += '<td>' + fmtUSD(d.totalTvl) + '</td>';
    h += '<td>' + fmtX(d.avgPS) + '</td>';
    h += '<td class="' + gmCls + '">' + fmtPct(d.avgGrossMargin) + '</td>';
    h += '<td class="' + nmCls + '">' + fmtPct(d.avgNetMargin) + '</td>';
    h += '</tr>';
  });
  tbody.innerHTML = h;

  addExportBtn('table-sector-summary', 'sector-summary');
  makeSortable(document.getElementById('table-sector-summary'));
}

/* ══════════════════════════════════════════════════════════════════════════
   11.  renderFinancialsTab — Income Statement / P&L for individual protocols
   ══════════════════════════════════════════════════════════════════════════ */

/** Format a value as negative USD with parentheses: ($1.2M) */
function fmtUSDNeg(n) {
  if (n === undefined || n === null || isNaN(n)) return '\u2014';
  var abs = Math.abs(n);
  var formatted;
  if (abs >= 1e12) formatted = '$' + (abs / 1e12).toFixed(1) + 'T';
  else if (abs >= 1e9) formatted = '$' + (abs / 1e9).toFixed(1) + 'B';
  else if (abs >= 1e6) formatted = '$' + (abs / 1e6).toFixed(1) + 'M';
  else if (abs >= 1e3) formatted = '$' + (abs / 1e3).toFixed(0) + 'K';
  else formatted = '$' + abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '(' + formatted + ')';
}

/** Format margin as percentage for the P&L table */
function _fmtMarginPct(n) {
  if (n === undefined || n === null || isNaN(n)) return '\u2014';
  var val = n * 100;
  if (Math.abs(val) > 999) return val > 0 ? '>999%' : '<-999%';
  return val.toFixed(1) + '%';
}

function renderFinancialsTab() {
  var select = document.getElementById('financials-protocol-select');
  var tableWrap = document.getElementById('financials-table-wrap');
  var waterfallEl = document.getElementById('chart-financials-waterfall');
  var areaEl = document.getElementById('chart-financials-area');

  /* ── Gather and sort protocols by revenue ─────────────────────── */
  var protocols = getFilteredProtocols();
  var sorted = protocols.slice().sort(function (a, b) {
    var ar = 0, br = 0;
    var am = getFilteredMonthly(a), bm = getFilteredMonthly(b);
    if (am.length) ar = am[am.length - 1].revenue;
    if (bm.length) br = bm[bm.length - 1].revenue;
    return br - ar;
  });

  /* ── Determine selected protocol ──────────────────────────────── */
  var sel = STATE.financialsProtocol;
  if (!sel || !sorted.find(function (p) { return p.name === sel; })) {
    sel = sorted.length > 0 ? sorted[0].name : null;
    STATE.financialsProtocol = sel;
  }

  /* ── Populate dropdown ────────────────────────────────────────── */
  if (select) {
    select.innerHTML = '';
    sorted.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.name;
      o.textContent = p.name;
      if (p.name === sel) o.selected = true;
      select.appendChild(o);
    });
    select.onchange = function () {
      STATE.financialsProtocol = select.value;
      renderFinancialsTab();
    };
  }

  /* ── Period toggle (monthly / quarterly) ──────────────────────── */
  if (!STATE.financialsPeriod) STATE.financialsPeriod = 'monthly';
  var btnMonthly = document.getElementById('fin-period-monthly');
  var btnQuarterly = document.getElementById('fin-period-quarterly');
  if (btnMonthly && btnQuarterly) {
    btnMonthly.classList.toggle('active', STATE.financialsPeriod === 'monthly');
    btnQuarterly.classList.toggle('active', STATE.financialsPeriod === 'quarterly');
    btnMonthly.onclick = function () {
      STATE.financialsPeriod = 'monthly';
      renderFinancialsTab();
    };
    btnQuarterly.onclick = function () {
      STATE.financialsPeriod = 'quarterly';
      renderFinancialsTab();
    };
  }

  if (!sel) {
    if (tableWrap) tableWrap.innerHTML = '<div class="empty-state">No protocol data available</div>';
    if (waterfallEl) emptyState('chart-financials-waterfall');
    if (areaEl) emptyState('chart-financials-area');
    return;
  }

  var sp = sorted.find(function (p) { return p.name === sel; });
  if (!sp) {
    if (tableWrap) tableWrap.innerHTML = '<div class="empty-state">Protocol not found</div>';
    if (waterfallEl) emptyState('chart-financials-waterfall');
    if (areaEl) emptyState('chart-financials-area');
    return;
  }

  var mo = getFilteredMonthly(sp);
  if (mo.length === 0) {
    if (tableWrap) tableWrap.innerHTML = '<div class="empty-state">No monthly data for ' + sel + '</div>';
    if (waterfallEl) emptyState('chart-financials-waterfall');
    if (areaEl) emptyState('chart-financials-area');
    return;
  }

  /* ── Build data rows depending on period toggle ───────────────── */
  var dataRows = [];
  var colHeaders = [];

  if (STATE.financialsPeriod === 'quarterly') {
    var q = getFilteredQuarterly(sp);
    var sliced = q.slice(-8);
    colHeaders = sliced.map(function (qr) { return qr.quarter; });
    sliced.forEach(function (qr) {
      var grossProfit = qr.revenue - qr.costOfRevenue;
      var grossMargin = qr.revenue > 0 ? grossProfit / qr.revenue : 0;
      var netMargin = qr.revenue > 0 ? qr.earnings / qr.revenue : 0;
      dataRows.push({
        fees: qr.fees,
        supplySideFees: qr.fees - qr.revenue,
        revenue: qr.revenue,
        costOfRevenue: qr.costOfRevenue,
        grossProfit: grossProfit,
        grossMargin: grossMargin,
        tokenIncentives: qr.tokenIncentives,
        earnings: qr.earnings,
        netMargin: netMargin
      });
    });
  } else {
    var slicedMo = mo.slice(-12);
    colHeaders = slicedMo.map(function (m) { return m.month; });
    slicedMo.forEach(function (m) {
      var grossProfit = m.revenue - (m.costOfRevenue || 0);
      dataRows.push({
        fees: m.fees,
        supplySideFees: m.supplySideFees || (m.fees - m.revenue),
        revenue: m.revenue,
        costOfRevenue: m.costOfRevenue || 0,
        grossProfit: grossProfit,
        grossMargin: m.grossMargin || 0,
        tokenIncentives: m.tokenIncentives || 0,
        earnings: m.earnings || 0,
        netMargin: m.netMargin || 0
      });
    });
  }

  /* ── Build Income Statement Table ─────────────────────────────── */
  if (tableWrap && dataRows.length > 0) {
    var h = '<table class="financials-table"><thead><tr><th>Line Item</th>';
    colHeaders.forEach(function (col) {
      h += '<th>' + col + '</th>';
    });
    h += '</tr></thead><tbody>';

    // Row definitions: [label, key, cssClass, formatter]
    var lineItems = [
      { label: 'Total Fees',          key: 'fees',             cls: '',           fmt: 'usd' },
      { label: '\u2013 Supply-Side Fees', key: 'supplySideFees', cls: 'deduction',  fmt: 'neg' },
      { label: '= Revenue (Protocol)',key: 'revenue',          cls: 'subtotal',   fmt: 'usd' },
      { label: '\u2013 Cost of Revenue', key: 'costOfRevenue',  cls: 'deduction',  fmt: 'neg' },
      { label: '= Gross Profit',      key: 'grossProfit',      cls: 'subtotal',   fmt: 'usd' },
      { label: 'Gross Margin',        key: 'grossMargin',      cls: 'margin-row', fmt: 'pct' },
      { label: '\u2013 Token Incentives', key: 'tokenIncentives', cls: 'deduction', fmt: 'neg' },
      { label: '= Earnings (Net Income)', key: 'earnings',     cls: 'subtotal',   fmt: 'usd' },
      { label: 'Net Margin',          key: 'netMargin',        cls: 'margin-row', fmt: 'pct' }
    ];

    lineItems.forEach(function (item) {
      h += '<tr class="' + item.cls + '"><td>' + item.label + '</td>';
      dataRows.forEach(function (row) {
        var val = row[item.key];
        var cell;
        if (item.fmt === 'neg') {
          cell = (val !== undefined && val !== null && !isNaN(val) && val !== 0) ? fmtUSDNeg(val) : '\u2014';
        } else if (item.fmt === 'pct') {
          cell = _fmtMarginPct(val);
        } else {
          cell = fmtUSD(val);
        }
        h += '<td>' + cell + '</td>';
      });
      h += '</tr>';
    });

    h += '</tbody></table>';
    tableWrap.innerHTML = h;
  }

  /* ── Waterfall chart for latest period ────────────────────────── */
  if (waterfallEl && dataRows.length > 0) {
    var latest = dataRows[dataRows.length - 1];
    var wfLabels = ['Fees', '- Supply Side', 'Revenue', '- Cost of Rev', 'Gross Profit', '- Incentives', 'Earnings'];
    var wfValues = [
      latest.fees,
      -latest.supplySideFees,
      latest.revenue,
      -latest.costOfRevenue,
      latest.grossProfit,
      -latest.tokenIncentives,
      latest.earnings
    ];

    // Simulated waterfall: invisible base bars + colored visible bars
    var baseBars = [];
    var visibleBars = [];
    var barColors = [];
    var running = 0;

    for (var wi = 0; wi < wfLabels.length; wi++) {
      var wVal = wfValues[wi];
      if (wi === 0) {
        // First bar: starts from 0
        baseBars.push(0);
        visibleBars.push(wVal);
        barColors.push('#4a9eff');
        running = wVal;
      } else if (wi === 2 || wi === 4 || wi === 6) {
        // Subtotal bars: start from 0, show the subtotal value
        baseBars.push(0);
        visibleBars.push(wVal);
        barColors.push(wVal >= 0 ? '#4af6c3' : '#ff5a54');
        running = wVal;
      } else {
        // Deduction bars: negative values subtracted from running total
        var deductionAmt = Math.abs(wVal);
        var newRunning = running - deductionAmt;
        baseBars.push(Math.max(0, newRunning));
        visibleBars.push(deductionAmt);
        barColors.push('#ff5a54');
        running = newRunning;
      }
    }

    var wfTraces = [
      {
        x: wfLabels,
        y: baseBars,
        name: 'Base',
        type: 'bar',
        marker: { color: 'rgba(0,0,0,0)' },
        hoverinfo: 'skip',
        showlegend: false
      },
      {
        x: wfLabels,
        y: visibleBars,
        name: 'Amount',
        type: 'bar',
        marker: { color: barColors },
        hovertemplate: '%{x}: %{y:$,.0f}<extra></extra>'
      }
    ];

    safeReact('chart-financials-waterfall', wfTraces, layoutWith({
      barmode: 'stack',
      showlegend: false,
      yaxis: { tickformat: '$,.0s', nticks: 6 },
      xaxis: { tickangle: -30 },
      margin: { t: 32, r: 24, b: 72, l: 64 }
    }));
  }

  /* ── Revenue vs Expenses Area Chart ───────────────────────────── */
  if (areaEl && dataRows.length > 0) {
    var areaTraces = [
      {
        x: colHeaders,
        y: dataRows.map(function (d) { return d.revenue; }),
        name: 'Revenue',
        type: 'scatter',
        mode: 'lines',
        line: { color: '#4a9eff', width: 2 },
        hovertemplate: 'Revenue: %{y:$,.0f}<extra></extra>'
      },
      {
        x: colHeaders,
        y: dataRows.map(function (d) { return d.costOfRevenue; }),
        name: 'Cost of Revenue',
        type: 'scatter',
        mode: 'lines',
        fill: 'tozeroy',
        fillcolor: 'rgba(255,90,84,0.15)',
        line: { color: '#ff5a54', width: 1.5 },
        hovertemplate: 'Cost of Rev: %{y:$,.0f}<extra></extra>'
      },
      {
        x: colHeaders,
        y: dataRows.map(function (d) { return d.tokenIncentives; }),
        name: 'Token Incentives',
        type: 'scatter',
        mode: 'lines',
        fill: 'tonexty',
        fillcolor: 'rgba(251,139,30,0.15)',
        line: { color: '#fb8b1e', width: 1.5 },
        hovertemplate: 'Incentives: %{y:$,.0f}<extra></extra>'
      },
      {
        x: colHeaders,
        y: dataRows.map(function (d) { return d.earnings; }),
        name: 'Earnings',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#4af6c3', width: 2 },
        marker: { size: 4 },
        hovertemplate: 'Earnings: %{y:$,.0f}<extra></extra>'
      }
    ];

    safeReact('chart-financials-area', areaTraces, layoutWith({
      yaxis: { tickformat: '$,.0s', nticks: 6 },
      xaxis: { type: 'category' },
      legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center', font: { size: 10 } }
    }));
  }
}
