// ===================================================================
// APP.JS — Initialization & Event Wiring
// ===================================================================
// Globals from other files:
//   STATE, encodeStateToURL(), decodeStateFromURL(), getFilteredProtocols()  (filters.js)
//   generateAllData(), fetchAllLiveData(), FETCH_STATUS, PROTOCOLS,
//     SECTOR_COLORS, SECTOR_LABELS                                          (data.js)
//   renderRevenueTab(), renderValuationTab(), renderRetentionTab(),
//     renderLTVTab(), renderMarginsTab()                                     (charts.js)
//   fmtUSD(), fmtPct(), fmtX(), fmtNum(), makeSortable(), changeClass()    (utils.js)
//   Plotly                                                                   (CDN)
// ===================================================================

// ===================================================================
// PROTOCOL DETAIL MODAL
// ===================================================================

/**
 * Show a detailed modal for a specific protocol, including KPIs,
 * revenue/earnings chart, margins chart, and a monthly data table.
 */
function showProtocolDetail(protocolId) {
  if (!STATE.data || !STATE.data[protocolId]) return;
  var p = STATE.data[protocolId];
  var modal = document.getElementById('protocol-modal');
  if (!modal) return;

  // Header
  var nameEl = document.getElementById('modal-protocol-name');
  if (nameEl) nameEl.textContent = p.name;

  var metaEl = document.getElementById('modal-protocol-meta');
  if (metaEl) {
    var color = SECTOR_COLORS[p.sector] || '#6b7280';
    var label = SECTOR_LABELS[p.sector] || p.sector;
    metaEl.innerHTML = '<span class="sector-dot" style="background:' + color + '"></span>' + label +
      ' \u00b7 ' + (p.chains || []).join(', ');
  }

  // KPIs
  var kpis = document.getElementById('modal-kpis');
  if (kpis && p.monthly && p.monthly.length > 0) {
    var last = p.monthly[p.monthly.length - 1];
    var prev = p.monthly.length > 1 ? p.monthly[p.monthly.length - 2] : null;
    var revGrowth = prev && prev.revenue > 0 ? (last.revenue - prev.revenue) / prev.revenue : null;

    // Momentum signal from DB or computed
    var momSignal = p.momentumSignal || 'neutral';
    var momColors = { 'strong-up': '#22c55e', 'up': '#4ade80', 'neutral': '#94a3b8', 'down': '#f97316', 'strong-down': '#ef4444' };
    var momLabels = { 'strong-up': '\u25b2\u25b2 Strong Up', 'up': '\u25b2 Up', 'neutral': '\u25cf Neutral', 'down': '\u25bc Down', 'strong-down': '\u25bc\u25bc Strong Down' };
    var momColor = momColors[momSignal] || '#94a3b8';
    var momLabel = momLabels[momSignal] || 'Neutral';

    kpis.innerHTML =
      '<div class="kpi-card"><div class="kpi-label">Monthly Revenue</div><div class="kpi-value">' + fmtUSD(last.revenue) + '</div>' +
        (revGrowth !== null ? '<div class="kpi-change ' + changeClass(revGrowth) + '">' + fmtPct(revGrowth) + ' MoM</div>' : '') + '</div>' +
      '<div class="kpi-card"><div class="kpi-label">FDV</div><div class="kpi-value">' + fmtUSD(last.fdv) + '</div>' +
        (last.circMcap > 0 ? '<div class="kpi-change">Circ: ' + fmtUSD(last.circMcap) + '</div>' : '') + '</div>' +
      '<div class="kpi-card"><div class="kpi-label">P/S Ratio</div><div class="kpi-value">' + fmtX(last.psRatio) + '</div>' +
        (last.revenueYield > 0 ? '<div class="kpi-change positive">Yield: ' + fmtPct(last.revenueYield) + '</div>' : '') + '</div>' +
      '<div class="kpi-card"><div class="kpi-label">Momentum</div><div class="kpi-value" style="color:' + momColor + '">' + momLabel + '</div>' +
        '<div class="kpi-change">Consistency: ' + (p.consistency || 0).toFixed(3) + '</div></div>';
  }

  // Revenue chart
  if (p.monthly && p.monthly.length > 0) {
    var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    var chartColor = SECTOR_COLORS[p.sector] || '#4a9eff';

    Plotly.react('modal-chart-revenue', [
      {
        x: p.monthly.map(function (m) { return m.month; }),
        y: p.monthly.map(function (m) { return m.revenue; }),
        name: 'Revenue',
        type: 'bar',
        marker: { color: chartColor, opacity: 0.8 },
        hovertemplate: '%{x}: %{y:$,.0f}<extra></extra>'
      },
      {
        x: p.monthly.map(function (m) { return m.month; }),
        y: p.monthly.map(function (m) { return m.earnings; }),
        name: 'Earnings',
        type: 'scatter', mode: 'lines+markers',
        line: { color: isDark ? '#4af6c3' : '#059669', width: 2 }, marker: { size: 3 },
        hovertemplate: '%{x}: %{y:$,.0f}<extra></extra>'
      }
    ], {
      font: { family: 'Inter, sans-serif', size: 11, color: isDark ? '#c8c8c8' : '#333' },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 30, r: 16, b: 40, l: 60 },
      title: { text: 'Revenue & Earnings', font: { size: 13 } },
      yaxis: { tickformat: '$,.0s', gridcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' },
      xaxis: { type: 'category', gridcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' },
      legend: { orientation: 'h', y: -0.15 },
      autosize: true
    }, { displayModeBar: false, responsive: true });

    // Margins chart
    Plotly.react('modal-chart-margins', [
      {
        x: p.monthly.map(function (m) { return m.month; }),
        y: p.monthly.map(function (m) { return m.grossMargin * 100; }),
        name: 'Gross Margin',
        type: 'scatter', mode: 'lines',
        line: { color: isDark ? '#4a9eff' : '#2563eb', width: 2 },
        hovertemplate: '%{x}: %{y:.1f}%<extra></extra>'
      },
      {
        x: p.monthly.map(function (m) { return m.month; }),
        y: p.monthly.map(function (m) { return Math.max(-300, m.netMargin * 100); }),
        name: 'Net Margin',
        type: 'scatter', mode: 'lines',
        line: { color: isDark ? '#4af6c3' : '#059669', width: 2 },
        hovertemplate: '%{x}: %{y:.1f}%<extra></extra>'
      }
    ], {
      font: { family: 'Inter, sans-serif', size: 11, color: isDark ? '#c8c8c8' : '#333' },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 30, r: 16, b: 40, l: 50 },
      title: { text: 'Margins', font: { size: 13 } },
      yaxis: { tickformat: '.0f', ticksuffix: '%', range: [-300, 100], gridcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' },
      xaxis: { type: 'category', gridcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' },
      legend: { orientation: 'h', y: -0.15 },
      autosize: true
    }, { displayModeBar: false, responsive: true });
  }

  // Monthly data table
  var tableWrap = document.getElementById('modal-monthly-table');
  if (tableWrap && p.monthly && p.monthly.length > 0) {
    var h = '<table class="data-table"><thead><tr><th>Month</th><th>Revenue</th><th>Fees</th><th>Earnings</th><th>TVL</th><th>DAU</th><th>P/S</th><th>Gross Margin</th><th>Net Margin</th></tr></thead><tbody>';
    // Show latest 12 months reversed
    p.monthly.slice(-12).reverse().forEach(function (m) {
      var gmCls = m.grossMargin >= 0 ? 'positive' : 'negative';
      var nmCls = m.netMargin >= 0 ? 'positive' : 'negative';
      h += '<tr><td>' + m.month + '</td><td>' + fmtUSD(m.revenue) + '</td><td>' + fmtUSD(m.fees) + '</td><td>' + fmtUSD(m.earnings) + '</td><td>' + fmtUSD(m.tvl) + '</td><td>' + fmtNum(m.dau) + '</td><td>' + fmtX(m.psRatio) + '</td><td class="' + gmCls + '">' + fmtPct(m.grossMargin) + '</td><td class="' + nmCls + '">' + fmtPct(m.netMargin) + '</td></tr>';
    });
    h += '</tbody></table>';
    tableWrap.innerHTML = h;
  }

  // Show modal
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// ===================================================================
// TAB SWITCHING
// ===================================================================

/**
 * Switch the active dashboard tab. Updates state, toggles DOM classes,
 * purges Plotly charts in hidden tabs to free WebGL contexts, re-renders
 * the newly active tab, and persists state to the URL hash.
 */
function switchTab(tabId) {
  STATE.activeTab = tabId;

  // Toggle .active on tab buttons
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Toggle .active on tab content sections
  document.querySelectorAll('.tab-content').forEach(function (section) {
    section.classList.toggle('active', section.id === 'tab-' + tabId);
  });

  // Purge Plotly charts in all *inactive* tabs to free WebGL contexts and memory
  document.querySelectorAll('.tab-content:not(.active)').forEach(function (section) {
    section.querySelectorAll('[id^="chart-"]').forEach(function (el) {
      try {
        if (el.data) Plotly.purge(el);
      } catch (_) {
        // Ignore — element may not have been plotted yet
      }
    });
  });

  renderActiveTab();
  encodeStateToURL();
}

// ===================================================================
// RENDER ACTIVE TAB
// ===================================================================

/**
 * Dispatch to the correct tab renderer based on STATE.activeTab.
 * Wraps the call in try/catch so a rendering error is surfaced inside
 * the tab content area rather than silently swallowed.
 */
function renderActiveTab() {
  try {
    switch (STATE.activeTab) {
      case 'revenue':
        renderRevenueTab();
        break;
      case 'valuation':
        renderValuationTab();
        break;
      case 'retention':
        renderRetentionTab();
        break;
      case 'ltv':
        renderLTVTab();
        break;
      case 'margins':
        renderMarginsTab();
        break;
      case 'compare':
        renderCompareTab();
        break;
      case 'screener':
        renderScreenerTab();
        break;
      case 'financials':
        renderFinancialsTab();
        break;
      case 'sectors':
        renderSectorsTab();
        break;
      default:
        renderRevenueTab();
        break;
    }
  } catch (err) {
    console.error('[renderActiveTab] Render error for tab "' + STATE.activeTab + '":', err);
    var activeSection = document.getElementById('tab-' + STATE.activeTab);
    if (activeSection) {
      activeSection.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">!</div>' +
          '<div>Failed to render this tab.</div>' +
          '<div style="font-size:11px;color:var(--text-muted);max-width:480px;word-break:break-word;">' +
            err.message +
          '</div>' +
        '</div>';
    }
  }
}

// ===================================================================
// LOADING OVERLAY HELPERS
// ===================================================================

/**
 * Ensure the loading overlay element exists. If the HTML already contains
 * div#loading-overlay it is reused; otherwise one is created dynamically.
 * Returns the overlay element.
 */
function ensureLoadingOverlay() {
  var overlay = document.getElementById('loading-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML =
    '<div class="loading-spinner"></div>' +
    '<div class="loading-text">Loading data...</div>';
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Update the text shown inside the loading overlay.
 * Optionally accepts a progress fraction (0-1) to update the progress bar.
 */
function setLoadingText(text, progress) {
  var el = document.querySelector('#loading-overlay .loading-text');
  if (el) el.textContent = text;
  if (typeof progress === 'number') {
    var bar = document.getElementById('loading-bar-fill');
    if (bar) bar.style.width = Math.min(100, Math.max(0, progress * 100)) + '%';
  }
}

/**
 * Hide the loading overlay with a CSS opacity fade, then remove it from
 * the layout after the transition completes.
 */
function hideLoadingOverlay() {
  var overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  // After the CSS transition (300ms in styles.css), fully remove from flow
  setTimeout(function () {
    overlay.style.display = 'none';
  }, 350);
}

// ===================================================================
// DYNAMIC SECTOR DROPDOWN + LEGEND
// ===================================================================

/**
 * Build sector dropdown options and legend dots from loaded data.
 */
function buildSectorUI() {
  if (!STATE.data) return;
  var sectorCounts = {};
  Object.values(STATE.data).forEach(function (p) {
    var s = p.sector || 'other';
    sectorCounts[s] = (sectorCounts[s] || 0) + 1;
  });

  // Sort sectors by protocol count descending
  var sectors = Object.keys(sectorCounts).sort(function (a, b) {
    return sectorCounts[b] - sectorCounts[a];
  });

  // Populate sector dropdown
  var select = document.getElementById('sector-select');
  if (select) {
    // Remove old options (keep "All Sectors")
    while (select.options.length > 1) select.remove(1);
    sectors.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      var label = (SECTOR_LABELS && SECTOR_LABELS[s]) ? SECTOR_LABELS[s] : s;
      opt.textContent = label + ' (' + sectorCounts[s] + ')';
      if (s === STATE.sector) opt.selected = true;
      select.appendChild(opt);
    });
    // Update "All" count
    var allCount = Object.values(STATE.data).length;
    select.options[0].textContent = 'All Sectors (' + allCount + ')';
  }

  // Build color legend (top 6 sectors only to keep it compact)
  var legendEl = document.getElementById('sector-legend');
  if (legendEl) {
    var html = '<label class="filter-label">Legend</label>';
    var topSectors = sectors.slice(0, 6);
    topSectors.forEach(function (s) {
      var color = (SECTOR_COLORS && SECTOR_COLORS[s]) ? SECTOR_COLORS[s] : '#6b7280';
      var label = (SECTOR_LABELS && SECTOR_LABELS[s]) ? SECTOR_LABELS[s] : s;
      html += '<span class="sector-dot" style="background:' + color + '"></span> ' + label + ' ';
    });
    if (sectors.length > 6) {
      html += '<span style="color:var(--text-muted);font-size:10px;">+' + (sectors.length - 6) + ' more</span>';
    }
    legendEl.innerHTML = html;
  }
}

// ===================================================================
// POPULATE COMPARE DROPDOWNS
// ===================================================================

/**
 * Fill each .compare-select dropdown with all loaded protocols,
 * sorted by latest-month revenue descending. Attach change listeners
 * so switching a dropdown re-renders the compare tab.
 */
function populateCompareDropdowns() {
  if (!STATE.data) return;
  var sorted = getFilteredProtocols().sort(function (a, b) {
    var aR = a.monthly && a.monthly.length > 0 ? a.monthly[a.monthly.length - 1].revenue : 0;
    var bR = b.monthly && b.monthly.length > 0 ? b.monthly[b.monthly.length - 1].revenue : 0;
    return bR - aR;
  });
  document.querySelectorAll('.compare-select').forEach(function (sel) {
    var current = sel.value;
    var placeholder = sel.options[0] ? sel.options[0].textContent : 'Select protocol...';
    sel.innerHTML = '<option value="">' + placeholder + '</option>';
    sorted.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === current) opt.selected = true;
      sel.appendChild(opt);
    });
    // Remove existing listeners by cloning (avoids duplicate listeners on re-populate)
    var newSel = sel.cloneNode(true);
    sel.parentNode.replaceChild(newSel, sel);
    newSel.addEventListener('change', function () {
      if (STATE.activeTab === 'compare') renderCompareTab();
    });
  });
}

