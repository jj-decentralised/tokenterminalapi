// =============================================================================
// sync.js — Background data sync engine
// =============================================================================
// Pulls data from Token Terminal API and populates the PostgreSQL database.
// Run periodically (e.g., every 6 hours via cron) or on-demand.
//
// Usage:
//   node sync.js              # Full sync
//   node sync.js --sectors    # Sync sectors only
//   node sync.js --metrics    # Sync metrics only (skip project discovery)
//   node sync.js --refresh    # Refresh materialized views only
//
// Env vars:
//   TT_API_KEY   — Token Terminal API bearer token
//   DATABASE_URL — PostgreSQL connection string
// =============================================================================

const https = require('https');
const { Pool } = require('pg');

const TT_BASE = 'https://api.tokenterminal.com/v2';
const TT_KEY = process.env.TT_API_KEY;
const MAX_PROTOCOLS = 500;
const BATCH_SIZE = 5;        // Conservative: 5 concurrent requests per batch
const BATCH_DELAY = 2000;    // 2s between batches → ~150 req/min (well under 1000/min limit)
const MAX_RETRIES = 3;       // Retry 429s with exponential backoff

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// =============================================================================
// TT API FETCH
// =============================================================================

function fetchTTRaw(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(TT_BASE + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { Authorization: 'Bearer ' + TT_KEY, Accept: 'application/json' }
    };
    https.get(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    }).on('error', reject);
  });
}

