// =============================================================================
// Shared Fetching, Parsing, and Projection Cache
// Loaded by index.html, competition.html, and competitions.html.
// Depends on ai.js (for generateFieldProjections, hashData, getCache, setCache,
// bandNameMatches) being loaded first.
// =============================================================================

const MASTER_INDEX_SPREADSHEET_ID = "106s_uuX5YOXAS_cXPCqj4HaO69DK8wHMWGevKUhTWd0";
const SHEET_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CAPTION_LAYOUTS = {
  16: { musicInd: 1, musicEns: 2, musicTotal: 3, visualInd: 4, visualEns: 5, visualTotal: 6, geMusic: 7, geVisual: 8, geTotal: 9, fieldTiming: 10, grandTotal: 11 },
  12: { musicInd: 2, musicEns: 3, musicTotal: 4, visualInd: 5, visualEns: 6, visualTotal: 7, geMusic: 8, geVisual: 9, geTotal: 10, grandTotal: 11 },
  11: { musicInd: 2, musicEns: 3, musicTotal: 4, visualEns: 5, visualTotal: 6, geMusic: 7, geVisual: 8, geTotal: 9, grandTotal: 10 }
};

function detectLayout(row) {
  const trimmed = [...row];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") trimmed.pop();
  return CAPTION_LAYOUTS[trimmed.length] || null;
}

function extractCaptions(row, layout) {
  const c = {};
  if (!layout) return c;
  for (const [key, idx] of Object.entries(layout)) {
    if (idx >= row.length) continue;
    const v = parseFloat(row[idx]);
    if (!isNaN(v)) c[key] = v;
  }
  return c;
}

function extractDateFromTab(tabName) {
  if (!tabName) return "";
  const m = tabName.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return "";
  let y = m[3];
  if (y.length === 2) y = "20" + y;
  return `${m[1]}/${m[2]}/${y}`;
}

function parseLocalDate(dateStr, fallbackYear) {
  if (!dateStr) return new Date(`${fallbackYear}-10-31T23:59:59`);
  const parts = dateStr.trim().split(/[-/]/);
  if (parts.length === 3) {
    let y, m, d;
    if (parts[0].length === 4) {
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      d = parseInt(parts[2], 10);
    } else {
      m = parseInt(parts[0], 10) - 1;
      d = parseInt(parts[1], 10);
      y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
    }
    return new Date(y, m, d, 23, 59, 59);
  }
  return new Date(dateStr);
}

async function fetchMasterDirectory() {
  const endpoint = `https://docs.google.com/spreadsheets/d/${MASTER_INDEX_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&_cb=${Date.now()}`;
  const res = await fetch(endpoint, { cache: "no-store" });
  if (!res.ok) throw new Error(`Master directory HTTP ${res.status}`);
  const csv = await res.text();
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

  const entries = (parsed.data || []).map(r => {
    const hasFinalsStr = (r["Has Finals"] || r["hasFinals"] || "yes").toString().trim().toLowerCase();
    const prelimsTab = (r["Prelims Tab"] || r["Tab Name"] || r["Tab"] || "").trim();
    const dateFromSheet = (r["Date"] || "").trim();
    const dateFromTab = extractDateFromTab(prelimsTab);
    return {
      name: r["Contest Name"] || r["Name"] || "Contest",
      key: (r["Event Key"] || r["eventKey"] || r["Key"] || "").trim().toLowerCase(),
      loc: r["Location"] || r["City"] || "Location Pending",
      year: (r["Year"] || "").toString().trim(),
      date: dateFromSheet || dateFromTab,
      prelimsTab: prelimsTab,
      finalsTab: (r["Finals Tab"] || "").trim(),
      id: (r["Spreadsheet ID"] || r["spreadsheetId"] || "").trim(),
      hasFinals: ["yes", "true", "1"].includes(hasFinalsStr),
      _hasFinalsRaw: hasFinalsStr
    };
  }).filter(c => c.key && c.id);

  if (entries.length === 0) throw new Error("Master directory returned 0 valid rows");
  return entries;
}

// =============================================================================
// Sheet Fetcher — 3-tier cache (in-memory → localStorage → network)
// =============================================================================
const _sheetCache = new Map();

