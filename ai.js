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
// Fuzzy band-name match
// ---------------------------------------------------------------------------
function bandNameMatches(a, b) {
  const norm = (s) => (s || "").toLowerCase()
    .replace(/\s+high school$/i, "")
    .replace(/\s+hs$/i, "")
    .replace(/[,.']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 8 && nb.length >= 8) {
    return na.includes(nb) || nb.includes(na);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Low-level Gemini call
//
// Status handling:
//   2xx             → success
//   404             → model retired, skip to next model immediately
//   429             → rate limit / quota, skip to next model immediately
//   502/503/504     → transient overload, retry same model up to 3x
//   network err     → retry same model up to 3x
//   400/401/403     → request-wide problem, abort everything
// ---------------------------------------------------------------------------
async function callGemini(prompt, { schema = null, temperature = 0.7, maxTokens = 4000, cacheKey = null } = {}) {
  if (!GEMINI_PROXY_URL || GEMINI_PROXY_URL.includes("YOUR-SUBDOMAIN")) {
    throw new Error("AI proxy URL not configured — edit config.js");
  }

  const generationConfig = {
    temperature,
    maxOutputTokens: maxTokens,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingBudget: 0 }
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
  const errorsByModel = [];

  for (const model of modelsToTry) {
    const delays = [0, 2000, 5000];
    let skipModel = false;

    for (let attempt = 0; attempt < delays.length && !skipModel; attempt++) {
      if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));

      const headers = { "Content-Type": "application/json" };
      if (cacheKey) headers["X-Cache-Key"] = cacheKey;

      let res;
      try {
        res = await fetch(`${GEMINI_PROXY_URL}?model=${model}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });
      } catch (netErr) {
        lastError = netErr;
        console.warn(`[ai] ${model} attempt ${attempt + 1}: network error`);
        continue;
      }

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");
        try {
          return JSON.parse(text);
        } catch {
          throw new Error("AI returned invalid JSON: " + text.slice(0, 150));
        }
      }

      const errText = await res.text();
      lastError = new Error(`${model} → ${res.status}: ${errText.slice(0, 160)}`);
      errorsByModel.push({ model, status: res.status });

      // 404: model retired / doesn't exist. Skip to next model.
      if (res.status === 404) {
        console.warn(`[ai] ${model} is not available, skipping to next model`);
        skipModel = true;
        break;
      }

      // 429: rate limited or out of quota. Retrying the same model won't help
      // (Gemini's free-tier quota is per-project), so skip straight to the next.
      if (res.status === 429) {
        console.warn(`[ai] ${model} rate limited (429), skipping to next model`);
        skipModel = true;
        break;
      }

      // 400: often means this model doesn't support thinkingConfig.
      // Retry once without it before giving up.
      if (res.status === 400 && generationConfig.thinkingConfig) {
        console.warn(`[ai] ${model} rejected thinkingConfig, retrying without it`);
        delete generationConfig.thinkingConfig;
        attempt--;
        continue;
      }

      // Transient overload: retry same model
      if ([502, 503, 504].includes(res.status)) {
        console.warn(`[ai] ${model} attempt ${attempt + 1} got ${res.status}, retrying`);
        continue;
      }

      // Anything else — request-wide problem, no point trying other models
      throw lastError;
    }
  }

  // All models exhausted. Build a helpful error.
  const allRateLimited = errorsByModel.length > 0 &&
    errorsByModel.every(e => e.status === 429);

  if (allRateLimited) {
    throw new Error(
      "Daily quota reached across all models. Gemini's free tier resets daily; " +
      "try again tomorrow, or upgrade to a paid tier for higher limits."
    );
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
// Prompt: past-contest performance summary (FHC spotlight)
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
// Prompt: upcoming-contest outlook text (FHC spotlight headline + reasoning)
// The numeric projection comes from the field-wide projection. This call
// only writes the reasoning/headline. Numbers are passed in for context so
// the reasoning matches what's shown on the tiles.
// ---------------------------------------------------------------------------
const OUTLOOK_SCHEMA = {
  type: "object",
  properties: {
    headline:  { type: "string" },
    reasoning: { type: "string" }
  },
  required: ["headline", "reasoning"]
};

function buildOutlookPrompt(comp, fhcProjection, priorSeasonScores) {
  const priorText = priorSeasonScores.length
    ? priorSeasonScores.map(p => `  ${p.year}: ${p.score.toFixed(3)}`).join("\n")
    : "  (FHC has no prior appearances at this contest)";

  const rank = fhcProjection.projectedRank;
  const score = fhcProjection.projectedScore;
  const finalsLine = fhcProjection.finalsChance != null && fhcProjection.finalsChance > 0
    ? `\nProjected finals-advance chance: ${Math.round(fhcProjection.finalsChance)}%`
    : "";

  return `You are a marching band competition analyst writing for band directors. Cite specific numbers. Do not use filler phrases like "showcased their talents" or "demonstrated excellence". Be direct.

=== CONTEXT ===
Contest: ${comp.name} (${comp.year}), ${comp.loc}
Date: ${comp.date}

A separate field-wide projection model has already calculated these numbers for Francis Howell Central at this contest:
  Projected preliminary score: ${score.toFixed(2)}
  Projected rank: #${rank}${finalsLine}

FHC prior appearances at this same contest:
${priorText}

=== TASK ===
Do NOT recompute or restate the projected score/rank. Instead, write text that explains WHY these numbers make sense.

Return JSON with these fields:
- headline: 8 words or fewer. Concrete, not promotional. May reference the placement.
- reasoning: exactly 2 sentences. Explain what FHC's history at this contest and this season suggests, and what would need to go right (or wrong) for them to beat or miss the projection.

Output JSON only, matching this schema exactly: ${JSON.stringify(OUTLOOK_SCHEMA)}`;
}

// ---------------------------------------------------------------------------
// Prompt: field-wide projected standings (upcoming contests)
// ---------------------------------------------------------------------------
const FIELD_PROJECTION_SCHEMA = {
  type: "object",
  properties: {
    overview:      { type: "string" },
    finalsSize:    { type: "number" },
    finalsCutoff:  { type: "number" },
    projections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name:            { type: "string" },
          projectedScore:  { type: "number" },
          projectedRank:   { type: "number" },
          finalsChance:    { type: "number" },
          confidence:      { type: "string", enum: ["low", "medium", "high"] },
          note:            { type: "string" }
        },
        required: ["name", "projectedScore", "projectedRank", "finalsChance", "confidence", "note"]
      }
    }
  },
  required: ["overview", "finalsSize", "finalsCutoff", "projections"]
};

function buildFieldProjectionPrompt(comp, roster, history) {
  const bandBlocks = roster.map(b => {
    const scores = history[b.name] || [];
    if (scores.length === 0) {
      return `${b.name}:\n  (no prior history available)`;
    }
    const lines = scores
      .map(s => `  ${s.year} ${s.contest}: ${s.score.toFixed(3)}`)
      .join("\n");
    return `${b.name}:\n${lines}`;
  }).join("\n\n");

  const rosterList = roster.map((b, i) => `${i + 1}. ${b.name}${b.classification ? ` (${b.classification})` : ""}`).join("\n");

  return `You are a marching band competition analyst projecting final preliminary-round standings for an upcoming contest. Cite specific numbers. Do not use filler. Commit to projections.

=== CONTEST ===
${comp.name} (${comp.year}) — ${comp.loc}
Date: ${comp.date}
Finals round: ${comp.hasFinals ? "Yes — top bands advance" : "No — single round, prelims is final"}

=== REGISTERED BANDS (${roster.length}) ===
${rosterList}

=== HISTORICAL SCORES PER BAND ===
(Full history: all prior years of this contest, all prior years of peer contests, all completed contests this season)

${bandBlocks}

=== TASK ===
Project final preliminary-round standings for all ${roster.length} registered bands.

Rules:
- Use each band's full history as the primary signal. Look for multi-year growth trajectories, not just the most recent score.
- Bands with current-season momentum should be projected near their current trajectory, adjusted for venue difficulty.
- Bands with scores at this same contest in prior years should be anchored to that pattern plus their growth curve.
- Bands with ZERO history → mid-pack, low confidence, note explaining the projection is a field-median estimate.
- projectedRank must be unique integers 1 through ${roster.length}.
- projectedScore should be realistic (marching band range 45-95).

FINALS CHANCE:
${comp.hasFinals
  ? `This contest has a finals round. Estimate finalsSize (how many bands advance — commonly 10-14 for a field this size) and finalsCutoff (the projected score of the last band to make the cut). For each band, compute finalsChance as a percentage (0-100) representing the probability they advance. Use the cut line as the 50% anchor: bands projected well above the cutoff should be 90-100%, bands right at the cutoff around 40-60%, bands well below 0-15%.`
  : `This contest has NO finals round. Set finalsSize = 0, finalsCutoff = 0, and finalsChance = 0 for every band.`}

OVERVIEW:
Write a 2-3 sentence overview that names:
1. The projected winner and their likely score.
2. The most notable projection (a band that over- or under-performs its history).
${comp.hasFinals ? `3. The projected finals bubble — who's on the edge of making the cut and what score they need.` : ""}

Return JSON with these fields:
- overview: string
- finalsSize: number
- finalsCutoff: number
- projections: array of ${roster.length} entries, each with:
  - name: exact band name
  - projectedScore: number
  - projectedRank: integer
  - finalsChance: number (0-100)
  - confidence: "low" | "medium" | "high"
  - note: 1-2 sentences of reasoning. Cite the specific historical scores that informed this projection.

Output JSON only, matching this schema exactly: ${JSON.stringify(FIELD_PROJECTION_SCHEMA)}`;
}

// ---------------------------------------------------------------------------
// High-level generators
// ---------------------------------------------------------------------------
async function generatePerformanceSummary(comp, fhc, roster, currentRound, priorSeasonScores) {
  const prompt = buildSummaryPrompt(comp, fhc, roster, currentRound, priorSeasonScores);
  return await callGemini(prompt, { schema: SUMMARY_SCHEMA, temperature: 0.5, maxTokens: 4000 });
}

async function generateContestOutlook(comp, fhcProjection, priorSeasonScores, cacheKey = null) {
  const prompt = buildOutlookPrompt(comp, fhcProjection, priorSeasonScores);
  return await callGemini(prompt, { schema: OUTLOOK_SCHEMA, temperature: 0.6, maxTokens: 1500, cacheKey });
}

async function generateFieldProjections(comp, roster, history, cacheKey = null) {
  const prompt = buildFieldProjectionPrompt(comp, roster, history);
  return await callGemini(prompt, { schema: FIELD_PROJECTION_SCHEMA, temperature: 0.5, maxTokens: 8000, cacheKey });
}