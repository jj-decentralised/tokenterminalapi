// ===================================================================
// SECTOR SYSTEM — expanded to cover all Token Terminal sectors
// ===================================================================
const SECTOR_COLORS = {
  'lending':         '#4a9eff',
  'dex':             '#fb8b1e',
  'l1':              '#4af6c3',
  'liquid-staking':  '#a78bfa',
  'derivatives':     '#ff5a54',
  'bridge':          '#fbbf24',
  'cdp':             '#34d399',
  'yield':           '#818cf8',
  'oracle':          '#f472b6',
  'nft':             '#c084fc',
  'gaming':          '#22d3ee',
  'social':          '#fb923c',
  'l2':              '#86efac',
  'infrastructure':  '#94a3b8',
  'payments':        '#e879f9',
  'rwa':             '#facc15',
  'prediction':      '#67e8f9',
  'launchpad':       '#f0abfc',
  'ai':              '#a3e635',
  'other':           '#6b7280'
};
const SECTOR_LABELS = {
  'lending':         'Lending',
  'dex':             'DEX',
  'l1':              'L1 Blockchain',
  'liquid-staking':  'Liquid Staking',
  'derivatives':     'Derivatives',
  'bridge':          'Bridge',
  'cdp':             'CDP',
  'yield':           'Yield',
  'oracle':          'Oracle',
  'nft':             'NFT',
  'gaming':          'Gaming',
  'social':          'Social',
  'l2':              'L2',
  'infrastructure':  'Infrastructure',
  'payments':        'Payments',
  'rwa':             'RWA',
  'prediction':      'Prediction Market',
  'launchpad':       'Launchpad',
  'ai':              'AI',
  'other':           'Other'
};