async function fetchSheetGrid(sheetId, sheetName) {
  const memKey = `${sheetId}::${sheetName || ""}`;
  if (_sheetCache.has(memKey)) return _sheetCache.get(memKey);

  const lsKey = `sheet_${memKey}`;
  try {
    const raw = localStorage.getItem(lsKey);
    if (raw) {
      const { value, expires } = JSON.parse(raw);
      if (Date.now() < expires) {
        _sheetCache.set(memKey, value);
        console.log(`[sheet-cache] HIT  ${sheetName || sheetId}`);
        return value;
      }
      localStorage.removeItem(lsKey);
    }
  } catch (e) {
    console.warn("[sheet-cache] localStorage read failed:", e);
  }

  console.log(`[sheet-cache] MISS ${sheetName || sheetId}`);
  const params = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : "";
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${params}&_cb=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  const csv = await res.text();
  const parsed = Papa.parse(csv, { skipEmptyLines: false });
  const rows = parsed.data.map(r =>
    (r || []).map(c => (c || "").toString().trim().replace(/\u00a0/g, " "))
  );

  _sheetCache.set(memKey, rows);

  const payload = JSON.stringify({ value: rows, expires: Date.now() + SHEET_CACHE_TTL_MS });
  try {
    localStorage.setItem(lsKey, payload);
  } catch (e) {
    console.warn("[sheet-cache] localStorage write failed, pruning old entries...");
    Object.keys(localStorage)
      .filter(k => k.startsWith("sheet_"))
      .forEach(k => localStorage.removeItem(k));
    try {
      localStorage.setItem(lsKey, payload);
    } catch (e2) {
      console.warn("[sheet-cache] still failed — persistence disabled for this sheet");
    }
  }

  return rows;
}

// =============================================================================
// Cache utilities
// =============================================================================
function clearAllCaches() {
  const removed = { sheets: 0, ai: 0, bust: 0, proj: 0 };
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith("sheet_")) { localStorage.removeItem(k); removed.sheets++; }
    else if (k.startsWith("ai_")) { localStorage.removeItem(k); removed.ai++; }
    else if (k.startsWith("bust_")) { localStorage.removeItem(k); removed.bust++; }
    else if (k.startsWith("proj_result_")) { localStorage.removeItem(k); removed.proj++; }
  });
  _sheetCache.clear();
  console.log(`[cache] Cleared ${removed.sheets} sheet, ${removed.ai} AI, ${removed.bust} bust, ${removed.proj} proj-result entries`);
}

function getContestBust(key, year) {
  return localStorage.getItem(`bust_${key}_${year}`) || "0";
}

function bumpContestBust(key, year) {
  const current = parseInt(getContestBust(key, year), 10);
  const next = current + 1;
  localStorage.setItem(`bust_${key}_${year}`, next.toString());
  return next;
}

function clearContestSheetCache(target) {
  const memKeyPrelims = `${target.id}::${target.prelimsTab || ""}`;
  const memKeyFinals = target.finalsTab ? `${target.id}::${target.finalsTab}` : null;

  _sheetCache.delete(memKeyPrelims);
  localStorage.removeItem(`sheet_${memKeyPrelims}`);
  console.log(`[refresh] Cleared memory + localStorage for ${memKeyPrelims}`);

  if (memKeyFinals) {
    _sheetCache.delete(memKeyFinals);
    localStorage.removeItem(`sheet_${memKeyFinals}`);
    console.log(`[refresh] Cleared memory + localStorage for ${memKeyFinals}`);
  }
}