// ===================================================================
// PROTOCOL COUNT (FOOTER)
// ===================================================================

/**
 * Update the footer protocol count indicator to show how many protocols
 * are visible after filtering vs total.
 */
function updateProtocolCount() {
  var countEl = document.getElementById('footer-protocol-count');
  if (countEl && STATE.data) {
    var total = Object.keys(STATE.data).length;
    var filtered = getFilteredProtocols().length;
    countEl.textContent = filtered === total ? total + ' protocols' : filtered + '/' + total + ' protocols';
  }
}

// ===================================================================
// RELATIVE TIMESTAMP HELPER
// ===================================================================

/**
 * Given a Date object, return a human-readable relative string such as
 * "Updated 3 min ago", "Updated just now", etc.
 */
function relativeTimeString(date) {
  if (!date) return '';
  var diffMs = Date.now() - date.getTime();
  var diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Updated just now';
  var diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return 'Updated ' + diffMin + ' min ago';
  var diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return 'Updated ' + diffHr + ' hr ago';
  var diffDay = Math.floor(diffHr / 24);
  return 'Updated ' + diffDay + ' day' + (diffDay === 1 ? '' : 's') + ' ago';
}

// ===================================================================
// APPLY STATE TO DOM
// ===================================================================

/**
 * Synchronize UI controls (sector buttons, chain dropdown, period
 * dropdown) to match the values currently held in STATE.  Called once
 * after decodeStateFromURL() restores saved filter state.
 */