// Maps TT API sector names (and common variations) to our normalized keys.
// normalizeSector() lowercases and converts spaces/underscores to hyphens
// before lookup, so entries here use lowercase-hyphenated form.
const SECTOR_NORMALIZE = {
  // Lending
  'lending':                    'lending',
  'lending-borrowing':          'lending',
  'lending-&-borrowing':        'lending',
  'lending/borrowing':          'lending',
  'money-market':               'lending',
  'money-markets':              'lending',
  'credit':                     'lending',
  'borrowing':                  'lending',
  'collateralized-lending':     'lending',

  // DEX
  'dex':                        'dex',
  'dexs':                       'dex',
  'dexes':                      'dex',
  'decentralized-exchange':     'dex',
  'decentralized-exchanges':    'dex',
  'exchange':                   'dex',
  'exchanges':                  'dex',
  'amm':                        'dex',
  'spot-dex':                   'dex',
  'dex-aggregator':             'dex',
  'dex-aggregators':            'dex',

  // L1
  'l1':                         'l1',
  'layer-1':                    'l1',
  'layer1':                     'l1',
  'blockchain':                 'l1',
  'blockchains':                'l1',
  'chain':                      'l1',
  'layer-1-blockchain':         'l1',

  // Liquid Staking
  'liquid-staking':             'liquid-staking',
  'liquid_staking':             'liquid-staking',
  'staking':                    'liquid-staking',
  'liquid-staking-derivatives': 'liquid-staking',
  'liquid-restaking':           'liquid-staking',
  'restaking':                  'liquid-staking',
  'eth-staking':                'liquid-staking',
  'lstfi':                      'liquid-staking',

  // Derivatives
  'derivatives':                'derivatives',
  'perpetuals':                 'derivatives',
  'perps':                      'derivatives',
  'options':                    'derivatives',
  'perpetual':                  'derivatives',
  'futures':                    'derivatives',
  'synthetic-assets':           'derivatives',
  'synthetics':                 'derivatives',
  'structured-products':        'derivatives',
  'perp-dex':                   'derivatives',
  'derivatives-dex':            'derivatives',

  // Bridge
  'bridge':                     'bridge',
  'bridges':                    'bridge',
  'cross-chain':                'bridge',
  'cross-chain-communication':  'bridge',
  'cross-chain-bridge':         'bridge',
  'interoperability':           'bridge',
  'messaging':                  'bridge',

  // CDP / Stablecoins
  'cdp':                        'cdp',
  'stablecoin':                 'cdp',
  'stablecoins':                'cdp',
  'stablecoin-issuer':          'cdp',
  'stablecoin-issuers':         'cdp',
  'collateralized-debt':        'cdp',

  // Yield
  'yield':                      'yield',
  'yield-aggregator':           'yield',
  'yield-aggregators':          'yield',
  'yield-farming':              'yield',
  'vault':                      'yield',
  'vaults':                     'yield',
  'asset-management':           'yield',
  'fund-management':            'yield',
  'portfolio':                  'yield',
  'optimizer':                  'yield',
  'yield-optimizer':            'yield',

  // Oracle
  'oracle':                     'oracle',
  'oracles':                    'oracle',
  'data-feeds':                 'oracle',

  // NFT
  'nft':                        'nft',
  'nfts':                       'nft',
  'nft-marketplace':            'nft',
  'nft-marketplaces':           'nft',
  'nft-lending':                'nft',
  'nft-fi':                     'nft',
  'collectibles':               'nft',
  'digital-collectibles':       'nft',
  'music':                      'nft',
  'art':                        'nft',
  'fan-tokens':                 'nft',

  // Gaming
  'gaming':                     'gaming',
  'gamefi':                     'gaming',
  'game-fi':                    'gaming',
  'games':                      'gaming',
  'metaverse':                  'gaming',
  'play-to-earn':               'gaming',

  // Social
  'social':                     'social',
  'socialfi':                   'social',
  'social-fi':                  'social',
  'social-media':               'social',
  'content':                    'social',

  // L2
  'l2':                         'l2',
  'layer-2':                    'l2',
  'layer2':                     'l2',
  'rollup':                     'l2',
  'rollups':                    'l2',
  'optimistic-rollup':          'l2',
  'zk-rollup':                  'l2',
  'scaling':                    'l2',
  'layer-2-blockchain':         'l2',

  // Infrastructure
  'infrastructure':             'infrastructure',
  'infra':                      'infrastructure',
  'developer-tools':            'infrastructure',
  'developer-tooling':          'infrastructure',
  'tooling':                    'infrastructure',
  'mev':                        'infrastructure',
  'data-availability':          'infrastructure',
  'identity':                   'infrastructure',
  'storage':                    'infrastructure',
  'compute':                    'infrastructure',
  'wallet':                     'infrastructure',
  'wallets':                    'infrastructure',
  'analytics':                  'infrastructure',
  'security':                   'infrastructure',
  'middleware':                  'infrastructure',
  'indexer':                     'infrastructure',
  'indexing':                    'infrastructure',
  'node-infrastructure':        'infrastructure',
  'rpc':                        'infrastructure',

  // Payments
  'payments':                   'payments',
  'payment':                    'payments',
  'payment-processing':         'payments',
  'remittance':                 'payments',
  'payroll':                    'payments',

  // RWA
  'rwa':                        'rwa',
  'real-world-assets':          'rwa',
  'tokenized-assets':           'rwa',
  'real-estate':                'rwa',
  'tokenization':               'rwa',
  'securities':                 'rwa',
  'treasury':                   'rwa',

  // Prediction
  'prediction':                 'prediction',
  'prediction-market':          'prediction',
  'prediction-markets':         'prediction',
  'betting':                    'prediction',
  'gambling':                   'prediction',

  // Launchpad
  'launchpad':                  'launchpad',
  'launchpads':                 'launchpad',
  'ido':                        'launchpad',
  'ico':                        'launchpad',
  'token-launch':               'launchpad',

  // AI
  'ai':                         'ai',
  'artificial-intelligence':    'ai',
  'machine-learning':           'ai',
  'ai-agents':                  'ai',
  'depin':                      'ai',

  // Insurance → other
  'insurance':                  'other',
  'indexes':                    'other',
  'index':                      'other',
  'privacy':                    'other',
  'dao':                        'other',
  'daos':                       'other',
  'governance':                 'other',
};

function normalizeSector(raw) {
  if (!raw) return 'other';
  // Normalize: lowercase, trim, replace spaces/underscores/slashes with hyphens
  var key = raw.toLowerCase().trim()
    .replace(/[/\\]+/g, '-')           // slashes → hyphens
    .replace(/[\s_]+/g, '-')           // spaces/underscores → hyphens
    .replace(/[&]+/g, '-')             // ampersands → hyphens
    .replace(/-{2,}/g, '-')            // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');          // trim leading/trailing hyphens

  if (SECTOR_NORMALIZE[key]) return SECTOR_NORMALIZE[key];

  // Fallback: check if any normalize key is a substring of our input, or vice versa
  var keys = Object.keys(SECTOR_NORMALIZE);
  for (var i = 0; i < keys.length; i++) {
    if (key.indexOf(keys[i]) !== -1 || keys[i].indexOf(key) !== -1) {
      return SECTOR_NORMALIZE[keys[i]];
    }
  }

  // If the normalized key matches one of our sector color keys, use it directly
  if (SECTOR_COLORS[key]) return key;

  return 'other';
}

