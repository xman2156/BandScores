// =============================================================================
// Live Master Directory Connection & Deterministic Universal Recap Engine
// =============================================================================

const MASTER_INDEX_SPREADSHEET_ID = "106s_uuX5YOXAS_cXPCqj4HaO69DK8wHMWGevKUhTWd0";

let activeWorkbookData = {
  prelims: [],
  finals: [],
  hasFinalsInSheet: false
};

// ---------------------------------------------------------------------------
// Caption column layouts (indexed by the true trimmed data-row length)
// ---------------------------------------------------------------------------
const CAPTION_LAYOUTS = {
  // BOA St. Louis: Name | MInd MEns MAvg | VInd VEns VAvg | GEM GEV GETot | F&T | Total | Rating | Class | CRank | ORank
  16: {
    musicInd: 1, musicEns: 2, musicTotal: 3,
    visualInd: 4, visualEns: 5, visualTotal: 6,
    geMusic: 7, geVisual: 8, geTotal: 9,
    fieldTiming: 10, grandTotal: 11
  },
  // MEMC / Lafayette (2025+): Order | Name | MInd MEns MTot | VInd VEns VTot | GEM GEV GETot | GrandTotal
  12: {
    musicInd: 2, musicEns: 3, musicTotal: 4,
    visualInd: 5, visualEns: 6, visualTotal: 7,
    geMusic: 8, geVisual: 9, geTotal: 10,
    grandTotal: 11
  },
  // Tiger Ambush: Order | Name | MInd MEns MTot | VEns VTot | GEM GEV GETot | GrandTotal
  11: {
    musicInd: 2, musicEns: 3, musicTotal: 4,
    visualEns: 5, visualTotal: 6,
    geMusic: 7, geVisual: 8, geTotal: 9,
    grandTotal: 10
  }
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

// Extract MM/DD/YY or MM/DD/YYYY from a tab name like "MEMC - 2026 - 9/12/26"
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
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Master directory HTTP ${res.status}`);

  const csv = await res.text();
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

  const entries = (parsed.data || []).map(r => {
    const hasFinalsStr = (r["Has Finals"] || r["hasFinals"] || "yes").toString().toLowerCase();
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
      hasFinals: ["yes", "true", "1"].includes(hasFinalsStr)
    };
  }).filter(c => c.key && c.id);

  if (entries.length === 0) {
    throw new Error("Master directory returned 0 valid rows — check column headers");
  }
  return entries;
}

// =============================================================================
// CSV Grid Fetcher
// =============================================================================
async function fetchSheetGrid(sheetId, sheetName) {
  const params = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : "";
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${params}&_cb=${Date.now()}`;
  const res = await fetch(url);
  const csv = await res.text();
  const parsed = Papa.parse(csv, { skipEmptyLines: false });
  return parsed.data.map(r =>
    (r || []).map(c => (c || "").toString().trim().replace(/\u00a0/g, " "))
  );
}

// =============================================================================
// Direct Cell Pattern Parser — with caption extraction
// =============================================================================
function parseFullWorkbookCSV(rows) {
  let currentBlock = "Prelims";
  let currentClass = "";
  let inlineClassColIdx = -1;
  let classIndex = -1;
  let sequence = null;
  let sheetLayout = null;   // set on the first data row we see
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
      if (m) {
        return m[1] === "aaaa" ? "Class AAAA"
             : m[1] === "aaa"  ? "Class AAA"
             : m[1] === "aa"   ? "Class AA"
             :                   "Class A";
      }
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

    if (line.includes("finals") &&
        !line.includes("field & timing") &&
        !line.includes("prelims")) {
      currentBlock = "Finals";
      currentClass = "";
      classIndex = -1;
      sequence = null;
      detectedFinals = true;
      continue;
    }
    if (line.includes("prelims")) {
      currentBlock = "Prelims";
      continue;
    }

    const lowerRow = row.map(c => c.toLowerCase());
    if (lowerRow.includes("class") &&
        (lowerRow.includes("music performance") || lowerRow.includes("field & timing"))) {
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
    ) {
      continue;
    }

    // --- Total score ---
    let scoreVal = 0.0;
    for (let c = row.length - 1; c >= 0; c--) {
      const val = parseFloat(row[c]);
      if (!isNaN(val) && val >= 35.0 && val <= 100.0) { scoreVal = val; break; }
    }

    // --- Name ---
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

    // --- Detect layout on the first data row ---
    if (!sheetLayout) sheetLayout = detectLayout(row);

    // --- Dedup ---
    const targetList = currentBlock === "Finals" ? finals : prelims;
    const existing = targetList.find(b => b.name.toLowerCase() === candidateName.toLowerCase());
    if (existing) {
      if (scoreVal > 0 && existing.base === 0) {
        existing.base = scoreVal;
        existing.captions = extractCaptions(row, sheetLayout);
      }
      continue;
    }

    // --- Classification ---
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
// Router & State Management
// =============================================================================
function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    event: (urlParams.get("event") || "lafayette").toLowerCase(),
    year: (urlParams.get("year") || "2026").toString(),
    round: (urlParams.get("round") || "prelims").toLowerCase()
  };
}

