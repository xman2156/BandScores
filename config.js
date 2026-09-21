// ============================================================
// AI Proxy Configuration
// ============================================================
// Gemini calls are proxied through a Cloudflare Worker so the
// API key stays server-side and is never exposed to the browser.
// Safe to commit this file to a public repo.

const GEMINI_PROXY_URL = "https://band-scores-ai.xman2156.workers.dev/generate";

// Primary model, plus fallbacks tried in order if the primary is overloaded (503).
const GEMINI_MODELS = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];

// Backward-compat alias (some code may still reference GEMINI_MODEL)
const GEMINI_MODEL = GEMINI_MODELS[0];