// =============================================================================
// Gemini AI Client — Analytical Marching Band Prediction & Recap Engine
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

  // Strip generic school descriptors, then require EXACT match of the cores.
  // Prevents "Francis Howell" from matching "Francis Howell Central".
  const generic = /\b(high|hs|school|academy|community|township|county|district|the)\b/g;
  const strip = (s) => s.replace(generic, "").replace(/\s+/g, " ").trim();
  const sa = strip(na);
  const sb = strip(nb);

  return sa.length > 0 && sa === sb;
}

// ---------------------------------------------------------------------------
// Low-level Gemini call
//
// Thinking enabled at Gemini's native dynamic budget. Costs ~3-6s per call
// instead of ~1s, but produces materially better analytical output.
// maxOutputTokens must be generous since thinking tokens count against it.
// ---------------------------------------------------------------------------
async function callGemini(prompt, { schema = null, temperature = 0.3, maxTokens = 16000, cacheKey = null } = {}) {
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
  const errorsByModel = [];

  for (const model of modelsToTry) {
    const delays = [0, 2000, 4000];
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
        const candidate = data?.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        if (!text) {
          const reason = candidate?.finishReason || "unknown";
          throw new Error(`Empty AI response (finishReason: ${reason})`);
        }
        try {
          return JSON.parse(text);
        } catch {
          throw new Error("AI returned invalid JSON: " + text.slice(0, 150));
        }
      }

      const errText = await res.text();
      lastError = new Error(`${model} → ${res.status}: ${errText.slice(0, 160)}`);
      errorsByModel.push({ model, status: res.status });

      if (res.status === 404 || res.status === 429) {
        console.warn(`[ai] ${model} unavailable (${res.status}), skipping`);
        skipModel = true;
        break;
      }

      if ([502, 503, 504].includes(res.status)) {
        console.warn(`[ai] ${model} attempt ${attempt + 1} got ${res.status}, retrying`);
        continue;
      }

      throw lastError;
    }
  }

  const allRateLimited = errorsByModel.length > 0 && errorsByModel.every(e => e.status === 429);
  if (allRateLimited) {
    throw new Error("Daily quota reached across all models. Try again tomorrow or upgrade API key.");
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
  if (c.musicInd != null)     lines.push(`  - Music Individual: ${c.musicInd.toFixed(3)}`);
  if (c.musicEns != null)     lines.push(`  - Music Ensemble: ${c.musicEns.toFixed(3)}`);
  if (c.musicTotal != null)   lines.push(`  - Music Total: ${c.musicTotal.toFixed(3)}`);
  if (c.visualInd != null)    lines.push(`  - Visual Individual: ${c.visualInd.toFixed(3)}`);
  if (c.visualEns != null)    lines.push(`  - Visual Ensemble: ${c.visualEns.toFixed(3)}`);
  if (c.visualTotal != null)  lines.push(`  - Visual Total: ${c.visualTotal.toFixed(3)}`);
  if (c.geMusic != null)      lines.push(`  - General Effect Music: ${c.geMusic.toFixed(3)}`);
  if (c.geVisual != null)     lines.push(`  - General Effect Visual: ${c.geVisual.toFixed(3)}`);
  if (c.geTotal != null)      lines.push(`  - GE Total: ${c.geTotal.toFixed(3)}`);
  if (c.fieldTiming != null)  lines.push(`  - Field & Timing Penalty: ${c.fieldTiming.toFixed(3)}`);
  return lines.length ? lines.join("\n") : "  (Full caption breakdown not recorded in sheet)";
}

