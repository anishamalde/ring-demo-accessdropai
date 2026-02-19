import { useState, useCallback, useRef } from 'react';
import { downloadMediaClip, startWhepSession, closeWhepSession } from './api';

export default function ClipDownloader({ deviceId, accessToken, onLog }) {
  const [downloading, setDownloading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordCountdown, setRecordCountdown] = useState(0);
  const [error, setError] = useState('');
  const [lastClip, setLastClip] = useState(null);

  // Form state
  const [minutesAgo, setMinutesAgo] = useState(1);
  const [duration, setDuration] = useState(5);
  const [codec, setCodec] = useState('avc');
  const [includeAudio, setIncludeAudio] = useState(false);
  const [recordDuration, setRecordDuration] = useState(10);

  const sessionUrlRef = useRef(null);
  const pcRef = useRef(null);

  const log = useCallback((msg) => onLog?.(`[Clip] ${msg}`), [onLog]);

  // Download an existing clip by timestamp
  const handleDownload = useCallback(async () => {
    setError('');
    setDownloading(true);
    setLastClip(null);

    const timestamp = Date.now() - minutesAgo * 60 * 1000;
    const durationMs = duration * 1000;

    log(`Requesting ${duration}s clip from ${minutesAgo}min ago (codec: ${codec}, audio: ${includeAudio})`);

    try {
      const result = await downloadMediaClip(deviceId, accessToken, {
        timestamp,
        duration: durationMs,
        codec,
        audioEnabled: includeAudio,
      });

      const url = URL.createObjectURL(result.blob);
      setLastClip({
        url,
        partial: result.partial,
        mediaTimestamp: result.mediaTimestamp,
        mediaLength: result.mediaLength,
        size: result.blob.size,
      });

      log(`Clip received: ${(result.blob.size / 1024).toFixed(1)}KB${result.partial ? ' (partial)' : ''}`);
    } catch (err) {
      setError(err.message);
      log(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }, [deviceId, accessToken, minutesAgo, duration, codec, includeAudio, log]);

  // Record then download: start a live stream to trigger recording, wait, then download
  const handleRecordAndDownload = useCallback(async () => {
    setError('');
    setRecording(true);
    setLastClip(null);

    const recordMs = recordDuration * 1000;
    const recordStart = Date.now();

    try {
      // Start a minimal WHEP session to trigger recording on the device
      log(`Starting ${recordDuration}s recording session...`);
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      if (pc.iceGatheringState !== 'complete') {
        await new Promise((resolve) => {
          const handler = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', handler);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', handler);
          setTimeout(resolve, 5000);
        });
      }

      const { sdpAnswer, location } = await startWhepSession(deviceId, pc.localDescription.sdp, accessToken);
      sessionUrlRef.current = location;
      log('Stream session started, device is recording...');

      const fixedSdp = sdpAnswer
        .replace(/a=recvonly/g, 'a=sendonly')
        .replace(/a=sendrecv/g, 'a=sendonly');
      await pc.setRemoteDescription({ type: 'answer', sdp: fixedSdp });

      // Countdown while recording
      for (let remaining = recordDuration; remaining > 0; remaining--) {
        setRecordCountdown(remaining);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setRecordCountdown(0);

      // Close the stream session
      log('Stopping recording session...');
      pc.close();
      pcRef.current = null;
      if (sessionUrlRef.current) {
        await closeWhepSession(sessionUrlRef.current, accessToken).catch(() => {});
        sessionUrlRef.current = null;
      }

      // Small buffer for the recording to be available
      log('Waiting for clip to become available...');
      await new Promise((r) => setTimeout(r, 3000));

      // Now download the clip from the recording window
      const clipTimestamp = recordStart;
      const clipDuration = Math.min(recordMs, Date.now() - recordStart);

      log(`Downloading ${(clipDuration / 1000).toFixed(0)}s clip...`);
      const result = await downloadMediaClip(deviceId, accessToken, {
        timestamp: clipTimestamp,
        duration: clipDuration,
        codec,
        audioEnabled: includeAudio,
      });

      const url = URL.createObjectURL(result.blob);
      setLastClip({
        url,
        partial: result.partial,
        mediaTimestamp: result.mediaTimestamp,
        mediaLength: result.mediaLength,
        size: result.blob.size,
      });

      log(`Clip received: ${(result.blob.size / 1024).toFixed(1)}KB${result.partial ? ' (partial)' : ''}`);
    } catch (err) {
      setError(err.message);
      log(`Record & download failed: ${err.message}`);
      // Cleanup on error
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (sessionUrlRef.current) {
        await closeWhepSession(sessionUrlRef.current, accessToken).catch(() => {});
        sessionUrlRef.current = null;
      }
    } finally {
      setRecording(false);
      setRecordCountdown(0);
    }
  }, [deviceId, accessToken, recordDuration, codec, includeAudio, log]);

  const handleSave = useCallback(() => {
    if (!lastClip) return;
    const a = document.createElement('a');
    a.href = lastClip.url;
    a.download = `ring-clip-${deviceId.slice(0, 8)}-${Date.now()}.mp4`;
    a.click();
    log('Clip saved to downloads');
  }, [lastClip, deviceId, log]);

  const busy = downloading || recording;

  return (
    <div className="clip-downloader">
      <h3>Video Clip Download</h3>

      <p className="clip-hint">
        Clips can only be downloaded from times when the camera was actively recording (live stream or motion event).
      </p>

      {/* Record & Download */}
      <div className="clip-section">
        <h4>Record & Download</h4>
        <p className="clip-description">Starts a live stream to trigger recording, then downloads the clip.</p>
        <div className="clip-form-row">
          <label>
            Record for (seconds)
            <input
              type="number"
              min={5}
              max={120}
              value={recordDuration}
              onChange={(e) => setRecordDuration(Number(e.target.value))}
            />
          </label>
          <label>
            Codec
            <select value={codec} onChange={(e) => setCodec(e.target.value)}>
              <option value="avc">AVC (H.264)</option>
              <option value="hevc">HEVC (H.265)</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} />
            Include audio
          </label>
        </div>
        <button className="btn-download" onClick={handleRecordAndDownload} disabled={busy}>
          {recording ? `🔴 Recording... ${recordCountdown}s` : '🎬 Record & Download'}
        </button>
      </div>

      {/* Download existing clip */}
      <div className="clip-section">
        <h4>Download Existing Clip</h4>
        <p className="clip-description">Download from a time when the camera was already recording.</p>
        <div className="clip-form-row">
          <label>
            Minutes ago
            <input type="number" min={1} max={60} value={minutesAgo} onChange={(e) => setMinutesAgo(Number(e.target.value))} />
          </label>
          <label>
            Duration (seconds)
            <input type="number" min={1} max={900} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </label>
        </div>
        <button className="btn-download" onClick={handleDownload} disabled={busy}>
          {downloading ? '⏳ Downloading...' : '📥 Download Clip'}
        </button>
      </div>

      {error && <div className="stream-error">{error}</div>}

      {lastClip && (
        <div className="clip-result">
          {lastClip.partial && (
            <div className="clip-warning">Partial content returned. The full duration may not have been available.</div>
          )}
          <div className="clip-meta">
            Size: {(lastClip.size / 1024).toFixed(1)} KB
            {lastClip.mediaLength && ` · Duration: ${(Number(lastClip.mediaLength) / 1000).toFixed(1)}s`}
          </div>
          <video src={lastClip.url} controls className="clip-video" />
          <button className="btn-save" onClick={handleSave}>💾 Save to Downloads</button>
        </div>
      )}
    </div>
  );
}
