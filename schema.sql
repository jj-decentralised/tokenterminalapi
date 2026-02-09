-- =============================================================================
-- Token Terminal Analytics Dashboard — Database Schema
-- =============================================================================
-- Optimized for:
--   1. Minimizing TT API calls (cache everything, refresh incrementally)
--   2. Fast dashboard queries (pre-aggregated views, proper indexes)
--   3. Easy feature extensibility (EAV for metrics, JSONB for flexible data)
--
-- Database: PostgreSQL 15+
-- =============================================================================

-- =============================================================================
-- 1. CORE ENTITIES
-- =============================================================================

-- Protocols: The master list of all discovered projects
CREATE TABLE protocols (
    id              TEXT PRIMARY KEY,           -- e.g. 'aave', 'uniswap'
    name            TEXT NOT NULL,              -- Display name
    symbol          TEXT,                       -- Token symbol (e.g. 'AAVE')
    sector_id       TEXT REFERENCES sectors(id),-- Normalized sector
    chains          TEXT[] DEFAULT '{}',        -- Array of chain slugs
    is_seed         BOOLEAN DEFAULT FALSE,      -- Hand-tuned seed protocol?
    is_archived     BOOLEAN DEFAULT FALSE,      -- Archived on TT
    logo_url        TEXT,                       -- Protocol logo URL
    website_url     TEXT,                       -- Protocol website
    coingecko_id    TEXT,                       -- CoinGecko mapping
    tt_slug         TEXT,                       -- Resolved TT API slug (after retry)
    metadata        JSONB DEFAULT '{}',         -- Flexible extra fields from API
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_protocols_sector ON protocols(sector_id);
CREATE INDEX idx_protocols_chains ON protocols USING GIN(chains);
CREATE INDEX idx_protocols_updated ON protocols(updated_at);

-- Sectors: Normalized sector taxonomy
CREATE TABLE sectors (
    id              TEXT PRIMARY KEY,           -- e.g. 'lending', 'dex', 'l1'
    label           TEXT NOT NULL,              -- Display name: 'Lending', 'DEX'
    color           TEXT NOT NULL,              -- Hex color: '#4a9eff'
    tt_sector_ids   TEXT[] DEFAULT '{}',        -- TT API sector IDs that map here
    protocol_count  INTEGER DEFAULT 0,          -- Cached count
    sort_order      INTEGER DEFAULT 999,        -- Display order
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Chains: Blockchain networks
CREATE TABLE chains (
    slug            TEXT PRIMARY KEY,           -- e.g. 'ethereum', 'solana'
    name            TEXT NOT NULL,              -- Display: 'Ethereum', 'Solana'
    chain_type      TEXT,                       -- 'l1', 'l2', 'sidechain'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. TIME-SERIES METRICS (EAV pattern for flexibility)
-- =============================================================================
-- This is the core table. Each row = one metric value for one protocol in one month.
-- EAV (Entity-Attribute-Value) pattern means adding new metrics requires ZERO schema changes.

CREATE TABLE monthly_metrics (
    protocol_id     TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    month           TEXT NOT NULL,              -- 'YYYY-MM' format
    metric_id       TEXT NOT NULL,              -- Metric name (see below)
    value           DOUBLE PRECISION,           -- Metric value (USD, ratio, count, etc.)
    PRIMARY KEY (protocol_id, month, metric_id)
);

-- The key metrics we track (extensible — just INSERT new metric_ids):
-- Revenue metrics:  'revenue', 'fees', 'earnings', 'token_incentives',
--                   'cost_of_revenue', 'supply_side_fees'
-- Valuation:        'tvl', 'fdv', 'circ_mcap', 'price'
-- Users:            'dau', 'mau', 'transaction_count', 'active_addresses'
-- Computed ratios:  'take_rate', 'gross_margin', 'net_margin', 'ps_ratio',
--                   'revenue_yield', 'arpu'
-- Developer:        'active_developers', 'code_commits' (future TT API)
-- Chain breakdown:  'revenue_ethereum', 'revenue_solana' (future per-chain)

CREATE INDEX idx_monthly_protocol_month ON monthly_metrics(protocol_id, month);
CREATE INDEX idx_monthly_metric ON monthly_metrics(metric_id, month);
CREATE INDEX idx_monthly_month ON monthly_metrics(month DESC);

-- =============================================================================
-- 3. PRE-AGGREGATED VIEWS (for fast dashboard queries)
-- =============================================================================

-- Latest snapshot: one row per protocol with all current metrics
-- Refreshed after each data sync. This is what the Screener tab queries.
CREATE TABLE protocol_latest (
    protocol_id     TEXT PRIMARY KEY REFERENCES protocols(id) ON DELETE CASCADE,
    month           TEXT NOT NULL,              -- Latest month with data
    revenue         DOUBLE PRECISION DEFAULT 0,
    fees            DOUBLE PRECISION DEFAULT 0,
    earnings        DOUBLE PRECISION DEFAULT 0,
    token_incentives DOUBLE PRECISION DEFAULT 0,
    cost_of_revenue DOUBLE PRECISION DEFAULT 0,
    supply_side_fees DOUBLE PRECISION DEFAULT 0,
    tvl             DOUBLE PRECISION DEFAULT 0,
    fdv             DOUBLE PRECISION DEFAULT 0,
    circ_mcap       DOUBLE PRECISION DEFAULT 0,
    price           DOUBLE PRECISION DEFAULT 0,
    dau             DOUBLE PRECISION DEFAULT 0,
    take_rate       DOUBLE PRECISION DEFAULT 0,
    gross_margin    DOUBLE PRECISION DEFAULT 0,
    net_margin      DOUBLE PRECISION DEFAULT 0,
    ps_ratio        DOUBLE PRECISION DEFAULT 0,
    arpu            DOUBLE PRECISION DEFAULT 0,
    -- Computed signals (refreshed by background job)
    revenue_mom     DOUBLE PRECISION,           -- Month-over-month growth
    revenue_mom3    DOUBLE PRECISION,           -- 3-month growth
    momentum_streak INTEGER DEFAULT 0,          -- Consecutive up/down months
    momentum_signal TEXT DEFAULT 'neutral',     -- 'strong-up','up','neutral','down','strong-down'
    consistency     DOUBLE PRECISION DEFAULT 0, -- Revenue consistency score
    sticky_index    DOUBLE PRECISION DEFAULT 0, -- Month-to-month stability
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_latest_revenue ON protocol_latest(revenue DESC);
CREATE INDEX idx_latest_signal ON protocol_latest(momentum_signal);

-- Quarterly aggregates: pre-computed for the revenue/sector charts
CREATE TABLE quarterly_metrics (
    protocol_id     TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    quarter         TEXT NOT NULL,              -- '2024 Q1' format
    revenue         DOUBLE PRECISION DEFAULT 0,
    fees            DOUBLE PRECISION DEFAULT 0,
    earnings        DOUBLE PRECISION DEFAULT 0,
    token_incentives DOUBLE PRECISION DEFAULT 0,
    cost_of_revenue DOUBLE PRECISION DEFAULT 0,
    avg_take_rate   DOUBLE PRECISION DEFAULT 0,
    avg_tvl         DOUBLE PRECISION DEFAULT 0,
    avg_fdv         DOUBLE PRECISION DEFAULT 0,
    avg_dau         DOUBLE PRECISION DEFAULT 0,
    PRIMARY KEY (protocol_id, quarter)
);

CREATE INDEX idx_quarterly_quarter ON quarterly_metrics(quarter);

-- Sector aggregates: pre-computed for the Sectors tab
CREATE TABLE sector_snapshots (
    sector_id       TEXT NOT NULL REFERENCES sectors(id),
    month           TEXT NOT NULL,
    protocol_count  INTEGER DEFAULT 0,
    total_revenue   DOUBLE PRECISION DEFAULT 0,
    avg_revenue     DOUBLE PRECISION DEFAULT 0,
    total_tvl       DOUBLE PRECISION DEFAULT 0,
    avg_ps_ratio    DOUBLE PRECISION DEFAULT 0,
    avg_gross_margin DOUBLE PRECISION DEFAULT 0,
    avg_net_margin  DOUBLE PRECISION DEFAULT 0,
    revenue_mom     DOUBLE PRECISION,           -- Sector-level MoM growth
    PRIMARY KEY (sector_id, month)
);

-- =============================================================================
-- 4. COHORT / RETENTION DATA
-- =============================================================================

CREATE TABLE cohort_retention (
    protocol_id     TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    cohort_month    TEXT NOT NULL,              -- Cohort start month 'YYYY-MM'
    retention_month INTEGER NOT NULL,           -- 0=M0 (always 1.0), 1=M1, ... 11=M11
    retention_rate  DOUBLE PRECISION NOT NULL,  -- 0.0 to 1.0
    PRIMARY KEY (protocol_id, cohort_month, retention_month)
);

CREATE INDEX idx_cohort_protocol ON cohort_retention(protocol_id);

-- =============================================================================
-- 5. CHAIN-LEVEL BREAKDOWN
-- =============================================================================

CREATE TABLE chain_metrics (
    protocol_id     TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    chain_slug      TEXT NOT NULL REFERENCES chains(slug),
    month           TEXT NOT NULL,
    revenue         DOUBLE PRECISION DEFAULT 0,
    fees            DOUBLE PRECISION DEFAULT 0,
    tvl             DOUBLE PRECISION DEFAULT 0,
    dau             DOUBLE PRECISION DEFAULT 0,
    revenue_share   DOUBLE PRECISION DEFAULT 0, -- This chain's share of total (0-1)
    PRIMARY KEY (protocol_id, chain_slug, month)
);

CREATE INDEX idx_chain_metrics_chain ON chain_metrics(chain_slug, month);

-- =============================================================================
-- 6. DATA SYNC & CACHE MANAGEMENT
-- =============================================================================

-- Track API sync status per protocol
CREATE TABLE sync_log (
    id              SERIAL PRIMARY KEY,
    protocol_id     TEXT REFERENCES protocols(id),
    endpoint        TEXT NOT NULL,              -- '/projects/{id}/metrics', '/market-sectors', etc.
    status          TEXT NOT NULL,              -- 'ok', 'failed', 'rate_limited', 'mock_fallback'
    slug_used       TEXT,                       -- Which slug alias succeeded
    row_count       INTEGER,                    -- Rows returned
    error_message   TEXT,
    duration_ms     INTEGER,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_sync_protocol ON sync_log(protocol_id, started_at DESC);
CREATE INDEX idx_sync_status ON sync_log(status);

-- Global sync state
CREATE TABLE sync_state (
    key             TEXT PRIMARY KEY,
    value           TEXT,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Initial sync state entries
INSERT INTO sync_state (key, value) VALUES
    ('last_full_sync', NULL),
    ('last_sector_sync', NULL),
    ('last_project_list_sync', NULL),
    ('sync_version', '1');

-- =============================================================================
-- 7. USER FEATURES (future: saved views, alerts, watchlists)
-- =============================================================================

-- Saved dashboard views / shareable snapshots
CREATE TABLE saved_views (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    -- Serialized filter state
    sector          TEXT DEFAULT 'all',
    chain           TEXT DEFAULT 'all',
    period          INTEGER DEFAULT 24,
    active_tab      TEXT DEFAULT 'revenue',
    extra_state     JSONB DEFAULT '{}',        -- Any additional state (compare selections, etc.)
    -- Sharing
    is_public       BOOLEAN DEFAULT FALSE,
    share_slug      TEXT UNIQUE,               -- Short URL slug
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    accessed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_views_slug ON saved_views(share_slug) WHERE share_slug IS NOT NULL;

-- Watchlist: users can track specific protocols
CREATE TABLE watchlist (
    id              SERIAL PRIMARY KEY,
    name            TEXT DEFAULT 'Default',
    protocol_ids    TEXT[] NOT NULL DEFAULT '{}',
    alert_rules     JSONB DEFAULT '[]',        -- e.g. [{"metric":"revenue_mom","op":">","value":0.2}]
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Alert history
CREATE TABLE alerts (
    id              SERIAL PRIMARY KEY,
    protocol_id     TEXT REFERENCES protocols(id),
    alert_type      TEXT NOT NULL,              -- 'momentum_change', 'revenue_spike', 'margin_drop'
    signal          TEXT,                       -- 'strong-up', 'strong-down', etc.
    message         TEXT,
    metric_value    DOUBLE PRECISION,
    threshold       DOUBLE PRECISION,
    acknowledged    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_protocol ON alerts(protocol_id, created_at DESC);
CREATE INDEX idx_alerts_unack ON alerts(acknowledged) WHERE acknowledged = FALSE;

-- =============================================================================
-- 8. METRIC REGISTRY (self-documenting, powers dynamic UI)
-- =============================================================================

CREATE TABLE metric_definitions (
    metric_id       TEXT PRIMARY KEY,           -- Same IDs used in monthly_metrics
    label           TEXT NOT NULL,              -- Display name
    description     TEXT,                       -- Tooltip text
    unit            TEXT NOT NULL,              -- 'usd', 'ratio', 'percent', 'count'
    format          TEXT NOT NULL,              -- 'fmtUSD', 'fmtPct', 'fmtX', 'fmtNum'
    category        TEXT NOT NULL,              -- 'revenue', 'valuation', 'users', 'margins', 'developer'
    tt_api_field    TEXT,                       -- Corresponding TT API metric_id
    is_computed     BOOLEAN DEFAULT FALSE,      -- Derived from other metrics?
    sort_order      INTEGER DEFAULT 999,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed metric definitions
INSERT INTO metric_definitions (metric_id, label, description, unit, format, category, tt_api_field, is_computed) VALUES
    ('revenue',          'Revenue',              'Monthly protocol revenue',                                'usd',     'fmtUSD', 'revenue',   'revenue',                     FALSE),
    ('fees',             'Fees',                 'Total fees paid by users',                                'usd',     'fmtUSD', 'revenue',   'fees',                        FALSE),
    ('earnings',         'Earnings',             'Revenue after costs and incentives',                      'usd',     'fmtUSD', 'revenue',   'earnings',                    FALSE),
    ('token_incentives', 'Token Incentives',     'Token incentive payouts to users/LPs',                    'usd',     'fmtUSD', 'revenue',   'token-incentives',            FALSE),
    ('cost_of_revenue',  'Cost of Revenue',      'Direct operating costs',                                  'usd',     'fmtUSD', 'revenue',   'cost-of-revenue',             FALSE),
    ('supply_side_fees', 'Supply-Side Fees',     'Fees paid to liquidity providers / validators',           'usd',     'fmtUSD', 'revenue',   'supply-side-fees',            FALSE),
    ('tvl',              'TVL',                  'Total Value Locked',                                      'usd',     'fmtUSD', 'valuation', 'tvl',                         FALSE),
    ('fdv',              'FDV',                  'Fully Diluted Valuation',                                 'usd',     'fmtUSD', 'valuation', 'fully-diluted-market-cap',    FALSE),
    ('circ_mcap',        'Circulating Mcap',     'Circulating market capitalization',                       'usd',     'fmtUSD', 'valuation', 'circulating-market-cap',      FALSE),
    ('price',            'Price',                'Token price',                                             'usd',     'fmtUSD', 'valuation', 'price',                       FALSE),
    ('dau',              'DAU',                  'Daily Active Users',                                      'count',   'fmtNum', 'users',     'daily-active-users',          FALSE),
    ('take_rate',        'Take Rate',            'Revenue / Fees — proportion of fees retained by protocol','ratio',   'fmtPct', 'margins',   NULL,                          TRUE),
    ('gross_margin',     'Gross Margin',         '(Revenue - Cost of Revenue) / Revenue',                   'ratio',   'fmtPct', 'margins',   NULL,                          TRUE),
    ('net_margin',       'Net Margin',           'Earnings / Revenue',                                      'ratio',   'fmtPct', 'margins',   NULL,                          TRUE),
    ('ps_ratio',         'P/S Ratio',            'FDV / (Revenue × 12) — annualized',                      'ratio',   'fmtX',   'valuation', NULL,                          TRUE),
    ('revenue_yield',    'Revenue Yield',        '(Revenue × 12) / FDV — annualized',                      'ratio',   'fmtPct', 'valuation', NULL,                          TRUE),
    ('arpu',             'ARPU',                 'Average Revenue Per User (monthly)',                      'usd',     'fmtUSD', 'users',     NULL,                          TRUE),
    ('active_developers','Active Developers',    'Monthly active developers',                               'count',   'fmtNum', 'developer', 'active-developers',           FALSE),
    ('code_commits',     'Code Commits',         'Monthly code commits',                                   'count',   'fmtNum', 'developer', 'code-commits',                FALSE),
    ('transaction_count','Transactions',         'Monthly transaction count',                               'count',   'fmtNum', 'users',     'transaction-count',           FALSE),
    ('active_addresses', 'Active Addresses',     'Monthly active addresses',                                'count',   'fmtNum', 'users',     'active-addresses',            FALSE),
    ('token_holders',    'Token Holders',        'Number of token holders',                                 'count',   'fmtNum', 'users',     'token-holders',               FALSE);


-- =============================================================================
-- 9. MATERIALIZED VIEWS FOR DASHBOARD API ENDPOINTS
-- =============================================================================

-- One-call endpoint: returns everything the dashboard needs for initial load
-- Refresh this after each sync cycle
CREATE MATERIALIZED VIEW mv_dashboard_load AS
SELECT
    p.id,
    p.name,
    p.symbol,
    p.sector_id AS sector,
    p.chains,
    s.label AS sector_label,
    s.color AS sector_color,
    pl.month AS latest_month,
    pl.revenue,
    pl.fees,
    pl.earnings,
    pl.token_incentives,
    pl.cost_of_revenue,
    pl.tvl,
    pl.fdv,
    pl.dau,
    pl.take_rate,
    pl.gross_margin,
    pl.net_margin,
    pl.ps_ratio,
    pl.arpu,
    pl.revenue_mom,
    pl.revenue_mom3,
    pl.momentum_signal,
    pl.momentum_streak,
    pl.consistency,
    pl.sticky_index
FROM protocols p
JOIN sectors s ON s.id = p.sector_id
LEFT JOIN protocol_latest pl ON pl.protocol_id = p.id
WHERE p.is_archived = FALSE
ORDER BY pl.revenue DESC NULLS LAST;

CREATE UNIQUE INDEX idx_mv_dashboard_id ON mv_dashboard_load(id);

-- Sector summary: pre-computed for Sectors tab
CREATE MATERIALIZED VIEW mv_sector_summary AS
SELECT
    s.id AS sector_id,
    s.label,
    s.color,
    COUNT(p.id) AS protocol_count,
    SUM(pl.revenue) AS total_revenue,
    AVG(pl.revenue) AS avg_revenue,
    SUM(pl.tvl) AS total_tvl,
    AVG(NULLIF(pl.ps_ratio, 0)) AS avg_ps_ratio,
    AVG(pl.gross_margin) AS avg_gross_margin,
    AVG(pl.net_margin) AS avg_net_margin,
    AVG(pl.revenue_mom) AS avg_revenue_mom
FROM sectors s
LEFT JOIN protocols p ON p.sector_id = s.id AND p.is_archived = FALSE
LEFT JOIN protocol_latest pl ON pl.protocol_id = p.id
GROUP BY s.id, s.label, s.color
ORDER BY total_revenue DESC NULLS LAST;

CREATE UNIQUE INDEX idx_mv_sector_id ON mv_sector_summary(sector_id);

-- Refresh function (call after sync)
-- CREATE OR REPLACE FUNCTION refresh_dashboard_views() RETURNS void AS $$
-- BEGIN
--     REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_load;
--     REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sector_summary;
-- END;
-- $$ LANGUAGE plpgsql;


-- =============================================================================
-- 10. API ENDPOINT QUERY PATTERNS
-- =============================================================================
-- These comments document the optimal queries for each dashboard feature.

-- SCREENER TAB: Single query, returns all protocols with latest metrics + momentum
-- SELECT * FROM mv_dashboard_load ORDER BY revenue DESC;

-- SECTOR ANALYTICS TAB: Single query for summary
-- SELECT * FROM mv_sector_summary ORDER BY total_revenue DESC;

-- PROTOCOL DETAIL MODAL: Monthly time series for one protocol
-- SELECT month, metric_id, value
-- FROM monthly_metrics
-- WHERE protocol_id = $1
-- ORDER BY month, metric_id;

-- REVENUE TAB (quarterly stacked bars): Top 25 protocols × quarters
-- SELECT qm.protocol_id, p.name, qm.quarter, qm.revenue
-- FROM quarterly_metrics qm
-- JOIN protocols p ON p.id = qm.protocol_id
-- WHERE qm.protocol_id IN (SELECT id FROM mv_dashboard_load LIMIT 25)
-- ORDER BY qm.quarter, qm.revenue DESC;

-- COMPARE TAB: Monthly data for 2-4 selected protocols
-- SELECT mm.protocol_id, mm.month, mm.metric_id, mm.value
-- FROM monthly_metrics mm
-- WHERE mm.protocol_id = ANY($1)
-- ORDER BY mm.protocol_id, mm.month, mm.metric_id;

-- FINANCIALS TAB: All line items for one protocol
-- SELECT month, metric_id, value
-- FROM monthly_metrics
-- WHERE protocol_id = $1
--   AND metric_id IN ('revenue','fees','earnings','token_incentives',
--                     'cost_of_revenue','supply_side_fees')
-- ORDER BY month;

-- MOMENTUM SIGNALS: Already in protocol_latest
-- SELECT protocol_id, revenue_mom, revenue_mom3, momentum_signal, momentum_streak
-- FROM protocol_latest
-- ORDER BY revenue DESC;
