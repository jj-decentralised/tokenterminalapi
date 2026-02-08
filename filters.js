// ===================================================================
// GLOBAL STATE
// ===================================================================
const STATE = {
  sector: 'all',
  chain: 'all',
  period: 24,
  activeTab: 'revenue',
  data: null,
  dataSource: null, // 'live' or 'mock'
  dataTimestamp: null,
  decompProtocol: null, // selected protocol for decomposition chart
};

// ===================================================================
// FILTER LOGIC
// ===================================================================
function getFilteredProtocols() {
  if (!STATE.data) return [];
  let protocols = Object.values(STATE.data);
  if (STATE.sector !== 'all') {
    protocols = protocols.filter(p => p.sector === STATE.sector);
  }
  if (STATE.chain !== 'all') {
    protocols = protocols.filter(p => p.chains.includes(STATE.chain));
  }
  return protocols;
}

function getFilteredMonthly(protocol) {
  if (!protocol || !protocol.monthly) return [];

  // Date-based period filtering (not index-based)
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - STATE.period, 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let monthly = protocol.monthly.filter(m => m.date >= cutoffStr);

  // Chain-specific filtering
  if (STATE.chain !== 'all' && protocol.chainDist && protocol.chainDist[STATE.chain]) {
    monthly = monthly.map(m => {
      const cd = m.chainData?.[STATE.chain];
      if (!cd) return null;
      const chainRevenue = cd.revenue || 0;
      const chainFees = cd.fees || 0;
      const chainTvl = cd.tvl || 0;
      const chainDau = Math.max(0, cd.dau || 0);
      // Scale protocol-level metrics proportionally
      const revRatio = m.revenue > 0 ? chainRevenue / m.revenue : 0;
      return {
        ...m,
        revenue: chainRevenue,
        fees: chainFees,
        tvl: chainTvl,
        dau: chainDau,
        takeRate: safeDiv(chainRevenue, chainFees, 0),
        arpu: safeDiv(chainRevenue, Math.max(chainDau, 1), 0),
        earnings: m.earnings * revRatio,
        tokenIncentives: m.tokenIncentives * revRatio,
        costOfRevenue: m.costOfRevenue * revRatio,
        supplySideFees: chainFees - chainRevenue,
        grossMargin: safeDiv(chainRevenue - (m.costOfRevenue * revRatio), chainRevenue, 0),
        netMargin: safeDiv(m.earnings * revRatio, chainRevenue, 0),
        // Preserve date fields
        date: m.date,
        month: m.month,
        calMonth: m.calMonth,
        // Keep valuation fields from parent (not chain-specific)
        fdv: m.fdv,
        circMcap: m.circMcap,
        price: m.price,
        psRatio: m.psRatio,
        revenueYield: m.revenueYield,
      };
    }).filter(Boolean);
  }

  return monthly;
}

function getFilteredQuarterly(protocol) {
  const monthly = getFilteredMonthly(protocol);
  return buildQuarterly(monthly);
}

// Returns top N protocols by latest-month revenue (for chart readability)
function getTopFilteredProtocols(n) {
  var all = getFilteredProtocols();
  if (!n || all.length <= n) return all;
  return all.slice().sort(function (a, b) {
    var aRev = 0, bRev = 0;
    if (a.monthly && a.monthly.length > 0) aRev = a.monthly[a.monthly.length - 1].revenue;
    if (b.monthly && b.monthly.length > 0) bRev = b.monthly[b.monthly.length - 1].revenue;
    return bRev - aRev;
  }).slice(0, n);
}

// ===================================================================
// URL STATE
// ===================================================================
function encodeStateToURL() {
  const params = new URLSearchParams();
  if (STATE.activeTab !== 'revenue') params.set('tab', STATE.activeTab);
  if (STATE.sector !== 'all') params.set('sector', STATE.sector);
  if (STATE.chain !== 'all') params.set('chain', STATE.chain);
  if (STATE.period !== 24) params.set('period', STATE.period);
  if (STATE.decompProtocol) params.set('protocol', STATE.decompProtocol);
  const hash = params.toString();
  window.history.replaceState(null, '', hash ? '#' + hash : window.location.pathname);
}

function decodeStateFromURL() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  if (params.has('tab')) STATE.activeTab = params.get('tab');
  if (params.has('sector')) STATE.sector = params.get('sector');
  if (params.has('chain')) STATE.chain = params.get('chain');
  if (params.has('period')) STATE.period = parseInt(params.get('period')) || 24;
  if (params.has('protocol')) STATE.decompProtocol = params.get('protocol');
}
