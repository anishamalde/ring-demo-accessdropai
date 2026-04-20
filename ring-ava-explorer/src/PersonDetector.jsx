import { useState, useRef, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { startWhepSession, closeWhepSession } from './api';

const DETECT_INTERVAL_MS = 3000; // run detection every 3 seconds (reduces main thread load)
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

export default function PersonDetector({ deviceId, accessToken, onLog, onPersonDetected, onStatusChange, onAudioTrack }) {
  const [model, setModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState('idle');
  const [personCount, setPersonCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectCanvasRef = useRef(null);
  const pcRef = useRef(null);
  const sessionUrlRef = useRef(null);
  const detectIntervalRef = useRef(null);
  const prevCountRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const unmountedRef = useRef(false);

  const log = useCallback((msg) => onLog?.(`[Detector] ${msg}`), [onLog]);

  // Load COCO-SSD model
  const loadModel = useCallback(async () => {
    if (model) return model;
    setModelLoading(true);
    log('Loading COCO-SSD model...');
    try {
      await tf.ready();
      log(`TensorFlow.js backend: ${tf.getBackend()}`);
      const loaded = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      setModel(loaded);
      log('COCO-SSD model loaded');
      return loaded;
    } catch (err) {
      log(`Model load failed: ${err.message}`);
      throw err;
    } finally {
      setModelLoading(false);
    }
  }, [model, log]);

  // Clean up existing peer connection without resetting UI state
  const cleanupConnection = useCallback(async () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (sessionUrlRef.current) {
      await closeWhepSession(sessionUrlRef.current, accessToken).catch(() => {});
      sessionUrlRef.current = null;
    }
  }, [accessToken]);

  // Start WHEP stream
  const startStream = useCallback(async () => {
    setErrorMsg('');
    setStatus('connecting');
    onStatusChange?.('connecting');
    log('Starting WHEP stream...');

    try {
      // Clean up any previous connection first
      await cleanupConnection();

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
        if (event.track.kind === 'audio') {
          onAudioTrack?.(event.track);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          log(`Local ICE: ${event.candidate.type} ${event.candidate.protocol} ${event.candidate.address || ''}:${event.candidate.port || ''}`);
        }
      };
      pc.oniceconnectionstatechange = () => {
        log(`ICE: ${pc.iceConnectionState}`);
      };
      pc.onconnectionstatechange = () => {
        log(`Connection: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
          setStatus('live');
          onStatusChange?.('live');
          setErrorMsg('');
          reconnectAttemptRef.current = 0; // reset on success
        }
        if (pc.connectionState === 'failed') {
          log('WebRTC connection failed, will attempt reconnect...');
          handleReconnect();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering (with longer timeout)
      if (pc.iceGatheringState !== 'complete') {
        await new Promise((resolve) => {
          const handler = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', handler);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', handler);
          setTimeout(resolve, 8000);
        });
      }

      const sdpOffer = pc.localDescription.sdp;
      log(`SDP offer: ${sdpOffer.length} bytes`);

      const { sdpAnswer, location } = await startWhepSession(deviceId, sdpOffer, accessToken);
      sessionUrlRef.current = location;
      log(`WHEP session: ${location}`);

      const fixedSdp = sdpAnswer
        .replace(/a=recvonly/g, 'a=sendonly')
        .replace(/a=sendrecv/g, 'a=sendonly');

      await pc.setRemoteDescription({ type: 'answer', sdp: fixedSdp });
      log('SDP answer applied, waiting for media...');
      setStreaming(true);
    } catch (err) {
      log(`Stream error: ${err.message}`);
      handleReconnect();
    }
  }, [deviceId, accessToken, log, onStatusChange, cleanupConnection]);

  // Auto-reconnect on failure
  const handleReconnect = useCallback(() => {
    if (unmountedRef.current) return;
    const attempt = reconnectAttemptRef.current;
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('error');
      onStatusChange?.('error');
      setErrorMsg(`Connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts`);
      log(`Giving up after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts`);
      return;
    }
    reconnectAttemptRef.current = attempt + 1;
    const delay = RECONNECT_DELAY_MS * (attempt + 1);
    setStatus('connecting');
    onStatusChange?.('connecting');
    setErrorMsg(`Reconnecting (${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
    log(`Reconnecting in ${delay}ms (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    reconnectTimerRef.current = setTimeout(() => {
      if (!unmountedRef.current) startStream();
    }, delay);
  }, [startStream, onStatusChange, log]);

  // Run detection on a single frame using a small offscreen canvas for inference
  const detectFrame = useCallback(async (activeModel) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !activeModel || video.readyState < 2) return;

    // Use a small offscreen canvas for COCO-SSD inference (much faster)
    if (!detectCanvasRef.current) {
      detectCanvasRef.current = document.createElement('canvas');
    }
    const detectCanvas = detectCanvasRef.current;
    detectCanvas.width = 320;
    detectCanvas.height = 240;
    const detectCtx = detectCanvas.getContext('2d');
    detectCtx.drawImage(video, 0, 0, 320, 240);

    // Run COCO-SSD on the small canvas
    const predictions = await activeModel.detect(detectCanvas);

    // Filter for persons only
    const persons = predictions.filter((p) => p.class === 'person' && p.score > 0.5);
    const count = persons.length;
    setPersonCount(count);

    if (count !== prevCountRef.current) {
      onPersonDetected?.(count);
    }
    prevCountRef.current = count;

    // Draw bounding boxes on the visible canvas, scaled up from 320x240
    const displayW = video.videoWidth || 640;
    const displayH = video.videoHeight || 480;
    canvas.width = displayW;
    canvas.height = displayH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, displayW, displayH);

    const scaleX = displayW / 320;
    const scaleY = displayH / 240;

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.font = '14px monospace';
    ctx.fillStyle = '#00ff88';

    persons.forEach((p) => {
      const [x, y, w, h] = p.bbox;
      ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);
      const labelY = y * scaleY;
      ctx.fillText(`person ${Math.round(p.score * 100)}%`, x * scaleX, labelY > 16 ? labelY - 4 : labelY + 16);
    });
  }, [onPersonDetected]);

  // Start/stop detection loop
  const startDetection = useCallback(async () => {
    log('Starting person detection...');
    try {
      const activeModel = await loadModel();
      setDetecting(true);
      log(`Detection running every ${DETECT_INTERVAL_MS}ms`);

      detectIntervalRef.current = setInterval(() => {
        detectFrame(activeModel);
      }, DETECT_INTERVAL_MS);
    } catch (err) {
      log(`Detection start failed: ${err.message}`);
      setErrorMsg(err.message);
    }
  }, [loadModel, detectFrame, log]);

  const stopDetection = useCallback(() => {
    log('Stopping detection');
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    setDetecting(false);
    setPersonCount(0);
  }, [log]);

  // Stop stream and cleanup
  const stopAll = useCallback(async () => {
    stopDetection();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    await cleanupConnection();
    setStreaming(false);
    setStatus('idle');
    onStatusChange?.('idle');
    log('Stopped');
  }, [stopDetection, cleanupConnection, onStatusChange, log]);

  // Cleanup on unmount
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
      if (pcRef.current) pcRef.current.close();
      if (sessionUrlRef.current) {
        closeWhepSession(sessionUrlRef.current, accessToken).catch(() => {});
      }
    };
  }, [deviceId]);

  return (
    <div className="person-detector">
      {/* Video + Canvas overlay */}
      <div className="detector-video-container">
        <video ref={videoRef} autoPlay playsInline className="detector-video" />
        <canvas ref={canvasRef} className="detector-canvas" />
        {status === 'idle' && (
          <div className="video-placeholder">Start stream to begin detection</div>
        )}
      </div>

      {/* Controls */}
      <div className="detector-controls">
        {!streaming ? (
          <button className="btn-play" onClick={startStream} disabled={status === 'connecting'}>
            ▶ Start Stream
          </button>
        ) : (
          <>
            {!detecting ? (
              <button className="btn-detect" onClick={startDetection} disabled={modelLoading}>
                🔍 Start Detection
              </button>
            ) : (
              <button className="btn-pause" onClick={stopDetection}>
                ⏸ Pause Detection
              </button>
            )}
            <button className="btn-stop" onClick={stopAll}>⏹ Stop All</button>
          </>
        )}
      </div>

      {errorMsg && <div className="stream-error">{errorMsg}</div>}
    </div>
  );
}
