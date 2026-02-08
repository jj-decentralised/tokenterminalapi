const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3000;
const TT_API_KEY = process.env.TT_API_KEY || '';
const TT_BASE = 'https://api.tokenterminal.com/v2';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Simple in-memory cache: key -> { data, timestamp }
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Proxy a request to Token Terminal API
function proxyTT(apiPath, res) {
  if (!TT_API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'TT_API_KEY not configured. Using mock data.' }));
    return;
  }

  const cached = getCached(apiPath);
  if (cached) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
    res.end(cached);
    return;
  }

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
    upstream.on('end', () => {
      if (upstream.statusCode === 200) {
        setCache(apiPath, body);
      }
      res.writeHead(upstream.statusCode, {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
      });
      res.end(body);
    });
  });

  req.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upstream error', message: err.message }));
  });

  req.end();
}

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsed.pathname;

  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // API proxy: /api/tt/* -> Token Terminal API
  if (pathname.startsWith('/api/tt/')) {
    const apiPath = pathname.replace('/api/tt', '') + parsed.search;
    proxyTT(apiPath, res);
    return;
  }

  // Health check for Railway
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', api_configured: !!TT_API_KEY }));
    return;
  }

  // Static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  // Prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Token Terminal API: ${TT_API_KEY ? 'configured' : 'not configured (using mock data)'}`);
  console.log(`Open http://localhost:${PORT}`);
});
