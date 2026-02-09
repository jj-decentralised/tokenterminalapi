# Token Terminal Dashboard — Gap Analysis & Implementation Plan

## Current State: 40/100 Institutional Score

### What We Have (35+ Visualizations)
- 31 Plotly charts, 6 sortable tables, 32 KPI cards across 9 tabs
- Revenue, Valuation, Retention, LTV, Margins, Compare, Screener, Financials, Sectors
- PostgreSQL database with 15 tables (7 unpopulated) + 2 materialized views
- Background sync pulling from TT API v2

---

## TIER 1 — CRITICAL: Display Data We Already Have But Don't Show

**Priority: Highest | Effort: Low | No new API calls needed**

These metrics are already computed during sync and stored in `protocol_latest` / `monthly_metrics` but never rendered in any chart:

### 1.1 Missing KPI Cards & Charts
| Metric | Stored In | Where To Show |
|--------|-----------|---------------|
| `circ_mcap` | protocol_latest | Valuation tab KPI + chart |
| `price` | protocol_latest | Protocol detail modal |
| `revenue_yield` | monthly_metrics | Valuation tab (yield = annualized rev / FDV) |
| `consistency` | protocol_latest | Screener column + Retention tab |
| `sticky_index` | protocol_latest | Retention tab KPI |
| `momentum_streak` | protocol_latest | Revenue tab signal indicator |
| `momentum_signal` | protocol_latest | Screener column (strong-up/up/neutral/down/strong-down) |
| `revenue_mom3` | protocol_latest | Revenue tab (3-month momentum) |
| `arpu` | protocol_latest, monthly_metrics | LTV tab (already partial) |

### 1.2 Implementation
- **charts.js**: Add KPI cards for consistency, sticky_index, momentum signals
- **Screener tab**: Add sortable columns for momentum_signal, consistency, revenue_yield
- **Valuation tab**: Add circulating market cap chart alongside FDV
- **Protocol detail modal**: Add price history, revenue yield trend
- Estimated: ~200 lines of chart code changes

---

## TIER 2 — HIGH: Populate Empty Database Tables

**Priority: High | Effort: Medium | Requires sync engine updates**

7 database tables exist in schema but are never populated:

### 2.1 sector_snapshots (CRITICAL — Sectors tab is half-empty)
- **Schema exists**: protocol_id, sector_id, month, revenue, fees, tvl, dau
- **Data source**: Aggregate from existing `monthly_metrics` during sync
- **Implementation**: Add `computeSectorSnapshots()` to sync.js — pure SQL aggregation
- **Enables**: Time-series sector performance charts, sector rotation analysis

### 2.2 chain_metrics (IMPORTANT — per-chain revenue breakdown)
- **Schema exists**: protocol_id, chain_slug, month, revenue, fees, tvl, dau
- **Data source**: TT API `?aggregate_by=chain` parameter (already supported)
- **Implementation**: Add chain-level fetch in sync loop, ~50 lines
- **Enables**: "Revenue by Chain" treemap, chain comparison charts

### 2.3 cohort_retention (IMPORTANT — Retention tab uses mock data)
- **Schema exists**: protocol_id, cohort_month, period, retained_users, retention_rate
- **Data source**: TT API has limited cohort data; may need estimation from DAU trends
- **Implementation**: Compute synthetic retention from monthly DAU patterns
- **Enables**: Real retention heatmaps instead of mock data

### 2.4 alerts, watchlist, saved_views (NICE-TO-HAVE — user features)
- These require frontend interaction + localStorage/DB storage
- Lower priority until core analytics are solid

### 2.5 metric_definitions (NICE-TO-HAVE — data dictionary)
- Static seed data for methodology documentation
- Important for institutional credibility but not for analytics

---

## TIER 3 — HIGH: Fix Mock Data Fallbacks

**Priority: High | Effort: Medium**

Two data categories are populated for mock data but **empty for real API data**:

### 3.1 chainData (per-chain revenue breakdown)
- **Problem**: `data.js:771` — chainData is always `{}` for real API, only populated in mock mode
- **Fix**: Use TT API `?aggregate_by=chain` to populate per-chain metrics during sync
- **Impact**: Revenue Decomposition charts, chain comparison, cross-chain analysis

### 3.2 cohorts (user retention cohorts)
- **Problem**: `data.js` — cohorts always `[]` for real API, generated synthetically in mock
- **Fix**: Compute estimated retention from DAU time-series (monthly_metrics has DAU)
- **Impact**: Retention heatmap, cohort analysis, LTV calculations

---

## TIER 4 — MEDIUM: Bloomberg/WSJ Feature Gaps

**Priority: Medium | Effort: High | Requires new computations**

