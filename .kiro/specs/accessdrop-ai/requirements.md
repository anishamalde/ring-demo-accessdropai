# Requirements Document

## Introduction

AccessDrop AI is an accessibility layer for doorstep delivery powered by Amazon Devices. It extends the existing Ring AVA Explorer app with a dedicated demo screen that supports two primary customer journeys: a text-first flow for deaf or hard-of-hearing customers, and a voice-guided flow for blind or low-vision customers. The feature uses the existing WHEP audio stream from the Ring device, Amazon Transcribe for speech-to-text conversion, and Amazon Polly for text-to-speech output. This is a hackathon MVP prototype that prioritises clarity, accessibility, and strong storytelling over production complexity.

## Glossary

- **Explorer_App**: The existing Ring AVA Explorer React + Vite application with proxy server, live streaming, person detection, and clip download capabilities
- **AccessDrop_Screen**: The new second screen within the Explorer_App that hosts the AccessDrop AI demo UI, accessible via a navigation link from the main Explorer screen
- **Text_Mode**: The accessibility mode designed for deaf or hard-of-hearing customers, displaying courier speech as readable text and providing tap-based interaction buttons
- **Voice_Mode**: The accessibility mode designed for blind or low-vision customers, providing spoken delivery guidance and voice-based parcel location support
- **Transcription_Service**: The component responsible for converting courier audio from the WHEP stream into text, using Amazon Transcribe or a mock fallback
- **Speech_Service**: The component responsible for converting text guidance into spoken audio output, using Amazon Polly
- **Accessibility_Profile**: A selectable customer profile that determines which mode (Text_Mode or Voice_Mode) is active for the demo
- **Doorstep_Event**: A Ring-triggered motion detection event that initiates the delivery interaction flow
- **Delivery_Flow**: The end-to-end sequence of interactions from doorstep event detection through to delivery completion
- **WHEP_Stream**: The existing WebRTC-based live audio and video stream from the Ring device, already implemented in the Explorer_App
- **Proxy_Server**: The existing Express server on port 3001 that handles CORS proxying for Ring API and OAuth endpoints

## Requirements

### Requirement 1: Navigation from Explorer to AccessDrop Screen

**User Story:** As a demo presenter, I want to navigate from the existing Ring AVA Explorer screen to the AccessDrop AI demo screen, so that I can showcase the accessibility feature without losing the existing app functionality.

#### Acceptance Criteria

1. WHEN a device is selected in the Explorer_App, THE AccessDrop_Screen navigation link SHALL become visible within the device actions section
2. WHEN the navigation link is activated, THE Explorer_App SHALL render the AccessDrop_Screen as a separate view while preserving the main Explorer screen state
3. WHEN the user activates the back navigation on the AccessDrop_Screen, THE Explorer_App SHALL return to the main Explorer view with all previous state intact
4. THE AccessDrop_Screen SHALL receive the selected device ID and access token from the Explorer_App

### Requirement 2: Doorstep Event Trigger

**User Story:** As a demo presenter, I want to simulate or detect a Ring doorstep motion event, so that the delivery interaction flow begins with a realistic trigger.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL provide a manual trigger button to simulate a Doorstep_Event for demo purposes
2. WHEN a Doorstep_Event is triggered, THE AccessDrop_Screen SHALL transition from an idle state to an active delivery interaction state
3. WHEN a Doorstep_Event is triggered, THE AccessDrop_Screen SHALL display a notification indicating that a person has been detected at the doorstep
4. IF the Doorstep_Event trigger fails, THEN THE AccessDrop_Screen SHALL display an error message and remain in the idle state

### Requirement 3: Accessibility Profile Selection

**User Story:** As a demo presenter, I want to select or switch between accessibility profiles, so that I can demonstrate both the text-first and voice-guided customer journeys.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL display two selectable Accessibility_Profile options: Text_Mode and Voice_Mode
2. WHEN the user selects Text_Mode, THE AccessDrop_Screen SHALL activate the text-first interaction flow
3. WHEN the user selects Voice_Mode, THE AccessDrop_Screen SHALL activate the voice-guided interaction flow
4. THE AccessDrop_Screen SHALL allow switching between Text_Mode and Voice_Mode at any point during the Delivery_Flow
5. THE AccessDrop_Screen SHALL visually indicate which Accessibility_Profile is currently active

### Requirement 4: Text Mode - Courier Speech Transcription

**User Story:** As a deaf or hard-of-hearing customer, I want to see courier speech displayed as readable text in real time, so that I can understand what the delivery person is communicating.

#### Acceptance Criteria

1. WHILE Text_Mode is active and a Delivery_Flow is in progress, THE Transcription_Service SHALL convert audio from the WHEP_Stream into text
2. WHEN the Transcription_Service produces a transcription result, THE AccessDrop_Screen SHALL display the transcribed text in a readable message panel with clear typography and high contrast
3. IF the Transcription_Service is unavailable, THEN THE AccessDrop_Screen SHALL fall back to displaying mock courier messages to maintain the demo flow
4. THE AccessDrop_Screen SHALL display transcribed messages in chronological order with timestamps
5. WHEN a new transcription message arrives, THE AccessDrop_Screen SHALL auto-scroll the message panel to show the latest message

### Requirement 5: Text Mode - Customer Action Buttons

