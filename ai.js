// =============================================================================
// Gemini AI Client — Analytical Marching Band Prediction & Recap Engine
// =============================================================================

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

  const generic = /\b(high|hs|school|academy|community|township|county|district|the)\b/g;
  const strip = (s) => s.replace(generic, "").replace(/\s+/g, " ").trim();
  const sa = strip(na);
  const sb = strip(nb);

  return sa.length > 0 && sa === sb;
}

async function callGemini(prompt, { schema = null, temperature = 0.3, maxTokens = 24000, cacheKey = null, asText = false } = {}) {
  if (!GEMINI_PROXY_URL || GEMINI_PROXY_URL.includes("YOUR-SUBDOMAIN")) {
    throw new Error("AI proxy URL not configured — edit config.js");
  }

  const generationConfig = {
    temperature,
    maxOutputTokens: maxTokens
  };
  if (!asText) {
    generationConfig.responseMimeType = "application/json";
    if (schema) generationConfig.responseSchema = schema;
  }

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
        if (asText) return text;
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
  return lines.length ? lines.join("\n") : null;
}

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
${captionLines(fhc) || "  (Full caption breakdown not recorded)"}

=== HISTORICAL CONTEST TRACK RECORD ===
${priorSeasonsText}

=== ANALYTICAL GUIDELINES ===
1. Speak directly as an expert marching arts designer. Zero generic promotional fluff.
2. Focus on caption spreads: Was placement driven by General Effect, Visual Ensemble execution, or Music sub-totals?
3. Quantify every claim with the exact decimal scores provided above.

Return valid JSON adhering to this schema:
${JSON.stringify(SUMMARY_SCHEMA)}`;
}

const OUTLOOK_SCHEMA = {
  type: "object",
  properties: {
    headline:  { type: "string" },
    reasoning: { type: "string" }
  },
  required: ["headline", "reasoning"]
};

function buildOutlookPrompt(comp, fhcProjection, priorSeasonScores, fhcRecentScores, fhcCaptions) {
  const priorText = priorSeasonScores.length
    ? priorSeasonScores.map(p => `  * ${p.year}: ${p.score.toFixed(3)}`).join("\n")
    : "  * No prior contest history on file.";

  const recentText = fhcRecentScores.length
    ? fhcRecentScores.map(s => `  * ${s.year} ${s.contest}: ${s.score.toFixed(3)}`).join("\n")
    : "  * No completed contests this season yet.";

  const rank = fhcProjection.projectedRank;
  const score = fhcProjection.projectedScore;
  const advanceNote = fhcProjection.finalsChance != null && fhcProjection.finalsChance > 0
    ? `\n- Projected Finals Advance Probability: ${Math.round(fhcProjection.finalsChance)}%`
    : "";

  const captionsText = fhcCaptions && Object.keys(fhcCaptions).length > 0
    ? captionLines({ captions: fhcCaptions })
    : "  (Caption breakdown not available for FHC's most recent contest)";

  return `You are an expert competitive marching band analyst writing an advance scouting outlook for the directors of Francis Howell Central (FHC).

=== CONTEST CONTEXT ===
- Contest: ${comp.name} (${comp.year}) — ${comp.loc}
- Contest Date: ${comp.date}

=== PRE-COMPUTED PROJECTIONS FOR FHC ===
- Projected Score: ${score.toFixed(2)}
- Projected Standing: #${rank} overall${advanceNote}

=== FHC PRIOR APPEARANCES AT THIS EXACT CONTEST ===
${priorText}

=== FHC 2026 SEASON SCORES TO DATE ===
${recentText}

=== FHC'S MOST RECENT CAPTION PERFORMANCE ===
${captionsText}

=== DIRECTIVES ===
1. Do NOT recalculate or contradict the projected numbers above.
2. Explain WHY these numbers make sense: reference FHC's trajectory, their caption balance at their most recent performance, and what needs to improve for them to exceed or miss this projection.
3. Cite exact decimal scores from the lists above. No vague language.
4. Keep the headline under 8 words, bold and journalistic.
5. Reasoning must be exactly 2 dense, insightful sentences.

