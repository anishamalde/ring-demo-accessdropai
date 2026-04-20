# Requirements Document

## Introduction

AccessDrop AI is an accessibility layer for doorstep delivery powered by Amazon Devices. It extends the Ring AVA Explorer app with a dedicated demo screen supporting two customer journeys: a text-first flow for deaf or hard-of-hearing customers, and a voice-guided flow for blind or low-vision customers. The feature uses the WHEP audio stream from the Ring device, Amazon Transcribe for speech-to-text, Amazon Polly for text-to-speech, and COCO-SSD person detection to automatically trigger the delivery flow when someone appears at the doorstep. Confirming a safe place completes the delivery. This is a hackathon MVP prototype.

## Glossary

- **Explorer_App**: The Ring AVA Explorer React + Vite application with proxy server, live streaming, person detection, and clip download
- **AccessDrop_Screen**: The demo screen hosting the AccessDrop AI UI, with a phone-framed controls column and a live stream column
- **Text_Mode**: Accessibility mode for deaf/hard-of-hearing customers, displaying courier speech as readable text with action buttons
- **Voice_Mode**: Accessibility mode for blind/low-vision customers, providing spoken delivery guidance via Amazon Polly
- **Person_Detector**: The PersonDetector component that establishes a WHEP_Stream, loads COCO-SSD, runs person detection every 3 seconds on a 320x240 offscreen canvas, and draws bounding boxes
- **COCO_SSD_Model**: TensorFlow.js COCO-SSD object detection model (lite_mobilenet_v2) for person detection
- **Detection_Event**: An event when one or more persons are detected with confidence > 0.5
- **Auto_Trigger**: Mechanism that dispatches TRIGGER_DOORSTEP after a 2-second debounce when a person is detected while idle
- **Transcription_Service**: Converts WHEP audio to text via Amazon Transcribe WebSocket, with mock fallback
- **Speech_Service**: Converts text to speech via Amazon Polly, no Web Speech API fallback
- **Delivery_Flow_Engine**: Pure state machine with phases idle, active, and completed. Confirming a safe place transitions directly to completed.
- **WHEP_Stream**: WebRTC live video and audio stream from the Ring device
- **Proxy_Server**: Express server on port 3001 for Ring API, OAuth, Polly TTS, and Transcribe WebSocket

## Requirements

### Requirement 1: Navigation from Explorer to AccessDrop Screen

**User Story:** As a demo presenter, I want to navigate to the AccessDrop AI screen without losing Explorer state.

#### Acceptance Criteria

1. WHEN a device is selected, THE navigation link SHALL become visible
2. WHEN activated, THE AccessDrop_Screen SHALL render while preserving Explorer state
3. Back navigation SHALL return to Explorer with state intact
4. THE AccessDrop_Screen SHALL receive device ID and access token

### Requirement 2: Doorstep Event Trigger

**User Story:** As a demo presenter, I want to trigger the delivery flow manually or automatically.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL provide a manual trigger button outside the phone frame, below the stream
2. WHEN triggered, THE AccessDrop_Screen SHALL transition from idle to active
3. THE trigger button SHALL be disabled when phase is active or completed

### Requirement 3: Accessibility Profile Selection

**User Story:** As a demo presenter, I want to switch between text and voice modes.

#### Acceptance Criteria

1. THE phone frame SHALL display two selectable profiles: Text_Mode and Voice_Mode
2. Mode switching SHALL be allowed at any point during the Delivery_Flow
3. THE active profile SHALL be visually indicated

### Requirement 4: Text Mode - Courier Speech Transcription

**User Story:** As a deaf or hard-of-hearing customer, I want to see courier speech as readable text.

#### Acceptance Criteria

1. WHILE Text_Mode is active and delivery is in progress, THE Transcription_Service SHALL convert WHEP audio to text
2. Transcription SHALL only start after the delivery phase becomes active
3. IF Transcription_Service is unavailable, THE AccessDrop_Screen SHALL fall back to mock messages
4. Messages SHALL display in chronological order with timestamps and auto-scroll
5. When the WHEP stream reconnects, transcription SHALL restart automatically with the new audio track

### Requirement 5: Text Mode - Customer Action Buttons

**User Story:** As a deaf or hard-of-hearing customer, I want to respond using action buttons.

#### Acceptance Criteria

1. THE phone frame SHALL display stacked full-width action buttons: Confirm Safe Place, OTP Help, Mark as Received
2. Confirm Safe Place SHALL complete the delivery (transition to completed phase)
3. OTP Help SHALL display a generated OTP code
4. Buttons not applicable to the current phase SHALL be disabled

### Requirement 6: Voice Mode - Spoken Delivery Guidance

