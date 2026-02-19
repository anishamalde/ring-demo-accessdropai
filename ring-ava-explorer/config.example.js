// Ring AVA API Credentials
// Copy this file to config.js and add your credentials.
// DO NOT commit config.js to version control.

export const CONFIG = {
  // Your OAuth access token (expires every 4 hours)
  accessToken: '',

  // Your refresh token (use to get a new access token)
  refreshToken: '',

  // Partner credentials (issued during onboarding)
  clientId: '',
  clientSecret: '',

  // Ring API base URL
  apiBaseUrl: 'https://api.amazonvision.com',

  // Ring OAuth URL
  oauthUrl: 'https://oauth.ring.com',

  // Local proxy (so we avoid CORS issues on localhost)
  proxyUrl: 'http://localhost:3001',
};
