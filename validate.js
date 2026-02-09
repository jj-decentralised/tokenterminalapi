#!/usr/bin/env node
// =============================================================================
// validate.js — Pre-push code validation
// =============================================================================
// Run before every push to catch integration bugs early.
// Usage: node validate.js
// Exit code 0 = all checks pass, 1 = failures found
// =============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
let errors = 0;
let warnings = 0;

function error(msg) { console.error(`  \x1b[31mERROR\x1b[0m ${msg}`); errors++; }
function warn(msg)  { console.warn(`  \x1b[33mWARN\x1b[0m  ${msg}`); warnings++; }
function ok(msg)    { console.log(`  \x1b[32mOK\x1b[0m    ${msg}`); }
function section(title) { console.log(`\n\x1b[36m[${title}]\x1b[0m`); }

// ---------------------------------------------------------------------------
// 1. SYNTAX CHECK — all .js files
// ---------------------------------------------------------------------------
function checkSyntax() {
  section('Syntax Check');
  const jsFiles = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.js') && f !== 'validate.js')
    .filter(f => {
      const stat = fs.statSync(path.join(ROOT, f));
      return stat.isFile();
    });

  let passed = 0;
  for (const file of jsFiles) {
    try {
      execSync(`node -c "${path.join(ROOT, file)}"`, { stdio: 'pipe' });
      passed++;
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString().trim() : e.message;
      error(`${file}: Syntax error\n         ${stderr}`);
    }
  }
  ok(`${passed}/${jsFiles.length} JS files have valid syntax`);
}

// ---------------------------------------------------------------------------
// 2. HTML/JS DOM ID CROSS-CHECK
// ---------------------------------------------------------------------------
function checkDomIds() {
  section('DOM ID Cross-Check');

  const htmlPath = path.join(ROOT, 'index.html');
  if (!fs.existsSync(htmlPath)) { warn('index.html not found, skipping'); return; }

  const html = fs.readFileSync(htmlPath, 'utf8');

  // Extract all id="..." from HTML
  const htmlIds = new Set();
  const idRegex = /\bid=["']([^"']+)["']/g;
  let match;
  while ((match = idRegex.exec(html)) !== null) {
    htmlIds.add(match[1]);
  }

  // Find all getElementById('...') calls in JS files
  const jsFiles = ['app.js', 'charts.js', 'filters.js', 'data.js', 'utils.js']
    .filter(f => fs.existsSync(path.join(ROOT, f)));

  const jsIdRefs = new Map(); // id -> [file:line, ...]
  for (const file of jsFiles) {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const getByIdRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
      let m;
      while ((m = getByIdRegex.exec(line)) !== null) {
        const id = m[1];
        if (!jsIdRefs.has(id)) jsIdRefs.set(id, []);
        jsIdRefs.get(id).push(`${file}:${i + 1}`);
      }
    });
  }

  // Check: JS references an ID not in HTML
  let missingCount = 0;
  for (const [id, refs] of jsIdRefs) {
    if (!htmlIds.has(id)) {
      // Skip dynamically created IDs (common patterns)
      if (id.includes('${') || id.match(/^(chart-|tab-|modal-)/)) continue;
      error(`DOM ID "${id}" referenced in JS but not found in HTML: ${refs.join(', ')}`);
      missingCount++;
    }
  }
  if (missingCount === 0) ok(`All JS getElementById references found in HTML (${jsIdRefs.size} IDs checked)`);
}