Return valid JSON matching this schema:
${JSON.stringify(OUTLOOK_SCHEMA)}`;
}

// ---------------------------------------------------------------------------
// Chunked field projection
// Each chunk is a focused analysis of ~10 bands with full context.
// ---------------------------------------------------------------------------

function buildBandHistoryBlock(band, history) {
  const scores = history[band.name] || [];
  if (scores.length === 0) {
    return `${band.name} (${band.classification || "Unclassified"}):\n  - No historical scores on record.`;
  }
  const lines = scores.map(s => {
    let line = `  - ${s.date || s.year} ${s.contest}: ${s.score.toFixed(3)}`;
    if (s.captions && Object.keys(s.captions).length > 0) {
      const c = s.captions;
      const parts = [];
      if (c.musicTotal != null) parts.push(`Mus ${c.musicTotal.toFixed(2)}`);
      else if (c.musicInd != null && c.musicEns != null) parts.push(`Mus ${((c.musicInd + c.musicEns) / 2).toFixed(2)}`);
      if (c.visualTotal != null) parts.push(`Vis ${c.visualTotal.toFixed(2)}`);
      else if (c.visualInd != null && c.visualEns != null) parts.push(`Vis ${((c.visualInd + c.visualEns) / 2).toFixed(2)}`);
      if (c.geTotal != null) parts.push(`GE ${c.geTotal.toFixed(2)}`);
      if (parts.length > 0) line += ` [${parts.join(", ")}]`;
    }
    return line;
  }).join("\n");
  return `${band.name} (${band.classification || "Unclassified"}):\n${lines}`;
}

function buildFieldContextBlock(fieldContext) {
  const fmt = (v) => v == null ? "—" : v.toFixed(2);
  if (fieldContext.length === 0) return "  (No historical field distributions available)";
  return fieldContext.map(fc => {
    const parts = [
      `top=${fmt(fc.topScore)} (${fc.topBand})`,
      `#5=${fmt(fc.rank5Score)}`,
      `#10=${fmt(fc.rank10Score)}`,
      `#15=${fmt(fc.rank15Score)}`,
      `#20=${fmt(fc.rank20Score)}`
    ];
    if (fc.rank30Score != null) parts.push(`#30=${fmt(fc.rank30Score)}`);
    parts.push(`median=${fmt(fc.medianScore)}`);
    return `  ${fc.year} ${fc.contest} (${fc.totalBands} bands): ${parts.join(", ")}`;
  }).join("\n");
}

function buildChunkPrompt(comp, fullRoster, chunkBands, history, fieldContext, chunkIndex, totalChunks) {
  const isSuperRegional = comp.name.toLowerCase().includes("super regional") || comp.name.toLowerCase().includes("boa");
  const defaultFinalsSize = isSuperRegional ? 14 : (fullRoster.length >= 16 ? 12 : 10);

  const fullRosterList = fullRoster.map((b, i) => `${i + 1}. ${b.name}${b.classification ? ` [${b.classification}]` : ""}`).join("\n");
  const chunkHistory = chunkBands.map(b => buildBandHistoryBlock(b, history)).join("\n\n");
  const fieldContextText = buildFieldContextBlock(fieldContext);

  return `You are analyzing a portion of the field for an upcoming marching band contest. A separate analysis is handling the other bands. Your job: project the scores for YOUR assigned bands only, using the same analytical lens that will be applied across the full field.

=== CONTEST PARAMETERS ===
- Event: ${comp.name} (${comp.year})
- Location: ${comp.loc}
- Date: ${comp.date || "(date not specified)"}
- Total field size: ${fullRoster.length} programs
- ${comp.hasFinals ? `Format: top ${defaultFinalsSize} advance to finals` : "Format: single round"}
- Your chunk: ${chunkIndex + 1} of ${totalChunks}

=== FULL FIELD ROSTER (${fullRoster.length} bands) ===
Every band that will be at this contest. Your bands are a subset.

${fullRosterList}

=== YOUR ASSIGNED BANDS ===
Project scores for the following ${chunkBands.length} bands only:

${chunkBands.map(b => `  • ${b.name}`).join("\n")}

=== HISTORICAL DATA FOR YOUR BANDS ===
Every score each of your bands has received, with dates, contest names, and caption breakdowns where available.

${chunkHistory}

=== HISTORICAL FIELD DISTRIBUTIONS ===
Actual score-to-rank maps from past editions of this contest and comparable events. These tell you what a given score typically corresponds to in terms of placement. Use them as context for calibrating your scores to the same scale as the rest of the field.

${fieldContextText}

=== TASK ===

Predict a preliminary-round score for each of your ${chunkBands.length} assigned bands. Your scores will be merged with scores from the other chunks and ranked together, so calibrate carefully against the field distributions above.

Think about each band individually:
- What has their trajectory been over the past few seasons?
- How does their most recent score compare to their own historical baseline?
- Where did they land at this contest (or a comparable one) in past years?
- How do their recent results compare to the full field listed above?

Write a short analysis paragraph covering your chunk, then output your scores.

Your response must use this format:

ANALYSIS: <2-4 sentences about your assigned bands and how they fit the broader field>

SCORES:
<Band Name> | <Score>
<Band Name> | <Score>
...one line per band

Use the exact band names as listed. Scores numeric with at most two decimals.`;
}

