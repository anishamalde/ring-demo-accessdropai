import { useState, useRef, useCallback, useEffect } from 'react';
import { startWhepSession, closeWhepSession } from './api';

export default function LiveStream({ deviceId, accessToken, onLog }) {
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | live | error
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const sessionUrlRef = useRef(null);

  const log = useCallback((msg) => onLog?.(msg), [onLog]);

  const startStream = useCallback(async () => {
    setErrorMsg('');
    setStatus('connecting');
    log('Starting WHEP session for device...');

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        log(`Track received: ${event.track.kind}`);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          log(`Local ICE: ${event.candidate.type} ${event.candidate.protocol} ${event.candidate.address || ''}:${event.candidate.port || ''}`);
        }
      };

      pc.oniceconnectionstatechange = () => log(`ICE: ${pc.iceConnectionState}`);
      pc.onconnectionstatechange = () => {
        log(`Connection: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') setStatus('live');
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setStatus('error');
          setErrorMsg(`WebRTC ${pc.connectionState}. Check request log for ICE details.`);
        }
      };

      // Create and set local offer
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

      const sdpOffer = pc.localDescription.sdp;
      log(`SDP offer created (${sdpOffer.length} bytes)`);

      // POST to Ring WHEP endpoint
      log(`POST /v1/devices/${deviceId}/media/streaming/whep/sessions`);
      const { sdpAnswer, location } = await startWhepSession(deviceId, sdpOffer, accessToken);
      sessionUrlRef.current = location;
      log(`WHEP session created. Location: ${location}`);

      // Log remote ICE candidates
      const remoteCandidates = (sdpAnswer.match(/a=candidate:.+/g) || []);
      log(`Remote ICE candidates: ${remoteCandidates.length}`);
      remoteCandidates.forEach((c) => log(`  ICE: ${c.slice(0, 80)}...`));

      // Fix SDP direction and apply answer on the same PC
      const fixedSdp = sdpAnswer
        .replace(/a=recvonly/g, 'a=sendonly')
        .replace(/a=sendrecv/g, 'a=sendonly');

      await pc.setRemoteDescription({ type: 'answer', sdp: fixedSdp });
      log('SDP answer applied');

      setStreaming(true);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
      log(`Stream error: ${err.message}`);
      cleanup();
    }
  }, [deviceId, accessToken, log]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopStream = useCallback(async () => {
    log('Stopping stream...');
    try {
      // Close the WebRTC connection
      cleanup();

      // DELETE the WHEP session on Ring's side
      if (sessionUrlRef.current) {
        log(`DELETE ${sessionUrlRef.current}`);
        await closeWhepSession(sessionUrlRef.current, accessToken);
        sessionUrlRef.current = null;
        log('WHEP session closed');
      }
    } catch (err) {
      log(`Error closing session: ${err.message}`);
    }
    setStreaming(false);
    setStatus('idle');
  }, [accessToken, log, cleanup]);

  // Cleanup on unmount or device change
  useEffect(() => {
    return () => {
      if (streaming) {
        cleanup();
        if (sessionUrlRef.current) {
          closeWhepSession(sessionUrlRef.current, accessToken).catch(() => {});
          sessionUrlRef.current = null;
        }
      }
    };
  }, [deviceId]);

  return (
    <div className="live-stream">
      <div className="stream-header">
        <h3>Live Stream</h3>
        <span className={`stream-status ${status}`}>
          {status === 'idle' && '⏹ Stopped'}
          {status === 'connecting' && '⏳ Connecting...'}
          {status === 'live' && '🔴 Live'}
          {status === 'error' && '⚠ Error'}
        </span>
      </div>

      <div className="video-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="stream-video"
        />
        {status === 'idle' && !streaming && (
          <div className="video-placeholder">Click Play to start live stream</div>
        )}
      </div>

      <div className="stream-controls">
        {!streaming ? (
          <button className="btn-play" onClick={startStream} disabled={status === 'connecting'}>
            ▶ Play
          </button>
        ) : (
          <button className="btn-stop" onClick={stopStream}>
            ⏹ Stop
          </button>
        )}
      </div>

      {errorMsg && <div className="stream-error">{errorMsg}</div>}
    </div>
  );
}