// ---------------------------------------------------------------------------
// Prompt 1: Past Contest Official Performance Summary (FHC Spotlight)
// ---------------------------------------------------------------------------
const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    headline:   { type: "string" },
    summary:    { type: "string" },
    strengths:  { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    trajectory: { type: "string" }
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
    ? priorSeasonScores.map(p => `  * ${p.year} (${comp.name}): ${p.score.toFixed(3)}`).join("\n")
    : "  * No recorded appearances in prior seasons.";

  return `You are an elite competitive marching band adjudicator and data analyst providing executive debriefs for band directors and design coordinators.

=== CONTEST FRAMEWORK ===
- Contest: ${comp.name} (${comp.year}), Location: ${comp.loc}
- Round: ${currentRound}

=== FHC OFFICIAL RESULTS ===
- Official Total Score: ${fhc.base.toFixed(3)}
- Overall Rank: #${rank} of ${roster.length}
- Division / Class: ${fhc.classification || "Open / Single Class"}
- Class Standing: #${classPeers.findIndex(b => b.name === fhc.name) + 1} of ${classPeers.length}
- Class Top Score: ${classWinner ? `${classWinner.name} (${classWinner.base.toFixed(3)})` : "N/A"}
- Class Median Score: ${median != null ? median.toFixed(3) : "N/A"} (FHC Spread: ${median != null ? (fhc.base - median >= 0 ? "+" : "") + (fhc.base - median).toFixed(3) : "N/A"})

=== FHC CAPTION RECAP ===
${captionLines(fhc)}

=== HISTORICAL CONTEST TRACK RECORD ===
${priorSeasonsText}

=== ANALYTICAL GUIDELINES ===
1. Speak directly as an expert marching arts designer. Zero generic promotional fluff ("great energy", "talented students").
2. Focus on caption spreads: Was placement driven by General Effect, Visual Ensemble execution, or Music sub-totals?
3. Quantify every claim with the exact decimal scores provided above.

Return valid JSON adhering to this schema:
${JSON.stringify(SUMMARY_SCHEMA)}`;
}

// ---------------------------------------------------------------------------
// Prompt 2: Upcoming Contest Outlook (FHC Spotlight Context)
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
    ? priorSeasonScores.map(p => `  * ${p.year}: ${p.score.toFixed(3)}`).join("\n")
    : "  * No prior contest history on file.";

  const rank = fhcProjection.projectedRank;
  const score = fhcProjection.projectedScore;
  const advanceNote = fhcProjection.finalsChance != null && fhcProjection.finalsChance > 0
    ? `\n- Projected Finals Advance Probability: ${Math.round(fhcProjection.finalsChance)}%`
    : "";

  return `You are an expert competitive marching band analyst writing an advance scouting outlook for the directors of Francis Howell Central (FHC).

=== CONTEST CONTEXT ===
- Contest: ${comp.name} (${comp.year}) — ${comp.loc}
- Contest Date: ${comp.date}

=== PRE-COMPUTED PROJECTIONS FOR FHC ===
- Projected Score: ${score.toFixed(2)}
- Projected Standing: #${rank} overall${advanceNote}

=== HISTORICAL PERFORMANCES AT THIS CONTEST ===
${priorText}

=== DIRECTIVES ===
1. Do NOT recalculate or contradict the projected numbers above.
2. Explain the exact competitive dynamics: examine scoring trends, calendar week pacing, and what caption performance (Music vs. Visual vs. GE) FHC must deliver to exceed or fall below this projection.
3. Keep the headline under 8 words, bold and journalistic.
4. Reasoning must be exactly 2 dense, insightful sentences with specific context.

Return valid JSON matching this schema:
${JSON.stringify(OUTLOOK_SCHEMA)}`;
}

