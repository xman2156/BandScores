// ============================================================
// AI Proxy Configuration
// ============================================================
// Gemini calls are proxied through a Cloudflare Worker so the
// API key stays server-side and is never exposed to the browser.
// Safe to commit this file to a public repo.

const GEMINI_PROXY_URL = "https://band-scores-ai.xman2156.workers.dev/generate";

// Tried in order. A 404 (retired model) skips to the next; a 503
// (overloaded) retries three times before moving on.
//
// Only models that support `generateContent` with `responseSchema`
// belong here. Excluded on purpose:
//   - *-live / *-live-* : real-time streaming API, different endpoint
//   - *-image (Nano Banana) : image generation
//   - *-tts / *-transcribe : speech in/out
const GEMINI_MODELS = [
  "gemini-3.7-flash",        // newest general Flash — primary
  "gemini-3.6-flash",        // previous generation — first fallback
  "gemini-3.5-flash",        // older but reliable
  "gemini-3.5-flash-lite"    // last resort — cheapest, always available
];

// Backward-compat alias (some code may still reference GEMINI_MODEL)
const GEMINI_MODEL = GEMINI_MODELS[0];