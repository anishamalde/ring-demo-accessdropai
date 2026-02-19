# Ring AVA Explorer

A React-based web app for exploring the Ring AVA (Amazon Vision API). View live streams, detect people using TensorFlow.js, and download video clips from Ring devices.

## Features

- OAuth token management and refresh
- Device discovery and status
- Live video streaming
- Real-time person detection with TensorFlow.js COCO-SSD
- Video clip download and analysis

## Setup

1. Install dependencies:
```bash
cd ring-ava-explorer
npm install
```

2. Configure credentials in `config.js`:
   - Add your Ring AVA OAuth tokens
   - Add your partner client ID and secret

3. Run the app:
```bash
npm run dev
```

This starts both the Vite dev server (port 5173) and the CORS proxy (port 3001).

## Project Structure

- `src/App.jsx` - Main app with device management
- `src/LiveStream.jsx` - Live video streaming component
- `src/PersonDetector.jsx` - TensorFlow.js person detection
- `src/ClipDownloader.jsx` - Video clip download and analysis
- `src/api.js` - Ring AVA API client
- `proxy-server.js` - Local CORS proxy for Ring API calls
- `config.js` - API credentials (DO NOT commit)

## Security

Never commit `config.js` with real credentials. It's gitignored by default.