// Default financial params by sector (for mock data generation)
const SECTOR_DEFAULTS = {
  'lending':        { baseRev: 5e6, takeRate: 0.15, growth: 0.02, season: 0.15, incentive: 0.35, vol: 0.10, tvl: 3e9,  fdv: 2e9,  dau: 10000, ret: 0.20 },
  'dex':            { baseRev: 6e6, takeRate: 0.06, growth: 0.02, season: 0.22, incentive: 0.20, vol: 0.16, tvl: 2e9,  fdv: 2e9,  dau: 50000, ret: 0.09 },
  'l1':             { baseRev: 50e6,takeRate: 0.65, growth: 0.01, season: 0.20, incentive: 0.08, vol: 0.15, tvl: 10e9, fdv: 50e9, dau: 300000,ret: 0.30 },
  'liquid-staking': { baseRev: 10e6,takeRate: 0.10, growth: 0.01, season: 0.08, incentive: 0.15, vol: 0.06, tvl: 5e9,  fdv: 1.5e9,dau: 3000,  ret: 0.55 },
  'derivatives':    { baseRev: 4e6, takeRate: 0.04, growth: 0.03, season: 0.25, incentive: 0.30, vol: 0.20, tvl: 1e9,  fdv: 1.5e9,dau: 15000, ret: 0.12 },
  'bridge':         { baseRev: 2e6, takeRate: 0.05, growth: 0.01, season: 0.18, incentive: 0.25, vol: 0.14, tvl: 0.8e9,fdv: 0.8e9,dau: 8000,  ret: 0.10 },
  'cdp':            { baseRev: 3e6, takeRate: 0.20, growth: 0.01, season: 0.10, incentive: 0.15, vol: 0.08, tvl: 4e9,  fdv: 1e9,  dau: 5000,  ret: 0.35 },
  'yield':          { baseRev: 2e6, takeRate: 0.10, growth: 0.01, season: 0.15, incentive: 0.40, vol: 0.12, tvl: 1.5e9,fdv: 0.5e9,dau: 6000,  ret: 0.15 },
  'oracle':         { baseRev: 1e6, takeRate: 0.50, growth: 0.01, season: 0.08, incentive: 0.10, vol: 0.06, tvl: 0.1e9,fdv: 2e9,  dau: 1000,  ret: 0.50 },
  'nft':            { baseRev: 3e6, takeRate: 0.025,growth: 0.00, season: 0.30, incentive: 0.10, vol: 0.25, tvl: 0.2e9,fdv: 0.5e9,dau: 20000, ret: 0.06 },
  'l2':             { baseRev: 8e6, takeRate: 0.70, growth: 0.03, season: 0.18, incentive: 0.12, vol: 0.14, tvl: 3e9,  fdv: 10e9, dau: 100000,ret: 0.25 },
  'other':          { baseRev: 2e6, takeRate: 0.10, growth: 0.01, season: 0.15, incentive: 0.20, vol: 0.12, tvl: 0.5e9,fdv: 0.5e9,dau: 5000,  ret: 0.15 },
};

