# Token Terminal API: Deep Analytical Plan

## Objective

A deeply analytical framework for understanding **token revenue**, **market price dynamics**, **user retention**, and **seasonality of capital flows** in crypto — built entirely on Token Terminal's v2 REST API.

---

## API Surface Summary

Base URL: `https://api.tokenterminal.com/v2/`
Auth: Bearer token
Rate limits: 1,000 req/min, 250,000 req/day
Python SDK: `pip install tokenterminal`

### Core Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /v2/projects` | List all trackable projects |
| `GET /v2/projects/{id}` | Metric availability, chains, products per project |
| `GET /v2/projects/{id}/metrics` | Historical time-series (daily) for any metric |
| `GET /v2/projects/{id}/products/{pid}/metrics` | Product-level metric breakdowns |
| `GET /v2/projects/{id}/metric-aggregations` | Pre-computed rolling aggregations |
| `GET /v2/projects/{id}/financial-statement` | Income statement format (fees → revenue → earnings) |
| `GET /v2/metrics` | List all 99 available metrics |
| `GET /v2/metrics/{metric_id}` | Cross-project comparison for a single metric |
| `GET /v2/market-sectors` | Sector taxonomy (L1s, lending, DEXs, etc.) |
| `GET /v2/datasets` | Special datasets listing |
| `GET /v2/datasets/trending_contracts` | Contract-level flows, gas, events |

### Key Parameters

- `metric_ids`: Comma-separated metric IDs (e.g., `fees,revenue,earnings`)
- `chain_ids`: Filter by chain (e.g., `ethereum,base`)
- `product_ids`: Filter by product (e.g., `usdc,usdt`)
- `market_sector_ids`: Filter by sector (e.g., `blockchains-l1,lending`)
- `aggregate_by`: `chain`, `version`, or `business_line`
- `start` / `end`: Date range
- `timestamp_granularity`: `year`, `quarter`, `month`, `week` (financial statements)
- `interval`: `1m`, `1y`, `2y`, `3y`, `5y`, `max`

---

## Metric Taxonomy

### Financial Data
| Metric | Description |
|---|---|
| `fees` | Total value users pay to use a project |
| `supply-side-fees` | Portion distributed to service providers (LPs, validators) |
| `revenue` | Fees kept by the protocol and tokenholders |
| `cost-of-revenue` | Outsourced operational costs |
| `token-incentives` | Value of governance tokens claimed by users (subsidy spend) |
| `earnings` | Revenue minus token incentives (true bottom line) |

### Market & Valuation Data
| Metric | Description |
|---|---|
| `price` | Token price |
| `circulating-market-cap` | Current supply × price |
| `fully-diluted-market-cap` | Max supply × price |
| `token-trading-volume` | CEX + DEX trading volume |
| `p-f-ratio` | Price-to-fees ratio (valuation multiple) |
| `p-s-ratio` | Price-to-sales ratio (valuation multiple) |

### GMV & Activity Data
| Metric | Description |
|---|---|
| `tvl` | Total Value Locked in smart contracts |
| `transaction-volume` | L1/L2 transaction value |
| `trading-volume` | DEX/NFT exchange activity |
| `active-loans` | Outstanding borrowing amounts |
| `assets-staked` | Funds in liquid staking protocols |
| `transfer-volume` | Cross-chain bridge transaction values |

### Alternative Data
| Metric | Description |
|---|---|
| `daily-active-users` | Unique addresses interacting with business-relevant contracts |
| `tokenholders` | Count of unique addresses with positive balances |
| `active-developers` | Distinct users with 1+ commits in 30 days |
| `code-commits` | Repository contribution frequency |

### Cash Management
| Metric | Description |
|---|---|
| `treasury` | Value of tokens in protocol treasury contracts |

---

## Analysis Module 1: Token Revenue

### Data Sources
- Financial statement endpoint (`timestamp_granularity=month`, `interval=max`)
- Project metrics endpoint: `metric_ids=fees,revenue,earnings,cost-of-revenue,token-incentives,supply-side-fees`
- Cross-project metrics: `GET /v2/metrics/revenue?market_sector_ids=lending`

### Analytical Framework