### 4.1 Income Statement Gaps (Rating: 6/10 → target 9/10)
- **Missing**: Operating expenses breakdown, EBITDA proxy, operating margin trend
- **Fix**: Compute from existing data: `operating_margin = (revenue - cost_of_revenue) / revenue`
- **Fix**: Add EBITDA proxy: `revenue - cost_of_revenue` (no depreciation in crypto)
- **New chart**: Waterfall chart showing Fees → Revenue → Cost → Earnings flow

### 4.2 Valuation Gaps (Rating: 5/10 → target 8/10)
- **Missing**: EV/Revenue, PEG ratio, fair value ranges, DCF model
- **Fix**: EV = FDV - Treasury (treasury data not available, use FDV as proxy)
- **Fix**: PEG = P/S ratio / revenue growth rate (both available)
- **New chart**: Valuation band chart (P/S ratio over time with percentile bands)

### 4.3 Growth Analytics (Rating: 4/10 → target 8/10)
- **Missing**: Organic vs incentive-driven growth, CAGR, growth deceleration
- **Fix**: `organic_growth = revenue_growth - token_incentives_growth`
- **Fix**: CAGR from monthly_metrics (12-month window)
- **New chart**: Growth quality scatter (revenue growth vs incentive ratio)

### 4.4 Profitability Deep Dive (Rating: 5/10 → target 8/10)
- **Missing**: Revenue/TVL efficiency, ROIC proxy, margin expansion tracking
- **Fix**: `capital_efficiency = revenue / tvl` (both in monthly_metrics)
- **Fix**: Margin expansion = current margin - 6-month-ago margin
- **New chart**: Profitability matrix (margin vs growth quadrants)

### 4.5 Risk Metrics (Rating: 2/10 → target 6/10)
- **Missing**: Revenue volatility, Sharpe-like ratio, concentration risk, beta
- **Fix**: Compute from monthly_metrics: `volatility = stdev(revenue) / mean(revenue)` (12mo)
- **Fix**: `risk_adjusted_return = revenue_growth / volatility`
- **Fix**: `concentration = max_protocol_revenue / total_sector_revenue`
- **New chart**: Risk-return scatter, volatility trend

### 4.6 Peer Benchmarking (Rating: 4/10 → target 8/10)
- **Missing**: Explicit percentile rankings, comp tables, sector medians
- **Fix**: Compute percentiles from protocol_latest aggregate queries
- **Fix**: Add sector median/mean lines to existing charts
- **New chart**: Peer comparison radar chart, percentile ranking table

---

## TIER 5 — LOWER: Presentation & UX

### 5.1 PDF/CSV Export
- Add "Export" button per chart → download PNG (Plotly built-in)
- Add CSV export for screener data
- Add PDF report generation (html2canvas + jsPDF)

### 5.2 Data Dictionary / Methodology
- Populate metric_definitions table with descriptions, sources, formulas
- Add "i" tooltip icons next to each KPI with methodology explanation

### 5.3 Alert System
- Populate alerts table when momentum_signal changes
- Browser notifications or email digest

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)
1. Display existing computed metrics (Tier 1) — ~200 LOC
2. Add sector_snapshots computation to sync — ~50 LOC SQL
3. Add momentum signals to Screener tab columns

### Phase 2: Data Completeness (2-3 days)
4. Add chain_metrics sync (aggregate_by=chain) — ~100 LOC
5. Compute synthetic retention from DAU trends — ~80 LOC
6. Fix chainData/cohorts for real API data path

### Phase 3: Bloomberg Features (3-5 days)
7. New computed metrics (PEG, CAGR, volatility, capital efficiency) — ~150 LOC
8. New charts (waterfall, growth quality scatter, risk-return) — ~400 LOC
9. Peer benchmarking with percentile rankings — ~200 LOC

### Phase 4: Polish (2-3 days)
10. Export functionality (CSV, PNG, PDF)
11. Data dictionary tooltips
12. Alert system basics

**Total estimated: ~1,200 lines of code across 10-13 working days**

---

## Data Source Matrix

| Feature | Source | New API Calls? | New DB Table? |
|---------|--------|----------------|---------------|
| Display hidden metrics | monthly_metrics, protocol_latest | No | No |
| Sector snapshots | SQL aggregation | No | Populate existing |
| Chain breakdown | TT API `?aggregate_by=chain` | Yes (+1 per protocol) | Populate existing |
| Retention estimates | Derived from DAU | No | Populate existing |
| PEG ratio | revenue + fdv + growth | No | No (compute on read) |
| CAGR | monthly_metrics history | No | No (compute on read) |
| Revenue volatility | monthly_metrics history | No | No (compute on read) |
| Capital efficiency | revenue / tvl | No | No (compute on read) |
| Percentile rankings | protocol_latest aggregates | No | No (compute on read) |
| Organic growth ratio | revenue + token_incentives | No | No (compute on read) |
