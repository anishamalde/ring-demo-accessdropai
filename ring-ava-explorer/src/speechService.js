/**
 * speechService.js
 *
 * Browser-side TTS service using Amazon Polly via the proxy server.
 * Polly is the ONLY TTS provider — no Web Speech API fallback.
 * If Polly is unavailable, speak() resolves silently with a console warning.
 */

import { PROXY_URL as PROXY } from './env';

let audioContext = null;
let currentSource = null;
let speaking = false;

/**
 * Lazily initialise (or resume) the shared AudioContext.
 * Browsers require a user gesture before audio can play, so we
 * resume the context each time to handle that requirement.
 * @returns {AudioContext}
 */
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Speak the given text using Amazon Polly via the proxy TTS endpoint.
 *
 * Posts to /api/accessdrop/tts, receives an MP3 buffer, decodes it
 * with the Web Audio API, and plays it through the default output.
 *
 * @param {string} text    The text to speak.
 * @param {string} [voiceId] Optional Polly voice ID (defaults to server-side Joanna).
 * @returns {Promise<void>} Resolves when playback finishes (or immediately on failure).
 */
export async function speak(text, voiceId) {
  // Stop any in-progress playback first.
  stop();

  try {
    const body = { text };
    if (voiceId) body.voiceId = voiceId;

    const res = await fetch(`${PROXY}/api/accessdrop/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`[speechService] Polly TTS request failed (${res.status})`);
      return;
    }

    const arrayBuffer = await res.arrayBuffer();
    const ctx = getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // Create a buffer source and play it.
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    speaking = true;
    currentSource = source;

    return new Promise((resolve) => {
      source.onended = () => {
        speaking = false;
        currentSource = null;
        resolve();
      };
      source.start(0);
    });
  } catch (err) {
    // Silent no-op on any failure — just warn and move on.
    console.warn('[speechService] Polly TTS unavailable:', err.message || err);
    speaking = false;
    currentSource = null;
  }
}

/**
 * Stop any speech that is currently playing.
 */
export function stop() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      // Already stopped — ignore.
    }
    currentSource = null;
  }
  speaking = false;
}

/**
 * Whether the service is currently playing speech audio.
 * @returns {boolean}
 */
export function isSpeaking() {
  return speaking;
}
