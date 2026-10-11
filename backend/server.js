// Minimal Node.js HTTP API for The Host's full-stack sample. No dependencies.
// Routes keep their /api prefix (The Host routes /api to this service with the prefix preserved).
const http = require('node:http');
const port = Number(process.env.PORT || 8080);
const started = new Date().toISOString();

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (url.pathname === '/api/health') return json(200, { ok: true, started });
  if (url.pathname === '/api/hello') {
    // Reports whether a secret was delivered, never its value.
    return json(200, { message: 'hello from the backend', secretConfigured: Boolean(process.env.SAMPLE_SECRET), appUrl: process.env.APP_URL || null, time: new Date().toISOString() });
  }
  json(404, { error: 'not found', path: url.pathname });
}).listen(port, () => console.log(`sample api listening on ${port}`));