// =============================================================================
// Full workbook parser
// =============================================================================
function parseFullWorkbookCSV(rows) {
  let currentBlock = "Prelims";
  let currentClass = "";
  let inlineClassColIdx = -1;
  let classIndex = -1;
  let sequence = null;
  let sheetLayout = null;
  let prelims = [];
  let finals = [];
  let detectedFinals = false;

  const CLASS_SEQUENCE = ["Class A", "Class AA", "Class AAA", "Class AAAA"];
  const DIVISION_SEQUENCE = ["Gold Division", "Black Division", "White Division"];

  const forbiddenWords = [
    "music performance", "visual performance", "general effect", "judge panel",
    "individual", "ensemble", "total", "order", "school name", "field & timing",
    "prelims", "finals", "overall rank", "class rank", "rating", "score", "sub total",
    "music", "visual", "panel", "oustanding", "outstanding", "awards", "caption awards",
    "recap", "summary", "stats", "timing", "division", "penalty", "rank", "place"
  ];

  function detectBanner(row) {
    for (let c = 0; c < Math.min(row.length, 2); c++) {
      const cell = (row[c] || "").trim();
      if (!cell || cell.length > 200) continue;
      const lc = cell.toLowerCase();
      if (/\b(high school|hs|academy|community)\b/.test(lc)) continue;
      const m = lc.match(/\bclass\s+(aaaa|aaa|aa|a)\b/);
      if (m) return m[1] === "aaaa" ? "Class AAAA" : m[1] === "aaa" ? "Class AAA" : m[1] === "aa" ? "Class AA" : "Class A";
      const div = lc.match(/\b(gold|black|white)(?:\s+division)?\b/);
      if (div) return div[1].charAt(0).toUpperCase() + div[1].slice(1) + " Division";
    }
    return "";
  }

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i] || [];
    const row = rawRow.map(c => (c || "").toString().trim().replace(/\u00a0/g, " "));
    if (row.every(c => c === "")) continue;

    const line = row.join(" ").toLowerCase();

    if (line.includes("finals") && !line.includes("field & timing") && !line.includes("prelims")) {
      currentBlock = "Finals";
      currentClass = "";
      classIndex = -1;
      sequence = null;
      detectedFinals = true;
      continue;
    }
    if (line.includes("prelims")) { currentBlock = "Prelims"; continue; }

    const lowerRow = row.map(c => c.toLowerCase());
    if (lowerRow.includes("class") && (lowerRow.includes("music performance") || lowerRow.includes("field & timing"))) {
      inlineClassColIdx = lowerRow.indexOf("class");
      continue;
    }

    const banner = detectBanner(row);
    if (banner) {
      currentClass = banner;
      sequence = banner.startsWith("Class") ? CLASS_SEQUENCE : DIVISION_SEQUENCE;
      classIndex = sequence.indexOf(banner);
      if (classIndex < 0) classIndex = 0;
      continue;
    }

    if (inlineClassColIdx === -1) {
      const hasSchoolNameHeader = row.some(c => c.toLowerCase() === "school name");
      const colAEmpty = !row[0] || row[0] === "";
      if (hasSchoolNameHeader && colAEmpty && classIndex >= 0 && sequence) {
        classIndex++;
        currentClass = sequence[classIndex] || currentClass;
        continue;
      }
    }
    if (row.some(c => c.toLowerCase() === "school name")) continue;

    if (
      line.includes("judge panel") ||
      (line.includes("individual") && line.includes("ensemble")) ||
      line.includes("caption awards") ||
      line.includes("oustanding") ||
      line.includes("outstanding") ||
      (line.includes("award") && !row.some(c => parseFloat(c) >= 35.0))
    ) continue;

    let scoreVal = 0.0;
    const layout = sheetLayout || detectLayout(row);
    if (layout && typeof layout.grandTotal === "number" && layout.grandTotal < row.length) {
      const v = parseFloat(row[layout.grandTotal]);
      if (!isNaN(v) && v >= 35.0 && v <= 100.0) scoreVal = v;
    }
    if (scoreVal === 0.0) {
      for (let c = row.length - 1; c >= 0; c--) {
        const val = parseFloat(row[c]);
        if (!isNaN(val) && val >= 35.0 && val <= 100.0) { scoreVal = val; break; }
      }
    }

    let candidateName = "";
    for (let c = 0; c < Math.min(row.length, 4); c++) {
      const cell = row[c];
      const cellLower = cell.toLowerCase();
      if (cell.length > 2 && isNaN(Number(cell))) {
        const isForbidden = forbiddenWords.some(w => cellLower === w || cellLower.startsWith(w + " "));
        const isOrdinal = /^\d+(st|nd|rd|th)\b/i.test(cellLower);
        const isJudge = /^[a-z]\.\s/.test(cellLower) || /^[a-z]\.$/.test(cellLower);
        if (!isForbidden && !isOrdinal && !isJudge) { candidateName = cell; break; }
      }
    }
    if (!candidateName) continue;

    if (!sheetLayout) sheetLayout = detectLayout(row);

    const targetList = currentBlock === "Finals" ? finals : prelims;
    const existing = targetList.find(b => b.name.toLowerCase() === candidateName.toLowerCase());
    if (existing) {
      if (scoreVal > 0 && existing.base === 0) {
        existing.base = scoreVal;
        existing.captions = extractCaptions(row, sheetLayout);
      }
      continue;
    }

    let finalClass = "";
    if (inlineClassColIdx !== -1 && row[inlineClassColIdx] && row[inlineClassColIdx].length > 0) {
      const val = row[inlineClassColIdx].trim();
      finalClass = val.toLowerCase().startsWith("class") ? val : `Class ${val}`;
    } else {
      finalClass = currentClass;
    }

    targetList.push({
      name: candidateName,
      classification: finalClass,
      round: currentBlock,
      state: "MO",
      base: scoreVal,
      captions: extractCaptions(row, sheetLayout)
    });
  }

  return { prelims, finals, hasFinalsInSheet: detectedFinals };
}

