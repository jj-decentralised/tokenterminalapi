const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3000;
const TT_API_KEY = process.env.TT_API_KEY || '';
const TT_BASE = 'https://api.tokenterminal.com/v2';
const START_TIME = Date.now();

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
// Slug retry map – when the upstream TT API returns 404 for a project slug,
// we automatically retry with these alternate slugs before giving up.
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
// Make a single HTTPS GET request to the Token Terminal API.
// Returns a Promise that resolves to { statusCode, body }.
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

// ---------------------------------------------------------------------------
// Extract the project slug from a TT API path, if present.
// Paths look like: /projects/<slug>/metrics?...  or  /projects/<slug>
// ---------------------------------------------------------------------------
function extractSlug(apiPath) {
  const match = apiPath.match(/^\/projects\/([^/?]+)(\/|$|\?)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Replace the slug portion of an API path with a new slug.
// ---------------------------------------------------------------------------
function replaceSlug(apiPath, oldSlug, newSlug) {
  return apiPath.replace(`/projects/${oldSlug}`, `/projects/${newSlug}`);
}

// ---------------------------------------------------------------------------
// Proxy a request to the Token Terminal API with slug-retry logic.
// ---------------------------------------------------------------------------
async function proxyTT(apiPath, res) {
  if (!TT_API_KEY) {
    res.writeHead(503, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify({ error: 'TT_API_KEY not configured. Using mock data.' }));
    return;
  }

  // ------ Check cache first ------
  const cached = getCached(apiPath);
  if (cached) {
    res.writeHead(cached.statusCode, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Cache': 'HIT',
      'X-Data-Timestamp': new Date(cached.timestamp).toISOString(),
    });
    res.end(cached.data);
    return;
  }

  // ------ Fetch from upstream ------
  try {
    let result = await fetchTT(apiPath);
    const now = new Date().toISOString();

    // Rate-limit warning
    if (result.statusCode === 429) {
      console.warn(`[RATE-LIMIT] 429 received from TT API for: ${apiPath}`);
    }

    // Slug retry on 404
    if (result.statusCode === 404) {
      const slug = extractSlug(apiPath);
      const retries = slug ? SLUG_RETRIES[slug] : null;

      if (retries && retries.length > 0) {
        for (const altSlug of retries) {
          const altPath = replaceSlug(apiPath, slug, altSlug);
          console.log(`[SLUG-RETRY] 404 for "${slug}", trying "${altSlug}" -> ${altPath}`);
          const altResult = await fetchTT(altPath);

          if (altResult.statusCode === 429) {
            console.warn(`[RATE-LIMIT] 429 received from TT API for: ${altPath}`);
          }

          if (altResult.statusCode === 200) {
            // Cache under the *original* key so future hits are fast
            setCache(apiPath, altResult.body, 200);
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Cache': 'MISS',
              'X-Data-Timestamp': now,
            });
            res.end(altResult.body);
            return;
          }
        }
        // All retries exhausted – fall through and return the original 404
      }
    }

    // Cache successful responses
    if (result.statusCode === 200) {
      setCache(apiPath, result.body, 200);
    }

    res.writeHead(result.statusCode, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Cache': 'MISS',
      'X-Data-Timestamp': now,
    });
    res.end(result.body);
  } catch (err) {
    console.error(`[PROXY-ERROR] ${apiPath}: ${err.message}`);
    res.writeHead(502, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify({ error: 'Upstream error', message: err.message }));
  }
}

// ---------------------------------------------------------------------------
// Serve a static file from __dirname, or fall back to index.html (SPA).
// ---------------------------------------------------------------------------
function serveStatic(pathname, res) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  // Prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      // SPA fallback – serve index.html for any path that is not a real file
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (readErr, data) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache',
        });
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
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'max-age=3600',
      });
      res.end(data);
    });
  });
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsed.pathname;

  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API proxy: /api/tt/* -> Token Terminal API
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
      cache_entries: cache.size,
      uptime: uptimeSeconds,
    }));
    return;
  }

  // Debug endpoint: show raw field names from TT API /projects response
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
        var parsed = JSON.parse(result.body);
        var projects = Array.isArray(parsed) ? parsed : (parsed.data || parsed.projects || []);
        // Return first 3 projects with all field names visible
        var sample = projects.slice(0, 3);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          total_projects: projects.length,
          field_names: projects.length > 0 ? Object.keys(projects[0]) : [],
          sample: sample
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Token Terminal API: ${TT_API_KEY ? 'configured' : 'not configured (using mock data)'}`);
  console.log(`Open http://localhost:${PORT}`);
});