async function fetchTT(path) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const r = await fetchTTRaw(path);
    if (r.statusCode === 429) {
      if (attempt < MAX_RETRIES) {
        const backoff = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.warn(`[RATE-LIMIT] 429 on ${path}, retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoff);
        continue;
      }
      throw new Error(`API 429 (rate limited after retries): ${path}`);
    }
    if (r.statusCode >= 400) {
      throw new Error(`API ${r.statusCode}: ${path}`);
    }
    try { return JSON.parse(r.body); }
    catch (e) { throw new Error(`JSON parse failed: ${path}`); }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// =============================================================================
// 1. SYNC SECTORS
// =============================================================================

async function syncSectors() {
  console.log('[sync] Syncing sectors...');
  const start = Date.now();

  const json = await fetchTT('/market-sectors');
  const sectors = Array.isArray(json) ? json : (json.data || []);

  // Build reverse map: project_id → sector_id
  const sectorMap = {};

  for (let i = 0; i < sectors.length; i += BATCH_SIZE) {
    const chunk = sectors.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      chunk.map(s => fetchTT('/market-sectors/' + s.id).then(d => ({ sectorId: s.id, data: d })))
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { sectorId, data } = result.value;
      const projects = (data.data && data.data.projects) || data.projects || [];
      for (const p of projects) {
        const pid = (p.project_id || '').toLowerCase();
        if (pid && !sectorMap[pid]) sectorMap[pid] = sectorId;
      }
    }

    if (i + BATCH_SIZE < sectors.length) await sleep(BATCH_DELAY);
  }

  console.log(`[sync] Sector map: ${Object.keys(sectorMap).length} projects, ${Date.now() - start}ms`);
  return sectorMap;
}

// =============================================================================
// 2. SYNC PROJECT LIST
// =============================================================================

async function syncProjects(sectorMap) {
  console.log('[sync] Syncing project list...');

  const json = await fetchTT('/projects');
  const projects = Array.isArray(json) ? json : (json.data || json.projects || []);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const p of projects.slice(0, MAX_PROTOCOLS)) {
      const id = (p.project_id || p.id || p.slug || '').toLowerCase();
      if (!id) continue;

      const name = p.name || p.project_name || id;
      const sector = sectorMap[id] || 'other';
      const chains = (Array.isArray(p.chains) ? p.chains : [])
        .map(c => (c.slug || c.name || c).toString().toLowerCase());
      const symbol = p.symbol || p.token_symbol || '';

      await client.query(`
        INSERT INTO protocols (id, name, symbol, sector_id, chains, tt_slug, metadata, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          symbol = EXCLUDED.symbol,
          sector_id = EXCLUDED.sector_id,
          chains = EXCLUDED.chains,
          tt_slug = EXCLUDED.tt_slug,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [id, name, symbol, sector, chains, id, JSON.stringify(p)]);
    }

    await client.query('COMMIT');
    console.log(`[sync] Upserted ${Math.min(projects.length, MAX_PROTOCOLS)} protocols`);
    return projects.slice(0, MAX_PROTOCOLS).map(p => (p.project_id || p.id || '').toLowerCase()).filter(Boolean);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// =============================================================================
// 3. SYNC METRICS (batch fetch per protocol)
// =============================================================================

const METRIC_IDS = [
  'fees', 'revenue', 'earnings', 'token-incentives', 'cost-of-revenue',
  'supply-side-fees', 'tvl', 'price', 'fully-diluted-market-cap',
  'circulating-market-cap', 'daily-active-users'
].join(',');

// Normalize TT API metric names to our DB metric_ids
const METRIC_NORMALIZE = {
  'fees': 'fees',
  'revenue': 'revenue',
  'earnings': 'earnings',
  'token-incentives': 'token_incentives',
  'cost-of-revenue': 'cost_of_revenue',
  'supply-side-fees': 'supply_side_fees',
  'tvl': 'tvl',
  'price': 'price',
  'fully-diluted-market-cap': 'fdv',
  'circulating-market-cap': 'circ_mcap',
  'daily-active-users': 'dau',
};

async function syncMetricsForProtocol(protocolId) {
  const start = Date.now();
  try {
    const data = await fetchTT(`/projects/${protocolId}/metrics?metric_ids=${METRIC_IDS}&interval=2y`);
    const rows = data.data || (Array.isArray(data) ? data : []);

    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO sync_log (protocol_id, endpoint, status, row_count, duration_ms, completed_at)
         VALUES ($1, $2, 'empty', 0, $3, NOW())`,
        [protocolId, '/projects/' + protocolId + '/metrics', Date.now() - start]
      );
      return 0;
    }

    // Group by month
    const byMonth = {};
    for (const row of rows) {
      const month = (row.timestamp || row.date || '').slice(0, 7);
      if (!month) continue;
      const metricId = row.metric_id;
      const value = parseFloat(row.value);
      if (!metricId || isNaN(value)) continue;

      const normalizedMetric = METRIC_NORMALIZE[metricId];
      if (!normalizedMetric) continue;

      if (!byMonth[month]) byMonth[month] = {};
      byMonth[month][normalizedMetric] = value;
    }

    // Compute derived metrics and insert
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing metrics for this protocol (full refresh)
      await client.query('DELETE FROM monthly_metrics WHERE protocol_id = $1', [protocolId]);

      for (const [month, metrics] of Object.entries(byMonth)) {
        const rev = metrics.revenue || 0;
        const fees = metrics.fees || rev;
        const cor = metrics.cost_of_revenue || 0;
        const ti = metrics.token_incentives || 0;
        const earn = metrics.earnings || 0;
        const ssf = metrics.supply_side_fees || (fees - rev);
        const fdv = metrics.fdv || 0;
        const dau = metrics.dau || 0;

        // Computed metrics
        metrics.supply_side_fees = ssf;
        metrics.take_rate = fees > 0 ? rev / fees : 0;
        metrics.gross_margin = rev > 0 ? (rev - cor) / rev : 0;
        metrics.net_margin = rev > 0 ? earn / rev : 0;
        metrics.ps_ratio = (rev * 12) > 0 ? fdv / (rev * 12) : 0;
        metrics.revenue_yield = fdv > 0 ? (rev * 12) / fdv : 0;
        metrics.arpu = Math.max(dau, 1) > 0 ? rev / Math.max(dau, 1) : 0;

        // Insert all metrics as rows
        for (const [metricId, value] of Object.entries(metrics)) {
          if (value === null || value === undefined || isNaN(value)) continue;
          await client.query(
            `INSERT INTO monthly_metrics (protocol_id, month, metric_id, value)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (protocol_id, month, metric_id) DO UPDATE SET value = $4`,
            [protocolId, month, metricId, value]
          );
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await pool.query(
      `INSERT INTO sync_log (protocol_id, endpoint, status, slug_used, row_count, duration_ms, completed_at)
       VALUES ($1, $2, 'ok', $3, $4, $5, NOW())`,
      [protocolId, '/projects/' + protocolId + '/metrics', protocolId, rows.length, Date.now() - start]
    );

    return Object.keys(byMonth).length;

  } catch (e) {
    await pool.query(
      `INSERT INTO sync_log (protocol_id, endpoint, status, error_message, duration_ms, completed_at)
       VALUES ($1, $2, 'failed', $3, $4, NOW())`,
      [protocolId, '/projects/' + protocolId + '/metrics', e.message, Date.now() - start]
    );
    return 0;
  }
}

async function syncAllMetrics(protocolIds) {
  console.log(`[sync] Syncing metrics for ${protocolIds.length} protocols...`);
  let total = 0;
  let failed = 0;

  for (let i = 0; i < protocolIds.length; i += BATCH_SIZE) {
    const chunk = protocolIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      chunk.map(pid => syncMetricsForProtocol(pid))
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value > 0) total++;
      else failed++;
    }

    const done = Math.min(i + BATCH_SIZE, protocolIds.length);
    process.stdout.write(`\r[sync] Progress: ${done}/${protocolIds.length} (${total} ok, ${failed} failed)`);

    if (i + BATCH_SIZE < protocolIds.length) await sleep(BATCH_DELAY);
  }

  console.log(`\n[sync] Metrics sync complete: ${total} ok, ${failed} failed`);
}

// =============================================================================
// 4. COMPUTE AGGREGATES
// =============================================================================

async function computeProtocolLatest() {
  console.log('[sync] Computing protocol_latest...');

  await pool.query(`
    INSERT INTO protocol_latest (
      protocol_id, month, revenue, fees, earnings, token_incentives,
      cost_of_revenue, supply_side_fees, tvl, fdv, circ_mcap, price, dau,
      take_rate, gross_margin, net_margin, ps_ratio, arpu, updated_at
    )
    SELECT
      mm.protocol_id,
      mm.month,
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
      FROM monthly_metrics
      WHERE metric_id = 'revenue'
      GROUP BY protocol_id
    ) latest ON mm.protocol_id = latest.protocol_id AND mm.month = latest.month
    GROUP BY mm.protocol_id, mm.month
    ON CONFLICT (protocol_id) DO UPDATE SET
      month = EXCLUDED.month,
      revenue = EXCLUDED.revenue,
      fees = EXCLUDED.fees,
      earnings = EXCLUDED.earnings,
      token_incentives = EXCLUDED.token_incentives,
      cost_of_revenue = EXCLUDED.cost_of_revenue,
      supply_side_fees = EXCLUDED.supply_side_fees,
      tvl = EXCLUDED.tvl,
      fdv = EXCLUDED.fdv,
      circ_mcap = EXCLUDED.circ_mcap,
      price = EXCLUDED.price,
      dau = EXCLUDED.dau,
      take_rate = EXCLUDED.take_rate,
      gross_margin = EXCLUDED.gross_margin,
      net_margin = EXCLUDED.net_margin,
      ps_ratio = EXCLUDED.ps_ratio,
      arpu = EXCLUDED.arpu,
      updated_at = NOW()
  `);

  // Compute momentum signals
  const protocols = await pool.query('SELECT DISTINCT protocol_id FROM protocol_latest');
  for (const row of protocols.rows) {
    const pid = row.protocol_id;
    const metrics = await pool.query(
      `SELECT month, value FROM monthly_metrics
       WHERE protocol_id = $1 AND metric_id = 'revenue'
       ORDER BY month DESC LIMIT 12`,
      [pid]
    );
    const revs = metrics.rows.reverse(); // oldest first

    if (revs.length >= 2) {
      const latest = revs[revs.length - 1].value;
      const prev = revs[revs.length - 2].value;
      const mom1 = prev > 0 ? (latest - prev) / prev : 0;

      const three = revs.length >= 4 ? revs[revs.length - 4].value : null;
      const mom3 = three && three > 0 ? (latest - three) / three : 0;

      // Streak
      let streak = 0;
      for (let i = revs.length - 1; i >= 1; i--) {
        const diff = revs[i].value - revs[i - 1].value;
        if (diff > 0) { if (streak >= 0) streak++; else break; }
        else if (diff < 0) { if (streak <= 0) streak--; else break; }
        else break;
      }

      // Signal classification
      let signal = 'neutral';
      if (mom1 > 0.15 && mom3 > 0.30 && streak >= 3) signal = 'strong-up';
      else if (mom1 > 0 && mom3 > 0) signal = 'up';
      else if (mom1 < -0.15 && mom3 < -0.30 && streak <= -3) signal = 'strong-down';
      else if (mom1 < 0 && mom3 < 0) signal = 'down';

      // Consistency & sticky index
      const revValues = revs.map(r => r.value).filter(v => v > 0);
      const mean = revValues.length > 0 ? revValues.reduce((a, b) => a + b, 0) / revValues.length : 0;
      const std = revValues.length > 0 ? Math.sqrt(revValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / revValues.length) : 0;
      const consistency = mean > 0 ? Math.max(0, 1 - std / mean) : 0;

      let stickySum = 0, stickyCount = 0;
      for (let i = 1; i < revs.length; i++) {
        const mx = Math.max(revs[i].value, revs[i - 1].value);
        if (mx > 0) { stickySum += Math.min(revs[i].value, revs[i - 1].value) / mx; stickyCount++; }
      }
      const stickyIndex = stickyCount > 0 ? stickySum / stickyCount : 0;

      await pool.query(
        `UPDATE protocol_latest SET
          revenue_mom = $2, revenue_mom3 = $3, momentum_streak = $4,
          momentum_signal = $5, consistency = $6, sticky_index = $7
         WHERE protocol_id = $1`,
        [pid, mom1, mom3, streak, signal, consistency, stickyIndex]
      );
    }
  }

  console.log('[sync] protocol_latest computed');
}

async function computeQuarterly() {
  console.log('[sync] Computing quarterly aggregates...');
  await pool.query('DELETE FROM quarterly_metrics');
  await pool.query(`
    INSERT INTO quarterly_metrics (
      protocol_id, quarter, revenue, fees, earnings, token_incentives,
      cost_of_revenue, avg_take_rate, avg_tvl, avg_fdv, avg_dau
    )
    SELECT
      protocol_id,
      EXTRACT(YEAR FROM TO_DATE(month || '-01', 'YYYY-MM-DD'))::TEXT || ' Q' ||
        CEIL(EXTRACT(MONTH FROM TO_DATE(month || '-01', 'YYYY-MM-DD')) / 3.0)::INTEGER,
      SUM(CASE WHEN metric_id = 'revenue' THEN value ELSE 0 END),
      SUM(CASE WHEN metric_id = 'fees' THEN value ELSE 0 END),
      SUM(CASE WHEN metric_id = 'earnings' THEN value ELSE 0 END),
      SUM(CASE WHEN metric_id = 'token_incentives' THEN value ELSE 0 END),
      SUM(CASE WHEN metric_id = 'cost_of_revenue' THEN value ELSE 0 END),
      AVG(CASE WHEN metric_id = 'take_rate' THEN value END),
      AVG(CASE WHEN metric_id = 'tvl' THEN value END),
      AVG(CASE WHEN metric_id = 'fdv' THEN value END),
      AVG(CASE WHEN metric_id = 'dau' THEN value END)
    FROM monthly_metrics
    WHERE metric_id IN ('revenue','fees','earnings','token_incentives',
                        'cost_of_revenue','take_rate','tvl','fdv','dau')
    GROUP BY protocol_id,
      EXTRACT(YEAR FROM TO_DATE(month || '-01', 'YYYY-MM-DD'))::TEXT || ' Q' ||
        CEIL(EXTRACT(MONTH FROM TO_DATE(month || '-01', 'YYYY-MM-DD')) / 3.0)::INTEGER
  `);
  console.log('[sync] Quarterly aggregates computed');
}

async function refreshViews() {
  console.log('[sync] Refreshing materialized views...');
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_load');
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sector_summary');
  console.log('[sync] Views refreshed');
}

// =============================================================================
// 5. MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const start = Date.now();

  try {
    if (args.includes('--refresh')) {
      await refreshViews();
    } else if (args.includes('--metrics')) {
      const pids = (await pool.query('SELECT id FROM protocols WHERE is_archived = FALSE')).rows.map(r => r.id);
      await syncAllMetrics(pids);
      await computeProtocolLatest();
      await computeQuarterly();
      await refreshViews();
    } else if (args.includes('--sectors')) {
      await syncSectors();
    } else {
      // Full sync
      const sectorMap = await syncSectors();
      const protocolIds = await syncProjects(sectorMap);
      await syncAllMetrics(protocolIds);
      await computeProtocolLatest();
      await computeQuarterly();
      await refreshViews();
    }

    await pool.query(
      `INSERT INTO sync_state (key, value, updated_at) VALUES ('last_full_sync', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [new Date().toISOString()]
    );

    console.log(`\n[sync] Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error('[sync] Fatal error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
