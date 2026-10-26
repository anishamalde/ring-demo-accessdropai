# AccessDrop AI

**Accessible doorstep delivery powered by Amazon Devices (Ring & Alexa+)**

> **Hackathon submission.** This repo is a hackathon MVP, built and demoed over a short hackathon window. It's a working prototype, not production code. Some service paths are mocked or simplified for demo reliability (see [Built vs mocked](#built-vs-mocked)).

## Demo videos

- [Text Mode demo](https://github.com/anishamalde/ring-demo-accessdropai/releases/download/hackathon-demo/accessdrop-text-mode.mov): courier speech transcribed into readable messages for a deaf or hard-of-hearing customer
- [Voice Mode demo](https://github.com/anishamalde/ring-demo-accessdropai/releases/download/hackathon-demo/accessdrop-voice-mode.mov): spoken delivery guidance for a blind or low-vision customer

Both videos are also on the [hackathon-demo release](https://github.com/anishamalde/ring-demo-accessdropai/releases/tag/hackathon-demo).

## Why this exists

Doorstep delivery is still a synchronous audio-visual interaction. It assumes the customer can hear the courier, respond instantly, and visually confirm where the parcel was left. For many people, that assumption breaks.

AccessDrop AI treats accessibility as a systems design problem rather than an edge case. Instead of changing courier workflows, it changes how the delivery moment is interpreted and communicated to the customer. Same doorstep signal, same stream, same delivery moment, different output:

- Readable delivery communication for deaf or hard-of-hearing customers
- Spoken parcel guidance for blind or low-vision customers
- Hands-free support for anyone who can't (or doesn't want to) get up straight away

## What it does

AccessDrop AI is an accessibility layer built on top of the Ring AVA Explorer app. It supports two customer journeys:

- **Text Mode** (deaf / hard of hearing): courier speech is transcribed with Amazon Transcribe and shown as readable messages with action buttons (Confirm Safe Place, OTP Help, Mark as Received)
- **Voice Mode** (blind / low vision): spoken delivery guidance via Amazon Polly, a speaking indicator, and a "Where is my parcel?" button that replays the parcel location

Both journeys share one delivery state machine. Delivery can be triggered manually or automatically when a person is detected at the door.

## How it works

1. A Ring device provides a live WHEP stream from the doorstep
2. `PersonDetector` runs COCO-SSD on an offscreen canvas and watches for people in frame
3. When a person is detected while idle, a 2-second debounce starts the auto-trigger
4. The delivery flow moves from `idle` to `active`
5. Text Mode: audio from the WHEP stream goes to the transcription pipeline (WebSocket to the local proxy, then Amazon Transcribe)
6. Voice Mode: spoken prompts are generated through Amazon Polly
7. Confirming a safe place moves the flow to `completed`
8. The UI shows a delivery summary and a reset button for the next demo

### State machine

`deliveryFlowEngine.js` manages every transition so both modes stay consistent.

```
DeliveryState { phase, mode, messages, parcelLocation, otpCode, safePlace,
                startedAt, completedAt, useMockData, error }

Actions: TRIGGER_DOORSTEP, ADD_MESSAGE, CONFIRM_SAFE_PLACE (-> completed),
         REQUEST_OTP, MARK_RECEIVED, ACKNOWLEDGE_DELIVERY, SET_MODE,
         SET_MOCK_MODE, SET_ERROR, RESET
```

Rules: mode switching preserves other state, messages stay chronological, completion actions only apply while active, and invalid transitions are ignored.

### Key components (`ring-ava-explorer/src/`)

| File | Role |
|------|------|
| `AccessDropScreen.jsx` | Main orchestrator: reducer, phone-frame UI, mode selector, auto-trigger debounce, transcription start/restart |
| `PersonDetector.jsx` | Owns the WHEP stream lifecycle, auto-reconnect, COCO-SSD detection (320x240 canvas every 3s), bounding boxes, `onAudioTrack` |
| `TextModePanel.jsx` | Scrollable message list with courier/customer labels and stacked action buttons |
| `VoiceModePanel.jsx` | Speaking indicator, parcel location, "Where is my parcel?" |
| `DeliveryStatusBar.jsx` | Phase indicator with ARIA labels |
| `deliveryFlowEngine.js` | Shared delivery state machine |
| `autoTriggerLogic.js` | Person-detection auto-trigger rules |
| `speechService.js` | Polly text-to-speech via the proxy |
| `transcriptionService.js` | WebSocket client for streaming transcription |
| `mockData.js` | Fallback message flows |
| `proxy-server.js` | Local proxy for Ring API, OAuth, `/api/accessdrop/tts` and `/ws/transcribe` |

### Resilience

- WHEP failures retry up to 3 times (2s / 4s / 6s), cleaning up the previous connection first
- Transcription failures switch to mock mode automatically
- Polly failures fail silently
- A guard ref prevents duplicate transcription sessions

## Built vs mocked

**Built:** dedicated AccessDrop screen inside Ring AVA Explorer, live video and person detection, shared state machine, Text and Voice Mode panels, Amazon Transcribe and Polly paths, proxy wiring, presenter controls, restart/fallback/cleanup logic.

**Mocked or simplified:** fallback message flows when services are unstable, presenter-controlled triggering for demo predictability, simplified orchestration around some service paths, and Polly standing in for Alexa-style spoken support.

## Running it locally

You'll need Node 18+, Ring AVA partner credentials, and AWS credentials with access to Polly and Transcribe (picked up from your default AWS credential chain).

```bash
cd ring-ava-explorer
npm install
cp config.example.js config.js   # add your Ring AVA tokens and partner credentials
npm run dev
```

This starts Vite on `http://localhost:5173` and the proxy on `http://127.0.0.1:3001`. Open the app and click **AccessDrop AI**.

The proxy only listens on loopback and only accepts requests from the Vite dev origin, because it uses your local AWS credentials. Keep it that way.

`config.js` is gitignored. Never commit real credentials.

### Tests

```bash
npm test
```

46 tests across 4 files (Vitest, React Testing Library, fast-check), including property-based tests for the auto-trigger logic.

## Specs

The Kiro spec docs (requirements, design, tasks) live in [`.kiro/specs/accessdrop-ai/`](.kiro/specs/accessdrop-ai/).

## Team

- **Varun Behl**: product story, delivery use case, business framing
- **Mine Sinal**: storyboard, visual design, UI
- **Anisha Malde**: demo build using the Ring API and Kiro, integration support
- **Aarthi Ilangovan**: AI and analytics, logic support
