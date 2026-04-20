# Implementation Plan: AccessDrop AI

## Overview

Accessibility-focused delivery interaction screen for Ring AVA Explorer with live person detection, automatic delivery triggering, real-time transcription, and text-to-speech. Side-by-side layout with phone-framed controls and live video stream.

## Tasks

- [x] 1. Core state machine and mock data
  - [x] 1.1 Create deliveryFlowEngine.js (CONFIRM_SAFE_PLACE completes delivery)
  - [x] 1.2 Create mockData.js with "customer" sender labels

- [x] 2. Service layer
  - [x] 2.1 Create speechService.js (Polly TTS, no Web Speech API fallback)
  - [x] 2.2 Create transcriptionService.js (WebSocket to proxy, PCM audio)

- [x] 3. Proxy server endpoints
  - [x] 3.1 POST /api/accessdrop/tts (Polly)
  - [x] 3.2 WebSocket /ws/transcribe (Transcribe Streaming)

- [x] 4. UI components
  - [x] 4.1 DeliveryStatusBar.jsx
  - [x] 4.2 TextModePanel.jsx (stacked full-width buttons, "customer" sender)
  - [x] 4.3 VoiceModePanel.jsx ("Where is my parcel?" when unconfirmed)
  - [x] 4.4 AccessDropScreen.jsx (phone frame, side-by-side layout)

- [x] 5. Explorer integration
  - [x] 5.1 App.jsx view switching
  - [x] 5.2 CSS styles (dark navy/blue theme, phone frame, presenter controls)

- [x] 6. Mock data and speech wiring
  - [x] 6.1 Mock message playback with timing
  - [x] 6.2 Voice mode speech calls

- [x] 7. PersonDetector callback props
  - [x] 7.1 onPersonDetected (count transitions only)
  - [x] 7.2 onStatusChange
  - [x] 7.3 onAudioTrack

- [x] 8. Auto-trigger and transcription
  - [x] 8.1 Embed PersonDetector with side-by-side layout
  - [x] 8.2 Auto-trigger debounce (2s, phaseRef for stale closure safety)
  - [x] 8.3 Detection status indicator with ARIA labels
  - [x] 8.4 Transcription from WHEP audio (only when phase is active, guard ref)
  - [x] 8.5 Transcription restart on stream reconnect
  - [x] 8.6 Cleanup on unmount

- [x] 9. WebRTC resilience
  - [x] 9.1 Auto-reconnect (3 retries, 2s/4s/6s delays)
  - [x] 9.2 Connection cleanup before retry

- [x] 10. Performance optimisation
  - [x] 10.1 320x240 offscreen canvas for COCO-SSD inference
  - [x] 10.2 3-second detection interval
  - [x] 10.3 Scaled bounding box drawing

- [x] 11. UI polish
  - [x] 11.1 Phone frame (notch, screen, home indicator)
  - [x] 11.2 Dark navy/blue theme with glowing borders
  - [x] 11.3 Presenter controls below stream (trigger, mock toggle, reset)
  - [x] 11.4 Removed history chart and header from embedded PersonDetector

- [x] 12. Property-based tests
  - [x] 12.1 autoTriggerLogic.js pure helpers
  - [x] 12.2 Property: Detection callback on count transitions
  - [x] 12.3 Property: Debounce guards timing
  - [x] 12.4 Property: Auto-trigger respects phase

## Notes

- 46 tests pass across 4 test files
- deliveryFlowEngine unchanged except CONFIRM_SAFE_PLACE now completes delivery
- Messages use "customer" sender (not "system" or "varun")
- Polly is the only TTS provider
- Detection uses offscreen 320x240 canvas at 3s intervals for performance
- Transcription only starts when phase is active, with duplicate prevention
