/**
 * Set EXPO_PUBLIC_API_URL in .env (e.g. https://api.focusflow.app).
 * When it is missing, cloud sync is disabled and the app stays fully offline.
 * Note: from a phone, "localhost" is the phone itself. Use your machine's LAN IP in development.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
export const SYNC_ENABLED = API_URL.length > 0;
export const REQUEST_TIMEOUT_MS = 20_000;