// ---------------------------------------------------------------------------
// 3. SQL SCHEMA — Foreign key dependency ordering
// ---------------------------------------------------------------------------
function checkSchemaOrder() {
  section('Schema FK Ordering');

  const schemaPath = path.join(ROOT, 'schema.sql');
  if (!fs.existsSync(schemaPath)) { warn('schema.sql not found, skipping'); return; }

  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Extract CREATE TABLE order
  const tableOrder = [];
  const createRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/gi;
  let match;
  while ((match = createRegex.exec(sql)) !== null) {
    tableOrder.push(match[1].toLowerCase());
  }

  // Extract REFERENCES
  const refRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)[\s\S]*?(?=CREATE TABLE|$)/gi;
  let tableMatch;
  let fkErrors = 0;
  while ((tableMatch = refRegex.exec(sql)) !== null) {
    const tableName = tableMatch[1].toLowerCase();
    const tableBody = tableMatch[0];
    const fkRefRegex = /REFERENCES\s+(\w+)/gi;
    let fkMatch;
    while ((fkMatch = fkRefRegex.exec(tableBody)) !== null) {
      const refTable = fkMatch[1].toLowerCase();
      if (refTable === tableName) continue; // self-reference is fine
      const tableIdx = tableOrder.indexOf(tableName);
      const refIdx = tableOrder.indexOf(refTable);
      if (refIdx < 0) {
        error(`Table "${tableName}" references "${refTable}" which is not defined in schema`);
        fkErrors++;
      } else if (refIdx > tableIdx) {
        error(`Table "${tableName}" (position ${tableIdx}) references "${refTable}" (position ${refIdx}) — referenced table must come first`);
        fkErrors++;
      }
    }
  }
  if (fkErrors === 0) ok(`All FK references point to previously-defined tables (${tableOrder.length} tables)`);
}

// ---------------------------------------------------------------------------
// 4. SQL COMMENT FILTER — ensure init-db.js correctly parses schema.sql
// ---------------------------------------------------------------------------
function checkSqlParsing() {
  section('SQL Statement Parsing');

  const schemaPath = path.join(ROOT, 'schema.sql');
  const initPath = path.join(ROOT, 'init-db.js');
  if (!fs.existsSync(schemaPath) || !fs.existsSync(initPath)) {
    warn('schema.sql or init-db.js not found, skipping');
    return;
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Simulate the statement splitting logic from init-db.js
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => {
      const stripped = s.split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n').trim();
      return stripped.length > 0;
    });

  // Count expected CREATE TABLE statements
  const expectedTables = (sql.match(/CREATE TABLE/gi) || []).length;
  const foundTables = statements.filter(s => /CREATE TABLE/i.test(s)).length;

  if (foundTables < expectedTables) {
    error(`SQL parser finds ${foundTables} CREATE TABLE statements but schema has ${expectedTables} — statement filter is dropping some`);
  } else {
    ok(`SQL parser correctly finds all ${foundTables} CREATE TABLE statements out of ${statements.length} total statements`);
  }

  // Check for any statement that is ONLY comments (no actual SQL)
  for (const stmt of statements) {
    const stripped = stmt.split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n').trim();
    if (stripped.length === 0) {
      warn('Found a statement chunk with only SQL comments and no actual SQL');
    }
  }
}

// ---------------------------------------------------------------------------
// 5. SERVER.JS INTEGRATION — check require() targets exist
// ---------------------------------------------------------------------------
function checkRequires() {
  section('Module Dependencies');

  const serverFiles = ['server.js', 'init-db.js', 'sync.js', 'db.js']
    .filter(f => fs.existsSync(path.join(ROOT, f)));

  let checked = 0;
  for (const file of serverFiles) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const requireRegex = /require\(['"]\.\/([^'"]+)['"]\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      const target = match[1].endsWith('.js') ? match[1] : match[1] + '.js';
      if (!fs.existsSync(path.join(ROOT, target))) {
        error(`${file}: requires './${match[1]}' but ${target} not found`);
      }
      checked++;
    }
  }
  ok(`${checked} local require() targets verified`);
}

