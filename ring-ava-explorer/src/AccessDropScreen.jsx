import React, { useReducer, useState, useCallback, useEffect, useRef } from 'react';
import { deliveryReducer, createInitialState } from './deliveryFlowEngine';
import { speak, stop } from './speechService';
import { startTranscription, stopTranscription } from './transcriptionService';
import { getMockMessages } from './mockData';
import DeliveryStatusBar from './DeliveryStatusBar';
import TextModePanel from './TextModePanel';
import VoiceModePanel from './VoiceModePanel';
import PersonDetector from './PersonDetector';

const DEBOUNCE_MS = 2000;

/**
 * AccessDropScreen — top-level orchestrating component for the AccessDrop AI demo.
 *
 * Manages delivery state via useReducer, renders mode selector, doorstep trigger,
 * status bar, mode-specific panels, mock toggle, and completed summary.
 *
 * Props:
 *   deviceId    — selected Ring device ID
 *   accessToken — current access token
 *   onBack      — callback to navigate back to Explorer view
 *   onLog       — callback to append to the app request log
 */
export default function AccessDropScreen({ deviceId, accessToken, onBack, onLog }) {
  const [deliveryState, dispatch] = useReducer(deliveryReducer, undefined, createInitialState);
  const [speakingActive, setSpeakingActive] = useState(false);
  const [detectorStatus, setDetectorStatus] = useState('idle');
  const [autoTriggerPending, setAutoTriggerPending] = useState(false);

  const { phase, mode, messages, parcelLocation } = deliveryState;
  const mockTimeoutsRef = useRef([]);
  const debounceTimerRef = useRef(null);
  const lastPersonCountRef = useRef(0);
  const phaseRef = useRef(phase);
  const audioTrackRef = useRef(null);

  // --- Mock message playback with realistic timing ---
  useEffect(() => {
    if (phase === 'active' && deliveryState.useMockData) {
      const mockMessages = getMockMessages();
      const baseTimestamp = mockMessages[0]?.timestamp ?? Date.now();

      mockTimeoutsRef.current = mockMessages.map((msg) => {
        const delay = msg.timestamp - baseTimestamp;
        return setTimeout(() => {
          dispatch({ type: 'ADD_MESSAGE', message: msg });
        }, delay);
      });
    }

    // Cleanup: clear all pending timeouts when phase changes or mock mode toggles
    return () => {
      mockTimeoutsRef.current.forEach(clearTimeout);
      mockTimeoutsRef.current = [];
    };
  }, [phase, deliveryState.useMockData]);

  // --- Keep phaseRef in sync with phase ---
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // --- Mode switching ---
  const handleSetMode = useCallback((newMode) => {
    dispatch({ type: 'SET_MODE', mode: newMode });
  }, []);

  // --- Speech helper (wraps speak with local isSpeaking state) ---
  const speakText = useCallback(async (text) => {
    setSpeakingActive(true);
    try {
      await speak(text);
    } finally {
      setSpeakingActive(false);
    }
  }, []);

  // --- Person detection auto-trigger with debounce ---
  const handlePersonDetected = useCallback((count) => {
    lastPersonCountRef.current = count;

    if (count >= 1 && phaseRef.current === 'idle' && debounceTimerRef.current === null) {
      setAutoTriggerPending(true);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        if (lastPersonCountRef.current >= 1 && phaseRef.current === 'idle') {
          dispatch({ type: 'TRIGGER_DOORSTEP' });
          if (onLog) onLog('Person detected - delivery flow auto-triggered');
          if (deliveryState.mode === 'voice') {
            speakText('Hello! A delivery person has been detected at your doorstep.');
          }
        }
        setAutoTriggerPending(false);
      }, DEBOUNCE_MS);
    }

    if (count === 0 && debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      setAutoTriggerPending(false);
    }
  }, [onLog, deliveryState.mode, speakText]);

  // --- Detector status change handler ---
  const handleDetectorStatusChange = useCallback((newStatus) => {
    setDetectorStatus(newStatus);
  }, []);

  // --- Start transcription from the WHEP audio track ---
  const tryStartTranscription = useCallback(() => {
    if (deliveryState.useMockData) return;
    if (!audioTrackRef.current) {
      if (onLog) onLog('No audio track available yet - transcription will start when stream connects');
      return;
    }
    try {
      startTranscription(
        audioTrackRef.current,
        (result) => {
          if (result.isFinal && result.text) {
            dispatch({
              type: 'ADD_MESSAGE',
              message: {
                id: `transcript-${Date.now()}`,
                sender: 'courier',
                text: result.text,
                timestamp: result.timestamp || Date.now(),
                type: 'info',
              },
            });
          }
        },
        (err) => {
          console.warn('[AccessDropScreen] Transcription failed, falling back to mock mode:', err.message);
          stopTranscription();
          dispatch({ type: 'SET_MOCK_MODE', useMock: true });
          if (onLog) onLog('Transcription unavailable - switched to mock mode');
        }
      );
      if (onLog) onLog('Transcription started from WHEP audio');
    } catch (err) {
      console.warn('[AccessDropScreen] Could not start transcription:', err.message);
      dispatch({ type: 'SET_MOCK_MODE', useMock: true });
      if (onLog) onLog('Transcription unavailable - switched to mock mode');
    }
  }, [deliveryState.useMockData, onLog]);

  // --- Audio track handler from PersonDetector ---
  const handleAudioTrack = useCallback((track) => {
    audioTrackRef.current = track;
    if (onLog) onLog('Audio track received from WHEP stream');
    // If delivery is already active, start transcription now
    if (phaseRef.current === 'active') {
      tryStartTranscription();
    }
  }, [onLog, tryStartTranscription]);

  // --- Cleanup debounce timer on phase change or unmount ---
  useEffect(() => {
    if (phase !== 'idle' && debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      setAutoTriggerPending(false);
    }
    // Start transcription when phase becomes active (covers both manual and auto-trigger)
    if (phase === 'active') {
      tryStartTranscription();
    }
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [phase, tryStartTranscription]);

  // --- Speak completion message when delivery ends in voice mode ---
  useEffect(() => {
    if (phase === 'completed' && mode === 'voice') {
      speakText('Your delivery is now complete. Thank you!');
    }
  }, [phase, mode, speakText]);

  // --- Doorstep trigger ---
  const handleTriggerDoorstep = useCallback(() => {
    dispatch({ type: 'TRIGGER_DOORSTEP' });
    if (onLog) onLog('Doorstep event triggered - delivery flow started');

    if (deliveryState.mode === 'voice') {
      speakText('Hello! A delivery person has been detected at your doorstep.');
    }

    tryStartTranscription();
  }, [onLog, deliveryState.mode, speakText, tryStartTranscription]);

  // --- Mock mode toggle ---
  const handleMockToggle = useCallback((e) => {
    dispatch({ type: 'SET_MOCK_MODE', useMock: e.target.checked });
  }, []);

  // --- Reset ---
  const handleReset = useCallback(() => {
    stop();
    stopTranscription();
    mockTimeoutsRef.current.forEach(clearTimeout);
    mockTimeoutsRef.current = [];
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setAutoTriggerPending(false);
    setSpeakingActive(false);
    dispatch({ type: 'RESET' });
    if (onLog) onLog('Delivery flow reset');
  }, [onLog]);

  // --- Action handler from child panels ---
  const handleAction = useCallback((action) => {
    // Special case: WHERE_IS_PARCEL in voice mode — speak location
    if (action.type === 'WHERE_IS_PARCEL') {
      if (parcelLocation) {
        speakText(parcelLocation);
      } else {
        speakText('Parcel location has not yet been confirmed');
      }
      return;
    }

    dispatch(action);

    // Voice mode speech announcements for delivery events
    if (mode === 'voice') {
      switch (action.type) {
        case 'CONFIRM_SAFE_PLACE':
          speakText(`Safe place confirmed at ${action.location}.`);
          break;
        case 'REQUEST_OTP':
          speakText('Your OTP code has been generated. Check the screen for the code.');
          break;
        case 'MARK_RECEIVED':
        case 'ACKNOWLEDGE_DELIVERY':
          speakText('Your delivery is now complete. Thank you!');
          break;
        default:
          break;
      }
    }

    if (onLog) {
      onLog(`Action dispatched: ${action.type}`);
    }
  }, [parcelLocation, mode, speakText, onLog]);

  return (
    <div className="ad-screen">
      {/* Back navigation */}
      <button
        className="ad-back-btn"
        onClick={onBack}
        aria-label="Back to Explorer"
      >
        ← Back
      </button>

      <h2 className="ad-title">AccessDrop AI</h2>

      <div className="ad-layout">
        {/* Left column: delivery controls in phone frame */}
        <div className="ad-controls-col">
          <div className="ad-phone-frame">
            <div className="ad-phone-notch"></div>
            <div className="ad-phone-screen">
              <div className="ad-detection-status" role="status" aria-live="polite" aria-label="Detection status">
                <span className={`ad-detection-badge ad-detection-badge--${detectorStatus}`}>
                  Stream: {detectorStatus}
                </span>
                {detectorStatus === 'live' && phase === 'idle' && !autoTriggerPending && (
                  <span className="ad-detection-badge ad-detection-badge--armed">Auto-trigger armed</span>
                )}
                {autoTriggerPending && (
                  <span className="ad-detection-badge ad-detection-badge--pending">Person spotted — triggering...</span>
                )}
              </div>

              <div className="ad-mode-selector" role="group" aria-label="Accessibility mode selector">
                <button
                  className={`ad-mode-btn ${mode === 'text' ? 'ad-mode-btn--active' : ''}`}
                  onClick={() => handleSetMode('text')}
                  aria-pressed={mode === 'text'}
                  aria-label="Text Mode"
                >
                  Text Mode
                </button>
                <button
                  className={`ad-mode-btn ${mode === 'voice' ? 'ad-mode-btn--active' : ''}`}
                  onClick={() => handleSetMode('voice')}
                  aria-pressed={mode === 'voice'}
                  aria-label="Voice Mode"
                >
                  Voice Mode
                </button>
              </div>

              <button
                className="ad-trigger-btn"
                onClick={handleTriggerDoorstep}
                disabled={phase !== 'idle'}
                aria-label="Simulate doorstep motion detection"
              >
                🚪 Trigger Doorstep Event
              </button>

              <DeliveryStatusBar phase={phase} />

              {mode === 'text' ? (
                <TextModePanel
                  messages={messages}
                  deliveryState={deliveryState}
                  onAction={handleAction}
                />
              ) : (
                <VoiceModePanel
                  deliveryState={deliveryState}
                  isSpeaking={speakingActive}
                  parcelLocation={parcelLocation}
                  onAction={handleAction}
                />
              )}

              <label className="ad-mock-toggle" aria-label="Toggle mock data mode">
                <input
                  type="checkbox"
                  checked={deliveryState.useMockData}
                  onChange={handleMockToggle}
                />
                Mock Mode
              </label>

              {phase === 'completed' && (
                <div className="ad-completed" role="status" aria-label="Delivery completed summary">
                  <h3 className="ad-completed-title">Delivery Complete ✅</h3>
                  {deliveryState.safePlace && (
                    <p className="ad-completed-detail">Safe place: {deliveryState.safePlace}</p>
                  )}
                  {deliveryState.completedAt && (
                    <p className="ad-completed-detail">
                      Completed at: {new Date(deliveryState.completedAt).toLocaleTimeString()}
                    </p>
                  )}
                  <button
                    className="ad-reset-btn"
                    onClick={handleReset}
                    aria-label="Reset and start new demo"
                  >
                    Reset Demo
                  </button>
                </div>
              )}
            </div>
            <div className="ad-phone-home"></div>
          </div>
        </div>

        {/* Right column: live stream */}
        <div className="ad-stream-col">
          <div className="ad-detector-section">
            <PersonDetector
              deviceId={deviceId}
              accessToken={accessToken}
              onLog={onLog}
              onPersonDetected={handlePersonDetected}
              onStatusChange={handleDetectorStatusChange}
              onAudioTrack={handleAudioTrack}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
