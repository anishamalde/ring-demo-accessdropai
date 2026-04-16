# Requirements Document

## Introduction

AccessDrop AI is an accessibility layer for doorstep delivery powered by Amazon Devices. It extends the Ring AVA Explorer app with a dedicated demo screen supporting two customer journeys: a text-first flow for deaf or hard-of-hearing customers, and a voice-guided flow for blind or low-vision customers. The feature uses the WHEP audio stream from the Ring device, Amazon Transcribe for speech-to-text, Amazon Polly for text-to-speech, and COCO-SSD person detection to automatically trigger the delivery flow when someone appears at the doorstep. This is a hackathon MVP prototype that prioritises clarity, accessibility, and strong storytelling.

## Glossary

- **Explorer_App**: The existing Ring AVA Explorer React + Vite application with proxy server, live streaming, person detection, and clip download capabilities
- **AccessDrop_Screen**: The demo screen within the Explorer_App that hosts the AccessDrop AI UI, accessible via navigation from the main Explorer screen
- **Text_Mode**: The accessibility mode for deaf or hard-of-hearing customers, displaying courier speech as readable text with tap-based interaction buttons
- **Voice_Mode**: The accessibility mode for blind or low-vision customers, providing spoken delivery guidance and voice-based parcel location support
- **Person_Detector**: The PersonDetector React component that establishes a WHEP_Stream, loads the COCO_SSD_Model, runs person detection every 1 second, and draws bounding boxes on a canvas overlay
- **COCO_SSD_Model**: The TensorFlow.js COCO-SSD object detection model (lite_mobilenet_v2 variant) used to detect persons in video frames
- **Detection_Event**: An event produced by the Person_Detector when one or more persons are detected with a confidence score above 0.5
- **Auto_Trigger**: The mechanism that automatically dispatches a TRIGGER_DOORSTEP action when the Person_Detector produces a Detection_Event while the delivery phase is idle
- **Transcription_Service**: The component converting courier audio from the WHEP stream into text via Amazon Transcribe or a mock fallback
- **Speech_Service**: The component converting text guidance into spoken audio via Amazon Polly
- **Delivery_Flow_Engine**: The pure state machine (deliveryFlowEngine.js) with phases idle, active, and completed
- **WHEP_Stream**: The WebRTC-based live video and audio stream from the Ring device
- **Proxy_Server**: The Express server on port 3001 handling CORS proxying for Ring API, OAuth, Polly TTS, and Transcribe WebSocket

## Requirements

### Requirement 1: Navigation from Explorer to AccessDrop Screen

**User Story:** As a demo presenter, I want to navigate from the Explorer screen to the AccessDrop AI demo screen without losing existing app state.

#### Acceptance Criteria

1. WHEN a device is selected in the Explorer_App, THE AccessDrop_Screen navigation link SHALL become visible
2. WHEN the navigation link is activated, THE Explorer_App SHALL render the AccessDrop_Screen while preserving Explorer state
3. WHEN back navigation is activated, THE Explorer_App SHALL return to the Explorer view with all previous state intact
4. THE AccessDrop_Screen SHALL receive the selected device ID and access token from the Explorer_App

### Requirement 2: Doorstep Event Trigger

**User Story:** As a demo presenter, I want to simulate or detect a doorstep motion event to begin the delivery interaction flow.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL provide a manual trigger button to simulate a Doorstep_Event
2. WHEN a Doorstep_Event is triggered, THE AccessDrop_Screen SHALL transition from idle to active delivery state
3. WHEN a Doorstep_Event is triggered, THE AccessDrop_Screen SHALL display a notification indicating a person has been detected
4. IF the trigger fails, THE AccessDrop_Screen SHALL display an error and remain idle

### Requirement 3: Accessibility Profile Selection

