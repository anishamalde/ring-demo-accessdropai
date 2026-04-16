# Implementation Plan: AccessDrop AI

## Overview

Build an accessibility-focused delivery interaction screen for the Ring AVA Explorer app. The implementation follows an incremental approach: core state machine first, then service layer, then proxy endpoints, then UI components, and finally wiring everything together. JavaScript (React JSX) is used throughout, matching the existing codebase.

## Tasks

- [ ] 1. Implement delivery flow state machine and mock data
  - [~] 1.1 Create `deliveryFlowEngine.js` with pure state machine logic
    - Define `DeliveryState` shape: `{ phase, mode, messages, parcelLocation, otpCode, safePlace, startedAt, completedAt, useMockData, error }`
    - Implement `createInitialState()` returning default idle state
    - Implement `deliveryReducer(state, action)` handling all action types: `TRIGGER_DOORSTEP`, `ADD_MESSAGE`, `CONFIRM_SAFE_PLACE`, `REQUEST_OTP`, `MARK_RECEIVED`, `ACKNOWLEDGE_DELIVERY`, `SET_MODE`, `SET_MOCK_MODE`, `SET_ERROR`, `RESET`
    - Enforce phase-based action validity (idle: only TRIGGER_DOORSTEP/SET_MODE/SET_MOCK_MODE/RESET; active: delivery actions; completed: only RESET/SET_MODE)
    - Invalid actions for current phase return state unchanged
    - _Requirements: 2.2, 2.4, 3.2, 3.3, 3.4, 5.2, 5.3, 5.4, 5.5, 6.4, 8.4_

  - [ ] 1.2 Create `mockData.js` with predefined courier message sequences
    - Export `getMockMessages()` returning array of messages covering greeting, safe place discussion, OTP exchange, delivery confirmation
    - Export `getMockParcelLocation()` returning a mock location description
    - Each message: `{ id, sender, text, timestamp, type }`
    - _Requirements: 11.1, 11.4_

- [ ] 2. Implement service layer (speech and transcription)
  - [ ] 2.1 Create `speechService.js` for Amazon Polly TTS
    - Implement `speak(text, voiceId?)` that POSTs to `/api/accessdrop/tts`, receives MP3 buffer, plays via `AudioContext` and `decodeAudioData`
    - Implement `stop()` to halt current playback
    - Implement `isSpeaking()` returning boolean state
    - On Polly failure: silent no-op with console warning (NO Web Speech API fallback)
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 8.2_

  - [ ] 2.2 Create `transcriptionService.js` for Amazon Transcribe streaming
    - Implement `startTranscription(audioTrack, onMessage, onError)` that extracts PCM audio via `AudioContext` + `ScriptProcessorNode`, sends binary chunks over WebSocket to `/ws/transcribe`, parses incoming JSON transcript results
    - Implement `stopTranscription()` to close WebSocket and stop audio processing
    - On WebSocket failure: call `onError` so the screen can fall back to mock data
    - _Requirements: 4.1, 9.2_

- [ ] 3. Add proxy server endpoints for Polly TTS and Transcribe WebSocket
  - [ ] 3.1 Add POST `/api/accessdrop/tts` endpoint to `proxy-server.js`
    - Accept `{ text, voiceId? }` JSON body
    - Call Amazon Polly `SynthesizeSpeech` with OutputFormat `mp3`, default voice `Joanna` (Neural)
    - Return MP3 buffer with `Content-Type: audio/mpeg`
    - Return 400 for missing text, 502 for Polly failures with `{ error, detail }` JSON
    - Install `@aws-sdk/client-polly` as a dependency
    - _Requirements: 6.1, 6.2, 7.1, 8.2_

  - [ ] 3.2 Add WebSocket `/ws/transcribe` endpoint to `proxy-server.js`
    - Accept binary PCM audio frames from browser clients
    - Stream audio to Amazon Transcribe Streaming via `@aws-sdk/client-transcribe-streaming`
    - Send transcription results back as JSON: `{ type: 'transcript', text, isFinal, timestamp }`
    - Send errors as `{ type: 'error', message }`
    - Install `@aws-sdk/client-transcribe-streaming` and `ws` as dependencies
    - _Requirements: 4.1, 9.2_