// =============================================================================
// Field history gatherer — returns per-band history AND per-contest field
// distributions. The distributions are what let the AI know that a 75 at BOA
// STL is mid-pack, not top-15.
// =============================================================================
async function gatherFieldHistory(comp, allEntries, roster) {
  const now = new Date();

  const sources = allEntries
    .filter(e => !(e.key === comp.key && e.year === comp.year))
    .map(e => ({ ...e, dateObj: parseLocalDate(e.date, e.year) }))
    .filter(e => e.dateObj < now);

  console.log(`[gatherFieldHistory] Fetching ${sources.length} sheets (8 at a time)...`);

  const CONCURRENCY = 8;
  const results = [];
  for (let i = 0; i < sources.length; i += CONCURRENCY) {
    const batch = sources.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(async (src) => {
      try {
        const rows = await fetchSheetGrid(src.id, src.prelimsTab);
        const parsed = parseFullWorkbookCSV(rows);
        return { entry: src, roster: parsed.prelims };
      } catch (err) {
        console.warn(`[gatherFieldHistory] Skipping ${src.year} ${src.name}:`, err);
        return { entry: src, roster: [] };
      }
    }));
    results.push(...batchResults);
  }

  // Per-band history (existing behavior)
  const history = {};
  roster.forEach(b => history[b.name] = []);

  // Field distribution context — one entry per past contest
  const fieldContext = [];

  for (const r of results) {
    // --- Per-band history ---
    for (const band of r.roster) {
      const match = roster.find(rb => bandNameMatches(rb.name, band.name));
      if (match && band.base > 0) {
        history[match.name].push({
          contest: r.entry.name,
          year: r.entry.year,
          date: r.entry.date,
          score: band.base
        });
      }
    }

    // --- Field distribution for this contest ---
    const scored = r.roster.filter(b => b.base > 0).sort((a, b) => b.base - a.base);
    if (scored.length >= 5) {
      const scoreAt = (rank) => scored[rank - 1]?.base ?? null;
      const mid = Math.floor(scored.length / 2);
      const median = scored.length % 2
        ? scored[mid].base
        : (scored[mid - 1].base + scored[mid].base) / 2;

      fieldContext.push({
        contest: r.entry.name,
        contestKey: r.entry.key,
        year: r.entry.year,
        totalBands: scored.length,
        topScore: scored[0].base,
        topBand: scored[0].name,
        rank5Score:  scoreAt(5),
        rank10Score: scoreAt(10),
        rank15Score: scoreAt(15),
        rank20Score: scoreAt(20),
        rank30Score: scoreAt(30),
        medianScore: median
      });
    }
  }

  Object.values(history).forEach(arr =>
    arr.sort((a, b) => parseLocalDate(a.date, a.year) - parseLocalDate(b.date, b.year))
  );

  // Most recent first
  fieldContext.sort((a, b) => parseInt(b.year, 10) - parseInt(a.year, 10));

  const totalRows = Object.values(history).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`[gatherFieldHistory] ${sources.length} sheets → ${totalRows} band-score rows across ${roster.length} bands, ${fieldContext.length} field distributions`);

  return { history, fieldContext };
}