function parseChunkResponse(text) {
  const out = { overview: "", scores: [] };

  const overviewMatch = text.match(/ANALYSIS:\s*([\s\S]*?)(?=SCORES:|$)/i);
  if (overviewMatch) out.overview = overviewMatch[1].trim();

  const scoresMatch = text.match(/SCORES:\s*([\s\S]*)$/i);
  if (scoresMatch) {
    const lines = scoresMatch[1].split("\n");
    for (const line of lines) {
      const m = line.match(/^\s*(.+?)\s*\|\s*([\d.]+)\s*$/);
      if (m) {
        const name = m[1].trim();
        const score = parseFloat(m[2]);
        if (name && !isNaN(score)) {
          out.scores.push({ name, projectedScore: score, note: "" });
        }
      }
    }
  }

  return out;
}

async function runChunksWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

async function generateFieldProjections(comp, roster, history, fieldContext, cacheKey = null) {
  const CHUNK_SIZE = 10;
  const CONCURRENCY = 3;

  // Build chunks
  const chunks = [];
  for (let i = 0; i < roster.length; i += CHUNK_SIZE) {
    chunks.push(roster.slice(i, i + CHUNK_SIZE));
  }

  console.log(`[ai] Analyzing ${roster.length} bands in ${chunks.length} chunks (concurrency: ${CONCURRENCY})`);

  const chunkResults = await runChunksWithConcurrency(chunks, CONCURRENCY, async (chunk, idx) => {
    const prompt = buildChunkPrompt(comp, roster, chunk, history, fieldContext, idx, chunks.length);
    console.log(`[ai] Chunk ${idx + 1}/${chunks.length}: ${chunk.length} bands`);

    const text = await callGemini(prompt, {
      temperature: 0.2,
      maxTokens: 8000,
      asText: true
    });

    const parsed = parseChunkResponse(text);
    console.log(`[ai] Chunk ${idx + 1}: parsed ${parsed.scores.length}/${chunk.length} scores`);

    if (parsed.scores.length !== chunk.length) {
      console.warn(`[ai] Chunk ${idx + 1} returned ${parsed.scores.length} scores, expected ${chunk.length}`);
    }

    return parsed;
  });

  // Merge all scores
  const allProjections = [];
  const overviews = [];
  for (const cr of chunkResults) {
    if (cr.overview) overviews.push(cr.overview);
    for (const s of cr.scores) {
      allProjections.push(s);
    }
  }

  // Sanity check: did we get every band?
  const missing = roster.filter(b => !allProjections.find(p => bandNameMatches(p.name, b.name)));
  if (missing.length > 0) {
    console.warn(`[ai] Missing projections for: ${missing.map(b => b.name).join(", ")}`);
  }

  // Sort by projected score descending to derive ranks
  allProjections.sort((a, b) => b.projectedScore - a.projectedScore);
  allProjections.forEach((p, i) => {
    p.projectedRank = i + 1;
  });

  // Derive finals info
  const isSuperRegional = comp.name.toLowerCase().includes("super regional") || comp.name.toLowerCase().includes("boa");
  const finalsSize = comp.hasFinals ? (isSuperRegional ? 14 : (roster.length >= 16 ? 12 : 10)) : 0;
  const finalsCutoff = finalsSize > 0 && allProjections.length >= finalsSize
    ? allProjections[finalsSize - 1].projectedScore
    : 0;

  // Assign confidence and finals chance
  allProjections.forEach(p => {
    if (finalsSize > 0) {
      if (p.projectedRank <= finalsSize - 2) {
        p.confidence = "high";
        p.finalsChance = 92;
      } else if (p.projectedRank <= finalsSize) {
        p.confidence = "medium";
        p.finalsChance = 55;
      } else if (p.projectedRank <= finalsSize + 2) {
        p.confidence = "medium";
        p.finalsChance = 25;
      } else {
        p.confidence = "low";
        p.finalsChance = 3;
      }
    } else {
      p.confidence = "medium";
      p.finalsChance = 0;
    }
  });

  console.log("[ai] Final merged leaderboard:");
  allProjections.forEach(p => {
    console.log(`  #${p.projectedRank.toString().padStart(2)} ${p.name.padEnd(30)} ${p.projectedScore.toFixed(2)}`);
  });

  return {
    overview: overviews.join(" "),
    finalsSize,
    finalsCutoff,
    projections: allProjections
  };
}

async function generatePerformanceSummary(comp, fhc, roster, currentRound, priorSeasonScores) {
  const prompt = buildSummaryPrompt(comp, fhc, roster, currentRound, priorSeasonScores);
  return await callGemini(prompt, { schema: SUMMARY_SCHEMA, temperature: 0.3, maxTokens: 8000 });
}

async function generateContestOutlook(comp, fhcProjection, priorSeasonScores, cacheKey = null, fhcRecentScores = [], fhcCaptions = null) {
  const prompt = buildOutlookPrompt(comp, fhcProjection, priorSeasonScores, fhcRecentScores, fhcCaptions);
  return await callGemini(prompt, { schema: OUTLOOK_SCHEMA, temperature: 0.4, maxTokens: 6000, cacheKey });
}