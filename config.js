// ============================================================
// AI Proxy Configuration
// ============================================================
// Gemini calls are proxied through a Cloudflare Worker so the
// API key stays server-side and is never exposed to the browser.
// Safe to commit this file to a public repo.

const GEMINI_PROXY_URL = "https://band-scores-ai.xman2156.workers.dev/generate";
const GEMINI_MODEL = "gemini-flash-latest";