// ---------------------------------------------------------------------------
// 6. RATE LIMIT SANITY — check batch settings won't exceed TT API limits
// ---------------------------------------------------------------------------
function checkRateLimits() {
  section('Rate Limit Settings');

  const files = ['server.js', 'sync.js'].filter(f => fs.existsSync(path.join(ROOT, f)));

  for (const file of files) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const batchSizeMatch = content.match(/BATCH_SIZE\s*=\s*(\d+)/);
    const batchDelayMatch = content.match(/BATCH_DELAY\s*=\s*(\d+)/);

    if (batchSizeMatch && batchDelayMatch) {
      const size = parseInt(batchSizeMatch[1]);
      const delay = parseInt(batchDelayMatch[1]);
      const reqPerMin = (size / (delay / 1000)) * 60;

      if (reqPerMin > 200) {
        error(`${file}: BATCH_SIZE=${size}, BATCH_DELAY=${delay}ms → ~${Math.round(reqPerMin)} req/min (too aggressive for TT API)`);
      } else if (reqPerMin > 100) {
        warn(`${file}: BATCH_SIZE=${size}, BATCH_DELAY=${delay}ms → ~${Math.round(reqPerMin)} req/min (moderate — watch for 429s)`);
      } else {
        ok(`${file}: BATCH_SIZE=${size}, BATCH_DELAY=${delay}ms → ~${Math.round(reqPerMin)} req/min (safe)`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 7. PACKAGE.JSON — check dependencies exist in node_modules
// ---------------------------------------------------------------------------
function checkDependencies() {
  section('Dependencies');

  const pkgPath = path.join(ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) { warn('package.json not found, skipping'); return; }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});

  let missing = 0;
  for (const dep of deps) {
    if (!fs.existsSync(path.join(ROOT, 'node_modules', dep))) {
      error(`Dependency "${dep}" not installed — run npm install`);
      missing++;
    }
  }
  if (missing === 0) ok(`All ${deps.length} dependencies installed`);
}

// ---------------------------------------------------------------------------
// 8. SCRIPT LOAD ORDER — check index.html loads scripts in correct order
// ---------------------------------------------------------------------------
function checkScriptOrder() {
  section('Script Load Order');

  const htmlPath = path.join(ROOT, 'index.html');
  if (!fs.existsSync(htmlPath)) { warn('index.html not found, skipping'); return; }

  const html = fs.readFileSync(htmlPath, 'utf8');

  // Expected order: utils.js before data.js, data.js before filters.js, etc.
  const expectedOrder = ['utils.js', 'data.js', 'filters.js', 'charts.js', 'app.js'];
  const scriptRegex = /src=["']([^"']+\.js)["']/g;
  const loadedScripts = [];
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    loadedScripts.push(match[1]);
  }

  let lastIdx = -1;
  let orderOk = true;
  for (const expected of expectedOrder) {
    const idx = loadedScripts.indexOf(expected);
    if (idx < 0) {
      warn(`${expected} not found in index.html script tags`);
      orderOk = false;
    } else if (idx < lastIdx) {
      error(`${expected} loaded out of order in index.html (expected after ${expectedOrder[expectedOrder.indexOf(expected) - 1]})`);
      orderOk = false;
    } else {
      lastIdx = idx;
    }
  }
  if (orderOk) ok(`Script load order correct: ${expectedOrder.join(' -> ')}`);
}

// ---------------------------------------------------------------------------
// RUN ALL CHECKS
// ---------------------------------------------------------------------------
console.log('\x1b[1m=== Token Terminal Pre-Push Validation ===\x1b[0m');

checkSyntax();
checkDomIds();
checkSchemaOrder();
checkSqlParsing();
checkRequires();
checkRateLimits();
checkDependencies();
checkScriptOrder();

// Summary
console.log('\n\x1b[1m=== Summary ===\x1b[0m');
if (errors > 0) {
  console.log(`\x1b[31m  ${errors} error(s), ${warnings} warning(s) — FIX BEFORE PUSHING\x1b[0m`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`\x1b[33m  0 errors, ${warnings} warning(s) — OK to push\x1b[0m`);
  process.exit(0);
} else {
  console.log(`\x1b[32m  All checks passed!\x1b[0m`);
  process.exit(0);
}
