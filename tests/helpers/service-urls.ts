/**
 * Centralized service base URLs for E2E tests.
 *
 * When running against a deployed frontend (Vercel), API routes like `/api/ai/*`
 * may not exist on that same domain. These URLs let tests call the correct
 * backend/AI services directly.
 */
const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '');

export const FRONTEND_BASE_URL = trimTrailingSlash(
  process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://dellsystemmanager.vercel.app'
);

// Prefer explicit Playwright overrides, then reuse the app's public env vars if present.
export const BACKEND_BASE_URL = trimTrailingSlash(
  process.env.PLAYWRIGHT_BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'https://geosyntec-backend-ugea.onrender.com'
);

export const AI_SERVICE_BASE_URL = trimTrailingSlash(
  process.env.PLAYWRIGHT_AI_SERVICE_URL ||
    process.env.NEXT_PUBLIC_AI_SERVICE_URL ||
    'https://geosyntec-backend.onrender.com'
);


