const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3000;
const TT_API_KEY = process.env.TT_API_KEY || '';
const TT_BASE = 'https://api.tokenterminal.com/v2';
const START_TIME = Date.now();

// ---------------------------------------------------------------------------
// DATABASE (optional – enabled when DATABASE_URL is set)
// ---------------------------------------------------------------------------
const db = require('./db');
const { initDB } = require('./init-db');

// Sync state
let lastSyncTime = null;
let syncInProgress = false;
let syncProgress = { total: 0, done: 0, ok: 0, empty: 0, failed: 0, skipped: 0 };
const SYNC_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

// ---------------------------------------------------------------------------
// MIME types for static file serving
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

// ---------------------------------------------------------------------------
// Slug retry map
// ---------------------------------------------------------------------------
const SLUG_RETRIES = {
  'lido':        ['lido-finance', 'lido-dao'],
  'bnb-chain':   ['bnb-smart-chain', 'binance-smart-chain'],
  'rocket-pool': ['rocketpool'],
  'pancakeswap': ['pancake-swap'],
};

// ---------------------------------------------------------------------------
// In-memory cache: key -> { data, timestamp, statusCode }
// ---------------------------------------------------------------------------
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry;
  }
  return null;
}

function setCache(key, data, statusCode) {
  cache.set(key, { data, timestamp: Date.now(), statusCode });
}

// ---------------------------------------------------------------------------
// TT API fetch
// ---------------------------------------------------------------------------
function fetchTT(apiPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(TT_BASE + apiPath);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TT_API_KEY}`,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (upstream) => {
      let body = '';
      upstream.on('data', chunk => body += chunk);
      upstream.on('end', () => resolve({ statusCode: upstream.statusCode, body }));
    });

    req.on('error', reject);
    req.end();
  });
}

async function fetchTTJson(apiPath) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const r = await fetchTT(apiPath);
    if (r.statusCode === 429) {
      if (attempt < MAX_RETRIES) {
        const backoff = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.warn(`[RATE-LIMIT] 429 on ${apiPath}, retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoff);
        continue;
      }
      throw new Error('API 429 (rate limited after retries): ' + apiPath);
    }
    if (r.statusCode >= 400) throw new Error('API ' + r.statusCode + ': ' + apiPath);
    return JSON.parse(r.body);
  }
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------
function extractSlug(apiPath) {
  const match = apiPath.match(/^\/projects\/([^/?]+)(\/|$|\?)/);
  return match ? match[1] : null;
}

function replaceSlug(apiPath, oldSlug, newSlug) {
  return apiPath.replace(`/projects/${oldSlug}`, `/projects/${newSlug}`);
}