function switchYear(newYear) {
  const { event, round } = getUrlParams();
  const newUrl = `${window.location.pathname}?event=${event}&year=${newYear}&round=${round}`;
  window.history.pushState({ path: newUrl }, "", newUrl);
  loadCompetitionView(event, newYear, round);
}

function switchRound(newRound) {
  const { event, year } = getUrlParams();
  const newUrl = `${window.location.pathname}?event=${event}&year=${year}&round=${newRound}`;
  window.history.pushState({ path: newUrl }, "", newUrl);
  updateRoundUI(newRound);
}

// =============================================================================
// Dynamic Loader
// =============================================================================
async function loadCompetitionView(eventKey, selectedYear, selectedRound) {
  const titleEl = document.getElementById("contestTitle");
  const subtitleEl = document.getElementById("contestSubtitle");
  const tagEl = document.getElementById("contestTag");
  const rosterBody = document.getElementById("rosterTableBody");
  const leaderboardBody = document.getElementById("leaderboardTableBody");

  let allEntries;
  try {
    allEntries = await fetchMasterDirectory();
  } catch (err) {
    console.error("[loadCompetitionView] Directory fetch failed:", err);
    titleEl.textContent = "Directory Unavailable";
    subtitleEl.textContent = "Could not reach the Master Directory sheet. Check the published CSV link and sharing permissions.";
    tagEl.textContent = "OFFLINE";
    if (rosterBody) rosterBody.innerHTML = "";
    if (leaderboardBody) leaderboardBody.innerHTML = "";
    document.getElementById("fhcSpotlightSection").classList.add("hidden");
    return;
  }

  const contestSeasons = allEntries.filter(e => e.key === eventKey.toLowerCase());

  if (contestSeasons.length === 0) {
    titleEl.textContent = "Competition Not Found";
    subtitleEl.textContent = `Could not resolve "${eventKey}" in the Master Directory.`;
    tagEl.textContent = "NOT FOUND";
    if (rosterBody) rosterBody.innerHTML = "";
    if (leaderboardBody) leaderboardBody.innerHTML = "";
    document.getElementById("fhcSpotlightSection").classList.add("hidden");
    return;
  }

  const uniqueYears = [...new Set(contestSeasons.map(c => c.year))].filter(Boolean).sort((a, b) => b - a);
  const yearSelect = document.getElementById("yearDropdown");

  if (yearSelect) {
    yearSelect.innerHTML = "";
    uniqueYears.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = `${y} Season`;
      if (y === selectedYear) opt.selected = true;
      yearSelect.appendChild(opt);
    });
    yearSelect.value = selectedYear;
  }

  let targetEntry = contestSeasons.find(c => c.year === selectedYear) || contestSeasons[0];

  const contestDateObj = parseLocalDate(targetEntry.date, targetEntry.year);
  targetEntry.isPast = contestDateObj < new Date();

  titleEl.textContent = `${targetEntry.name} (${selectedYear})`;
  subtitleEl.textContent = `Loading ${selectedYear} scores from Google Drive...`;

  let targetTab = targetEntry.prelimsTab;
  const hasSeparateTabs = Boolean(targetEntry.finalsTab);

  if (hasSeparateTabs && selectedRound === "finals") {
    targetTab = targetEntry.finalsTab;
  }

  try {
    const rows = await fetchSheetGrid(targetEntry.id, targetTab);
    const parsedData = parseFullWorkbookCSV(rows);

    if (hasSeparateTabs) {
      if (selectedRound === "finals") {
        activeWorkbookData.finals = parsedData.prelims.concat(parsedData.finals);
      } else {
        activeWorkbookData.prelims = parsedData.prelims;
      }
      activeWorkbookData.hasFinalsInSheet = true;
    } else {
      activeWorkbookData.prelims = parsedData.prelims;
      activeWorkbookData.finals = parsedData.finals;
      activeWorkbookData.hasFinalsInSheet = parsedData.hasFinalsInSheet || targetEntry.hasFinals;
    }
  } catch (err) {
    console.error("[loadCompetitionView] Contest sheet fetch failed:", err);
    activeWorkbookData = { prelims: [], finals: [], hasFinalsInSheet: false };
    subtitleEl.textContent = `Could not load the sheet for ${targetEntry.name} (${selectedYear}). Check the tab name "${targetTab}" and sharing permissions.`;
    tagEl.textContent = "SHEET ERROR";
  }

  renderUI(targetEntry, selectedYear, selectedRound, targetTab);
}