function applyStateToDom() {
  // Sector dropdown
  var sectorSelect = document.getElementById('sector-select');
  if (sectorSelect) sectorSelect.value = STATE.sector;

  // Chain dropdown
  var chainSelect = document.getElementById('chain-select');
  if (chainSelect) chainSelect.value = STATE.chain;

  // Period dropdown
  var periodSelect = document.getElementById('period-select');
  if (periodSelect) periodSelect.value = String(STATE.period);
}

// ===================================================================
// DOMContentLoaded — MAIN INIT
// ===================================================================

document.addEventListener('DOMContentLoaded', async function () {

  // ------------------------------------------------------------------
  // 0a. Modal close handlers (set up early, before async data loading)
  // ------------------------------------------------------------------
  var modalCloseBtn = document.getElementById('modal-close');
  var modalOverlay = document.getElementById('protocol-modal');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', function () {
      modalOverlay.style.display = 'none';
      document.body.style.overflow = '';
    });
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) {
        modalOverlay.style.display = 'none';
        document.body.style.overflow = '';
      }
    });
  }

  // Escape key closes modal
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var modal = document.getElementById('protocol-modal');
      if (modal && modal.style.display !== 'none') {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    }
  });

  // ------------------------------------------------------------------
  // 0. Theme: check localStorage, default to dark
  // ------------------------------------------------------------------
  var savedTheme = localStorage.getItem('tt-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.textContent = savedTheme === 'dark' ? '\u2600' : '\u263E';
    themeBtn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('tt-theme', next);
      themeBtn.textContent = next === 'dark' ? '\u2600' : '\u263E';
      // Re-render active tab to update Plotly chart colors
      renderActiveTab();
    });
  }

  // ------------------------------------------------------------------
  // a. Show loading overlay
  // ------------------------------------------------------------------
  var overlay = ensureLoadingOverlay();
  overlay.classList.remove('hidden');
  overlay.style.display = '';
  setLoadingText('Loading data...');

  // ------------------------------------------------------------------
  // b. Decode URL state (restore filters from hash)
  // ------------------------------------------------------------------
  decodeStateFromURL();

  // ------------------------------------------------------------------
  // c/d. Attempt live data fetch, fall back to mock data
  // ------------------------------------------------------------------
  var headerMeta = document.querySelector('.header-meta');
  var dataTimestamp = null;

  try {
    setLoadingText('Connecting to Token Terminal API...');

    var liveData = await fetchAllLiveData(function (done, total, msg) {
      var progress = total > 0 ? done / total : 0;
      if (msg) setLoadingText(msg, progress);
      else if (total > 0) setLoadingText('Loading protocols... ' + done + '/' + total, progress);
    });

    if (liveData && Object.keys(liveData).length > 0) {
      STATE.data = liveData;
      STATE.dataSource = 'live';

      // Attempt to read a data timestamp from a health check response
      try {
        var healthRes = await fetch('/health');
        var xTimestamp = healthRes.headers.get('X-Data-Timestamp');
        if (xTimestamp) {
          dataTimestamp = new Date(xTimestamp);
        }
        if (!dataTimestamp || isNaN(dataTimestamp.getTime())) {
          var healthBody = await healthRes.json().catch(function () { return {}; });
          if (healthBody.timestamp) {
            dataTimestamp = new Date(healthBody.timestamp);
          }
        }
      } catch (_) {
        // Health endpoint metadata is optional — not fatal
      }

      if (!dataTimestamp || isNaN(dataTimestamp.getTime())) {
        dataTimestamp = new Date();
      }
      STATE.dataTimestamp = dataTimestamp;

      // Update header meta — green "Live data" indicator
      if (headerMeta) {
        var tsDisplay = relativeTimeString(dataTimestamp);
        headerMeta.style.color = 'var(--accent-teal)';
        headerMeta.innerHTML = '&#9679; Live data via Token Terminal API';
        if (tsDisplay) {
          headerMeta.innerHTML += ' &middot; ' + tsDisplay;
        }

        // Show warning badge if some protocols failed to fetch
        var failedCount = 0;
        Object.keys(FETCH_STATUS).forEach(function (key) {
          if (FETCH_STATUS[key].status !== 'ok') failedCount++;
        });
        if (failedCount > 0) {
          headerMeta.innerHTML +=
            ' <span style="color:var(--accent-orange);font-size:10px;">' +
            '(' + failedCount + ' protocol' + (failedCount === 1 ? '' : 's') + ' using fallback)' +
            '</span>';
        }
      }
    } else {
      // fetchAllLiveData returned null/empty — treat as failure
      throw new Error('No data returned from API');
    }

  } catch (err) {
    // ------------------------------------------------------------------
    // d. Fall back to mock data
    // ------------------------------------------------------------------
    console.warn('[app] Live data unavailable, using mock data.', err && err.message);
    setLoadingText('Generating mock data...');

    STATE.data = generateAllData();
    STATE.dataSource = 'mock';
    STATE.dataTimestamp = null;

    if (headerMeta) {
      headerMeta.style.color = 'var(--accent-orange)';
      headerMeta.innerHTML =
        '&#9679; Mock data &middot; Set <span style="font-family:var(--font-mono)">TT_API_KEY</span> env var for live data';
    }
  }

  // ------------------------------------------------------------------
  // e. Populate chain dropdown from protocol data
  // ------------------------------------------------------------------
  var chainSet = new Set();
  if (STATE.data) {
    Object.values(STATE.data).forEach(function (p) {
      if (p.chains) p.chains.forEach(function (c) { chainSet.add(c); });
    });
  }
  var chainSelectInit = document.getElementById('chain-select');
  if (chainSelectInit) {
    var sortedChains = Array.from(chainSet).sort();
    sortedChains.forEach(function (chain) {
      var opt = document.createElement('option');
      opt.value = chain;
      opt.textContent = chain.charAt(0).toUpperCase() + chain.slice(1);
      chainSelectInit.appendChild(opt);
    });
  }

  // ------------------------------------------------------------------
  // f. Remove loading overlay (fade out)
  // ------------------------------------------------------------------
  hideLoadingOverlay();

  // ------------------------------------------------------------------
  // g. Wire up tab buttons
  // ------------------------------------------------------------------
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.dataset.tab);
    });
  });

  // ------------------------------------------------------------------
  // g. Wire up sector dropdown
  // ------------------------------------------------------------------
  var sectorSelect = document.getElementById('sector-select');
  if (sectorSelect) {
    sectorSelect.addEventListener('change', function (e) {
      STATE.sector = e.target.value;
      updateProtocolCount();
      renderActiveTab();
      encodeStateToURL();
    });
  }

  // ------------------------------------------------------------------
  // h. Wire up chain filter
  // ------------------------------------------------------------------
  var chainSelect = document.getElementById('chain-select');
  if (chainSelect) {
    chainSelect.addEventListener('change', function (e) {
      STATE.chain = e.target.value;

      // Rebuild sector dropdown (counts may change with chain filter)
      buildSectorUI();
      updateProtocolCount();

      renderActiveTab();
      encodeStateToURL();
    });
  }

  // ------------------------------------------------------------------
  // i. Wire up period filter
  // ------------------------------------------------------------------
  var periodSelect = document.getElementById('period-select');
  if (periodSelect) {
    periodSelect.addEventListener('change', function (e) {
      STATE.period = parseInt(e.target.value, 10) || 24;
      renderActiveTab();
      encodeStateToURL();
    });
  }

  // ------------------------------------------------------------------
  // i2. Wire up protocol search bar
  // ------------------------------------------------------------------
  var searchInput = document.getElementById('protocol-search');
  var searchResults = document.getElementById('search-results');
  if (searchInput && searchResults) {
    searchInput.addEventListener('input', function () {
      var query = searchInput.value.toLowerCase().trim();
      if (!query || query.length < 2 || !STATE.data) {
        searchResults.style.display = 'none';
        return;
      }
      var matches = Object.values(STATE.data).filter(function (p) {
        return p.name.toLowerCase().indexOf(query) !== -1 || p.id.toLowerCase().indexOf(query) !== -1;
      }).slice(0, 15);

      if (matches.length === 0) {
        searchResults.style.display = 'none';
        return;
      }

      var html = '';
      matches.forEach(function (p) {
        var color = SECTOR_COLORS[p.sector] || '#6b7280';
        var label = SECTOR_LABELS[p.sector] || p.sector;
        html += '<div class="search-item" data-protocol="' + p.id + '">';
        html += '<div>' + p.name + '</div>';
        html += '<div class="search-sector"><span class="sector-dot" style="background:' + color + '"></span>' + label + '</div>';
        html += '</div>';
      });
      searchResults.innerHTML = html;
      searchResults.style.display = 'block';

      // Click handler for search results
      searchResults.querySelectorAll('.search-item').forEach(function (item) {
        item.addEventListener('click', function () {
          var pid = item.dataset.protocol;
          searchResults.style.display = 'none';
          searchInput.value = '';
          showProtocolDetail(pid);
        });
      });
    });

    // Close search on click outside
    document.addEventListener('click', function (e) {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none';
      }
    });

    // Close on Escape
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        searchResults.style.display = 'none';
        searchInput.blur();
      }
    });
  }

  // ------------------------------------------------------------------
  // j. Apply initial state from URL (set controls to match STATE)
  // ------------------------------------------------------------------
  applyStateToDom();
  buildSectorUI();
  populateCompareDropdowns();
  updateProtocolCount();

  // ------------------------------------------------------------------
  // k. Initial render
  // ------------------------------------------------------------------
  switchTab(STATE.activeTab);

  // ------------------------------------------------------------------
  // l. Timestamp auto-update (every 60s)
  // ------------------------------------------------------------------
  if (STATE.dataTimestamp && STATE.dataSource === 'live') {
    setInterval(function () {
      if (!STATE.dataTimestamp) return;
      var meta = document.querySelector('.header-meta');
      if (!meta) return;

      var tsDisplay = relativeTimeString(STATE.dataTimestamp);

      // Rebuild the header content while preserving warning badges
      var html = '&#9679; Live data via Token Terminal API';
      if (tsDisplay) html += ' &middot; ' + tsDisplay;

      // Re-check failed count (stays constant after init, but be safe)
      var failedCount = 0;
      Object.keys(FETCH_STATUS).forEach(function (key) {
        if (FETCH_STATUS[key].status !== 'ok') failedCount++;
      });
      if (failedCount > 0) {
        html +=
          ' <span style="color:var(--accent-orange);font-size:10px;">' +
          '(' + failedCount + ' protocol' + (failedCount === 1 ? '' : 's') + ' using fallback)' +
          '</span>';
      }

      meta.innerHTML = html;
    }, 60000);
  }
});

// ===================================================================
// HASHCHANGE — Back/Forward Navigation
// ===================================================================

window.addEventListener('hashchange', function () {
  decodeStateFromURL();

  // Sync DOM controls to the newly decoded state
  applyStateToDom();
  buildSectorUI();
  populateCompareDropdowns();
  updateProtocolCount();

  // Re-render the (possibly changed) active tab
  switchTab(STATE.activeTab);
});
