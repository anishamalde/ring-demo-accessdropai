# Implementation Plan: AccessDrop AI

## Overview

Build an accessibility-focused delivery interaction screen for the Ring AVA Explorer app with live person detection, automatic delivery triggering, real-time transcription from the WHEP audio stream, and text-to-speech via Amazon Polly. Side-by-side layout with phone-framed controls and live video stream.

## Tasks

- [x] 1. Implement delivery flow state machine and mock data
  - [x] 1.1 Create deliveryFlowEngine.js with pure state machine logic
  - [x] 1.2 Create mockData.js with predefined courier message sequences

- [x] 2. Implement service layer (speech and transcription)
  - [x] 2.1 Create speechService.js for Amazon Polly TTS
  - [x] 2.2 Create transcriptionService.js for Amazon Transcribe streaming

- [x] 3. Add proxy server endpoints
  - [x] 3.1 Add POST /api/accessdrop/tts endpoint for Polly
  - [x] 3.2 Add WebSocket /ws/transcribe endpoint for Transcribe

- [x] 4. Build AccessDrop UI components
  - [x] 4.1 Create DeliveryStatusBar.jsx
  - [x] 4.2 Create TextModePanel.jsx
  - [x] 4.3 Create VoiceModePanel.jsx
  - [x] 4.4 Create AccessDropScreen.jsx

- [x] 5. Integrate AccessDrop screen into Explorer app
  - [x] 5.1 Modify App.jsx for view switching and navigation
  - [x] 5.2 Add AccessDrop CSS styles to App.css

- [x] 6. Wire mock data fallback and end-to-end flow
  - [x] 6.1 Implement mock message playback with realistic timing
  - [x] 6.2 Wire speech service calls in Voice Mode flow

- [x] 7. Add PersonDetector callback props
  - [x] 7.1 Add onPersonDetected callback prop
  - [x] 7.2 Add onStatusChange callback prop
  - [x] 7.3 Add onAudioTrack callback prop

- [x] 8. Embed PersonDetector and add auto-trigger logic
  - [x] 8.1 Embed PersonDetector in AccessDropScreen with side-by-side layout
  - [x] 8.2 Implement auto-trigger debounce logic (2s default)
  - [x] 8.3 Implement onStatusChange handler
  - [x] 8.4 Add detection status indicator with ARIA labels
  - [x] 8.5 Wire WHEP audio track to transcription service
  - [x] 8.6 Ensure PersonDetector cleanup on unmount

- [x] 9. Add WebRTC auto-reconnect
  - [x] 9.1 Add auto-reconnect with 3 retries and exponential backoff
  - [x] 9.2 Clean up previous connection before retry

- [x] 10. Add phone frame UI and layout styles
  - [x] 10.1 Add phone frame CSS (notch, screen, home indicator)
  - [x] 10.2 Add side-by-side layout (controls left, stream right)
  - [x] 10.3 Add detection status badge styles

- [x] 11. Write property-based tests
  - [x] 11.1 Extract testable debounce logic into autoTriggerLogic.js
  - [x] 11.2 Property test: Detection callback fires on count transitions
  - [x] 11.3 Property test: Debounce guards auto-trigger timing
  - [x] 11.4 Property test: Auto-trigger respects delivery phase

## Notes

- deliveryFlowEngine.js is unchanged; existing TRIGGER_DOORSTEP action handles triggers correctly
- PersonDetector manages its own WHEP lifecycle independently of delivery state
- Manual trigger button retained as fallback
- Amazon Polly is the only TTS provider (no Web Speech API fallback)
- All 46 tests pass across 4 test files