**User Story:** As a demo presenter, I want to switch between text-first and voice-guided modes to demonstrate both customer journeys.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL display two selectable profiles: Text_Mode and Voice_Mode
2. WHEN Text_Mode is selected, THE AccessDrop_Screen SHALL activate the text-first interaction flow
3. WHEN Voice_Mode is selected, THE AccessDrop_Screen SHALL activate the voice-guided interaction flow
4. Mode switching SHALL be allowed at any point during the Delivery_Flow
5. THE AccessDrop_Screen SHALL visually indicate which profile is active

### Requirement 4: Text Mode - Courier Speech Transcription

**User Story:** As a deaf or hard-of-hearing customer, I want to see courier speech as readable text in real time.

#### Acceptance Criteria

1. WHILE Text_Mode is active and a Delivery_Flow is in progress, THE Transcription_Service SHALL convert WHEP_Stream audio into text
2. Transcribed text SHALL be displayed in a readable message panel with clear typography and high contrast
3. IF the Transcription_Service is unavailable, THE AccessDrop_Screen SHALL fall back to mock courier messages
4. Messages SHALL be displayed in chronological order with timestamps
5. The message panel SHALL auto-scroll to show the latest message

### Requirement 5: Text Mode - Customer Action Buttons

**User Story:** As a deaf or hard-of-hearing customer, I want to respond using predefined action buttons without needing to speak.

#### Acceptance Criteria

1. WHILE Text_Mode is active, THE AccessDrop_Screen SHALL display action buttons: confirm safe place, OTP help, mark as received
2. Confirm safe place SHALL display a confirmation message and update the Delivery_Flow state
3. OTP help SHALL display a mock OTP code in the message panel
4. Mark as received SHALL transition the Delivery_Flow to completed
5. Buttons not applicable to the current stage SHALL be disabled

### Requirement 6: Voice Mode - Spoken Delivery Guidance

**User Story:** As a blind or low-vision customer, I want spoken delivery guidance so I can interact without reading a screen.

#### Acceptance Criteria

1. WHEN Voice_Mode is active during a Delivery_Flow, THE Speech_Service SHALL speak a greeting and status message
2. THE Speech_Service SHALL announce each new delivery event using text-to-speech
3. A visual indicator SHALL show when the Speech_Service is actively speaking
4. Handoff acknowledgement in Voice_Mode SHALL speak a confirmation and transition to completed

### Requirement 7: Voice Mode - Parcel Location Support

**User Story:** As a blind or low-vision customer, I want spoken guidance about where my parcel was left.

#### Acceptance Criteria

1. WHEN the courier confirms a safe place in Voice_Mode, THE Speech_Service SHALL speak the location aloud
2. A "Where is my parcel?" action SHALL trigger the Speech_Service to repeat the location
3. IF no location has been confirmed, THE Speech_Service SHALL speak a "not yet confirmed" message

### Requirement 8: Delivery Completed State

**User Story:** As a customer, I want a clear indication that my delivery is complete.

#### Acceptance Criteria

1. WHEN completed, THE AccessDrop_Screen SHALL display a delivery completed summary
2. In Voice_Mode, THE Speech_Service SHALL speak a completion message
3. THE AccessDrop_Screen SHALL provide a reset option to start a new demo
4. All delivery action buttons SHALL be disabled once completed

### Requirement 9: Live Video Feed with Person Detection

**User Story:** As a demo presenter, I want to see the live video feed with person detection on the AccessDrop screen, and have the delivery flow start automatically when a person is detected.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL embed the Person_Detector with its live video feed and bounding box canvas overlay
2. THE Person_Detector SHALL receive device ID and access token as props
3. THE Person_Detector SHALL manage its own WHEP_Stream lifecycle independently of delivery state
4. WHEN the AccessDrop_Screen unmounts, THE Person_Detector SHALL clean up its WHEP_Stream and stop detection
5. THE Person_Detector SHALL render alongside the delivery interaction panels in a side-by-side layout
6. THE Person_Detector SHALL accept an optional onPersonDetected callback invoked when the detected person count changes
7. THE Person_Detector SHALL accept an optional onAudioTrack callback invoked when an audio track is received from the WHEP stream
8. THE Person_Detector SHALL accept an optional onStatusChange callback invoked when stream status changes

