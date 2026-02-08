// ===================================================================
// SECTOR CONSTANTS
// ===================================================================
const SECTOR_COLORS = {
  'lending': '#4a9eff',
  'dex': '#fb8b1e',
  'l1': '#4af6c3',
  'liquid-staking': '#a78bfa'
};
const SECTOR_LABELS = {
  'lending': 'Lending',
  'dex': 'DEX',
  'l1': 'L1 Blockchain',
  'liquid-staking': 'Liquid Staking'
};

// ===================================================================
// PROTOCOL CONFIGURATIONS
// ===================================================================
const PROTOCOLS = [
  { id: 'aave', name: 'Aave', sector: 'lending', chains: ['ethereum','polygon','arbitrum','base','optimism'],
    baseRevenue: 14e6, growthRate: 0.025, seasonAmp: 0.18, takeRate: 0.15, incentiveRatio: 0.30, volatility: 0.10,
    tvlBase: 12e9, fdvBase: 5e9, dauBase: 25000, retentionBase: 0.22,
    chainDist: {ethereum:0.55,polygon:0.10,arbitrum:0.18,base:0.12,optimism:0.05} },
  { id: 'compound', name: 'Compound', sector: 'lending', chains: ['ethereum','base','arbitrum'],
    baseRevenue: 3.5e6, growthRate: 0.008, seasonAmp: 0.15, takeRate: 0.12, incentiveRatio: 0.55, volatility: 0.08,
    tvlBase: 3.2e9, fdvBase: 1.8e9, dauBase: 8000, retentionBase: 0.18,
    chainDist: {ethereum:0.72,base:0.18,arbitrum:0.10} },
  { id: 'morpho', name: 'Morpho', sector: 'lending', chains: ['ethereum','base'],
    baseRevenue: 2.2e6, growthRate: 0.06, seasonAmp: 0.20, takeRate: 0.10, incentiveRatio: 0.70, volatility: 0.15,
    tvlBase: 1.8e9, fdvBase: 1.2e9, dauBase: 5000, retentionBase: 0.14,
    chainDist: {ethereum:0.60,base:0.40} },
  { id: 'venus', name: 'Venus', sector: 'lending', chains: ['bsc'],
    baseRevenue: 1.8e6, growthRate: 0.01, seasonAmp: 0.12, takeRate: 0.20, incentiveRatio: 0.40, volatility: 0.09,
    tvlBase: 2.1e9, fdvBase: 0.6e9, dauBase: 12000, retentionBase: 0.16,
    chainDist: {bsc:1.0} },
  { id: 'uniswap', name: 'Uniswap', sector: 'dex', chains: ['ethereum','polygon','arbitrum','base','optimism'],
    baseRevenue: 8e6, growthRate: 0.03, seasonAmp: 0.25, takeRate: 0.04, incentiveRatio: 0.08, volatility: 0.18,
    tvlBase: 5.5e9, fdvBase: 8e9, dauBase: 85000, retentionBase: 0.10,
    chainDist: {ethereum:0.45,arbitrum:0.22,base:0.18,polygon:0.08,optimism:0.07} },
  { id: 'curve', name: 'Curve', sector: 'dex', chains: ['ethereum','polygon','arbitrum'],
    baseRevenue: 2.8e6, growthRate: -0.005, seasonAmp: 0.15, takeRate: 0.50, incentiveRatio: 1.2, volatility: 0.12,
    tvlBase: 2.2e9, fdvBase: 0.9e9, dauBase: 6000, retentionBase: 0.15,
    chainDist: {ethereum:0.65,polygon:0.15,arbitrum:0.20} },
  { id: 'pancakeswap', name: 'PancakeSwap', sector: 'dex', chains: ['bsc','ethereum','arbitrum'],
    baseRevenue: 8e6, growthRate: 0.01, seasonAmp: 0.20, takeRate: 0.08, incentiveRatio: 0.35, volatility: 0.14,
    tvlBase: 2.8e9, fdvBase: 2.2e9, dauBase: 120000, retentionBase: 0.08,
    chainDist: {bsc:0.68,ethereum:0.18,arbitrum:0.14} },
  { id: 'raydium', name: 'Raydium', sector: 'dex', chains: ['solana'],
    baseRevenue: 12e6, growthRate: 0.04, seasonAmp: 0.30, takeRate: 0.12, incentiveRatio: 0.15, volatility: 0.22,
    tvlBase: 1.5e9, fdvBase: 1.8e9, dauBase: 95000, retentionBase: 0.07,
    chainDist: {solana:1.0} },
  { id: 'ethereum', name: 'Ethereum', sector: 'l1', chains: ['ethereum'],
    baseRevenue: 180e6, growthRate: 0.015, seasonAmp: 0.22, takeRate: 0.80, incentiveRatio: 0.05, volatility: 0.15,
    tvlBase: 65e9, fdvBase: 350e9, dauBase: 450000, retentionBase: 0.35,
    chainDist: {ethereum:1.0} },
  { id: 'solana', name: 'Solana', sector: 'l1', chains: ['solana'],
    baseRevenue: 85e6, growthRate: 0.04, seasonAmp: 0.28, takeRate: 0.50, incentiveRatio: 0.12, volatility: 0.20,
    tvlBase: 8e9, fdvBase: 90e9, dauBase: 600000, retentionBase: 0.25,
    chainDist: {solana:1.0} },
  { id: 'avalanche', name: 'Avalanche', sector: 'l1', chains: ['avalanche'],
    baseRevenue: 3e6, growthRate: -0.01, seasonAmp: 0.18, takeRate: 0.65, incentiveRatio: 0.50, volatility: 0.13,
    tvlBase: 1.2e9, fdvBase: 12e9, dauBase: 35000, retentionBase: 0.20,
    chainDist: {avalanche:1.0} },
  { id: 'bnb-chain', name: 'BNB Chain', sector: 'l1', chains: ['bsc'],
    baseRevenue: 25e6, growthRate: 0.005, seasonAmp: 0.15, takeRate: 0.70, incentiveRatio: 0.08, volatility: 0.10,
    tvlBase: 5.5e9, fdvBase: 85e9, dauBase: 800000, retentionBase: 0.28,
    chainDist: {bsc:1.0} },
  { id: 'lido', name: 'Lido', sector: 'liquid-staking', chains: ['ethereum'],
    baseRevenue: 35e6, growthRate: 0.01, seasonAmp: 0.08, takeRate: 0.10, incentiveRatio: 0.10, volatility: 0.06,
    tvlBase: 25e9, fdvBase: 2.5e9, dauBase: 3000, retentionBase: 0.60,
    chainDist: {ethereum:1.0} },
  { id: 'rocket-pool', name: 'Rocket Pool', sector: 'liquid-staking', chains: ['ethereum'],
    baseRevenue: 3e6, growthRate: 0.005, seasonAmp: 0.06, takeRate: 0.14, incentiveRatio: 0.20, volatility: 0.05,
    tvlBase: 3.5e9, fdvBase: 0.8e9, dauBase: 800, retentionBase: 0.65,
    chainDist: {ethereum:1.0} },
  { id: 'jito', name: 'Jito', sector: 'liquid-staking', chains: ['solana'],
    baseRevenue: 8e6, growthRate: 0.05, seasonAmp: 0.15, takeRate: 0.04, incentiveRatio: 0.25, volatility: 0.12,
    tvlBase: 2.5e9, fdvBase: 3e9, dauBase: 15000, retentionBase: 0.40,
    chainDist: {solana:1.0} }
];