// ===================================================================
// SEED PROTOCOLS — hand-tuned configs for high-quality mock data
// ===================================================================
const SEED_PROTOCOLS = [
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

// Build a quick lookup for seed protocols
const SEED_MAP = {};
SEED_PROTOCOLS.forEach(function (p) { SEED_MAP[p.id] = p; });

// Slug aliases for Token Terminal API (some project IDs differ)
const SLUG_ALIASES = {
  'lido':        ['lido', 'lido-finance', 'lido-dao'],
  'bnb-chain':   ['bnb-chain', 'bnb-smart-chain', 'binance-smart-chain', 'bsc'],
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
// DERIVE PROTOCOL CONFIG FROM API METADATA
// ===================================================================
// When we discover a protocol from the TT API that's NOT in our seed
// list, we generate reasonable mock-data params from its sector.
function deriveProtocolConfig(projectMeta) {
  var sector = projectMeta.sector || 'other';
  var defaults = SECTOR_DEFAULTS[sector] || SECTOR_DEFAULTS['other'];
  var rng = mulberry32(hashCode(projectMeta.id));

  // Scale base revenue randomly within 0.1x–3x of sector default
  var revScale = 0.1 + rng() * 2.9;
  var tvlScale = 0.1 + rng() * 2.9;
  var fdvScale = 0.1 + rng() * 2.9;

  return {
    id: projectMeta.id,
    name: projectMeta.name,
    sector: sector,
    chains: projectMeta.chains || ['ethereum'],
    baseRevenue: defaults.baseRev * revScale,
    growthRate: defaults.growth * (0.5 + rng()),
    seasonAmp: defaults.season * (0.7 + rng() * 0.6),
    takeRate: defaults.takeRate * (0.5 + rng()),
    incentiveRatio: defaults.incentive * (0.5 + rng()),
    volatility: defaults.vol * (0.7 + rng() * 0.6),
    tvlBase: defaults.tvl * tvlScale,
    fdvBase: defaults.fdv * fdvScale,
    dauBase: Math.round(defaults.dau * (0.2 + rng() * 2.0)),
    retentionBase: defaults.ret * (0.6 + rng() * 0.8),
    chainDist: buildChainDist(projectMeta.chains || ['ethereum'], rng),
  };
}

function buildChainDist(chains, rng) {
  if (!chains || chains.length === 0) return { ethereum: 1.0 };
  if (chains.length === 1) {
    var d = {};
    d[chains[0]] = 1.0;
    return d;
  }
  var dist = {};
  var total = 0;
  chains.forEach(function (c) {
    var w = 0.1 + rng() * 0.9;
    dist[c] = w;
    total += w;
  });
  // Normalize to sum to 1.0
  chains.forEach(function (c) { dist[c] /= total; });
  return dist;
}

// ===================================================================
// COHORT GENERATION HELPER
// ===================================================================
function generateCohorts(retentionBase, id) {
  var rng = mulberry32(hashCode((id || '') + '_cohort'));
  var cohorts = [];
  for (var c = 0; c < 12; c++) {
    var row = [1.0];
    for (var m = 1; m <= 11; m++) {
      var base = retentionBase * Math.pow(0.75, m - 1);
      row.push(Math.min(row[m - 1], Math.max(0.01, base * (0.8 + rng() * 0.4))));
    }
    cohorts.push(row);
  }
  return cohorts;
}

// ===================================================================
// TOKEN TERMINAL API LAYER
// ===================================================================
const API_BASE = '/api/tt';
const FETCH_STATUS = {};
// Maximum number of protocols to load from API
const MAX_PROTOCOLS = 500;
// Concurrency for batch fetching (stay well within 1000 req/min)
const BATCH_CONCURRENCY = 15;
const BATCH_DELAY_MS = 200;

async function fetchTT(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error('API ' + res.status + ': ' + path);
  return res.json();
}

async function fetchWithSlugRetry(projectId) {
  const aliases = SLUG_ALIASES[projectId] || [projectId];
  const metricIds = 'fees,revenue,earnings,token-incentives,cost-of-revenue,supply-side-fees,tvl,price,fully-diluted-market-cap,circulating-market-cap,daily-active-users';

  for (const slug of aliases) {
    try {
      const metrics = await fetchTT('/projects/' + slug + '/metrics?metric_ids=' + metricIds + '&interval=2y');
      if (metrics && (metrics.data?.length > 0 || (Array.isArray(metrics) && metrics.length > 0))) {
        FETCH_STATUS[projectId] = { status: 'ok', slug: slug, count: (metrics.data || metrics).length };
        return metrics;
      }
    } catch (e) {
      // Try next alias
    }
  }
  FETCH_STATUS[projectId] = { status: 'failed', error: 'All slug aliases returned 404' };
  throw new Error('All slug aliases failed for ' + projectId);
}

// ===================================================================
// DYNAMIC PROJECT DISCOVERY
// ===================================================================
// Extract a sector string from a TT API project object.
// The API uses various field names and formats (strings, arrays, objects).
function extractSectorRaw(p) {
  // 1. Check array fields first (TT API v2 commonly uses arrays)
  var arrayFields = ['market_sectors', 'categories', 'tags', 'sectors'];
  for (var i = 0; i < arrayFields.length; i++) {
    var arr = p[arrayFields[i]];
    if (Array.isArray(arr) && arr.length > 0) {
      var first = arr[0];
      if (typeof first === 'string') return first;
      if (typeof first === 'object' && first !== null) {
        return first.name || first.slug || first.label || first.title || '';
      }
    }
  }

  // 2. Check string/object fields
  var stringFields = [
    'market_sector', 'market_sector_slug', 'market_sector_name',
    'sector', 'sector_slug', 'category', 'category_slug',
    'type', 'project_type', 'protocol_type'
  ];
  for (var j = 0; j < stringFields.length; j++) {
    var val = p[stringFields[j]];
    if (typeof val === 'string' && val.trim()) return val;
    if (typeof val === 'object' && val !== null) {
      var extracted = val.name || val.slug || val.label || val.title || '';
      if (extracted) return extracted;
    }
  }

  return '';
}

async function fetchProjectList() {
  try {
    var json = await fetchTT('/projects');
    // TT API may return { data: [...] } or [...] directly
    var projects = Array.isArray(json) ? json : (json.data || json.projects || []);

    // Log sample for debugging sector field discovery
    if (projects.length > 0) {
      var sample = projects[0];
      var sectorKeys = Object.keys(sample).filter(function (k) {
        return /sector|categor|type|tag|market/i.test(k);
      });
      console.log('[fetchProjectList] ' + projects.length + ' projects. Sector-related keys:', sectorKeys);
      console.log('[fetchProjectList] Sample values:', sectorKeys.map(function (k) {
        return k + '=' + JSON.stringify(sample[k]);
      }).join(', '));
    }

    return projects.map(function (p) {
      // Parse out the fields we need — handle various API response formats
      var id = p.project_id || p.id || p.slug || '';
      var name = p.name || p.project_name || id;
      var sector = normalizeSector(extractSectorRaw(p));

      // Chains may be provided in various formats
      var chains = [];
      if (Array.isArray(p.chains)) {
        chains = p.chains;
      } else if (Array.isArray(p.blockchains)) {
        chains = p.blockchains;
      } else if (typeof p.chain === 'string') {
        chains = [p.chain];
      }
      chains = chains.map(function (c) {
        return (c.slug || c.name || c).toString().toLowerCase();
      });

      // Revenue for ranking (if available in listing)
      var revenue = null;
      if (p.revenue !== undefined) revenue = parseFloat(p.revenue);
      else if (p.monthly_revenue !== undefined) revenue = parseFloat(p.monthly_revenue);
      else if (p.revenue_30d !== undefined) revenue = parseFloat(p.revenue_30d);

      return {
        id: id.toLowerCase(),
        name: name,
        sector: sector,
        chains: chains.length > 0 ? chains : ['ethereum'],
        revenue: revenue,
        symbol: p.symbol || p.token_symbol || '',
      };
    }).filter(function (p) { return p.id && p.name; });
  } catch (e) {
    console.warn('[fetchProjectList] Failed:', e.message);
    return null;
  }
}

// ===================================================================
// BATCH FETCH WITH CONCURRENCY CONTROL
// ===================================================================
async function batchFetchMetrics(projectIds, onProgress) {
  var results = {};
  var completed = 0;
  var total = projectIds.length;

  for (var i = 0; i < total; i += BATCH_CONCURRENCY) {
    var chunk = projectIds.slice(i, i + BATCH_CONCURRENCY);

    var chunkResults = await Promise.allSettled(
      chunk.map(function (pid) {
        return fetchWithSlugRetry(pid).then(function (data) {
          return { id: pid, data: data };
        });
      })
    );

    chunkResults.forEach(function (result) {
      if (result.status === 'fulfilled' && result.value) {
        results[result.value.id] = result.value.data;
      }
    });

    completed = Math.min(completed + chunk.length, total);
    if (onProgress) onProgress(completed, total);

    // Rate limit: pause between batches
    if (i + BATCH_CONCURRENCY < total) {
      await new Promise(function (r) { setTimeout(r, BATCH_DELAY_MS); });
    }
  }

  return results;
}

// ===================================================================
// TRANSFORM API DATA
// ===================================================================
function transformAPIData(projectId, config, metricsData) {
  const monthly = [];
  const byMonth = {};

  // Group metrics by month
  var rows = metricsData.data || (Array.isArray(metricsData) ? metricsData : []);
  rows.forEach(function (row) {
    const month = (row.timestamp || row.date || '').slice(0, 7);
    if (!month) return;
    if (!byMonth[month]) byMonth[month] = {};

    // Handle metric_id + value format
    var metricId = row.metric_id;
    var value = parseFloat(row.value);
    if (metricId && !isNaN(value)) {
      byMonth[month][metricId] = value;
    }

    // Handle flat field format
    ['revenue','fees','earnings','token_incentives','cost_of_revenue',
     'supply_side_fees','tvl','price','fully_diluted_market_cap',
     'circulating_market_cap','daily_active_users','token_trading_volume'
    ].forEach(function (key) {
      if (row[key] !== undefined) {
        var v = parseFloat(row[key]);
        if (!isNaN(v)) byMonth[month][key] = v;
      }
    });
  });

  const months = Object.keys(byMonth).sort();
  months.forEach(function (month) {
    const d = byMonth[month];
    const date = new Date(month + '-01');

    // Resolve field names with all known aliases
    const revenue = d.revenue || 0;
    const fees = d.fees || revenue;
    const earnings = d.earnings || 0;
    const tokenIncentives = d['token-incentives'] || d.token_incentives || 0;
    const costOfRevenue = d['cost-of-revenue'] || d.cost_of_revenue || 0;
    const supplySideFees = d['supply-side-fees'] || d.supply_side_fees || (fees - revenue);
    const tvl = d.tvl || 0;
    const fdv = d['fully-diluted-market-cap'] || d.fully_diluted_market_cap || d['market-cap-fully-diluted'] || d.fdv || 0;
    const circMcap = d['circulating-market-cap'] || d.circulating_market_cap || d['market-cap-circulating'] || 0;
    const price = d.price || 0;
    const dau = d['daily-active-users'] || d.daily_active_users || d['active-users'] || 0;

    monthly.push({
      date: date.toISOString().slice(0, 10),
      month: month,
      calMonth: date.getMonth(),
      revenue: revenue, fees: fees, supplySideFees: supplySideFees,
      costOfRevenue: costOfRevenue, tokenIncentives: tokenIncentives, earnings: earnings,
      tvl: tvl, fdv: fdv, circMcap: circMcap, price: price,
      dau: Math.max(0, Math.round(dau)),
      takeRate: safeDiv(revenue, fees, 0),
      grossMargin: safeDiv(revenue - costOfRevenue, revenue, 0),
      netMargin: safeDiv(earnings, revenue, 0),
      psRatio: safeDiv(fdv, revenue * 12, 0),
      revenueYield: safeDiv(revenue * 12, fdv, 0),
      arpu: safeDiv(revenue, Math.max(dau, 1), 0),
      chainData: {}
    });
  });

  const quarterly = buildQuarterly(monthly);
  const { consistency, stickyIndex } = computeDerivedMetrics(monthly);

  return {
    id: config.id,
    name: config.name,
    sector: config.sector,
    chains: config.chains,
    chainDist: config.chainDist || {},
    monthly: monthly,
    quarterly: quarterly,
    cohorts: config.cohorts || [],
    consistency: consistency,
    stickyIndex: stickyIndex
  };
}

function buildQuarterly(monthly) {
  const qMap = {};
  monthly.forEach(function (m) {
    const d = new Date(m.date);
    const qKey = d.getFullYear() + ' Q' + (Math.floor(d.getMonth() / 3) + 1);
    if (!qMap[qKey]) qMap[qKey] = [];
    qMap[qKey].push(m);
  });
  const qKeys = Object.keys(qMap).sort(function (a, b) {
    var ap = a.split(' Q'), bp = b.split(' Q');
    var d = Number(ap[0]) - Number(bp[0]);
    return d !== 0 ? d : Number(ap[1]) - Number(bp[1]);
  });
  return qKeys.map(function (qLabel) {
    var qMonths = qMap[qLabel];
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

function computeDerivedMetrics(monthly) {
  const revValues = monthly.map(function (m) { return m.revenue; }).filter(function (v) { return v > 0; });
  const revMean = revValues.length > 0 ? revValues.reduce(function (a, b) { return a + b; }, 0) / revValues.length : 0;
  const revStd = revValues.length > 0 ? Math.sqrt(revValues.reduce(function (s, v) { return s + Math.pow(v - revMean, 2); }, 0) / revValues.length) : 0;
  const consistency = revMean > 0 ? Math.max(0, 1 - revStd / revMean) : 0;

  var stickySum = 0, stickyCount = 0;
  for (var i = 1; i < monthly.length; i++) {
    var mx = Math.max(monthly[i].revenue, monthly[i - 1].revenue);
    if (mx > 0) {
      stickySum += Math.min(monthly[i].revenue, monthly[i - 1].revenue) / mx;
      stickyCount++;
    }
  }
  const stickyIndex = stickyCount > 0 ? stickySum / stickyCount : 0;

  return { consistency: consistency, stickyIndex: stickyIndex };
}

// ===================================================================
// LIVE DATA PIPELINE
// ===================================================================
async function fetchAllLiveData(onProgress) {
  // 1. Check if API is configured
  const health = await fetch('/health').then(function (r) { return r.json(); }).catch(function () { return { api_configured: false }; });
  if (!health.api_configured) return null;

  if (onProgress) onProgress(0, 0, 'Discovering protocols...');

  // 2. Discover all projects from the API
  var projectList = await fetchProjectList();
  var projectConfigs = [];

  if (projectList && projectList.length > 0) {
    console.log('[data] Discovered ' + projectList.length + ' projects from API');

    // 3. Sort by revenue if available, otherwise take all (up to MAX_PROTOCOLS)
    var hasRevenue = projectList.filter(function (p) { return p.revenue !== null && p.revenue > 0; });
    var toFetch;

    if (hasRevenue.length > 0) {
      // Sort by revenue descending, take top MAX_PROTOCOLS
      hasRevenue.sort(function (a, b) { return (b.revenue || 0) - (a.revenue || 0); });
      toFetch = hasRevenue.slice(0, MAX_PROTOCOLS);
      // Also include any seed protocols not already in the list
      var fetchIds = new Set(toFetch.map(function (p) { return p.id; }));
      SEED_PROTOCOLS.forEach(function (sp) {
        if (!fetchIds.has(sp.id)) {
          toFetch.push({ id: sp.id, name: sp.name, sector: sp.sector, chains: sp.chains, revenue: null });
        }
      });
    } else {
      // No revenue data in listing — take first MAX_PROTOCOLS + all seeds
      toFetch = projectList.slice(0, MAX_PROTOCOLS);
      var fetchIds2 = new Set(toFetch.map(function (p) { return p.id; }));
      SEED_PROTOCOLS.forEach(function (sp) {
        if (!fetchIds2.has(sp.id)) {
          toFetch.push({ id: sp.id, name: sp.name, sector: sp.sector, chains: sp.chains, revenue: null });
        }
      });
    }

    // 4. Build configs for each project (seed config if available, else derive)
    toFetch.forEach(function (proj) {
      var seed = SEED_MAP[proj.id];
      if (seed) {
        projectConfigs.push(seed);
      } else {
        projectConfigs.push(deriveProtocolConfig(proj));
      }
    });

  } else {
    // Failed to get project list — fall back to seed protocols only
    console.warn('[data] Could not discover projects, using seed protocols');
    projectConfigs = SEED_PROTOCOLS.slice();
  }

  if (onProgress) onProgress(0, projectConfigs.length, 'Loading metrics...');

  // 5. Batch-fetch metrics for all protocols
  var projectIds = projectConfigs.map(function (c) { return c.id; });
  var metricsMap = await batchFetchMetrics(projectIds, function (done, total) {
    if (onProgress) onProgress(done, total, 'Loading metrics... ' + done + '/' + total);
  });

  // 6. Transform fetched data
  var results = {};
  var configMap = {};
  projectConfigs.forEach(function (c) { configMap[c.id] = c; });

  Object.keys(metricsMap).forEach(function (pid) {
    var config = configMap[pid];
    if (!config) return;

    // Generate cohorts
    config.cohorts = generateCohorts(config.retentionBase || 0.15, pid);

    try {
      results[pid] = transformAPIData(pid, config, metricsMap[pid]);
    } catch (e) {
      console.warn('[data] Transform failed for ' + pid + ':', e.message);
    }
  });

  // 7. If we got fewer than expected, fill with mock data
  var mockData = null;
  projectConfigs.forEach(function (config) {
    if (!results[config.id]) {
      if (!mockData) mockData = generateAllData(projectConfigs);
      if (mockData[config.id]) {
        results[config.id] = mockData[config.id];
        FETCH_STATUS[config.id] = { status: 'mock_fallback', error: 'Using mock data' };
      }
    }
  });

  var resultCount = Object.keys(results).length;
  console.log('[data] Loaded ' + resultCount + ' protocols (' +
    Object.keys(metricsMap).length + ' from API, rest mock)');

  if (resultCount === 0) return null;
  return results;
}

// ===================================================================
// MOCK DATA GENERATOR (fallback)
// ===================================================================
function generateAllData(configs) {
  var protocolList = configs || SEED_PROTOCOLS;
  const data = {};

  protocolList.forEach(function (p) {
    const rng = mulberry32(hashCode(p.id));
    const monthly = [];

    for (let m = 0; m < 24; m++) {
      const date = new Date(2024, m, 1);
      const calMonth = date.getMonth();
      const seasonal = 1 + (p.seasonAmp || 0.15) * Math.sin((calMonth - 6) * Math.PI / 6);
      const trend = Math.pow(1 + (p.growthRate || 0.01), m);
      const noise = 1 + (rng() - 0.5) * 2 * (p.volatility || 0.12);
      const revenue = (p.baseRevenue || 1e6) * trend * seasonal * noise;
      const tr = p.takeRate || 0.10;
      const fees = tr > 0 ? revenue / tr : revenue * 600;
      const supplySideFees = fees - revenue;
      const costOfRevenue = revenue * (0.05 + rng() * 0.08);
      const incentiveDecay = Math.max(0.3, 1 - m * 0.02);
      const tokenIncentives = revenue * (p.incentiveRatio || 0.20) * incentiveDecay * (0.8 + rng() * 0.4);
      const earnings = revenue - tokenIncentives - costOfRevenue;
      const tvl = (p.tvlBase || 1e9) * trend * (0.9 + rng() * 0.2) * seasonal * 0.9;
      const fdv = (p.fdvBase || 1e9) * trend * (0.85 + rng() * 0.3);
      const circMcap = fdv * (0.4 + rng() * 0.3);
      const price = fdv / (1e9 + rng() * 9e9);
      const dau = Math.max(0, Math.round((p.dauBase || 5000) * trend * (0.85 + rng() * 0.3) * seasonal));
      const chainData = {};
      const cd = p.chainDist || { ethereum: 1.0 };
      for (const [chain, pct] of Object.entries(cd)) {
        const chainNoise = 0.8 + rng() * 0.4;
        chainData[chain] = {
          revenue: revenue * pct * chainNoise,
          fees: fees * pct * chainNoise,
          tvl: tvl * pct * chainNoise,
          dau: Math.max(0, Math.round(dau * pct * chainNoise))
        };
      }
      const chainRevSum = Object.values(chainData).reduce(function (s, c) { return s + c.revenue; }, 0);
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
        calMonth: calMonth,
        revenue: revenue, fees: fees, supplySideFees: supplySideFees,
        costOfRevenue: costOfRevenue, tokenIncentives: tokenIncentives, earnings: earnings,
        tvl: tvl, fdv: fdv, circMcap: circMcap, price: price, dau: dau,
        takeRate: safeDiv(revenue, fees, 0),
        grossMargin: safeDiv(revenue - costOfRevenue, revenue, 0),
        netMargin: safeDiv(earnings, revenue, 0),
        psRatio: safeDiv(fdv, revenue * 12, 0),
        revenueYield: safeDiv(revenue * 12, fdv, 0),
        arpu: safeDiv(revenue, Math.max(dau, 1), 0),
        chainData: chainData
      });
    }

    const quarterly = buildQuarterly(monthly);
    const cohorts = generateCohorts(p.retentionBase || 0.15, p.id);
    const { consistency, stickyIndex } = computeDerivedMetrics(monthly);
    data[p.id] = {
      id: p.id, name: p.name, sector: p.sector,
      chains: p.chains || ['ethereum'],
      chainDist: p.chainDist || {},
      monthly: monthly, quarterly: quarterly, cohorts: cohorts,
      consistency: consistency, stickyIndex: stickyIndex
    };
  });

  return data;
}
