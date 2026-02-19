// Ring AVA API client
// All requests go through the local proxy to avoid CORS issues.

const PROXY = 'http://localhost:3001';

export async function refreshToken(refreshToken, clientId, clientSecret) {
  const res = await fetch(`${PROXY}/oauth/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return res.json();
}

async function ringGet(path, accessToken) {
  const res = await fetch(`${PROXY}/api${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getDevices(accessToken) {
  return ringGet('/v1/devices?include=status', accessToken);
}

export async function getDeviceStatus(deviceId, accessToken) {
  return ringGet(`/v1/devices/${deviceId}/status`, accessToken);
}

export async function getDeviceCapabilities(deviceId, accessToken) {
  return ringGet(`/v1/devices/${deviceId}/capabilities`, accessToken);
}

export async function getDeviceLocation(deviceId, accessToken) {
  return ringGet(`/v1/devices/${deviceId}/location`, accessToken);
}

export async function getDeviceConfigurations(deviceId, accessToken) {
  return ringGet(`/v1/devices/${deviceId}/configurations`, accessToken);
}

// WHEP Live Streaming

export async function startWhepSession(deviceId, sdpOffer, accessToken) {
  const res = await fetch(`${PROXY}/api/v1/devices/${deviceId}/media/streaming/whep/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/sdp',
    },
    body: sdpOffer,
  });
  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`WHEP session failed (${res.status}): ${text}`);
  }
  const sdpAnswer = await res.text();
  const location = res.headers.get('location') || '';
  return { sdpAnswer, location };
}

export async function closeWhepSession(sessionUrl, accessToken) {
  // sessionUrl is the full URL from the Location header.
  // Route it through our proxy by replacing the Ring base with /api.
  const proxyPath = sessionUrl.replace('https://api.amazonvision.com', `${PROXY}/api`);
  const res = await fetch(proxyPath, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Close session failed (${res.status}): ${text}`);
  }
}

// Media Clip Download (MP4)

export async function downloadMediaClip(deviceId, accessToken, options = {}) {
  const { timestamp, duration = 5000, codec, frameRate, width, height, audioEnabled = false } = options;

  const body = { timestamp, duration };
  if (codec || frameRate || width || height) {
    body.video_options = {};
    if (codec) body.video_options.codec = codec;
    if (frameRate) body.video_options.frame_rate = frameRate;
    if (width && height) body.video_options.resolution = { width, height };
  }
  if (audioEnabled) {
    body.audio_options = { audio_enabled: true };
  }

  const res = await fetch(`${PROXY}/api/v1/devices/${deviceId}/media/video/download`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 206) {
    const text = await res.text();
    throw new Error(`Download failed (${res.status}): ${text}`);
  }

  const blob = await res.blob();
  const mediaTimestamp = res.headers.get('x-media-timestamp');
  const mediaLength = res.headers.get('x-media-length');

  return {
    blob,
    partial: res.status === 206,
    mediaTimestamp,
    mediaLength,
    contentType: res.headers.get('content-type'),
  };
}