- [ ] 4. Build AccessDrop UI components
  - [ ] 4.1 Create `DeliveryStatusBar.jsx` shared status indicator
    - Display current delivery phase (idle/active/completed) with visual styling
    - Accept `phase` prop
    - Include ARIA labels for screen reader accessibility
    - _Requirements: 2.3, 10.4_

  - [ ] 4.2 Create `TextModePanel.jsx` for deaf/HoH interaction
    - Render scrollable message panel with transcribed courier messages (high contrast, min 16px text)
    - Auto-scroll to latest message on new arrivals
    - Render action buttons: Confirm Safe Place, OTP Help, Mark as Received
    - Disable buttons not applicable to current delivery phase
    - Display messages with timestamps in chronological order
    - Props: `{ messages, deliveryState, onAction }`
    - Include ARIA labels on all buttons
    - _Requirements: 4.2, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 10.1, 10.2, 10.3, 10.4_

  - [ ] 4.3 Create `VoiceModePanel.jsx` for blind/low-vision interaction
    - Display speaking indicator when Polly is active
    - Show delivery status and parcel location info
    - Render action buttons: Acknowledge Delivery, Where is my parcel?
    - Use ARIA live regions to announce delivery status changes
    - Props: `{ deliveryState, isSpeaking, parcelLocation, onAction }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 10.4, 10.5_

  - [ ] 4.4 Create `AccessDropScreen.jsx` top-level component
    - Manage delivery state via `useReducer` with `deliveryReducer`
    - Render back navigation button
    - Render accessibility profile selector (Text Mode / Voice Mode toggle) with active indicator
    - Render doorstep event trigger button (simulate motion detection)
    - Render `DeliveryStatusBar`
    - Conditionally render `TextModePanel` or `VoiceModePanel` based on selected mode
    - Render mock mode toggle
    - Wire transcription service: start on delivery flow begin, stop on end
    - Wire speech service: speak on voice mode events
    - Handle WHEP audio extraction from stream for transcription
    - Display delivery completed summary with reset option
    - Disable action buttons in completed state
    - Props: `{ deviceId, accessToken, onBack, onLog }`
    - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.3, 8.1, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 11.2, 11.3_

- [ ] 5. Integrate AccessDrop screen into Explorer app
  - [ ] 5.1 Modify `App.jsx` to add view switching and navigation
    - Add `view` state: `'explorer' | 'accessdrop'`
    - Render AccessDrop navigation link in device actions section (visible when device selected)
    - Render `AccessDropScreen` when view is `'accessdrop'`, passing deviceId, accessToken, onBack, onLog
    - Preserve Explorer state when switching views
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 5.2 Add AccessDrop CSS styles to `App.css`
    - Style AccessDrop screen layout, message panel, action buttons, status bar, profile selector
    - Ensure minimum 16px text for messages, 14px for button labels
    - Ensure 4.5:1 colour contrast ratio for all text
    - Add visible focus indicators for keyboard navigation
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 6. Wire mock data fallback and end-to-end flow
  - [ ] 6.1 Implement mock message playback with realistic timing in AccessDropScreen
    - When mock mode is active, dispatch `ADD_MESSAGE` actions with timed delays to simulate live conversation
    - Cover full delivery flow: greeting, safe place discussion, OTP exchange, delivery confirmation
    - Auto-detect mock mode when transcription service fails
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 6.2 Wire speech service calls in Voice Mode flow
    - Speak greeting on delivery start in voice mode
    - Announce each delivery event (safe place confirmed, OTP, completion)
    - Speak parcel location on "Where is my parcel?" action
    - Speak "not yet confirmed" when no parcel location set
    - Speak completion message on delivery end
    - _Requirements: 6.1, 6.2, 6.4, 7.1, 7.2, 7.3, 8.2_

## Notes

- Each task references specific requirements for traceability
- The delivery flow engine is implemented first as it's the core logic with no external dependencies
- Amazon Polly is the ONLY TTS provider; there is no Web Speech API fallback
- This is a hackathon MVP; no tests are included
