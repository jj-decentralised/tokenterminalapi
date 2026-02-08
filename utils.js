// ===================================================================
// FORMAT HELPERS
// ===================================================================
function fmtUSD(n, compact) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (compact !== false) {
    if (abs >= 1e12) return sign + '$' + (abs/1e12).toFixed(1) + 'T';
    if (abs >= 1e9) return sign + '$' + (abs/1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return sign + '$' + (abs/1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return sign + '$' + (abs/1e3).toFixed(0) + 'K';
  }
  return sign + '$' + abs.toLocaleString('en-US', {maximumFractionDigits:0});
}

function fmtPct(n) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  const val = n * 100;
  if (Math.abs(val) > 999) return val > 0 ? '>999%' : '<-999%';
  return val.toFixed(1) + '%';
}

function fmtPctRaw(n) {
  // Raw percentage without capping — for tooltips and data export
  if (n === undefined || n === null || isNaN(n)) return '—';
  return (n * 100).toFixed(1) + '%';
}

function fmtNum(n) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toFixed(1);
}

function fmtX(n) {
  if (n === undefined || isNaN(n) || n === 0) return '—';
  return n.toFixed(1) + 'x';
}

function fmtRatio(numerator, denominator, format) {
  // Safe ratio calculation — returns 'N/A' for zero denominator
  if (denominator === undefined || denominator === null || Math.abs(denominator) < 1e-10) return 'N/A';
  if (numerator === undefined || numerator === null || isNaN(numerator)) return '—';
  const val = numerator / denominator;
  if (format === 'x') return fmtX(val);
  if (format === '%') return fmtPct(val);
  return val;
}

function safeDiv(n, d, fallback) {
  if (d === undefined || d === null || Math.abs(d) < 1e-10) return fallback !== undefined ? fallback : 0;
  return n / d;
}

function changeClass(n) { return n >= 0 ? 'positive' : 'negative'; }

function changeStr(n) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + fmtPct(n);
}

function fmtTrend(n) {
  // For trend arrows with capping
  if (n === undefined || n === null || isNaN(n)) return { text: '—', class: '' };
  const val = n * 100;
  const arrow = val < -1 ? '&#9660;' : val > 1 ? '&#9650;' : '&#9654;';
  const cls = val < -1 ? 'var(--accent-teal)' : val > 1 ? 'var(--accent-red)' : 'var(--text-muted)';
  const display = Math.abs(val) > 999 ? (val > 0 ? '>999%' : '<-999%') : Math.abs(val).toFixed(1) + '%';
  return { html: `<span style="color:${cls}">${arrow}</span> ${display}`, color: cls };
}

// ===================================================================
// WEIGHTED AVERAGE HELPER
// ===================================================================
function weightedAvg(items, valueFn, weightFn) {
  let sumWV = 0, sumW = 0;
  items.forEach(item => {
    const w = weightFn(item);
    const v = valueFn(item);
    if (w > 0 && !isNaN(v) && isFinite(v)) {
      sumWV += v * w;
      sumW += w;
    }
  });
  return sumW > 0 ? sumWV / sumW : 0;
}

// ===================================================================
// CSV EXPORT
// ===================================================================
function exportTableCSV(tableEl, filename) {
  if (!tableEl) return;
  const rows = [];
  tableEl.querySelectorAll('tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('th, td').forEach(td => {
      cells.push('"' + td.textContent.trim().replace(/"/g, '""') + '"');
    });
    rows.push(cells.join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (filename || 'export') + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ===================================================================
// TABLE SORTING
// ===================================================================
function makeSortable(tableEl) {
  if (!tableEl) return;
  const headers = tableEl.querySelectorAll('th');
  headers.forEach((th, colIdx) => {
    if (!th.querySelector('.sort-arrow')) {
      th.innerHTML += ' <span class="sort-arrow">&#9650;</span>';
    }
    th.addEventListener('click', () => {
      const tbody = tableEl.querySelector('tbody');
      if (!tbody) return;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const isAsc = th.dataset.sortDir === 'asc';
      const dir = isAsc ? -1 : 1;
      // Reset other headers
      headers.forEach(h => { h.classList.remove('sorted'); h.dataset.sortDir = ''; });
      th.classList.add('sorted');
      th.dataset.sortDir = isAsc ? 'desc' : 'asc';
      th.querySelector('.sort-arrow').innerHTML = isAsc ? '&#9660;' : '&#9650;';

      rows.sort((a, b) => {
        const aCell = a.cells[colIdx]?.textContent.trim() || '';
        const bCell = b.cells[colIdx]?.textContent.trim() || '';
        // Try numeric comparison
        const aNum = parseFloat(aCell.replace(/[$,%x>< ]/g, ''));
        const bNum = parseFloat(bCell.replace(/[$,%x>< ]/g, ''));
        if (!isNaN(aNum) && !isNaN(bNum)) return (aNum - bNum) * dir;
        return aCell.localeCompare(bCell) * dir;
      });
      rows.forEach(row => tbody.appendChild(row));
    });
  });
}

// ===================================================================
// SCROLL OVERFLOW DETECTION
// ===================================================================
function detectOverflow(wrapEl) {
  if (!wrapEl) return;
  const check = () => {
    if (wrapEl.scrollWidth > wrapEl.clientWidth + 10) {
      wrapEl.classList.add('has-overflow');
    } else {
      wrapEl.classList.remove('has-overflow');
    }
  };
  check();
  wrapEl.addEventListener('scroll', () => {
    if (wrapEl.scrollLeft + wrapEl.clientWidth >= wrapEl.scrollWidth - 10) {
      wrapEl.classList.remove('has-overflow');
    } else if (wrapEl.scrollWidth > wrapEl.clientWidth + 10) {
      wrapEl.classList.add('has-overflow');
    }
  });
}
