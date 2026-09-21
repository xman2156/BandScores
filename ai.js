// =============================================================================
// Gemini AI Client — proxied through Cloudflare Worker
// =============================================================================

// ---------------------------------------------------------------------------
// Cache (localStorage, 24h TTL)
// ---------------------------------------------------------------------------
function hashData(obj) {
  const s = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return "ai_" + Math.abs(h).toString(36);
}

function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { value, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(key); return null; }
    return value;
  } catch { return null; }
}

function setCache(key, value, ttlHours = 24) {
  try {
    localStorage.setItem(key, JSON.stringify({
      value,
      expires: Date.now() + ttlHours * 3600 * 1000
    }));
  } catch (e) {
    console.warn("[ai] cache write failed (storage quota?):", e);
  }
}

// ---------------------------------------------------------------------------
// Low-level Gemini call (via Worker proxy, with retry + model fallback)
// ---------------------------------------------------------------------------
async function callGemini(prompt, { schema = null, temperature = 0.7, maxTokens = 800 } = {}) {
  if (!GEMINI_PROXY_URL || GEMINI_PROXY_URL.includes("YOUR-SUBDOMAIN")) {
    throw new Error("AI proxy URL not configured — edit config.js");
  }

  const generationConfig = {
    temperature,
    maxOutputTokens: maxTokens,
    responseMimeType: "application/json"
  };
  if (schema) generationConfig.responseSchema = schema;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig
  };

  const modelsToTry = (typeof GEMINI_MODELS !== "undefined" && GEMINI_MODELS.length)
    ? GEMINI_MODELS
    : [GEMINI_MODEL || "gemini-flash-latest"];

  let lastError = null;

  for (const model of modelsToTry) {
    // Up to 3 attempts per model: immediate, +2s, +5s
    const delays = [0, 2000, 5000];

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        await new Promise(r => setTimeout(r, delays[attempt]));
      }

      try {
        const res = await fetch(`${GEMINI_PROXY_URL}?model=${model}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        // Retry on transient errors; give up immediately on client errors
        if (res.status === 503 || res.status === 502 || res.status === 504 || res.status === 429) {
          const errText = await res.text();
          lastError = new Error(`${model} → ${res.status}: ${errText.slice(0, 160)}`);
          console.warn(`[ai] ${model} attempt ${attempt + 1} failed (${res.status}), retrying...`);
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`AI proxy ${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");

        try {
          return JSON.parse(text);
        } catch {
          throw new Error("AI returned invalid JSON: " + text.slice(0, 150));
        }
      } catch (err) {
        lastError = err;
        // Hard errors (JSON parse, 4xx) shouldn't be retried on this model
        if (!/50\d|429|fetch/i.test(err.message)) throw err;
        console.warn(`[ai] ${model} attempt ${attempt + 1} threw:`, err.message);
      }
    }

    console.warn(`[ai] ${model} exhausted — trying next model if available`);
  }

  throw new Error(`All models unavailable. Last: ${lastError?.message || "unknown"}`);
}

// ---------------------------------------------------------------------------
// Helpers for prompt-building
// ---------------------------------------------------------------------------
function classMedian(roster, classification) {
  const peers = roster.filter(b => b.classification === classification && b.base > 0);
  if (peers.length === 0) return null;
  const sorted = peers.map(b => b.base).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function captionLines(band) {
  const c = band.captions || {};
  const lines = [];
  if (c.musicInd != null)     lines.push(`  Music Individual: ${c.musicInd.toFixed(3)}`);
  if (c.musicEns != null)     lines.push(`  Music Ensemble: ${c.musicEns.toFixed(3)}`);
  if (c.musicTotal != null)   lines.push(`  Music Total: ${c.musicTotal.toFixed(3)}`);
  if (c.visualInd != null)    lines.push(`  Visual Individual: ${c.visualInd.toFixed(3)}`);
  if (c.visualEns != null)    lines.push(`  Visual Ensemble: ${c.visualEns.toFixed(3)}`);
  if (c.visualTotal != null)  lines.push(`  Visual Total: ${c.visualTotal.toFixed(3)}`);
  if (c.geMusic != null)      lines.push(`  GE Music: ${c.geMusic.toFixed(3)}`);
  if (c.geVisual != null)     lines.push(`  GE Visual: ${c.geVisual.toFixed(3)}`);
  if (c.geTotal != null)      lines.push(`  GE Total: ${c.geTotal.toFixed(3)}`);
  if (c.fieldTiming != null)  lines.push(`  Field & Timing: ${c.fieldTiming.toFixed(3)}`);
  return lines.length ? lines.join("\n") : "  (no caption breakdown available)";
}

// ---------------------------------------------------------------------------
// Prompt: past-contest performance summary
// ---------------------------------------------------------------------------
const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    headline:  { type: "string" },
    summary:   { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses:{ type: "array", items: { type: "string" } },
    trajectory:{ type: "string" }
  },
  required: ["headline", "summary", "strengths", "weaknesses", "trajectory"]
};

