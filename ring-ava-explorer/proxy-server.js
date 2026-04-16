import express from 'express';
import cors from 'cors';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { WebSocketServer } from 'ws';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from '@aws-sdk/client-transcribe-streaming';

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

// AccessDrop AI: Text-to-Speech via Amazon Polly
const pollyClient = new PollyClient({});

app.post('/api/accessdrop/tts', async (req, res) => {
  const { text, voiceId } = req.body || {};

  if (!text) {
    return res.status(400).json({ error: 'Missing required field', detail: '"text" is required' });
  }

  try {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voiceId || 'Joanna',
      Engine: 'neural',
    });

    const response = await pollyClient.send(command);
    const chunks = [];
    for await (const chunk of response.AudioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    console.error('Polly TTS error:', err.message);
    res.status(502).json({ error: 'Polly TTS failed', detail: err.message });
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

const server = app.listen(PORT, () => {
  console.log(`Ring AVA proxy running on http://localhost:${PORT}`);
  console.log(`  API proxy:   http://localhost:${PORT}/api/v1/...`);
  console.log(`  OAuth proxy: http://localhost:${PORT}/oauth/...`);
  console.log(`  Transcribe WS: ws://localhost:${PORT}/ws/transcribe`);
});

// --- WebSocket: /ws/transcribe ---
const wss = new WebSocketServer({ server, path: '/ws/transcribe' });

wss.on('connection', (ws) => {
  console.log('[transcribe] Client connected');

  const transcribeClient = new TranscribeStreamingClient({});

  // Collect incoming PCM chunks from the browser in a queue.
  // The async generator below yields them to the Transcribe SDK.
  const audioQueue = [];
  let audioResolve = null;
  let streamClosed = false;

  function pushAudio(chunk) {
    if (audioResolve) {
      const resolve = audioResolve;
      audioResolve = null;
      resolve(chunk);
    } else {
      audioQueue.push(chunk);
    }
  }

  function nextAudio() {
    if (audioQueue.length > 0) {
      return Promise.resolve(audioQueue.shift());
    }
    if (streamClosed) return Promise.resolve(null);
    return new Promise((resolve) => { audioResolve = resolve; });
  }

  async function* audioStream() {
    while (true) {
      const chunk = await nextAudio();
      if (chunk === null) return;
      yield { AudioEvent: { AudioChunk: chunk } };
    }
  }

  // Start the Transcribe streaming session.
  (async () => {
    try {
      const command = new StartStreamTranscriptionCommand({
        LanguageCode: 'en-US',
        MediaEncoding: 'pcm',
        MediaSampleRateHertz: 16000,
        AudioStream: audioStream(),
      });

      const response = await transcribeClient.send(command);

      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent) {
          const results = event.TranscriptEvent.Transcript?.Results || [];
          for (const result of results) {
            const alt = result.Alternatives?.[0];
            if (alt && alt.Transcript) {
              const msg = JSON.stringify({
                type: 'transcript',
                text: alt.Transcript,
                isFinal: !result.IsPartial,
                timestamp: Date.now(),
              });
              if (ws.readyState === ws.OPEN) ws.send(msg);
            }
          }
        }
      }
    } catch (err) {
      console.error('[transcribe] Transcribe error:', err.message);
      const errMsg = JSON.stringify({ type: 'error', message: err.message });
      if (ws.readyState === ws.OPEN) ws.send(errMsg);
    }
  })();

  ws.on('message', (data) => {
    // Binary PCM frames from the browser.
    if (data instanceof Buffer || data instanceof ArrayBuffer) {
      const buf = data instanceof ArrayBuffer ? Buffer.from(data) : data;
      pushAudio(new Uint8Array(buf));
    }
  });

  ws.on('close', () => {
    console.log('[transcribe] Client disconnected');
    streamClosed = true;
    // Unblock the generator if it's waiting.
    if (audioResolve) {
      audioResolve(null);
      audioResolve = null;
    }
  });

  ws.on('error', (err) => {
    console.error('[transcribe] WebSocket error:', err.message);
    streamClosed = true;
    if (audioResolve) {
      audioResolve(null);
      audioResolve = null;
    }
  });
});
