// Minimal Node.js HTTP API for The Host's full-stack sample. Only dependency: pg (used when a database exists).
// Routes keep their /api prefix (The Host routes /api to this service with the prefix preserved).
const http = require('node:http');
const crypto = require('node:crypto');
const { version } = require('./version.json'); // changed between deployments to tell versions apart
const port = Number(process.env.PORT || 8080);
const started = new Date().toISOString();

/** Path-style S3 request to the project's Spaces bucket, signed with SigV4 (no SDK needed). */
async function s3(method, key, body = '', bucket = process.env.SPACES_BUCKET) {
  const ep = new URL(process.env.SPACES_ENDPOINT);
  const region = 'us-east-1';
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''), date = amz.slice(0, 8);
  const sha = d => crypto.createHash('sha256').update(d).digest('hex');
  const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
  const payload = sha(body);
  const path = '/' + bucket + '/' + key.split('/').map(encodeURIComponent).join('/');
  const headers = { host: ep.host, 'x-amz-content-sha256': payload, 'x-amz-date': amz };
  const signed = Object.keys(headers).sort();
  const canonical = [method, path, '', signed.map(h => h + ':' + headers[h] + '\n').join(''), signed.join(';'), payload].join('\n');
  const scope = date + '/' + region + '/s3/aws4_request';
  const sig = crypto.createHmac('sha256', hmac(hmac(hmac(hmac('AWS4' + process.env.SPACES_SECRET, date), region), 's3'), 'aws4_request'))
    .update(['AWS4-HMAC-SHA256', amz, scope, sha(canonical)].join('\n')).digest('hex');
  const res = await fetch(ep.origin + path, { method, body: body || undefined, headers: { ...headers, authorization: 'AWS4-HMAC-SHA256 Credential=' + process.env.SPACES_KEY + '/' + scope + ', SignedHeaders=' + signed.join(';') + ', Signature=' + sig } });
  return { status: res.status, text: await res.text() };
}

/** Writes (mode=write) or reads back a value in the database and the bucket; reports results, never credentials. */
async function dataCheck(q) {
  const nonce = String(q.get('nonce') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
  const write = q.get('mode') === 'write';
  const out = { version };
  if (process.env.DATABASE_URL) {
    const { Client } = require('pg');
    const u = new URL(process.env.DATABASE_URL);
    u.searchParams.delete('sslmode'); // TLS is configured below, verified against the cluster CA when provided
    const c = new Client({ connectionString: u.toString(), ssl: process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT } : { rejectUnauthorized: false } });
    await c.connect();
    try {
      await c.query('CREATE TABLE IF NOT EXISTS th_check (k text PRIMARY KEY, v text NOT NULL)');
      if (write) await c.query("INSERT INTO th_check (k, v) VALUES ('nonce', $1) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v", [nonce]);
      out.db = { tls: process.env.DATABASE_CA_CERT ? 'verified' : 'unverified', value: (await c.query("SELECT v FROM th_check WHERE k = 'nonce'")).rows[0]?.v ?? null };
    } finally { await c.end(); }
  }
  if (process.env.SPACES_BUCKET) {
    if (write) out.storagePut = (await s3('PUT', 'check/nonce.txt', nonce)).status;
    const got = await s3('GET', 'check/nonce.txt');
    out.storage = { status: got.status, value: got.status === 200 ? got.text : null };
    // The key is scoped to this project's bucket: writing anywhere else must be refused.
    out.otherBucketStatus = (await s3('PUT', 'probe.txt', 'x', 'th-' + '0'.repeat(32))).status;
  }
  return out;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/api/health') return json(200, { ok: true, started, version });
  if (url.pathname === '/api/version') return json(200, { version, started });
  if (url.pathname === '/api/hello') {
    // Reports whether a secret was delivered, never its value.
    return json(200, { message: 'hello from the backend', version, secretConfigured: Boolean(process.env.SAMPLE_SECRET), appUrl: process.env.APP_URL || null, time: new Date().toISOString() });
  }
  if (url.pathname === '/api/data-check') { dataCheck(url.searchParams).then(r => json(200, r), e => json(500, { error: e.message })); return; }
  json(404, { error: 'not found', path: url.pathname });
}).listen(port, () => console.log(`sample api ${version} listening on ${port}`));
