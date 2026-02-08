// ===================================================================
// APP.JS — Initialization & Event Wiring
// ===================================================================
// Globals from other files:
//   STATE, encodeStateToURL(), decodeStateFromURL(), getFilteredProtocols()  (filters.js)
//   generateAllData(), fetchAllLiveData(), FETCH_STATUS, PROTOCOLS,
//     SECTOR_COLORS, SECTOR_LABELS                                          (data.js)
//   renderRevenueTab(), renderValuationTab(), renderRetentionTab(),
//     renderLTVTab(), renderMarginsTab()                                     (charts.js)
//   fmtUSD(), makeSortable()                                                (utils.js)
//   Plotly                                                                   (CDN)
// ===================================================================

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
 */
function setLoadingText(text) {
  var el = document.querySelector('#loading-overlay .loading-text');
  if (el) el.textContent = text;
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
// SECTOR COUNT BADGE HELPER
// ===================================================================

/**
 * Compute how many protocols match a given sector (considering the
 * current chain filter) and return a display string like "Lending (4)".
 */
function sectorCountBadge(sectorKey) {
  if (!STATE.data) return '';
  var protocols = Object.values(STATE.data);
  if (sectorKey !== 'all') {
    protocols = protocols.filter(function (p) { return p.sector === sectorKey; });
  }
  if (STATE.chain !== 'all') {
    protocols = protocols.filter(function (p) { return p.chains && p.chains.includes(STATE.chain); });
  }
  return protocols.length;
}

/**
 * Refresh every sector button label to include its count badge.
 */
function refreshSectorBadges() {
  document.querySelectorAll('.sector-btn').forEach(function (btn) {
    var sector = btn.dataset.sector;
    var count = sectorCountBadge(sector);
    var label;
    if (sector === 'all') {
      label = 'All';
    } else if (sector === 'lending') {
      label = 'Lending';
    } else if (sector === 'dex') {
      label = 'DEX';
    } else if (sector === 'l1') {
      label = 'L1';
    } else if (sector === 'liquid-staking') {
      label = 'Staking';
    } else {
      label = sector;
    }
    btn.textContent = label + ' (' + count + ')';
  });
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
  // Sector buttons
  document.querySelectorAll('.sector-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.sector === STATE.sector);
  });

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

    var liveData = await fetchAllLiveData();

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
  // g. Wire up sector toggles
  // ------------------------------------------------------------------
  document.querySelectorAll('.sector-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // Toggle active — only one sector active at a time
      document.querySelectorAll('.sector-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');

      STATE.sector = btn.dataset.sector;

      // Refresh all badges with updated counts
      refreshSectorBadges();

      renderActiveTab();
      encodeStateToURL();
    });
  });

  // ------------------------------------------------------------------
  // h. Wire up chain filter
  // ------------------------------------------------------------------
  var chainSelect = document.getElementById('chain-select');
  if (chainSelect) {
    chainSelect.addEventListener('change', function (e) {
      STATE.chain = e.target.value;

      // Refresh sector badges (counts may change with chain)
      refreshSectorBadges();

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
  // j. Apply initial state from URL (set controls to match STATE)
  // ------------------------------------------------------------------
  applyStateToDom();
  refreshSectorBadges();

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
  refreshSectorBadges();

  // Re-render the (possibly changed) active tab
  switchTab(STATE.activeTab);
});
