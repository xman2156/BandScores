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
// Field projection prompt — dates, sheet context, timing principles
// ---------------------------------------------------------------------------
function buildFieldProjectionPrompt(comp, roster, history, fieldContext) {
  const isSuperRegional = comp.name.toLowerCase().includes("super regional") || comp.name.toLowerCase().includes("boa");
  const defaultFinalsSize = isSuperRegional ? 14 : (roster.length >= 16 ? 12 : 10);
  const fieldSize = roster.length;
  const midpoint = Math.ceil(fieldSize / 2);
  const secondHalfStart = midpoint + 1;
  const useTwoParts = fieldSize > 30;

  // Format the target contest date as a readable string
  const targetDateStr = comp.date || "(date not specified)";

  // Per-band history with dates and captions
  const bandBlocks = roster.map(b => {
    const scores = history[b.name] || [];
    if (scores.length === 0) {
      return `${b.name} (${b.classification || "Unclassified"}):\n  - No historical scores on record.`;
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
    return `${b.name} (${b.classification || "Unclassified"}):\n${lines}`;
  }).join("\n\n");

  const rosterList = roster.map((b, i) => `${i + 1}. ${b.name}${b.classification ? ` [${b.classification}]` : ""}`).join("\n");

  const fmt = (v) => v == null ? "—" : v.toFixed(2);
  const fieldContextText = fieldContext.length > 0
    ? fieldContext.map(fc => {
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
      }).join("\n")
    : "  (No historical field distributions available)";

  const leaderboardFormat = useTwoParts
    ? `LEADERBOARD_PART_1:
1. <Band Name> | <Score> | <one-sentence note>
2. <Band Name> | <Score> | <one-sentence note>
...through rank ${midpoint}

LEADERBOARD_PART_2:
${secondHalfStart}. <Band Name> | <Score> | <one-sentence note>
${secondHalfStart + 1}. <Band Name> | <Score> | <one-sentence note>
...through rank ${fieldSize}`
    : `LEADERBOARD:
1. <Band Name> | <Score> | <one-sentence note>
2. <Band Name> | <Score> | <one-sentence note>
...through rank ${fieldSize}`;

  return `You are an elite competitive marching band data analyst. Model the projected preliminary-round standings for an upcoming contest.

Think carefully. Consider each band's trajectory, head-to-head results against the specific opponents registered here, how scoring scales differ between contests, and where each historical score falls in the calendar.

=== CONTEST PARAMETERS ===
- Event: ${comp.name} (${comp.year})
- Location: ${comp.loc}
- Contest Date: ${targetDateStr}
- Field size: ${fieldSize} registered programs
- Multi-Round: ${comp.hasFinals ? `YES — top ${defaultFinalsSize} advance to finals` : "NO — single round"}

=== HISTORICAL FIELD DISTRIBUTIONS ===
Actual score-to-rank maps from past contests. Use these as evidence of what a given score MEANS at each contest's sheet — they tell you the numeric range that typically corresponds to each rank band. If your projection puts a band at rank N with a score far outside the historical range for rank N, reconsider.

${fieldContextText}

=== SCORING SCALE AND TIMING CONSIDERATIONS ===

Scoring scales vary by contest. Local invitationals and BOA-style contests evaluate bands on different sheets. Two scores that look identical numerically may not represent the same level of performance if they came from different sheet types.

Timing within a season also matters. Bands typically improve over the course of a season as programs clean and expand. A score from mid-September and a score from late October are not directly comparable even on the same sheet.

When projecting each band:
- Use their own history on the target contest's sheet type as the primary anchor.
- Use their current-season scores (from whatever sheet they were on) to gauge whether they're ahead of, on, or behind their usual pace at this point in the calendar.
- When comparing two bands in the field, note the dates of their most recent scores. A score from a date close to the target contest carries more predictive weight than a score from weeks earlier. A score on a similar sheet type carries more weight than one on a different sheet.
- When two bands in this field competed on the same day at comparable-level events, that head-to-head comparison is unusually direct and should be weighted heavily.
- Trajectory matters: a band whose recent results show meaningful improvement over their own past performance should be projected near their new level, not held at their old one.

=== REGISTERED FIELD (${fieldSize} PROGRAMS) ===
${rosterList}

=== HISTORICAL RECORDS BY PROGRAM ===
Chronological history with dates and available caption breakdowns.

${bandBlocks}

=== ANALYTICAL TASK ===

1. For each band, reason through their own trajectory, head-to-head results against the specific bands registered here, how their scores translate across sheet types, and where their scores fall in the calendar.

2. Rank the full field from 1 to ${fieldSize}. Scores must strictly decrease as rank increases.

${comp.hasFinals ? `3. Identify the finals cutoff — the projected score of the band at rank #${defaultFinalsSize}.` : ""}

4. Bands with no prior history: use the field distribution above to place them reasonably. Don't guess high.

=== OUTPUT FORMAT ===

Write a short analytical overview first, then output the leaderboard. Every band needs a one-sentence note explaining which scores and dates drove the projection.

Your response must use EXACTLY this format:

ANALYSIS: <3-5 sentence overview>

${leaderboardFormat}

FINALS_SIZE: <number>
FINALS_CUTOFF: <number>

Rules:
- Band names must match the registered roster exactly.
- Scores numeric with at most two decimals.
- Rank numbers sequential integers, no gaps.
- Every registered band appears exactly once.
- Notes must cite specific scores (with dates) that informed the projection.
- If you notice your later scores drifting away from what the historical distributions suggest for those ranks, STOP and re-anchor before continuing.

Begin with "ANALYSIS:" and nothing else before it.`;
}

// ---------------------------------------------------------------------------
// Parser — extracts leaderboard rows and notes
// ---------------------------------------------------------------------------
function parseFieldProjectionText(text) {
  const result = {
    overview: "",
    finalsSize: 0,
    finalsCutoff: 0,
    projections: []
  };

  const overviewMatch = text.match(/ANALYSIS:\s*([\s\S]*?)(?=LEADERBOARD|FINALS_SIZE:|$)/i);
  if (overviewMatch) result.overview = overviewMatch[1].trim();

  // Row format: "1. Band Name | 76.30 | note text here"
  const extractRows = (section) => {
    const rows = [];
    const lines = section.split("\n");
    for (const line of lines) {
      const m = line.match(/^\s*(\d+)\.\s*(.+?)\s*\|\s*([\d.]+)\s*(?:\|\s*(.*))?$/);
      if (m) {
        const rank = parseInt(m[1], 10);
        const name = m[2].trim();
        const score = parseFloat(m[3]);
        const note = (m[4] || "").trim();
        if (!isNaN(rank) && !isNaN(score)) {
          rows.push({ name, projectedRank: rank, projectedScore: score, note });
        }
      }
    }
    return rows;
  };

  const part1Match = text.match(/LEADERBOARD_PART_1:\s*([\s\S]*?)(?=LEADERBOARD_PART_2:|FINALS_SIZE:|$)/i);
  const part2Match = text.match(/LEADERBOARD_PART_2:\s*([\s\S]*?)(?=FINALS_SIZE:|FINALS_CUTOFF:|$)/i);
  const singleMatch = text.match(/LEADERBOARD:\s*([\s\S]*?)(?=FINALS_SIZE:|FINALS_CUTOFF:|$)/i);

  if (part1Match || part2Match) {
    if (part1Match) result.projections.push(...extractRows(part1Match[1]));
    if (part2Match) result.projections.push(...extractRows(part2Match[1]));
  } else if (singleMatch) {
    result.projections.push(...extractRows(singleMatch[1]));
  }

  const finalsSizeMatch = text.match(/FINALS_SIZE:\s*(\d+)/i);
  if (finalsSizeMatch) result.finalsSize = parseInt(finalsSizeMatch[1], 10);

  const finalsCutoffMatch = text.match(/FINALS_CUTOFF:\s*([\d.]+)/i);
  if (finalsCutoffMatch) result.finalsCutoff = parseFloat(finalsCutoffMatch[1]);

  if (result.projections.length === 0) {
    throw new Error("Failed to parse leaderboard from AI response. First 300 chars: " + text.slice(0, 300));
  }

  result.projections.sort((a, b) => a.projectedRank - b.projectedRank);

  result.projections.forEach(p => {
    if (result.finalsSize > 0) {
      if (p.projectedRank <= result.finalsSize - 2) {
        p.confidence = "high";
        p.finalsChance = 92;
      } else if (p.projectedRank <= result.finalsSize) {
        p.confidence = "medium";
        p.finalsChance = 55;
      } else if (p.projectedRank <= result.finalsSize + 2) {
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

  return result;
}

async function generatePerformanceSummary(comp, fhc, roster, currentRound, priorSeasonScores) {
  const prompt = buildSummaryPrompt(comp, fhc, roster, currentRound, priorSeasonScores);
  return await callGemini(prompt, { schema: SUMMARY_SCHEMA, temperature: 0.3, maxTokens: 8000 });
}

async function generateContestOutlook(comp, fhcProjection, priorSeasonScores, cacheKey = null, fhcRecentScores = [], fhcCaptions = null) {
  const prompt = buildOutlookPrompt(comp, fhcProjection, priorSeasonScores, fhcRecentScores, fhcCaptions);
  return await callGemini(prompt, { schema: OUTLOOK_SCHEMA, temperature: 0.4, maxTokens: 6000, cacheKey });
}

async function generateFieldProjections(comp, roster, history, fieldContext, cacheKey = null) {
  const prompt = buildFieldProjectionPrompt(comp, roster, history, fieldContext);

  let text;
  try {
    text = await callGemini(prompt, { temperature: 0.2, maxTokens: 24000, cacheKey, asText: true });
  } catch (err) {
    throw new Error(`Gemini call failed: ${err.message}`);
  }

  console.log(`[ai] Field projection response (${text.length} chars), first 500:`);
  console.log(text.slice(0, 500));

  const parsed = parseFieldProjectionText(text);
  console.log(`[ai] Parsed ${parsed.projections.length} projections`);

  // Audit: dump every band's projected score with the note the model wrote
  console.log("[ai] Per-band projections + notes:");
  parsed.projections.forEach(p => {
    console.log(`  #${p.projectedRank.toString().padStart(2)} ${p.name.padEnd(30)} ${p.projectedScore.toFixed(2)}  — ${p.note || "(no note)"}`);
  });

  const ranks = parsed.projections.map(p => p.projectedRank);
  if (new Set(ranks).size !== ranks.length) {
    console.warn(`[ai] Duplicate ranks detected`);
  }
  if (parsed.projections.length !== roster.length) {
    console.warn(`[ai] Expected ${roster.length} bands, got ${parsed.projections.length}`);
  }

  return parsed;
}