**User Story:** As a deaf or hard-of-hearing customer, I want to respond to the courier using predefined action buttons, so that I can communicate without needing to speak.

#### Acceptance Criteria

1. WHILE Text_Mode is active and a Delivery_Flow is in progress, THE AccessDrop_Screen SHALL display action buttons for: confirm safe place, OTP help, and mark as received
2. WHEN the user activates the confirm safe place button, THE AccessDrop_Screen SHALL display a confirmation message in the message panel and update the Delivery_Flow state
3. WHEN the user activates the OTP help button, THE AccessDrop_Screen SHALL display a mock OTP code or OTP assistance message in the message panel
4. WHEN the user activates the mark as received button, THE AccessDrop_Screen SHALL transition the Delivery_Flow to the delivery completed state
5. THE AccessDrop_Screen SHALL disable action buttons that are not applicable to the current stage of the Delivery_Flow

### Requirement 6: Voice Mode - Spoken Delivery Guidance

**User Story:** As a blind or low-vision customer, I want to receive spoken delivery guidance, so that I can understand the delivery status and interact with the courier without needing to read a screen.

#### Acceptance Criteria

1. WHEN Voice_Mode is activated and a Delivery_Flow is in progress, THE Speech_Service SHALL speak a greeting and delivery status message aloud
2. WHILE Voice_Mode is active, THE Speech_Service SHALL announce each new delivery event or courier communication using text-to-speech
3. THE AccessDrop_Screen SHALL display a visual indicator showing when the Speech_Service is actively speaking
4. WHEN the user activates a handoff acknowledgement action in Voice_Mode, THE Speech_Service SHALL speak a confirmation message and THE AccessDrop_Screen SHALL transition the Delivery_Flow to the delivery completed state

### Requirement 7: Voice Mode - Parcel Location Support

**User Story:** As a blind or low-vision customer, I want spoken guidance about where my parcel has been left, so that I can locate it without visual assistance.

#### Acceptance Criteria

1. WHEN the courier confirms a safe place in Voice_Mode, THE Speech_Service SHALL speak the parcel location description aloud
2. THE AccessDrop_Screen SHALL provide a "Where is my parcel?" action that triggers the Speech_Service to repeat the parcel location description
3. IF no parcel location has been confirmed, THEN THE Speech_Service SHALL speak a message indicating that the parcel location has not yet been confirmed

### Requirement 8: Delivery Completed State

**User Story:** As a customer, I want a clear indication that my delivery is complete, so that I know the interaction has finished successfully.

#### Acceptance Criteria

1. WHEN the Delivery_Flow reaches the completed state, THE AccessDrop_Screen SHALL display a delivery completed summary
2. WHEN the Delivery_Flow reaches the completed state in Voice_Mode, THE Speech_Service SHALL speak a delivery completion message
3. WHEN the Delivery_Flow is completed, THE AccessDrop_Screen SHALL provide an option to reset and start a new demo
4. THE AccessDrop_Screen SHALL disable all delivery action buttons once the Delivery_Flow reaches the completed state

### Requirement 9: WHEP Audio Stream Integration

**User Story:** As a developer, I want the AccessDrop AI screen to use the existing WHEP audio stream, so that real courier audio can be captured for transcription without duplicating streaming infrastructure.

#### Acceptance Criteria

1. WHEN a Delivery_Flow starts on the AccessDrop_Screen, THE AccessDrop_Screen SHALL establish a WHEP_Stream connection using the existing streaming API from the Explorer_App
2. THE AccessDrop_Screen SHALL extract the audio track from the WHEP_Stream for use by the Transcription_Service
3. WHEN the Delivery_Flow ends, THE AccessDrop_Screen SHALL close the WHEP_Stream session
4. IF the WHEP_Stream connection fails, THEN THE AccessDrop_Screen SHALL display an error and fall back to mock data for the demo

### Requirement 10: Accessibility Compliance

**User Story:** As a customer with accessibility needs, I want the AccessDrop AI interface to follow accessibility best practices, so that the demo itself is usable by people with different abilities.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL use a minimum text size of 16px for all message content and a minimum of 14px for action button labels
2. THE AccessDrop_Screen SHALL maintain a colour contrast ratio of at least 4.5:1 for all text content against its background
3. THE AccessDrop_Screen SHALL ensure all interactive elements are keyboard navigable and have visible focus indicators
4. THE AccessDrop_Screen SHALL provide ARIA labels for all action buttons and status indicators
5. WHILE Voice_Mode is active, THE AccessDrop_Screen SHALL use ARIA live regions to announce delivery status changes to screen readers

### Requirement 11: Mock Data Fallback

**User Story:** As a demo presenter, I want the prototype to work with mock data when AWS services are unavailable, so that the demo flow is reliable during a hackathon presentation.

#### Acceptance Criteria

1. THE AccessDrop_Screen SHALL include a set of predefined mock courier messages that simulate a realistic delivery conversation
2. WHEN mock mode is active, THE AccessDrop_Screen SHALL display mock courier messages with realistic timing delays to simulate a live conversation
3. THE AccessDrop_Screen SHALL provide a toggle or automatic detection to switch between live Transcription_Service and mock data mode
4. THE mock courier messages SHALL cover the full Delivery_Flow including greeting, safe place discussion, OTP exchange, and delivery confirmation
