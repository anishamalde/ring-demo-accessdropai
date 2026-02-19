import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

const RING_API = 'https://api.amazonvision.com';
const RING_OAUTH = 'https://oauth.ring.com';

app.use(cors({ exposedHeaders: ['location', 'x-media-timestamp', 'x-media-length'] }));
app.use(express.urlencoded({ extended: true }));

// Parse JSON for most routes, but leave WHEP/SDP routes as raw text
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/sdp')) {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => { req.body = body; next(); });
  } else {
    express.json()(req, res, next);
  }
});

// Proxy Ring API requests: /api/v1/* -> https://api.amazonvision.com/v1/*
app.all('/api/*', async (req, res) => {
  const path = req.originalUrl.replace(/^\/api/, '');
  const url = `${RING_API}${path}`;
  const reqContentType = req.headers['content-type'] || '';

  try {
    const headers = {};
    if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];

    const fetchOptions = { method: req.method, headers };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (reqContentType.includes('application/sdp')) {
        // WHEP: pass raw SDP body
        headers['content-type'] = 'application/sdp';
        fetchOptions.body = req.body;
      } else {
        headers['content-type'] = 'application/json';
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    const response = await fetch(url, fetchOptions);
    const resContentType = response.headers.get('content-type') || '';

    res.status(response.status);
    // Forward important headers
    for (const header of ['content-type', 'location', 'x-media-timestamp', 'x-media-length']) {
      const val = response.headers.get(header);
      if (val) res.setHeader(header, val);
    }

    if (resContentType.includes('video/') || resContentType.includes('application/octet-stream')) {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (err) {
    console.error(`Proxy error: ${req.method} ${url}`, err.message);
    res.status(502).json({ error: 'Proxy error', detail: err.message });
  }
});

// Proxy OAuth requests: /oauth/* -> https://oauth.ring.com/*
app.all('/oauth/*', async (req, res) => {
  const path = req.originalUrl.replace(/^\/oauth/, '');
  const url = `${RING_OAUTH}${path}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = new URLSearchParams(req.body).toString();
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.text();
    res.status(response.status);
    for (const [key, value] of response.headers.entries()) {
      if (!['transfer-encoding', 'content-encoding', 'connection'].includes(key)) {
        res.setHeader(key, value);
      }
    }
    res.send(data);
  } catch (err) {
    console.error(`OAuth proxy error: ${req.method} ${url}`, err.message);
    res.status(502).json({ error: 'OAuth proxy error', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ring AVA proxy running on http://localhost:${PORT}`);
  console.log(`  API proxy:   http://localhost:${PORT}/api/v1/...`);
  console.log(`  OAuth proxy: http://localhost:${PORT}/oauth/...`);
});