// ---------------------------------------------------------------------------
// Prompt 3: Field-Wide Standings & Bubble Projections (Upcoming Contests)
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
  const isSuperRegional = comp.name.toLowerCase().includes("super regional") || comp.name.toLowerCase().includes("boa");
  const defaultFinalsSize = isSuperRegional ? 14 : (roster.length >= 16 ? 12 : 10);

  const bandBlocks = roster.map(b => {
    const scores = history[b.name] || [];
    if (scores.length === 0) {
      return `${b.name} (${b.classification || "Unclassified"}):\n  - No historical scores on record.`;
    }
    const lines = scores
      .map(s => `  - ${s.year} ${s.contest}: ${s.score.toFixed(3)}`)
      .join("\n");
    return `${b.name} (${b.classification || "Unclassified"}):\n${lines}`;
  }).join("\n\n");

  const rosterList = roster.map((b, i) => `${i + 1}. ${b.name}${b.classification ? ` [${b.classification}]` : ""}`).join("\n");

  return `You are an elite competitive marching band data analyst modeling projected preliminary-round standings and finals qualification benchmarks for an upcoming event.

=== CONTEST PARAMETERS ===
- Event: ${comp.name} (${comp.year})
- Location: ${comp.loc}
- Contest Date: ${comp.date}
- Multi-Round Event: ${comp.hasFinals ? `YES (Championship Finals round; top ${defaultFinalsSize} advance)` : "NO (Single-round class competition; prelims is final)"}

=== REGISTERED FIELD (${roster.length} PROGRAMS) ===
${rosterList}

=== HISTORICAL SCORING DATABASE BY PROGRAM ===
Each band's full chronological record is listed below, drawn from prior years of this contest, prior years of comparable regional contests, and completed contests this season.

${bandBlocks}

=== PROJECTION METHODOLOGY ===
Think carefully about each program's trajectory before assigning numbers. This is a reasoning task, not a formula.

SCORING:
- Derive every projection from the actual historical records above. Do not assume arbitrary score ceilings, floors, or field-relative adjustments.
- A band's score should reflect where that band actually is. Field strength affects placement, not raw score. A program that has never broken 72 does not suddenly score 79 because they're standing next to a 92.
- Weigh the most recent completed contests most heavily, then prior-year placements at this exact venue, then older data at peer venues.
- Consider trajectory: a program on a multi-year upward curve should be projected to continue that curve; a program that has plateaued should be projected to plateau. Read the data rather than applying a rule.
- Programs with no prior recorded history: estimate from the overall field, mark confidence "low", and say so in the note.

RANK INTEGRITY:
- projectedRank MUST be strictly unique integers from 1 through ${roster.length}.
- projectedScore MUST strictly decrease as projectedRank increases (Rank 1 > Rank 2 > Rank 3 ...). If two programs feel nearly equal, still break the tie.

FINALS BUBBLE:
${comp.hasFinals
  ? `- Set finalsSize = ${defaultFinalsSize}.
- finalsCutoff MUST equal the exact projectedScore of the program placed at rank #${defaultFinalsSize}.
- finalsChance (0-100%): evaluate each program's probability of advancing based on their projected position relative to the cutoff and the volatility evident in their historical record. A lock at rank #3 with a stable record deserves 95%+; a program sitting right on the cut line deserves something near 50%; a program many points below the cut deserves under 10%.`
  : `- This event has NO Finals round. Set finalsSize = 0, finalsCutoff = 0, and finalsChance = 0 for all bands.`}

EXECUTIVE OVERVIEW:
Write a 2-3 sentence overview covering:
- The projected champion and what in their historical record justifies that placement.
- The most compelling competitive storyline in the field (a riser, a faller, or a tight race).
- Francis Howell Central's projected trajectory relative to their own historical baseline.

Return valid JSON matching this schema:
${JSON.stringify(FIELD_PROJECTION_SCHEMA)}`;
}

// ---------------------------------------------------------------------------
// High-level generators
// ---------------------------------------------------------------------------
async function generatePerformanceSummary(comp, fhc, roster, currentRound, priorSeasonScores) {
  const prompt = buildSummaryPrompt(comp, fhc, roster, currentRound, priorSeasonScores);
  return await callGemini(prompt, { schema: SUMMARY_SCHEMA, temperature: 0.3, maxTokens: 8000 });
}

async function generateContestOutlook(comp, fhcProjection, priorSeasonScores, cacheKey = null) {
  const prompt = buildOutlookPrompt(comp, fhcProjection, priorSeasonScores);
  return await callGemini(prompt, { schema: OUTLOOK_SCHEMA, temperature: 0.4, maxTokens: 6000, cacheKey });
}

async function generateFieldProjections(comp, roster, history, cacheKey = null) {
  const prompt = buildFieldProjectionPrompt(comp, roster, history);
  return await callGemini(prompt, { schema: FIELD_PROJECTION_SCHEMA, temperature: 0.2, maxTokens: 24000, cacheKey });
}