function buildSummaryPrompt(comp, fhc, roster, currentRound, priorSeasonScores) {
  const sorted = [...roster].sort((a, b) => b.base - a.base);
  const rank = sorted.findIndex(b => b.name === fhc.name) + 1;
  const classPeers = roster.filter(b => b.classification === fhc.classification && b.base > 0).sort((a, b) => b.base - a.base);
  const classWinner = classPeers[0];
  const median = classMedian(roster, fhc.classification);

  const priorSeasonsText = priorSeasonScores.length
    ? priorSeasonScores.map(p => `  ${p.year} (${comp.name}): ${p.score.toFixed(3)}`).join("\n")
    : "  (no prior same-contest history)";

  return `You are a marching band competition analyst writing for band directors. Cite specific numbers. Do not use filler phrases like "showcased their talents" or "demonstrated excellence". Be direct.

=== CONTEXT ===
Contest: ${comp.name} (${comp.year}), ${comp.loc}
Round: ${currentRound}

FHC result: ${fhc.base.toFixed(3)} — Rank #${rank} of ${roster.length} total bands
FHC class: ${fhc.classification || "unclassified"}
Class rank: ${classPeers.findIndex(b => b.name === fhc.name) + 1} of ${classPeers.length}

FHC caption breakdown:
${captionLines(fhc)}

Class winner: ${classWinner ? `${classWinner.name} — ${classWinner.base.toFixed(3)}` : "n/a"}
Class median: ${median != null ? median.toFixed(3) : "n/a"}
FHC delta vs class median: ${median != null ? (fhc.base - median).toFixed(3) : "n/a"}

FHC prior appearances at this same contest:
${priorSeasonsText}

=== TASK ===
Return JSON with these fields:
- headline: 8 words or fewer. Concrete, not promotional.
- summary: 2 sentences. Cite specific caption numbers and explain what drove the placement.
- strengths: 1-2 bullets, each citing a specific number.
- weaknesses: 1-2 bullets, each citing a specific number.
- trajectory: 1 sentence on how this compares to FHC's prior appearances at this contest.

Output JSON only, matching this schema exactly: ${JSON.stringify(SUMMARY_SCHEMA)}`;
}

// ---------------------------------------------------------------------------
// Prompt: upcoming-contest outlook
// ---------------------------------------------------------------------------
const OUTLOOK_SCHEMA = {
  type: "object",
  properties: {
    projectedScore:     { type: "number" },
    projectedPlacement: { type: "string" },
    reasoning:          { type: "string" },
    confidence:         { type: "string", enum: ["low", "medium", "high"] }
  },
  required: ["projectedScore", "projectedPlacement", "reasoning", "confidence"]
};

function buildOutlookPrompt(comp, roster, priorSeasonScores, currentSeasonScores) {
  const registeredBands = roster.map(b => b.name);
  const notable = registeredBands.slice(0, 8).join(", ");

  const priorText = priorSeasonScores.length
    ? priorSeasonScores.map(p => `  ${p.year}: ${p.score.toFixed(3)}`).join("\n")
    : "  (FHC has no prior appearances at this contest)";

  const currentText = currentSeasonScores.length
    ? currentSeasonScores.map(s => `  ${s.contest} (${s.date}): ${s.score.toFixed(3)}`).join("\n")
    : "  (no completed 2026 contests yet)";

  return `You are a marching band competition analyst projecting outcomes for an upcoming contest. Be specific. Do not hedge with "could" or "might" — commit to a projection.

=== CONTEXT ===
Contest: ${comp.name} (${comp.year}), ${comp.loc}
Date: ${comp.date}

FHC prior appearances at this same contest:
${priorText}

FHC 2026 season to date:
${currentText}

Field size: ${roster.length} bands registered
Sample of registered bands: ${notable}

=== TASK ===
Project Francis Howell Central's likely score and placement at this contest.

Return JSON with these fields:
- projectedScore: number (e.g. 74.2)
- projectedPlacement: short string (e.g. "top 15 of Class AAA" or "#4-7 in Class AAAA")
- reasoning: 2 sentences. Cite specific historical scores and current-season trajectory.
- confidence: "low" | "medium" | "high"

Output JSON only, matching this schema exactly: ${JSON.stringify(OUTLOOK_SCHEMA)}`;
}

// ---------------------------------------------------------------------------
// High-level generators
// ---------------------------------------------------------------------------
async function generatePerformanceSummary(comp, fhc, roster, currentRound, priorSeasonScores) {
  const prompt = buildSummaryPrompt(comp, fhc, roster, currentRound, priorSeasonScores);
  return await callGemini(prompt, { schema: SUMMARY_SCHEMA, temperature: 0.5 });
}

async function generateContestOutlook(comp, roster, priorSeasonScores, currentSeasonScores) {
  const prompt = buildOutlookPrompt(comp, roster, priorSeasonScores, currentSeasonScores);
  return await callGemini(prompt, { schema: OUTLOOK_SCHEMA, temperature: 0.6 });
}