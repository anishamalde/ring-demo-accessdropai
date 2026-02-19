import { useState, useRef, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { startWhepSession, closeWhepSession } from './api';

const MAX_HISTORY = 60; // keep last 60 data points
const DETECT_INTERVAL_MS = 1000; // run detection every second

export default function PersonDetector({ deviceId, accessToken, onLog }) {
  const [model, setModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState('idle');
  const [personCount, setPersonCount] = useState(0);
  const [history, setHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pcRef = useRef(null);
  const sessionUrlRef = useRef(null);
  const detectIntervalRef = useRef(null);

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

  // Start WHEP stream
  const startStream = useCallback(async () => {
    setErrorMsg('');
    setStatus('connecting');
    log('Starting WHEP stream...');

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
          setErrorMsg(`WebRTC ${pc.connectionState}`);
        }
      };

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
      log(`SDP offer: ${sdpOffer.length} bytes`);

      const { sdpAnswer, location } = await startWhepSession(deviceId, sdpOffer, accessToken);
      sessionUrlRef.current = location;
      log(`WHEP session: ${location}`);

      // Fix SDP direction: Ring sends to us, so their answer should be sendonly
      // to match our recvonly offer
      const fixedSdp = sdpAnswer
        .replace(/a=recvonly/g, 'a=sendonly')
        .replace(/a=sendrecv/g, 'a=sendonly');

      await pc.setRemoteDescription({ type: 'answer', sdp: fixedSdp });
      log('SDP answer applied, waiting for media...');
      setStreaming(true);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
      log(`Stream error: ${err.message}`);
    }
  }, [deviceId, accessToken, log]);

  // Run detection on a single frame
  const detectFrame = useCallback(async (activeModel) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !activeModel || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Run COCO-SSD detection
    const predictions = await activeModel.detect(canvas);

    // Filter for persons only
    const persons = predictions.filter((p) => p.class === 'person' && p.score > 0.5);
    const count = persons.length;
    setPersonCount(count);

    // Draw bounding boxes
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.font = '14px monospace';
    ctx.fillStyle = '#00ff88';

    persons.forEach((p) => {
      const [x, y, w, h] = p.bbox;
      ctx.strokeRect(x, y, w, h);
      ctx.fillText(`person ${Math.round(p.score * 100)}%`, x, y > 16 ? y - 4 : y + 16);
    });

    // Add to history
    const now = new Date();
    const timeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), { time: timeLabel, count }]);
  }, []);

  // Start/stop detection loop
  const startDetection = useCallback(async () => {
    log('Starting person detection...');
    try {
      const activeModel = await loadModel();
      setDetecting(true);
      setHistory([]);
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
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (sessionUrlRef.current) {
      log(`Closing WHEP session...`);
      await closeWhepSession(sessionUrlRef.current, accessToken).catch((e) => log(`Close error: ${e.message}`));
      sessionUrlRef.current = null;
    }
    setStreaming(false);
    setStatus('idle');
    log('Stopped');
  }, [stopDetection, accessToken, log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
      if (pcRef.current) pcRef.current.close();
      if (sessionUrlRef.current) {
        closeWhepSession(sessionUrlRef.current, accessToken).catch(() => {});
      }
    };
  }, [deviceId]);

  return (
    <div className="person-detector">
      <div className="detector-header">
        <h3>Person Detection</h3>
        <div className="detector-badges">
          <span className={`stream-status ${status}`}>
            {status === 'idle' && '⏹ Off'}
            {status === 'connecting' && '⏳ Connecting'}
            {status === 'live' && '🔴 Live'}
            {status === 'error' && '⚠ Error'}
          </span>
          {detecting && <span className="badge-detecting">🔍 Detecting</span>}
          {modelLoading && <span className="badge-loading">Loading model...</span>}
        </div>
      </div>

      {/* Live count display */}
      <div className="count-display">
        <div className="count-number">{personCount}</div>
        <div className="count-label">person{personCount !== 1 ? 's' : ''} detected</div>
      </div>

      {/* Video + Canvas overlay */}
      <div className="detector-video-container">
        <video ref={videoRef} autoPlay playsInline muted className="detector-video" />
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

      {/* Historical chart */}
      {history.length > 1 && (
        <div className="history-chart">
          <h4>Person Count Over Time</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="time" stroke="#8b949e" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis stroke="#8b949e" allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }}
                labelStyle={{ color: '#8b949e' }}
                itemStyle={{ color: '#58a6ff' }}
              />
              <Line type="monotone" dataKey="count" stroke="#58a6ff" strokeWidth={2} dot={false} name="Persons" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