```
Fees (total user spend)
  ├─ Supply-side fees (paid to LPs, validators, etc.)
  └─ Revenue (protocol's take)
       ├─ Cost of revenue (outsourced costs)
       ├─ Token incentives (subsidies)
       └─ Earnings (true bottom line)
```

### Key Analyses

1. **Revenue quality scoring**: Compare `revenue` to `token-incentives`. When incentives > revenue, the protocol is subsidizing growth unsustainably. `earnings` shows true economic surplus.

2. **Revenue decomposition by chain**: Use `aggregate_by=chain` to see which L2/chain generates what share. Reveals concentration risk.

3. **Revenue by product**: Use product-level endpoint for multi-product protocols (Circle USDC vs EURC, Aave markets).

4. **Cross-protocol revenue benchmarking**: Use metric endpoint with `market_sector_ids` for horizontal comparison across lending, DEXs, L1s.

5. **Take rate analysis**: `revenue / fees` = the protocol's effective take rate. Track changes over time (competitive pressure or pricing power).

6. **Revenue sustainability**: Track `earnings / revenue` ratio. Rising = operational efficiency. Declining = growing costs or incentive dependency.

---

## Analysis Module 2: Market Price & Valuation

### Data Sources
- Project metrics: `metric_ids=price,circulating-market-cap,fully-diluted-market-cap,token-trading-volume,p-s-ratio,p-f-ratio`
- Combined with revenue metrics for fundamental overlay

### Key Analyses

1. **Fundamental-relative pricing**: Track price alongside P/S ratio. Falling P/S with stable revenue = market discounting despite unchanged fundamentals.

2. **Market cap to TVL ratio**: `circulating-market-cap / tvl` as a DeFi-specific valuation gauge. Low = potential value; high = speculative premium.

3. **Token incentive dilution impact**: Overlay `token-incentives` time-series on `price`. Quantify the relationship between incentive emissions and price pressure.

4. **Revenue yield**: `revenue / fully-diluted-market-cap` as annualized yield equivalent. Compare across sectors for relative value.

5. **Valuation regime detection**: Cluster protocols by P/S ranges over time. Identify when a sector shifts from growth-stage (high P/S) to maturity (compressing P/S).

### Limitation
Token Terminal does NOT provide intraday or tick-level price data. Pair with Coingecko/CoinMarketCap for high-frequency analysis. Use TT for the fundamental overlay.

---

## Analysis Module 3: Retention

### Data Sources
- Cohort analysis data (via explorer/datasets)
- Project metrics: `metric_ids=daily-active-users,tokenholders`
- Token holders dataset (top 200 holders at EOD)

### Key Analyses

1. **MAU cohort decay curves**: Compute retention rates at month 1, 3, 6, 12. Protocols with >20% 6-month retention are exceptional in crypto.

2. **Revenue per user (ARPU)**: `revenue / daily-active-users`. Rising ARPU with stable users = pricing power.

3. **User acquisition cost (CAC)**: `token-incentives / new users in cohort`. Compare to LTV for unit economics.

4. **Stickiness ratio**: DAU / MAU. Higher = habitual usage vs. speculative drive-by.

5. **Holder concentration tracking**: Track whether the top-200 holder base is diversifying or consolidating over time.

6. **Cross-sector retention benchmarks**: Compare retention curves across L1s, DEXs, lending, NFT platforms to identify which sector structures produce stickier users.

### Limitation
Cohort analysis may be primarily a UI/explorer feature. Verify which datasets expose cohort-level data programmatically via `GET /v2/datasets`.

---

## Analysis Module 4: Seasonality of Capital Flows

### Data Sources
- Project metrics: `metric_ids=tvl,transaction-volume,trading-volume,active-loans,assets-staked,transfer-volume,fees`
- Trending contracts dataset: `inflows_1d_sum`, `outflows_1d_sum`, `net_flows_1d_sum`
- Cross-sector metrics with `market_sector_ids` filtering

### Key Analyses

1. **TVL seasonality decomposition**: Pull multi-year daily TVL. Decompose via STL (Seasonal-Trend decomposition using Loess) into trend + seasonal + residual. Known patterns: Q1 rallies, summer lulls, year-end volatility.

2. **Capital rotation maps**: Track TVL changes across sectors (L1s → lending → DEXs → liquid staking) over time. When capital leaves one sector, where does it go?

3. **Net flow analysis**: Aggregate trending contracts inflow/outflow by sector for macro-level capital movement visibility.

