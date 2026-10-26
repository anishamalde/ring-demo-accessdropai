// Runtime config from .env (see .env.example). Vite only exposes VITE_* vars to the browser.
const env = import.meta.env;

export const PROXY_URL = env.VITE_PROXY_URL || 'http://localhost:3001';
export const RING_API_BASE_URL = env.VITE_RING_API_BASE_URL || 'https://api.amazonvision.com';

export const RING_CREDENTIALS = {
  accessToken: env.VITE_RING_ACCESS_TOKEN || '',
  refreshToken: env.VITE_RING_REFRESH_TOKEN || '',
  clientId: env.VITE_RING_CLIENT_ID || '',
  clientSecret: env.VITE_RING_CLIENT_SECRET || '',
};