// Slug aliases for Token Terminal API (some project IDs differ from our internal IDs)
const SLUG_ALIASES = {
  'lido': ['lido', 'lido-finance', 'lido-dao'],
  'bnb-chain': ['bnb-chain', 'bnb-smart-chain', 'binance-smart-chain', 'bsc'],
  'rocket-pool': ['rocket-pool', 'rocketpool'],
  'pancakeswap': ['pancakeswap', 'pancake-swap'],
};

// ===================================================================
// SEEDED PRNG
// ===================================================================
function mulberry32(a) {
  return function() {
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

// ===================================================================
// TOKEN TERMINAL API LAYER
// ===================================================================
const API_BASE = '/api/tt';

// Track per-protocol fetch status
const FETCH_STATUS = {};

async function fetchTT(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function fetchWithSlugRetry(config) {
  const aliases = SLUG_ALIASES[config.id] || [config.id];
  const metricIds = 'fees,revenue,earnings,token-incentives,cost-of-revenue,supply-side-fees,tvl,price,fully-diluted-market-cap,circulating-market-cap,daily-active-users';

  for (const slug of aliases) {
    try {
      const metrics = await fetchTT(`/projects/${slug}/metrics?metric_ids=${metricIds}&interval=2y`);
      if (metrics?.data?.length > 0) {
        FETCH_STATUS[config.id] = { status: 'ok', slug, count: metrics.data.length };
        return metrics;
      }
    } catch (e) {
      // Try next alias
    }
  }
  FETCH_STATUS[config.id] = { status: 'failed', error: 'All slug aliases returned 404' };
  throw new Error(`All slug aliases failed for ${config.id}`);
}

// Transform Token Terminal API responses into our internal format
function transformAPIData(projectId, config, metricsData) {
  const monthly = [];
  const byMonth = {};

  // Group metrics by month — TT API returns one row per metric per timestamp
  (metricsData.data || []).forEach(row => {
    const month = row.timestamp?.slice(0, 7);
    if (!month) return;
    if (!byMonth[month]) byMonth[month] = {};

    // Token Terminal uses metric_id field with value field
    const metricId = row.metric_id;
    const value = parseFloat(row.value);
    if (metricId && !isNaN(value)) {
      byMonth[month][metricId] = value;
    }

    // Also check for flat fields (some endpoints return them directly)
    ['revenue','fees','earnings','token_incentives','cost_of_revenue',
     'supply_side_fees','tvl','price','fully_diluted_market_cap',
     'circulating_market_cap','daily_active_users','token_trading_volume'
    ].forEach(key => {
      if (row[key] !== undefined) {
        const v = parseFloat(row[key]);
        if (!isNaN(v)) byMonth[month][key] = v;
      }
    });
  });

  const months = Object.keys(byMonth).sort();
  months.forEach((month) => {
    const d = byMonth[month];
    const date = new Date(month + '-01');

    // Resolve field names with all known aliases
    const revenue = d.revenue || d['revenue'] || 0;
    const fees = d.fees || d['fees'] || revenue;
    const earnings = d.earnings || d['earnings'] || 0;
    const tokenIncentives = d['token-incentives'] || d.token_incentives || d['token_incentives'] || 0;
    const costOfRevenue = d['cost-of-revenue'] || d.cost_of_revenue || d['cost_of_revenue'] || 0;
    const supplySideFees = d['supply-side-fees'] || d.supply_side_fees || d['supply_side_fees'] || (fees - revenue);
    const tvl = d.tvl || d['tvl'] || 0;
    const fdv = d['fully-diluted-market-cap'] || d.fully_diluted_market_cap || d['fully_diluted_market_cap'] || d['market-cap-fully-diluted'] || d['fdv'] || 0;
    const circMcap = d['circulating-market-cap'] || d.circulating_market_cap || d['circulating_market_cap'] || d['market-cap-circulating'] || 0;
    const price = d.price || d['price'] || 0;
    const dau = d['daily-active-users'] || d.daily_active_users || d['daily_active_users'] || d['active-users'] || 0;

    monthly.push({
      date: date.toISOString().slice(0, 10),
      month,
      calMonth: date.getMonth(),
      revenue, fees, supplySideFees, costOfRevenue, tokenIncentives, earnings,
      tvl, fdv, circMcap, price, dau: Math.max(0, Math.round(dau)),
      takeRate: safeDiv(revenue, fees, 0),
      grossMargin: safeDiv(revenue - costOfRevenue, revenue, 0),
      netMargin: safeDiv(earnings, revenue, 0),
      psRatio: safeDiv(fdv, revenue * 12, 0),
      revenueYield: safeDiv(revenue * 12, fdv, 0),
      arpu: safeDiv(revenue, Math.max(dau, 0), 0),
      chainData: {}
    });
  });

  // Quarterly aggregation
  const quarterly = buildQuarterly(monthly);

  // Compute derived metrics
  const { consistency, stickyIndex } = computeDerivedMetrics(monthly);

  return {
    ...config,
    monthly, quarterly,
    cohorts: config.cohorts || [],
    consistency, stickyIndex
  };
}

function buildQuarterly(monthly) {
  const quarterly = [];
  // Group by actual quarter, not by array index
  const qMap = {};
  monthly.forEach(m => {
    const d = new Date(m.date);
    const qKey = `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
    if (!qMap[qKey]) qMap[qKey] = [];
    qMap[qKey].push(m);
  });
  // Sort quarter keys chronologically
  const qKeys = Object.keys(qMap).sort((a, b) => {
    const [aY, aQ] = a.split(' Q').map(Number);
    const [bY, bQ] = b.split(' Q').map(Number);
    return aY !== bY ? aY - bY : aQ - bQ;
  });
  qKeys.forEach(qLabel => {
    const qMonths = qMap[qLabel];
    quarterly.push({
      quarter: qLabel,
      revenue: qMonths.reduce((s, m) => s + m.revenue, 0),
      fees: qMonths.reduce((s, m) => s + m.fees, 0),
      earnings: qMonths.reduce((s, m) => s + m.earnings, 0),
      tokenIncentives: qMonths.reduce((s, m) => s + m.tokenIncentives, 0),
      costOfRevenue: qMonths.reduce((s, m) => s + m.costOfRevenue, 0),
      avgTakeRate: qMonths.reduce((s, m) => s + m.takeRate, 0) / qMonths.length,
      avgTvl: qMonths.reduce((s, m) => s + m.tvl, 0) / qMonths.length,
      avgFdv: qMonths.reduce((s, m) => s + m.fdv, 0) / qMonths.length,
      avgDau: Math.round(qMonths.reduce((s, m) => s + m.dau, 0) / qMonths.length),
    });
  });
  return quarterly;
}

function computeDerivedMetrics(monthly) {
  const revValues = monthly.map(m => m.revenue).filter(v => v > 0);
  const revMean = revValues.length > 0 ? revValues.reduce((a, b) => a + b, 0) / revValues.length : 0;
  const revStd = revValues.length > 0 ? Math.sqrt(revValues.reduce((s, v) => s + Math.pow(v - revMean, 2), 0) / revValues.length) : 0;
  const consistency = revMean > 0 ? Math.max(0, 1 - revStd / revMean) : 0;

  let stickySum = 0, stickyCount = 0;
  for (let i = 1; i < monthly.length; i++) {
    const mx = Math.max(monthly[i].revenue, monthly[i - 1].revenue);
    if (mx > 0) {
      stickySum += Math.min(monthly[i].revenue, monthly[i - 1].revenue) / mx;
      stickyCount++;
    }
  }
  const stickyIndex = stickyCount > 0 ? stickySum / stickyCount : 0;

  return { consistency, stickyIndex };
}

async function fetchAllLiveData() {
  const health = await fetch('/health').then(r => r.json()).catch(() => ({ api_configured: false }));
  if (!health.api_configured) return null;

  const results = {};

  const fetches = PROTOCOLS.map(async (config) => {
    try {
      const metrics = await fetchWithSlugRetry(config);
      // Generate synthetic cohorts
      const rng = mulberry32(hashCode(config.id + '_cohort'));
      const cohorts = [];
      for (let c = 0; c < 12; c++) {
        const row = [1.0];
        for (let m = 1; m <= 11; m++) {
          const base = config.retentionBase * Math.pow(0.75, m - 1);
          row.push(Math.min(row[m - 1], Math.max(0.01, base * (0.8 + rng() * 0.4))));
        }
        cohorts.push(row);
      }
      config.cohorts = cohorts;
      results[config.id] = transformAPIData(config.id, config, metrics);
    } catch (e) {
      console.warn(`Failed to fetch ${config.id}:`, e.message);
      FETCH_STATUS[config.id] = { status: 'failed', error: e.message };
    }
  });

  await Promise.all(fetches);

  if (Object.keys(results).length < PROTOCOLS.length / 2) return null;

  // Fill missing protocols with mock data
  const mockData = generateAllData();
  PROTOCOLS.forEach(p => {
    if (!results[p.id]) {
      results[p.id] = mockData[p.id];
      FETCH_STATUS[p.id] = { status: 'mock_fallback', error: 'Using mock data' };
    }
  });

  return results;
}

// ===================================================================
// MOCK DATA GENERATOR (fallback)
// ===================================================================
function generateAllData() {
  const data = {};
  PROTOCOLS.forEach(p => {
    const rng = mulberry32(hashCode(p.id));
    const monthly = [];
    for (let m = 0; m < 24; m++) {
      const date = new Date(2024, m, 1);
      const calMonth = date.getMonth();
      const seasonal = 1 + p.seasonAmp * Math.sin((calMonth - 6) * Math.PI / 6);
      const trend = Math.pow(1 + p.growthRate, m);
      const noise = 1 + (rng() - 0.5) * 2 * p.volatility;
      const revenue = p.baseRevenue * trend * seasonal * noise;
      const fees = p.takeRate > 0 ? revenue / p.takeRate : revenue * 600;
      const supplySideFees = fees - revenue;
      const costOfRevenue = revenue * (0.05 + rng() * 0.08);
      const incentiveDecay = Math.max(0.3, 1 - m * 0.02);
      const tokenIncentives = revenue * p.incentiveRatio * incentiveDecay * (0.8 + rng() * 0.4);
      const earnings = revenue - tokenIncentives - costOfRevenue;
      const tvl = p.tvlBase * trend * (0.9 + rng() * 0.2) * seasonal * 0.9;
      const fdv = p.fdvBase * trend * (0.85 + rng() * 0.3);
      const circMcap = fdv * (0.4 + rng() * 0.3);
      const price = fdv / (1e9 + rng() * 9e9);
      const dau = Math.max(0, Math.round(p.dauBase * trend * (0.85 + rng() * 0.3) * seasonal));
      const chainData = {};
      for (const [chain, pct] of Object.entries(p.chainDist)) {
        const chainNoise = 0.8 + rng() * 0.4;
        chainData[chain] = {
          revenue: revenue * pct * chainNoise,
          fees: fees * pct * chainNoise,
          tvl: tvl * pct * chainNoise,
          dau: Math.max(0, Math.round(dau * pct * chainNoise))
        };
      }
      const chainRevSum = Object.values(chainData).reduce((s, c) => s + c.revenue, 0);
      if (chainRevSum > 0) {
        for (const chain of Object.keys(chainData)) {
          const scale = revenue / chainRevSum;
          chainData[chain].revenue *= scale;
          chainData[chain].fees *= scale;
        }
      }
      monthly.push({
        date: date.toISOString().slice(0, 10),
        month: date.toISOString().slice(0, 7),
        calMonth,
        revenue, fees, supplySideFees, costOfRevenue, tokenIncentives, earnings,
        tvl, fdv, circMcap, price, dau,
        takeRate: safeDiv(revenue, fees, 0),
        grossMargin: safeDiv(revenue - costOfRevenue, revenue, 0),
        netMargin: safeDiv(earnings, revenue, 0),
        psRatio: safeDiv(fdv, revenue * 12, 0),
        revenueYield: safeDiv(revenue * 12, fdv, 0),
        arpu: safeDiv(revenue, Math.max(dau, 1), 0),
        chainData
      });
    }
    const quarterly = buildQuarterly(monthly);
    const cohorts = [];
    const rng2 = mulberry32(hashCode(p.id + '_cohort'));
    for (let c = 0; c < 12; c++) {
      const row = [1.0];
      for (let m = 1; m <= 11; m++) {
        const base = p.retentionBase * Math.pow(0.75, m - 1);
        const noise = 0.8 + rng2() * 0.4;
        row.push(Math.min(row[m - 1], Math.max(0.01, base * noise)));
      }
      cohorts.push(row);
    }
    const { consistency, stickyIndex } = computeDerivedMetrics(monthly);
    data[p.id] = { ...p, monthly, quarterly, cohorts, consistency, stickyIndex };
  });
  return data;
}