4. **Stablecoin as flow proxy**: Track stablecoin outstanding supply by chain (product-level filtering) to see where USD-denominated capital is moving.

5. **Fee seasonality as demand proxy**: Monthly/quarterly fee patterns reveal when users actually use protocols vs. dormancy. Compare across sectors.

6. **Leverage cycle detection**: Track `active-loans` seasonality alongside `tvl` and `price`. Rising leverage during TVL expansion = fragility signal.

7. **Month-of-year effects**: Aggregate multi-year data by calendar month. Test for statistically significant monthly effects in fees, TVL, and trading volume.

---

## Implementation Architecture

```
Phase 1: Data Collection Layer
├── Enumerate all projects via GET /v2/projects
├── Get metric availability per project via GET /v2/projects/{id}
├── Pull historical metrics (max interval, daily) for core metrics
├── Pull financial statements (monthly + quarterly, max interval)
└── Pull trending contracts dataset for flow analysis

Phase 2: Storage & Normalization
├── Store raw JSON → normalize into Parquet or SQLite
├── Handle missing data (not all metrics available for all projects)
├── Align timestamps across metrics
└── Build sector-level aggregations using market_sector_ids

Phase 3: Analytical Modules
├── revenue_analysis.py     → Revenue quality, decomposition, benchmarking
├── valuation_analysis.py   → P/S, P/F, market cap/TVL, fundamental pricing
├── retention_analysis.py   → Cohort decay, ARPU, stickiness, CAC
├── seasonality_analysis.py → STL decomposition, capital rotation, flows
└── composite_signals.py    → Cross-module signals

Phase 4: Output
├── Time-series visualizations (matplotlib/plotly)
├── Sector heatmaps (capital rotation over time)
├── Protocol scorecards (revenue quality + retention + valuation)
└── Seasonality calendars (month-by-month behavioral patterns)
```

---

## API Usage Strategy

1. **Batch by metric, not by project.** `GET /v2/metrics/{metric_id}` pulls one metric across ALL projects in a single call.
2. **Use `aggregate_by` selectively.** Chain/product breakdowns multiply data volume. Start project-level, drill down on top protocols.
3. **Cache aggressively.** Historical data is immutable. Only re-pull trailing 7 days.
4. **Use financial statements for revenue analysis.** Pre-computed and more efficient than building from raw metrics.
5. **Use the Breakdown API** for time-windowed aggregations (single call for monthly aggregations over 180 days).
6. **Budget**: ~99 metrics × 1 cross-project call each = ~99 calls for a full snapshot. Full historical pulls for 100 projects × 15 metrics ≈ 1,500 calls. Well within 250K/day.

---

## Gaps & Complementary Data Sources

| Gap | Alternative |
|---|---|
| Intraday/tick price data | Coingecko, CoinMarketCap, exchange APIs |
| Order book depth & liquidity | DEX aggregator APIs, on-chain DEX data |
| Token unlock schedules | Token Unlocks, Messari |
| Governance proposals & votes | Snapshot, Tally |
| Social sentiment | LunarCrush, Santiment |
| Raw on-chain tx data | Dune Analytics, Flipside, Allium |

---

## Sources

- [Get historical metrics for a project](https://tokenterminal.com/docs/api-reference/projects/get-historical-metrics-for-a-project)
- [2025 API Updates](https://tokenterminal.com/resources/articles/2025-api-updates)
- [Get metric data for multiple projects](https://tokenterminal.com/docs/api-reference/metrics/get-metric-data-for-multiple-projects)
- [Token Terminal Key Metrics FAQ](https://tokenterminal.com/resources/articles/token-terminal-key-metrics-faq)
- [Financial statement endpoint](https://tokenterminal.com/docs/api-reference/projects/get-financial-statement-for-a-project)
- [Trending contracts dataset](https://tokenterminal.com/docs/api-reference/datasets/get-the-trending-contracts-dataset)
- [List all datasets](https://tokenterminal.com/docs/api-reference/datasets/list-all-datasets)
- [Market sectors endpoint](https://docs.tokenterminal.com/reference/get_v2-market-sectors)
- [Python SDK (community)](https://github.com/itzmestar/tokenterminal)
- [Token Terminal Docs](https://tokenterminal.com/docs)
