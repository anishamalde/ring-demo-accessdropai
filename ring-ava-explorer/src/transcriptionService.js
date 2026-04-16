/**
 * transcriptionService.js
 *
 * Browser-side transcription service that extracts PCM audio from a
 * MediaStreamTrack, streams it over WebSocket to the proxy server,
 * and relays Amazon Transcribe results back to the caller.
 *
 * The proxy WebSocket at /ws/transcribe accepts binary PCM frames and
 * returns JSON messages:
 *   { type: 'transcript', text, isFinal, timestamp }
 *   { type: 'error', message }
 */

const WS_URL = 'ws://localhost:3001/ws/transcribe';

// PCM capture settings — 16 kHz mono is what Amazon Transcribe expects.
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

let ws = null;
let audioContext = null;
let sourceNode = null;
let processorNode = null;

/**
 * Downsample a Float32Array from the source sample rate to the target rate.
 * Returns an Int16Array of PCM samples suitable for Transcribe.
 *
 * @param {Float32Array} buffer   Raw samples from the ScriptProcessorNode.
 * @param {number}       srcRate  The AudioContext's native sample rate.
 * @param {number}       dstRate  Desired output sample rate (16 000).
 * @returns {Int16Array}
 */
function downsampleToInt16(buffer, srcRate, dstRate) {
  if (srcRate === dstRate) {
    const out = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  const ratio = srcRate / dstRate;
  const length = Math.round(buffer.length / ratio);
  const out = new Int16Array(length);

  for (let i = 0; i < length; i++) {
    const idx = Math.round(i * ratio);
    const s = Math.max(-1, Math.min(1, buffer[idx]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  return out;
}

/**
 * Start transcribing audio from the given MediaStreamTrack.
 *
 * Opens a WebSocket to the proxy, hooks up an AudioContext +
 * ScriptProcessorNode to capture PCM samples from the track,
 * and forwards them as binary frames. Incoming transcript results
 * are parsed and delivered via the onMessage callback.
 *
 * @param {MediaStreamTrack} audioTrack  An audio track (e.g. from WHEP stream).
 * @param {function} onMessage           Called with { text: string, isFinal: boolean, timestamp: number }.
 * @param {function} onError             Called with an Error when the WebSocket fails.
 */
export function startTranscription(audioTrack, onMessage, onError) {
  // Clean up any previous session.
  stopTranscription();

  try {
    // --- WebSocket setup ---
    ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'error') {
          console.warn('[transcriptionService] Server error:', data.message);
          if (onError) onError(new Error(data.message));
          return;
        }

        if (data.type === 'transcript' && onMessage) {
          onMessage({
            text: data.text,
            isFinal: data.isFinal,
            timestamp: data.timestamp,
          });
        }
      } catch (parseErr) {
        console.warn('[transcriptionService] Failed to parse message:', parseErr);
      }
    };

    ws.onerror = (event) => {
      console.warn('[transcriptionService] WebSocket error:', event);
      if (onError) onError(new Error('WebSocket connection error'));
    };

    ws.onclose = (event) => {
      if (!event.wasClean) {
        console.warn('[transcriptionService] WebSocket closed unexpectedly:', event.code);
        if (onError) onError(new Error(`WebSocket closed unexpectedly (code ${event.code})`));
      }
    };

    // --- Audio capture setup ---
    const stream = new MediaStream([audioTrack]);
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: SAMPLE_RATE,
    });
    sourceNode = audioContext.createMediaStreamSource(stream);

    // ScriptProcessorNode captures raw PCM samples.
    // (Deprecated but widely supported; AudioWorklet would be the modern alternative.)
    processorNode = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    processorNode.onaudioprocess = (e) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = downsampleToInt16(inputData, audioContext.sampleRate, SAMPLE_RATE);

      ws.send(pcm16.buffer);
    };

    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);
  } catch (err) {
    console.warn('[transcriptionService] Failed to start:', err);
    if (onError) onError(err);
  }
}

/**
 * Stop the current transcription session.
 * Closes the WebSocket and tears down audio processing nodes.
 */
export function stopTranscription() {
  if (processorNode) {
    try {
      processorNode.disconnect();
    } catch { /* already disconnected */ }
    processorNode.onaudioprocess = null;
    processorNode = null;
  }

  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch { /* already disconnected */ }
    sourceNode = null;
  }

  if (audioContext) {
    try {
      audioContext.close();
    } catch { /* already closed */ }
    audioContext = null;
  }

  if (ws) {
    try {
      ws.close();
    } catch { /* already closed */ }
    ws = null;
  }
}