// =============================================================================
// Shared projection cache and generator
// =============================================================================
function cacheProjectionResult(comp, result, roster, bust) {
  if (!result || !Array.isArray(result.projections)) return;
  const fhcProj = result.projections.find(p => p.name.toLowerCase().includes("howell central"));
  if (!fhcProj) return;

  try {
    localStorage.setItem(`proj_result_${comp.key}_${comp.year}`, JSON.stringify({
      generatedAt: Date.now(),
      fhcProjection: fhcProj,
      overview: result.overview,
      finalsSize: result.finalsSize,
      finalsCutoff: result.finalsCutoff,
      projectionCount: result.projections.length,
      hasFinals: comp.hasFinals === true
    }));
  } catch (e) {
    console.warn("[cacheProjectionResult] shared key write failed:", e);
  }

  if (roster && typeof hashData === "function" && typeof setCache === "function") {
    const hashedKey = hashData({
      kind: "field-projection",
      comp: comp.key,
      year: comp.year,
      roster: roster.map(b => b.name).sort(),
      bust: bust || getContestBust(comp.key, comp.year)
    });
    setCache(hashedKey, result, 24);
  }
}

function getCachedProjectionResult(comp) {
  try {
    const raw = localStorage.getItem(`proj_result_${comp.key}_${comp.year}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.generatedAt && Date.now() - parsed.generatedAt > 14 * 24 * 3600 * 1000) {
      localStorage.removeItem(`proj_result_${comp.key}_${comp.year}`);
      return null;
    }
    if (typeof parsed.hasFinals === "boolean" && typeof comp.hasFinals === "boolean" && parsed.hasFinals !== comp.hasFinals) {
      console.log(`[proj-cache] hasFinals changed for ${comp.key} ${comp.year}, discarding stale projection`);
      localStorage.removeItem(`proj_result_${comp.key}_${comp.year}`);
      return null;
    }
    return parsed;
  } catch { return null; }
}

async function generateAndCacheProjection(comp, allEntries, onProgress) {
  if (onProgress) onProgress("Loading field roster...");
  const rows = await fetchSheetGrid(comp.id, comp.prelimsTab);
  const parsed = parseFullWorkbookCSV(rows);
  const roster = parsed.prelims;
  if (roster.length === 0) return null;

  if (onProgress) onProgress(`Gathering history (${roster.length} bands)...`);
  const { history, fieldContext } = await gatherFieldHistory(comp, allEntries, roster);

  const bust = getContestBust(comp.key, comp.year);
  const weekNum = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  // v2 prefix — bump so the new prompt doesn't reuse old cached responses
  const kvCacheKey = bust !== "0"
    ? `proj2-${comp.key}-${comp.year}-w${weekNum}-b${bust}`
    : `proj2-${comp.key}-${comp.year}-w${weekNum}`;

  if (onProgress) onProgress("Running AI projection...");
  const result = await generateFieldProjections(comp, roster, history, fieldContext, kvCacheKey);
  cacheProjectionResult(comp, result, roster, bust);
  return result;
}

async function getFHCResultForCompleted(comp) {
  const rows = await fetchSheetGrid(comp.id, comp.prelimsTab);
  const parsed = parseFullWorkbookCSV(rows);
  const roster = parsed.prelims;
  if (roster.length === 0) return null;
  const sorted = [...roster].sort((a, b) => b.base - a.base);
  const idx = sorted.findIndex(b => b.name.toLowerCase().includes("howell central"));
  if (idx < 0) return null;
  const fhc = sorted[idx];
  if (fhc.base <= 0) return null;
  return { score: fhc.base, rank: idx + 1, totalBands: roster.length, classification: fhc.classification };
}

// =============================================================================
// Small display helper used by the dashboard
// =============================================================================
function shortContestLabel(comp) {
  const name = comp.name || "";
  if (name.includes("BOA")) return "BOA STL";
  if (name.includes("Metro-East")) return "MEMC";
  if (name.includes("Tiger Ambush")) return "Tiger Ambush";
  if (name.includes("Lafayette")) return "Lafayette";
  if (name.includes("Renegade")) return "Renegade";
  if (name.includes("Broken Arrow")) return "Broken Arrow";
  if (name.includes("Deer Creek")) return "Deer Creek";
  if (name.includes("River City")) return "River City";
  return name;
}