// =============================================================================
// Band Detail Modal
// =============================================================================
let currentModalRoster = [];

function openBandModal(band, allBands) {
  const modal = document.getElementById("bandModal");
  const nameEl = document.getElementById("modalBandName");
  const metaEl = document.getElementById("modalBandMeta");
  const bodyEl = document.getElementById("modalBody");
  if (!modal || !nameEl || !metaEl || !bodyEl) return;

  const sorted = [...allBands].sort((a, b) => b.base - a.base);
  const rank = sorted.findIndex(b => b.name === band.name) + 1;

  nameEl.textContent = band.name;
  metaEl.textContent = `${band.classification || "Unclassified"} • Rank #${rank} of ${allBands.length} • ${band.round}`;

  const c = band.captions || {};
  const hasCaptions = Object.keys(c).length > 0;

  let html = `
    <div class="grid grid-cols-2 gap-3">
      <div class="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
        <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Score</div>
        <div class="text-2xl font-black text-emerald-400 font-mono mt-1">${band.base > 0 ? band.base.toFixed(3) : "—"}</div>
      </div>
      <div class="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
        <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Placement</div>
        <div class="text-2xl font-black text-indigo-400 font-mono mt-1">#${rank}</div>
      </div>
    </div>
  `;

  if (!hasCaptions) {
    html += `
      <div class="border border-dashed border-slate-700 rounded-xl p-6 text-center text-slate-500 text-xs font-mono">
        No caption data available for this band.
      </div>
    `;
  } else {
    const groups = [
      {
        title: "Music Performance", color: "emerald",
        items: [
          { label: "Individual", val: c.musicInd },
          { label: "Ensemble",   val: c.musicEns },
          { label: "Total",      val: c.musicTotal, bold: true }
        ]
      },
      {
        title: "Visual Performance", color: "pink",
        items: [
          { label: "Individual", val: c.visualInd },
          { label: "Ensemble",   val: c.visualEns },
          { label: "Total",      val: c.visualTotal, bold: true }
        ]
      },
      {
        title: "General Effect", color: "indigo",
        items: [
          { label: "Music",  val: c.geMusic },
          { label: "Visual", val: c.geVisual },
          { label: "Total",  val: c.geTotal, bold: true }
        ]
      }
    ];

    const colorMap = {
      emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
      pink:    { text: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/20" },
      indigo:  { text: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/20" },
      amber:   { text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" }
    };

    groups.forEach(group => {
      const present = group.items.filter(it => it.val != null);
      if (present.length === 0) return;
      const cm = colorMap[group.color];

      html += `
        <div class="border border-slate-800 rounded-xl overflow-hidden">
          <div class="px-4 py-2 ${cm.bg} border-b ${cm.border}">
            <span class="text-xs font-bold ${cm.text} uppercase tracking-wider">${group.title}</span>
          </div>
          <div class="divide-y divide-slate-800/60">
            ${present.map(it => `
              <div class="flex items-center justify-between px-4 py-2 text-xs">
                <span class="${it.bold ? 'font-bold text-slate-200' : 'text-slate-400'}">${it.label}</span>
                <span class="font-mono ${it.bold ? 'font-bold text-white' : 'text-slate-300'}">${it.val.toFixed(3)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    });

    if (c.fieldTiming != null) {
      const cm = colorMap.amber;
      html += `
        <div class="border border-slate-800 rounded-xl overflow-hidden">
          <div class="px-4 py-2 ${cm.bg} border-b ${cm.border}">
            <span class="text-xs font-bold ${cm.text} uppercase tracking-wider">Field & Timing</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2 text-xs">
            <span class="text-slate-400">Score</span>
            <span class="font-mono text-slate-300">${c.fieldTiming.toFixed(3)}</span>
          </div>
        </div>
      `;
    }
  }

  html += `
    <div class="border border-dashed border-slate-700 rounded-xl p-5 text-center">
      <div class="inline-flex items-center gap-2 text-slate-500 text-xs font-mono">
        <i data-lucide="sparkles" class="w-4 h-4"></i>
        AI Review & Projection — Coming Soon
      </div>
    </div>
  `;

  bodyEl.innerHTML = html;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  currentModalRoster = allBands;
  lucide.createIcons();
}

function closeBandModal() {
  const modal = document.getElementById("bandModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

// =============================================================================
// DOM Renderer
// =============================================================================
function renderUI(comp, year, currentRound, tabName) {
  const isPast = comp.isPast === true;

  const roundContainer = document.getElementById("roundToggleContainer");
  const showToggle = comp.hasFinals || activeWorkbookData.hasFinalsInSheet || Boolean(comp.finalsTab);

  if (showToggle && roundContainer) {
    roundContainer.classList.remove("hidden");
    const btnPrelims = document.getElementById("btnRoundPrelims");
    const btnFinals = document.getElementById("btnRoundFinals");
    if (currentRound === "finals") {
      btnFinals.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-indigo-600 text-white shadow";
      btnPrelims.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white";
    } else {
      btnPrelims.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-indigo-600 text-white shadow";
      btnFinals.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white";
    }
  } else if (roundContainer) {
    roundContainer.classList.add("hidden");
  }

  let activeRoster = currentRound === "finals" && activeWorkbookData.finals.length > 0
    ? activeWorkbookData.finals
    : activeWorkbookData.prelims;

  if (currentRound === "finals" && activeWorkbookData.finals.length === 0 && Boolean(comp.finalsTab)) {
    activeRoster = activeWorkbookData.prelims;
  }

  const roundLabel = showToggle ? (currentRound === "finals" ? "Finals" : "Prelims") : "";
  document.getElementById("contestTitle").textContent = `${comp.name} (${year}) ${roundLabel ? `• ${roundLabel}` : ""}`;
  document.getElementById("contestSubtitle").textContent = isPast
    ? `Official Completed Recap • ${comp.loc}`
    : `Upcoming Competition • ${comp.loc}`;
  document.getElementById("contestTag").textContent = isPast ? `${year} OFFICIAL RECAP` : `${year} UPCOMING`;
  document.getElementById("bandCountBadge").textContent = `${activeRoster.length} Programs`;

  const emptyScoreLabel = isPast ? "—" : "Pending";
  const fmtScore = (val) => val > 0 ? val.toFixed(3) : emptyScoreLabel;

  const fhc = activeRoster.find(b => b.name.toLowerCase().includes("howell central"));
  const spotlightSection = document.getElementById("fhcSpotlightSection");
  const finalsCard = document.getElementById("finalsBenchmarkCard");

  if (!fhc) {
    spotlightSection.classList.add("hidden");
  } else {
    spotlightSection.classList.remove("hidden");
    if (isPast) {
      document.getElementById("statLabel1").textContent = "Official Score";
      document.getElementById("statLabel2").textContent = "Round Placement";
      document.getElementById("fhcStatPeak").textContent = fmtScore(fhc.base);
      document.getElementById("fhcStatPeakSub").textContent = "Achieved Score";
      const sorted = [...activeRoster].sort((a, b) => b.base - a.base);
      const rank = sorted.findIndex(b => b.name.toLowerCase().includes("howell central")) + 1;
      document.getElementById("fhcStatRank").textContent = rank > 0 ? `#${rank} in ${roundLabel || "Event"}` : "Recorded";
      document.getElementById("fhcStatRankSub").textContent = "Official Standing";
      document.getElementById("fhcEventHeadline").textContent = "Official Performance Summary";
      document.getElementById("fhcEventSummary").textContent = fhc.base > 0
        ? `Francis Howell Central recorded an official score of ${fhc.base.toFixed(3)} at ${comp.name} (${roundLabel || "Event"}).`
        : `Francis Howell Central participated in ${comp.name} (${year}).`;
      if (showToggle && currentRound === "prelims") {
        finalsCard.classList.remove("hidden");
        document.getElementById("statLabel3").textContent = "Finals Benchmark";
        const cutoffIdx = activeRoster.length > 50 ? 13 : (activeRoster.length >= 12 ? 11 : 9);
        const bubbleBand = sorted.length > cutoffIdx ? sorted[cutoffIdx] : sorted[sorted.length - 1];
        const bubbleScore = bubbleBand && bubbleBand.base > 0 ? bubbleBand.base.toFixed(3) : "--";
        document.getElementById("fhcStatCutoff").textContent = bubbleScore;
        document.getElementById("fhcStatCutoffSub").textContent = bubbleBand ? `Cutoff (${bubbleBand.name})` : "Advance Line";
      } else {
        finalsCard.classList.add("hidden");
      }
    } else {
      document.getElementById("statLabel1").textContent = "Historical Mark";
      document.getElementById("statLabel2").textContent = "Projected Standing";
      document.getElementById("fhcStatPeak").textContent = "Pending";
      document.getElementById("fhcStatPeakSub").textContent = "Season Mark";
      document.getElementById("fhcStatRank").textContent = "Pending";
      document.getElementById("fhcStatRankSub").textContent = "Gemini API Projection";
      document.getElementById("fhcEventHeadline").textContent = "Contest Outlook";
      document.getElementById("fhcEventSummary").textContent = `Upcoming competition. Projections will be generated via the Gemini API.`;
      if (showToggle && currentRound === "prelims") {
        finalsCard.classList.remove("hidden");
        document.getElementById("statLabel3").textContent = "Finals Benchmark";
        document.getElementById("fhcStatCutoff").textContent = "Pending";
        document.getElementById("fhcStatCutoffSub").textContent = "Gemini API Projection";
      } else {
        finalsCard.classList.add("hidden");
      }
    }
  }

  // ---- Roster table ----
  const rosterBody = document.getElementById("rosterTableBody");
  rosterBody.innerHTML = "";
  activeRoster.forEach((band, idx) => {
    const isFHC = band.name.toLowerCase().includes("howell central");
    const tr = document.createElement("tr");
    tr.className = isFHC
      ? "bg-blue-950/40 border-l-2 border-blue-400 cursor-pointer hover:bg-blue-950/60 transition"
      : "hover:bg-slate-900/60 transition cursor-pointer";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-slate-500">${idx + 1}</td>
      <td class="py-2.5 px-3 ${isFHC ? 'text-blue-300 font-bold flex items-center gap-1.5' : 'text-slate-200'}">
        ${band.name}
        <span class="text-[10px] text-slate-500 font-mono font-normal">(${band.state})</span>
        ${isFHC ? '<span class="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold">FHC</span>' : ''}
      </td>
      <td class="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">${band.classification || '—'}</td>
    `;
    tr.onclick = () => openBandModal(band, activeRoster);
    rosterBody.appendChild(tr);
  });

  // ---- Leaderboard table ----
  const leaderboardBody = document.getElementById("leaderboardTableBody");
  leaderboardBody.innerHTML = "";
  const sorted = [...activeRoster].sort((a, b) => b.base - a.base);
  sorted.forEach((band, idx) => {
    const isFHC = band.name.toLowerCase().includes("howell central");
    const hasScore = band.base > 0;
    const tr = document.createElement("tr");
    tr.className = isFHC
      ? "bg-blue-950/40 border-l-2 border-blue-400 cursor-pointer hover:bg-blue-950/60 transition"
      : "hover:bg-slate-900/50 transition cursor-pointer";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono font-bold ${idx < 3 ? 'text-amber-400' : 'text-slate-400'}">#${idx + 1}</td>
      <td class="py-2.5 px-3 ${isFHC ? 'text-blue-300 font-bold' : 'text-white'}">
        ${band.name} <span class="text-[10px] text-slate-500 font-mono font-normal">(${band.state})</span>
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-bold ${hasScore ? 'text-emerald-400' : 'text-slate-500 italic'}">
        ${fmtScore(band.base)}
      </td>
      <td class="py-2.5 px-3 text-right">
        ${band.classification ? `<span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">${band.classification}</span>` : `<span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">—</span>`}
      </td>
    `;
    tr.onclick = () => openBandModal(band, activeRoster);
    leaderboardBody.appendChild(tr);
  });

  lucide.createIcons();
}

function updateRoundUI(newRound) {
  const { event, year } = getUrlParams();
  loadCompetitionView(event, year, newRound);
}

window.addEventListener("popstate", () => {
  const { event, year, round } = getUrlParams();
  loadCompetitionView(event, year, round);
});

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();

  // Modal close handlers
  const modal = document.getElementById("bandModal");
  const closeBtn = document.getElementById("modalCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeBandModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeBandModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeBandModal();
  });

  const { event, year, round } = getUrlParams();
  loadCompetitionView(event, year, round);
});