### Requirement 10: Automatic Delivery Flow Trigger from Person Detection

**User Story:** As a demo presenter, I want the delivery flow to start automatically when a person is detected, so the demo feels realistic.

#### Acceptance Criteria

1. WHEN person count >= 1 and phase is idle, THE AccessDrop_Screen SHALL dispatch TRIGGER_DOORSTEP after a debounce period
2. WHILE phase is active or completed, subsequent Detection_Events SHALL be ignored
3. Auto-trigger SHALL log a message indicating person detection and auto-triggering
4. In Voice_Mode, auto-trigger SHALL speak a greeting
5. THE debounce period SHALL default to 2 seconds
6. IF person count drops to zero before debounce elapses, the pending trigger SHALL be cancelled
7. THE manual trigger button SHALL remain as a fallback

### Requirement 11: WHEP Audio Stream Integration for Transcription

**User Story:** As a developer, I want the AccessDrop screen to use the WHEP audio stream for real-time transcription.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL extract the audio track from the Person_Detector's WHEP_Stream via the onAudioTrack callback
2. WHEN a Delivery_Flow starts, THE Transcription_Service SHALL use the WHEP audio track for transcription
3. IF the audio track is not yet available when the flow starts, transcription SHALL begin automatically when the track arrives
4. IF the WHEP_Stream fails, THE AccessDrop_Screen SHALL fall back to mock data

### Requirement 12: Detection Status Indicator

**User Story:** As a demo presenter, I want to see the detection status so I know whether auto-trigger is armed.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL display stream status: idle, connecting, live, or error
2. WHILE detecting and phase is idle, THE AccessDrop_Screen SHALL show "Auto-trigger armed"
3. WHEN debounce is counting down, THE AccessDrop_Screen SHALL show a pending trigger indicator
4. Status indicators SHALL have ARIA labels for accessibility

### Requirement 13: WebRTC Connection Resilience

**User Story:** As a demo presenter, I want the stream to automatically reconnect when the WebRTC connection drops.

#### Acceptance Criteria

1. WHEN the WebRTC connection fails, THE Person_Detector SHALL automatically attempt to reconnect
2. THE Person_Detector SHALL retry up to 3 times with increasing delays
3. IF all reconnect attempts fail, THE Person_Detector SHALL display an error message
4. On successful reconnection, the retry counter SHALL reset

### Requirement 14: Accessibility Compliance

**User Story:** As a customer with accessibility needs, I want the interface to follow accessibility best practices.

#### Acceptance Criteria

1. Minimum 16px text for message content, 14px for button labels
2. 4.5:1 colour contrast ratio for all text
3. All interactive elements SHALL be keyboard navigable with visible focus indicators
4. ARIA labels on all action buttons and status indicators
5. ARIA live regions in Voice_Mode for delivery status announcements

### Requirement 15: Mock Data Fallback

**User Story:** As a demo presenter, I want the prototype to work with mock data when AWS services are unavailable.

#### Acceptance Criteria

1. Predefined mock courier messages SHALL simulate a realistic delivery conversation
2. Mock messages SHALL display with realistic timing delays
3. A toggle SHALL allow switching between live transcription and mock mode
4. Mock messages SHALL cover the full Delivery_Flow: greeting, safe place, OTP, confirmation

### Requirement 16: Phone Frame UI

**User Story:** As a demo presenter, I want the delivery controls to appear inside a phone-shaped frame for a realistic mobile app feel.

#### Acceptance Criteria

1. THE delivery controls column SHALL be wrapped in a visual phone frame with notch and home indicator
2. THE phone frame SHALL have a dark theme matching the overall app styling