// ---------------------------------------------------------------------------
// Proxy a request to the Token Terminal API with slug-retry logic.
// ---------------------------------------------------------------------------
async function proxyTT(apiPath, res) {
  if (!TT_API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ error: 'TT_API_KEY not configured. Using mock data.' }));
    return;
  }

  const cached = getCached(apiPath);
  if (cached) {
    res.writeHead(cached.statusCode, {
      'Content-Type': 'application/json', 'Cache-Control': 'no-cache',
      'X-Cache': 'HIT', 'X-Data-Timestamp': new Date(cached.timestamp).toISOString(),
    });
    res.end(cached.data);
    return;
  }

  try {
    let result = await fetchTT(apiPath);
    const now = new Date().toISOString();

    if (result.statusCode === 429) {
      console.warn(`[RATE-LIMIT] 429 received from TT API for: ${apiPath}`);
    }

    if (result.statusCode === 404) {
      const slug = extractSlug(apiPath);
      const retries = slug ? SLUG_RETRIES[slug] : null;
      if (retries && retries.length > 0) {
        for (const altSlug of retries) {
          const altPath = replaceSlug(apiPath, slug, altSlug);
          const altResult = await fetchTT(altPath);
          if (altResult.statusCode === 200) {
            setCache(apiPath, altResult.body, 200);
            res.writeHead(200, {
              'Content-Type': 'application/json', 'Cache-Control': 'no-cache',
              'X-Cache': 'MISS', 'X-Data-Timestamp': now,
            });
            res.end(altResult.body);
            return;
          }
        }
      }
    }

    if (result.statusCode === 200) setCache(apiPath, result.body, 200);

    res.writeHead(result.statusCode, {
      'Content-Type': 'application/json', 'Cache-Control': 'no-cache',
      'X-Cache': 'MISS', 'X-Data-Timestamp': now,
    });
    res.end(result.body);
  } catch (err) {
    console.error(`[PROXY-ERROR] ${apiPath}: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ error: 'Upstream error', message: err.message }));
  }
}

// ---------------------------------------------------------------------------
// Serve a static file from __dirname, or fall back to index.html (SPA).
// ---------------------------------------------------------------------------
function serveStatic(pathname, res) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (readErr, data) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'max-age=3600' });
      res.end(data);
    });
  });
}

// ==========================================================================
// DATABASE API ENDPOINTS
// ==========================================================================
// These serve pre-computed data from PostgreSQL instead of proxying to TT API.
// Frontend calls these first; falls back to TT API proxy if DB is unavailable.
// ==========================================================================

function jsonResponse(res, data, statusCode) {
  statusCode = statusCode || 200;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-Data-Source': 'database',
    'X-Data-Timestamp': lastSyncTime ? lastSyncTime.toISOString() : '',
  });
  res.end(JSON.stringify(data));
}

function jsonError(res, msg, statusCode) {
  statusCode = statusCode || 500;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: msg }));
}

// GET /api/db/load — Returns full dashboard dataset in STATE.data format
// This is the ONE endpoint the frontend needs for initial load.
async function handleDbLoad(res) {
  try {
    // 1. Get all protocols with latest metrics
    const protocolsRes = await db.query(`
      SELECT p.id, p.name, p.symbol, p.sector_id AS sector, p.chains,
             pl.month AS latest_month, pl.revenue, pl.fees, pl.earnings,
             pl.token_incentives, pl.cost_of_revenue, pl.supply_side_fees,
             pl.tvl, pl.fdv, pl.circ_mcap, pl.price, pl.dau,
             pl.take_rate, pl.gross_margin, pl.net_margin, pl.ps_ratio, pl.arpu,
             pl.revenue_mom, pl.revenue_mom3, pl.momentum_signal, pl.momentum_streak,
             pl.consistency, pl.sticky_index
      FROM protocols p
      LEFT JOIN protocol_latest pl ON pl.protocol_id = p.id
      WHERE p.is_archived = FALSE
      ORDER BY pl.revenue DESC NULLS LAST
    `);

    if (protocolsRes.rows.length === 0) {
      console.log('[db-load] No protocols found in database, falling through to TT API proxy');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify(null));
      return;
    }

    // 2. Get all monthly metrics (batched — this is the big query)
    const monthlyRes = await db.query(`
      SELECT protocol_id, month, metric_id, value
      FROM monthly_metrics
      ORDER BY protocol_id, month
    `);

    // 3. Group monthly metrics by protocol
    const monthlyByProtocol = {};
    for (const row of monthlyRes.rows) {
      if (!monthlyByProtocol[row.protocol_id]) monthlyByProtocol[row.protocol_id] = {};
      if (!monthlyByProtocol[row.protocol_id][row.month]) monthlyByProtocol[row.protocol_id][row.month] = {};
      monthlyByProtocol[row.protocol_id][row.month][row.metric_id] = parseFloat(row.value);
    }

    // 4. Build STATE.data format
    const data = {};
    for (const p of protocolsRes.rows) {
      const monthlyMap = monthlyByProtocol[p.id] || {};
      const months = Object.keys(monthlyMap).sort();
      const monthly = months.map(function (month) {
        const d = monthlyMap[month];
        const date = new Date(month + '-01');
        return {
          date: date.toISOString().slice(0, 10),
          month: month,
          calMonth: date.getMonth(),
          revenue: d.revenue || 0,
          fees: d.fees || 0,
          supplySideFees: d.supply_side_fees || 0,
          costOfRevenue: d.cost_of_revenue || 0,
          tokenIncentives: d.token_incentives || 0,
          earnings: d.earnings || 0,
          tvl: d.tvl || 0,
          fdv: d.fdv || 0,
          circMcap: d.circ_mcap || 0,
          price: d.price || 0,
          dau: Math.max(0, Math.round(d.dau || 0)),
          takeRate: d.take_rate || 0,
          grossMargin: d.gross_margin || 0,
          netMargin: d.net_margin || 0,
          psRatio: d.ps_ratio || 0,
          revenueYield: d.revenue_yield || 0,
          arpu: d.arpu || 0,
          chainData: {},
        };
      });

      // Build quarterly from monthly
      const quarterly = buildQuarterlyServer(monthly);

      data[p.id] = {
        id: p.id,
        name: p.name,
        sector: p.sector || 'other',
        chains: p.chains || ['ethereum'],
        chainDist: {},
        monthly: monthly,
        quarterly: quarterly,
        cohorts: generateCohortsServer(p.consistency || 0.15, p.id),
        consistency: p.consistency || 0,
        stickyIndex: p.sticky_index || 0,
        momentumSignal: p.momentum_signal || 'neutral',
        momentumStreak: p.momentum_streak || 0,
        revenueMom: p.revenue_mom || 0,
        revenueMom3: p.revenue_mom3 || 0,
      };
    }

    // 5. Filter out protocols with no monthly metrics data
    var filteredData = {};
    var filteredCount = 0;
    for (var key in data) {
      if (data[key].monthly && data[key].monthly.length > 0) {
        filteredData[key] = data[key];
        filteredCount++;
      }
    }

    // 6. If too few protocols have data, fall through to TT API proxy
    //    (don't set X-Data-Source header so frontend returns null and tries proxy)
    var MIN_PROTOCOLS_THRESHOLD = 10;
    if (filteredCount < MIN_PROTOCOLS_THRESHOLD) {
      console.log('[db-load] Only ' + filteredCount + ' protocols have monthly data (min ' + MIN_PROTOCOLS_THRESHOLD + '), falling through to TT API proxy');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify(null));
      return;
    }

    console.log('[db-load] Returning ' + filteredCount + ' protocols with data (filtered from ' + protocolsRes.rows.length + ' total)');
    jsonResponse(res, filteredData);
  } catch (e) {
    console.error('[db-load] Error:', e.message);
    jsonError(res, 'Database query failed: ' + e.message);
  }
}

// Server-side quarterly builder (mirrors client-side buildQuarterly)
function buildQuarterlyServer(monthly) {
  const qMap = {};
  monthly.forEach(function (m) {
    const d = new Date(m.date);
    const qKey = d.getFullYear() + ' Q' + (Math.floor(d.getMonth() / 3) + 1);
    if (!qMap[qKey]) qMap[qKey] = [];
    qMap[qKey].push(m);
  });
  const qKeys = Object.keys(qMap).sort(function (a, b) {
    const ap = a.split(' Q'), bp = b.split(' Q');
    const d = Number(ap[0]) - Number(bp[0]);
    return d !== 0 ? d : Number(ap[1]) - Number(bp[1]);
  });
  return qKeys.map(function (qLabel) {
    const qMonths = qMap[qLabel];
    return {
      quarter: qLabel,
      revenue: qMonths.reduce(function (s, m) { return s + m.revenue; }, 0),
      fees: qMonths.reduce(function (s, m) { return s + m.fees; }, 0),
      earnings: qMonths.reduce(function (s, m) { return s + m.earnings; }, 0),
      tokenIncentives: qMonths.reduce(function (s, m) { return s + m.tokenIncentives; }, 0),
      costOfRevenue: qMonths.reduce(function (s, m) { return s + m.costOfRevenue; }, 0),
      avgTakeRate: qMonths.reduce(function (s, m) { return s + m.takeRate; }, 0) / qMonths.length,
      avgTvl: qMonths.reduce(function (s, m) { return s + m.tvl; }, 0) / qMonths.length,
      avgFdv: qMonths.reduce(function (s, m) { return s + m.fdv; }, 0) / qMonths.length,
      avgDau: Math.round(qMonths.reduce(function (s, m) { return s + m.dau; }, 0) / qMonths.length),
    };
  });
}

// Server-side cohort generator (mirrors client-side generateCohorts)
function generateCohortsServer(retentionBase, id) {
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h;
  }
  const rng = mulberry32(hashCode((id || '') + '_cohort'));
  const cohorts = [];
  for (let c = 0; c < 12; c++) {
    const row = [1.0];
    for (let m = 1; m <= 11; m++) {
      const base = retentionBase * Math.pow(0.75, m - 1);
      row.push(Math.min(row[m - 1], Math.max(0.01, base * (0.8 + rng() * 0.4))));
    }
    cohorts.push(row);
  }
  return cohorts;
}

// GET /api/db/protocol/:id — Monthly time series for one protocol
async function handleDbProtocol(protocolId, res) {
  try {
    const result = await db.query(
      `SELECT month, metric_id, value FROM monthly_metrics
       WHERE protocol_id = $1 ORDER BY month, metric_id`,
      [protocolId]
    );
    jsonResponse(res, result.rows);
  } catch (e) {
    jsonError(res, 'Query failed: ' + e.message);
  }
}

// GET /api/db/sectors — Sector summary
async function handleDbSectors(res) {
  try {
    const result = await db.query(`
      SELECT s.id AS sector_id, s.label, s.color,
             COUNT(p.id) AS protocol_count,
             COALESCE(SUM(pl.revenue), 0) AS total_revenue,
             COALESCE(AVG(pl.revenue), 0) AS avg_revenue,
             COALESCE(SUM(pl.tvl), 0) AS total_tvl,
             AVG(NULLIF(pl.ps_ratio, 0)) AS avg_ps_ratio,
             AVG(pl.gross_margin) AS avg_gross_margin,
             AVG(pl.net_margin) AS avg_net_margin,
             AVG(pl.revenue_mom) AS avg_revenue_mom
      FROM sectors s
      LEFT JOIN protocols p ON p.sector_id = s.id AND p.is_archived = FALSE
      LEFT JOIN protocol_latest pl ON pl.protocol_id = p.id
      GROUP BY s.id, s.label, s.color
      ORDER BY total_revenue DESC NULLS LAST
    `);
    jsonResponse(res, result.rows);
  } catch (e) {
    jsonError(res, 'Query failed: ' + e.message);
  }
}

// GET /api/db/status — Sync status
function handleDbStatus(res) {
  jsonResponse(res, {
    db_configured: db.isConfigured,
    last_sync: lastSyncTime ? lastSyncTime.toISOString() : null,
    sync_in_progress: syncInProgress,
    sync_progress: syncInProgress ? syncProgress : null,
    next_sync_in: lastSyncTime ? Math.max(0, SYNC_INTERVAL - (Date.now() - lastSyncTime.getTime())) : 0,
  });
}

// POST /api/db/sync — Trigger manual sync
function handleDbSync(res) {
  if (syncInProgress) {
    jsonResponse(res, { status: 'already_running', message: 'Sync is already in progress' });
    return;
  }
  console.log('[sync] Manual sync triggered via API');
  runSync();
  jsonResponse(res, { status: 'started', message: 'Sync started in background' });
}

// ==========================================================================
// BACKGROUND SYNC ENGINE (runs inside server process)
// ==========================================================================
// Fetches all data from TT API and stores in PostgreSQL.
// Runs on server startup + every 6 hours.
// ==========================================================================

const BATCH_SIZE = 2;       // Small batches to avoid burst-triggering rate limits
const BATCH_DELAY = 3000;   // 3s between batches → ~40 req/min (very conservative)
const MAX_RETRIES = 3;      // Retry 429s with exponential backoff
const RATE_LIMIT_COOLDOWN = 30000; // 30s cooldown when 429 detected at batch level

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Sector normalization (server-side copy of the essential mappings)
const SECTOR_NORMALIZE_SERVER = {
  'lending': 'lending', 'exchange': 'dex', 'dex': 'dex',
  'blockchains-l1': 'l1', 'blockchains-l2': 'l2', 'blockchains-l3': 'l2',
  'liquid-staking': 'liquid-staking', 'derivatives': 'derivatives',
  'bridge': 'bridge', 'cdp': 'cdp', 'stablecoin-issuers': 'cdp',
  'yield': 'yield', 'oracle': 'oracle', 'oracles': 'oracle',
  'nft': 'nft', 'nft-collection': 'nft', 'gaming': 'gaming',
  'social': 'social', 'l2': 'l2', 'infrastructure': 'infrastructure',
  'payments': 'payments', 'rwa': 'rwa', 'rwa-issuers': 'rwa',
  'prediction': 'prediction', 'prediction-market': 'prediction',
  'launchpad': 'launchpad', 'ai': 'ai', 'depin': 'ai',
  'cex': 'other', 'erc20-tokens': 'other', 'meme-coins': 'other',
  'risk-curators': 'lending',
};

function normalizeSectorServer(raw) {
  if (!raw) return 'other';
  const key = raw.toLowerCase().trim().replace(/[\s_/\\&]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  return SECTOR_NORMALIZE_SERVER[key] || 'other';
}

const SECTOR_SEED = [
  { id: 'lending', label: 'Lending', color: '#4a9eff' },
  { id: 'dex', label: 'DEX', color: '#fb8b1e' },
  { id: 'l1', label: 'L1 Blockchain', color: '#4af6c3' },
  { id: 'liquid-staking', label: 'Liquid Staking', color: '#a78bfa' },
  { id: 'derivatives', label: 'Derivatives', color: '#ff5a54' },
  { id: 'bridge', label: 'Bridge', color: '#fbbf24' },
  { id: 'cdp', label: 'CDP', color: '#34d399' },
  { id: 'yield', label: 'Yield', color: '#818cf8' },
  { id: 'oracle', label: 'Oracle', color: '#f472b6' },
  { id: 'nft', label: 'NFT', color: '#c084fc' },
  { id: 'gaming', label: 'Gaming', color: '#22d3ee' },
  { id: 'social', label: 'Social', color: '#fb923c' },
  { id: 'l2', label: 'L2', color: '#86efac' },
  { id: 'infrastructure', label: 'Infrastructure', color: '#94a3b8' },
  { id: 'payments', label: 'Payments', color: '#e879f9' },
  { id: 'rwa', label: 'RWA', color: '#facc15' },
  { id: 'prediction', label: 'Prediction Market', color: '#67e8f9' },
  { id: 'launchpad', label: 'Launchpad', color: '#f0abfc' },
  { id: 'ai', label: 'AI', color: '#a3e635' },
  { id: 'other', label: 'Other', color: '#6b7280' },
];

const METRIC_IDS = 'fees,revenue,earnings,token-incentives,cost-of-revenue,supply-side-fees,tvl,price,fully-diluted-market-cap,circulating-market-cap,daily-active-users';

const METRIC_NORMALIZE = {
  'fees': 'fees', 'revenue': 'revenue', 'earnings': 'earnings',
  'token-incentives': 'token_incentives', 'cost-of-revenue': 'cost_of_revenue',
  'supply-side-fees': 'supply_side_fees', 'tvl': 'tvl', 'price': 'price',
  'fully-diluted-market-cap': 'fdv', 'circulating-market-cap': 'circ_mcap',
  'daily-active-users': 'dau',
};

async function runSync() {
  if (syncInProgress) {
    console.log('[sync] Already in progress, skipping');
    return;
  }
  if (!TT_API_KEY) {
    console.log('[sync] No TT_API_KEY, skipping sync');
    return;
  }

  syncInProgress = true;
  const start = Date.now();
  console.log('[sync] Starting full sync...');

  try {
    // 1. Seed sectors table
    for (const s of SECTOR_SEED) {
      await db.query(
        `INSERT INTO sectors (id, label, color) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET label = $2, color = $3`,
        [s.id, s.label, s.color]
      );
    }

    // 2. Fetch sector map from TT API
    console.log('[sync] Fetching sector map...');
    const sectorMap = {};
    try {
      const sectorsJson = await fetchTTJson('/market-sectors');
      const sectors = Array.isArray(sectorsJson) ? sectorsJson : (sectorsJson.data || []);

      for (let i = 0; i < sectors.length; i += BATCH_SIZE) {
        const chunk = sectors.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          chunk.map(s => fetchTTJson('/market-sectors/' + s.id).then(d => ({ sectorId: s.id, data: d })))
        );
        for (const r of results) {
          if (r.status !== 'fulfilled') continue;
          const projects = (r.value.data.data && r.value.data.data.projects) || r.value.data.projects || [];
          for (const p of projects) {
            const pid = (p.project_id || '').toLowerCase();
            if (pid && !sectorMap[pid]) sectorMap[pid] = r.value.sectorId;
          }
        }
        if (i + BATCH_SIZE < sectors.length) await sleep(BATCH_DELAY);
      }
      console.log(`[sync] Sector map: ${Object.keys(sectorMap).length} projects`);
    } catch (e) {
      console.warn('[sync] Sector map failed:', e.message);
    }

    // Cooldown between sector phase and project fetch to avoid rate limit carryover
    console.log('[sync] Cooling down 10s before project fetch...');
    await sleep(10000);

    // 3. Fetch project list
    console.log('[sync] Fetching project list...');
    const projJson = await fetchTTJson('/projects');
    const projects = Array.isArray(projJson) ? projJson : (projJson.data || projJson.projects || []);
    const toSync = projects;
    console.log(`[sync] Found ${projects.length} projects, syncing all`);

    // 4. Upsert protocols
    for (const p of toSync) {
      const id = (p.project_id || p.id || p.slug || '').toLowerCase();
      if (!id) continue;
      const name = p.name || p.project_name || id;
      const rawSector = sectorMap[id] || '';
      const sector = normalizeSectorServer(rawSector);
      const chains = (Array.isArray(p.chains) ? p.chains : [])
        .map(c => (c.slug || c.name || c).toString().toLowerCase());
      const symbol = p.symbol || p.token_symbol || '';

      await db.query(
        `INSERT INTO protocols (id, name, symbol, sector_id, chains, tt_slug, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, symbol = EXCLUDED.symbol,
           sector_id = EXCLUDED.sector_id, chains = EXCLUDED.chains,
           tt_slug = EXCLUDED.tt_slug, updated_at = NOW()`,
        [id, name, symbol, sector, chains.length > 0 ? chains : ['ethereum'], id]
      );
    }

    // 5. Batch-fetch metrics (with adaptive rate limiting)
    // Cooldown before metrics to let rate limit window reset
    console.log('[sync] Cooling down 15s before metrics fetch...');
    await sleep(15000);

    console.log('[sync] Fetching metrics...');
    let okCount = 0, emptyCount = 0, failCount = 0;
    const allProtocolIds = toSync.map(p => (p.project_id || p.id || '').toLowerCase()).filter(Boolean);

    // Smart-filter: skip protocols with 2+ consecutive empty syncs
    let skippable = new Set();
    try {
      const skipRes = await db.query(`
        SELECT protocol_id FROM (
          SELECT protocol_id, status,
            ROW_NUMBER() OVER (PARTITION BY protocol_id ORDER BY completed_at DESC) AS rn
          FROM sync_log
          WHERE endpoint LIKE '%/metrics%'
        ) recent
        WHERE rn <= 2
        GROUP BY protocol_id
        HAVING COUNT(*) = 2
          AND COUNT(*) FILTER (WHERE status = 'empty') = 2
      `);
      skippable = new Set(skipRes.rows.map(r => r.protocol_id));
    } catch (e) {
      console.warn('[sync] Could not query skippable protocols:', e.message);
    }
    const protocolIds = allProtocolIds.filter(pid => !skippable.has(pid));
    const skippedCount = allProtocolIds.length - protocolIds.length;
    if (skippedCount > 0) {
      console.log(`[sync] Skipping ${skippedCount} known-empty protocols, fetching ${protocolIds.length}`);
    }
    syncProgress = { total: protocolIds.length, done: 0, ok: 0, empty: 0, failed: 0, skipped: skippedCount };
    let consecutiveRateLimits = 0;

    for (let i = 0; i < protocolIds.length; i += BATCH_SIZE) {
      const chunk = protocolIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map(pid =>
          fetchTTJson('/projects/' + pid + '/metrics?metric_ids=' + METRIC_IDS + '&interval=2y')
            .then(data => ({ pid, data }))
        )
      );

      // Check if any request in this batch was rate-limited (even after retries)
      let batchHadRateLimit = false;
      for (const r of results) {
        if (r.status === 'rejected' && r.reason && r.reason.message && r.reason.message.includes('429')) {
          batchHadRateLimit = true;
        }
      }

      for (const r of results) {
        if (r.status !== 'fulfilled') { failCount++; continue; }
        const { pid, data } = r.value;
        const rows = data.data || (Array.isArray(data) ? data : []);
        if (rows.length === 0) { emptyCount++; continue; }

        // Group by month
        const byMonth = {};
        for (const row of rows) {
          const month = (row.timestamp || row.date || '').slice(0, 7);
          const metricId = row.metric_id;
          const value = parseFloat(row.value);
          if (!month || !metricId || isNaN(value)) continue;
          const normalizedMetric = METRIC_NORMALIZE[metricId];
          if (!normalizedMetric) continue;
          if (!byMonth[month]) byMonth[month] = {};
          byMonth[month][normalizedMetric] = value;
        }

        // Compute derived metrics and insert
        const client = await db.getClient();
        try {
          await client.query('BEGIN');
          await client.query('DELETE FROM monthly_metrics WHERE protocol_id = $1', [pid]);

          for (const [month, metrics] of Object.entries(byMonth)) {
            const rev = metrics.revenue || 0;
            const fees = metrics.fees || rev;
            const cor = metrics.cost_of_revenue || 0;
            const ti = metrics.token_incentives || 0;
            const earn = metrics.earnings || 0;
            const ssf = metrics.supply_side_fees || (fees - rev);
            const fdv = metrics.fdv || 0;
            const dau = metrics.dau || 0;

            metrics.supply_side_fees = ssf;
            metrics.take_rate = fees > 0 ? rev / fees : 0;
            metrics.gross_margin = rev > 0 ? (rev - cor) / rev : 0;
            metrics.net_margin = rev > 0 ? earn / rev : 0;
            metrics.ps_ratio = (rev * 12) > 0 ? fdv / (rev * 12) : 0;
            metrics.revenue_yield = fdv > 0 ? (rev * 12) / fdv : 0;
            metrics.arpu = Math.max(dau, 1) > 0 ? rev / Math.max(dau, 1) : 0;

            for (const [metricId, val] of Object.entries(metrics)) {
              if (val === null || val === undefined || isNaN(val)) continue;
              await client.query(
                `INSERT INTO monthly_metrics (protocol_id, month, metric_id, value)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (protocol_id, month, metric_id) DO UPDATE SET value = $4`,
                [pid, month, metricId, val]
              );
            }
          }
          await client.query('COMMIT');
          okCount++;
        } catch (e) {
          await client.query('ROLLBACK');
          failCount++;
        } finally {
          client.release();
        }
      }

      const done = Math.min(i + BATCH_SIZE, protocolIds.length);
      syncProgress = { total: protocolIds.length, done, ok: okCount, empty: emptyCount, failed: failCount, skipped: skippedCount };
      if (done % 50 === 0 || done === protocolIds.length) {
        console.log(`[sync] Progress: ${done}/${protocolIds.length} (${okCount} ok, ${emptyCount} empty, ${failCount} failed)`);
      }

      // Adaptive backoff: if any request in this batch was rate-limited, cool down
      if (batchHadRateLimit) {
        consecutiveRateLimits++;
        const cooldown = RATE_LIMIT_COOLDOWN * consecutiveRateLimits; // 30s, 60s, 90s...
        console.warn(`[sync] Rate limit detected in batch, cooling down ${cooldown / 1000}s...`);
        await sleep(cooldown);
      } else {
        consecutiveRateLimits = Math.max(0, consecutiveRateLimits - 1); // Gradually recover
        if (i + BATCH_SIZE < protocolIds.length) await sleep(BATCH_DELAY);
      }
    }

    // 6. Compute protocol_latest with momentum signals
    console.log('[sync] Computing aggregates...');
    await computeProtocolLatest();

    lastSyncTime = new Date();
    console.log(`[sync] Complete: ${okCount} ok, ${emptyCount} empty, ${failCount} failed, ${skippedCount} skipped (known-empty), ${((Date.now() - start) / 1000).toFixed(0)}s`);

  } catch (e) {
    console.error('[sync] Fatal error:', e.message);
  } finally {
    syncInProgress = false;
  }
}

async function computeProtocolLatest() {
  // Pivot latest month's metrics into protocol_latest
  await db.query(`
    INSERT INTO protocol_latest (
      protocol_id, month, revenue, fees, earnings, token_incentives,
      cost_of_revenue, supply_side_fees, tvl, fdv, circ_mcap, price, dau,
      take_rate, gross_margin, net_margin, ps_ratio, arpu, updated_at
    )
    SELECT
      mm.protocol_id, mm.month,
      MAX(CASE WHEN mm.metric_id = 'revenue' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'fees' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'earnings' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'token_incentives' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'cost_of_revenue' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'supply_side_fees' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'tvl' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'fdv' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'circ_mcap' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'price' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'dau' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'take_rate' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'gross_margin' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'net_margin' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'ps_ratio' THEN mm.value END),
      MAX(CASE WHEN mm.metric_id = 'arpu' THEN mm.value END),
      NOW()
    FROM monthly_metrics mm
    INNER JOIN (
      SELECT protocol_id, MAX(month) AS month
      FROM monthly_metrics WHERE metric_id = 'revenue'
      GROUP BY protocol_id
    ) latest ON mm.protocol_id = latest.protocol_id AND mm.month = latest.month
    GROUP BY mm.protocol_id, mm.month
    ON CONFLICT (protocol_id) DO UPDATE SET
      month = EXCLUDED.month, revenue = EXCLUDED.revenue, fees = EXCLUDED.fees,
      earnings = EXCLUDED.earnings, token_incentives = EXCLUDED.token_incentives,
      cost_of_revenue = EXCLUDED.cost_of_revenue, supply_side_fees = EXCLUDED.supply_side_fees,
      tvl = EXCLUDED.tvl, fdv = EXCLUDED.fdv, circ_mcap = EXCLUDED.circ_mcap,
      price = EXCLUDED.price, dau = EXCLUDED.dau, take_rate = EXCLUDED.take_rate,
      gross_margin = EXCLUDED.gross_margin, net_margin = EXCLUDED.net_margin,
      ps_ratio = EXCLUDED.ps_ratio, arpu = EXCLUDED.arpu, updated_at = NOW()
  `);

  // Compute momentum per protocol
  const protocols = await db.query('SELECT DISTINCT protocol_id FROM protocol_latest');
  for (const row of protocols.rows) {
    const pid = row.protocol_id;
    const metrics = await db.query(
      `SELECT month, value FROM monthly_metrics
       WHERE protocol_id = $1 AND metric_id = 'revenue'
       ORDER BY month DESC LIMIT 12`, [pid]
    );
    const revs = metrics.rows.reverse();
    if (revs.length < 2) continue;

    const latest = revs[revs.length - 1].value;
    const prev = revs[revs.length - 2].value;
    const mom1 = prev > 0 ? (latest - prev) / prev : 0;
    const three = revs.length >= 4 ? revs[revs.length - 4].value : null;
    const mom3 = three && three > 0 ? (latest - three) / three : 0;

    let streak = 0;
    for (let i = revs.length - 1; i >= 1; i--) {
      const diff = revs[i].value - revs[i - 1].value;
      if (diff > 0) { if (streak >= 0) streak++; else break; }
      else if (diff < 0) { if (streak <= 0) streak--; else break; }
      else break;
    }

    let signal = 'neutral';
    if (mom1 > 0.15 && mom3 > 0.30 && streak >= 3) signal = 'strong-up';
    else if (mom1 > 0 && mom3 > 0) signal = 'up';
    else if (mom1 < -0.15 && mom3 < -0.30 && streak <= -3) signal = 'strong-down';
    else if (mom1 < 0 && mom3 < 0) signal = 'down';

    const revValues = revs.map(r => parseFloat(r.value)).filter(v => v > 0);
    const mean = revValues.length > 0 ? revValues.reduce((a, b) => a + b, 0) / revValues.length : 0;
    const std = revValues.length > 0 ? Math.sqrt(revValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / revValues.length) : 0;
    const consistency = mean > 0 ? Math.max(0, 1 - std / mean) : 0;

    let stickySum = 0, stickyCount = 0;
    for (let i = 1; i < revs.length; i++) {
      const a = parseFloat(revs[i].value), b = parseFloat(revs[i - 1].value);
      const mx = Math.max(a, b);
      if (mx > 0) { stickySum += Math.min(a, b) / mx; stickyCount++; }
    }
    const stickyIndex = stickyCount > 0 ? stickySum / stickyCount : 0;

    await db.query(
      `UPDATE protocol_latest SET
        revenue_mom = $2, revenue_mom3 = $3, momentum_streak = $4,
        momentum_signal = $5, consistency = $6, sticky_index = $7
       WHERE protocol_id = $1`,
      [pid, mom1, mom3, streak, signal, consistency, stickyIndex]
    );
  }
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsed.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ---- Database API endpoints ----
  if (pathname === '/api/db/load') {
    handleDbLoad(res);
    return;
  }

  if (pathname.startsWith('/api/db/protocol/')) {
    const protocolId = pathname.replace('/api/db/protocol/', '').split('/')[0];
    handleDbProtocol(protocolId, res);
    return;
  }

  if (pathname === '/api/db/sectors') {
    handleDbSectors(res);
    return;
  }

  if (pathname === '/api/db/status') {
    handleDbStatus(res);
    return;
  }

  if (pathname === '/api/db/sync') {
    handleDbSync(res);
    return;
  }

  // ---- TT API proxy (fallback for when DB is not available) ----
  if (pathname.startsWith('/api/tt/')) {
    const apiPath = pathname.replace('/api/tt', '') + parsed.search;
    proxyTT(apiPath, res);
    return;
  }

  // Health check
  if (pathname === '/health') {
    const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      api_configured: !!TT_API_KEY,
      db_configured: db.isConfigured,
      db_synced: !!lastSyncTime,
      last_sync: lastSyncTime ? lastSyncTime.toISOString() : null,
      cache_entries: cache.size,
      uptime: uptimeSeconds,
    }));
    return;
  }

  // Debug endpoint
  if (pathname === '/api/debug/projects-sample') {
    if (!TT_API_KEY) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No API key configured' }));
      return;
    }
    fetchTT('/projects').then(function (result) {
      if (result.statusCode !== 200) {
        res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
        res.end(result.body);
        return;
      }
      try {
        var body = JSON.parse(result.body);
        var projects = Array.isArray(body) ? body : (body.data || body.projects || []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          total_projects: projects.length,
          field_names: projects.length > 0 ? Object.keys(projects[0]) : [],
          sample: projects.slice(0, 3)
        }, null, 2));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ raw_truncated: result.body.slice(0, 2000) }));
      }
    }).catch(function (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Static files (with SPA fallback)
  serveStatic(pathname, res);
});

// ---------------------------------------------------------------------------
// SERVER STARTUP
// ---------------------------------------------------------------------------
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Token Terminal API: ${TT_API_KEY ? 'configured' : 'not configured (mock data mode)'}`);
  console.log(`PostgreSQL: ${db.isConfigured ? 'configured' : 'not configured (TT API proxy mode)'}`);

  // Initialize database if configured
  if (db.isConfigured) {
    const ok = await initDB();
    if (ok) {
      console.log('[startup] Database ready');

      // Check if we have data already
      try {
        const count = await db.query('SELECT COUNT(*) FROM protocol_latest');
        const protocolCount = parseInt(count.rows[0].count);
        if (protocolCount > 0) {
          console.log(`[startup] ${protocolCount} protocols already in DB, serving immediately`);
          // Get last sync time
          try {
            const syncState = await db.query("SELECT value FROM sync_state WHERE key = 'last_full_sync'");
            if (syncState.rows.length > 0 && syncState.rows[0].value) {
              lastSyncTime = new Date(syncState.rows[0].value);
            }
          } catch (_) {}
        }
      } catch (_) {}

      // Run sync in background (doesn't block server startup)
      console.log('[startup] Starting background sync...');
      runSync().then(() => {
        // Schedule recurring sync
        setInterval(() => {
          console.log('[scheduler] Starting periodic sync...');
          runSync();
        }, SYNC_INTERVAL);
      });
    }
  }

  console.log(`Open http://localhost:${PORT}`);
});