**User Story:** As a blind or low-vision customer, I want spoken delivery guidance.

#### Acceptance Criteria

1. WHEN delivery starts in Voice_Mode, THE Speech_Service SHALL speak a greeting
2. THE Speech_Service SHALL announce delivery events
3. A visual indicator SHALL show when speaking
4. Handoff acknowledgement SHALL speak confirmation and complete the delivery

### Requirement 7: Voice Mode - Parcel Location Support

**User Story:** As a blind or low-vision customer, I want spoken guidance about my parcel location.

#### Acceptance Criteria

1. WHEN safe place is confirmed in Voice_Mode, THE Speech_Service SHALL speak the location
2. "Where is my parcel?" button SHALL speak the location, or "Where is my parcel?" if not yet confirmed

### Requirement 8: Delivery Completed State

**User Story:** As a customer, I want a clear indication that delivery is complete.

#### Acceptance Criteria

1. WHEN completed, THE phone frame SHALL display a delivery summary
2. In Voice_Mode, THE Speech_Service SHALL speak a completion message
3. A reset button SHALL appear below the stream for starting a new demo
4. All delivery action buttons SHALL be disabled once completed

### Requirement 9: Live Video Feed with Person Detection

**User Story:** As a demo presenter, I want live video with person detection alongside the delivery controls.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL embed Person_Detector in a side-by-side layout (phone frame left, stream right)
2. Person_Detector SHALL manage its own WHEP lifecycle independently
3. Detection SHALL run on a 320x240 offscreen canvas every 3 seconds for performance
4. Bounding boxes SHALL be scaled and drawn on the visible canvas overlay
5. Person_Detector SHALL expose onPersonDetected, onStatusChange, and onAudioTrack callbacks
6. On unmount, Person_Detector SHALL clean up WHEP session and detection

### Requirement 10: Automatic Delivery Flow Trigger

**User Story:** As a demo presenter, I want automatic triggering when a person is detected.

#### Acceptance Criteria

1. WHEN person count >= 1 and phase is idle, auto-trigger SHALL start a 2-second debounce
2. IF person count drops to 0 before debounce elapses, the trigger SHALL be cancelled
3. WHILE phase is active or completed, detection events SHALL be ignored
4. Auto-trigger SHALL log a message and speak a greeting in Voice_Mode

### Requirement 11: WHEP Audio for Transcription

**User Story:** As a developer, I want the WHEP audio stream used for real-time transcription.

#### Acceptance Criteria

1. THE audio track SHALL be exposed from Person_Detector via onAudioTrack callback
2. Transcription SHALL only start when phase is active and audio track is available
3. Duplicate transcription sessions SHALL be prevented
4. On stream reconnect, transcription SHALL restart with the new audio track
5. IF WHEP fails, mock data SHALL be used as fallback

### Requirement 12: Detection Status Indicator

**User Story:** As a demo presenter, I want to see detection status.

#### Acceptance Criteria

1. THE phone frame SHALL display stream status: idle, connecting, live, or error
2. "Auto-trigger armed" SHALL show when detecting and phase is idle
3. "Person spotted - triggering..." SHALL show during debounce countdown
4. Status indicators SHALL have ARIA labels

### Requirement 13: WebRTC Connection Resilience

**User Story:** As a demo presenter, I want the stream to auto-reconnect.

#### Acceptance Criteria

1. On WebRTC failure, Person_Detector SHALL retry up to 3 times with 2s/4s/6s delays
2. Previous connection SHALL be cleaned up before each retry
3. On success, retry counter SHALL reset
4. After 3 failures, an error message SHALL display

### Requirement 14: Accessibility Compliance

#### Acceptance Criteria

1. Minimum 16px text for messages, 14px for buttons
2. 4.5:1 colour contrast ratio
3. Keyboard navigable with visible focus indicators
4. ARIA labels on all interactive elements
5. ARIA live regions in Voice_Mode

### Requirement 15: Mock Data Fallback

#### Acceptance Criteria

1. Mock messages SHALL simulate a full delivery conversation
2. Mock messages SHALL display with realistic timing
3. A mock mode toggle SHALL appear below the stream
4. Auto-switch to mock mode on transcription failure

### Requirement 16: Phone Frame UI

#### Acceptance Criteria

1. Delivery controls SHALL be wrapped in a phone frame with notch and home indicator
2. Dark navy/blue theme with glowing borders and blue accent buttons
3. Presenter controls (trigger, mock toggle, reset) SHALL appear below the stream, outside the phone frame

### Requirement 17: Message Sender Labels

#### Acceptance Criteria

1. System-generated messages (safe place confirmation, OTP, status) SHALL use "customer" as the sender label
2. Courier transcription messages SHALL use "courier" as the sender label
