// =============================================================================
// Competition Page — rendering + AI enrichment
// Shared fetching/parsing lives in shared.js
// =============================================================================

let activeWorkbookData = {
  prelims: [],
  finals: [],
  hasFinalsInSheet: false
};

let activeFieldProjections = null;

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

async function loadCompetitionView(eventKey, selectedYear, selectedRound) {
  const titleEl = document.getElementById("contestTitle");
  const subtitleEl = document.getElementById("contestSubtitle");
  const tagEl = document.getElementById("contestTag");
  const rosterBody = document.getElementById("rosterTableBody");
  const leaderboardBody = document.getElementById("leaderboardTableBody");

  if (new URLSearchParams(window.location.search).has("clearcache")) {
    clearAllCaches();
  }

  activeFieldProjections = null;

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
  if (hasSeparateTabs && selectedRound === "finals") targetTab = targetEntry.finalsTab;

  try {
    const rows = await fetchSheetGrid(targetEntry.id, targetTab);
    const parsedData = parseFullWorkbookCSV(rows);

    if (hasSeparateTabs) {
      if (selectedRound === "finals") activeWorkbookData.finals = parsedData.prelims.concat(parsedData.finals);
      else activeWorkbookData.prelims = parsedData.prelims;
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

  if (targetEntry.isPast) {
    enrichFHCSpotlightPast(targetEntry, selectedYear, selectedRound, contestSeasons, allEntries);
  } else {
    enrichProjectedStandings(targetEntry, allEntries, selectedRound, contestSeasons);
  }
}

// =============================================================================
// Manual Sheet Refresh
// =============================================================================
async function handleRefreshClick() {
  const btn = document.getElementById("refreshSheetBtn");
  if (!btn || btn.disabled) return;

  const original = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add("opacity-70", "cursor-wait");
  btn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Refreshing...`;
  lucide.createIcons();

  const { event, year, round } = getUrlParams();

  try {
    const allEntries = await fetchMasterDirectory();
    const contestSeasons = allEntries.filter(e => e.key === event);
    const target = contestSeasons.find(c => c.year === year) || contestSeasons[0];

    if (target) {
      clearContestSheetCache(target);
      const newBust = bumpContestBust(target.key, target.year);
      console.log(`[refresh] Bumped bust for ${target.key} ${target.year} → ${newBust}`);
      // Clear the shared projection result for this contest
      localStorage.removeItem(`proj_result_${target.key}_${target.year}`);
    }
  } catch (err) {
    console.error("[refresh] Failed to invalidate sheet cache:", err);
  }

  await loadCompetitionView(event, year, round);

  btn.disabled = false;
  btn.classList.remove("opacity-70", "cursor-wait");
  btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i> Refreshed`;
  lucide.createIcons();

  setTimeout(() => {
    btn.innerHTML = original;
    lucide.createIcons();
  }, 2500);
}

// =============================================================================
// AI Enrichment — FHC Spotlight (past contests)
// =============================================================================
async function enrichFHCSpotlightPast(comp, year, currentRound, contestSeasons, allEntries) {
  const spotlight = document.getElementById("fhcSpotlightSection");
  const headlineEl = document.getElementById("fhcEventHeadline");
  const summaryEl = document.getElementById("fhcEventSummary");
  const extrasEl = document.getElementById("fhcAIExtras");
  if (!spotlight || !headlineEl || !summaryEl || !extrasEl) return;

  const activeRoster = currentRound === "finals" && activeWorkbookData.finals.length > 0
    ? activeWorkbookData.finals
    : activeWorkbookData.prelims;

  const fhc = activeRoster.find(b => b.name.toLowerCase().includes("howell central"));
  if (!fhc) return;

  const cacheKey = hashData({
    kind: "summary",
    comp: comp.key,
    year,
    round: currentRound,
    fhc: { name: fhc.name, base: fhc.base, captions: fhc.captions },
    rosterSize: activeRoster.length
  });

  const cached = getCache(cacheKey);
  if (cached) { applySummaryResult(cached, headlineEl, summaryEl, extrasEl); return; }

  showAILoading(summaryEl, true);
  extrasEl.classList.add("hidden");

  const priorSameContest = await gatherPriorSameContestScores(comp, contestSeasons, allEntries);

  try {
    const result = await generatePerformanceSummary(comp, fhc, activeRoster, currentRound, priorSameContest);
    setCache(cacheKey, result, 24);
    applySummaryResult(result, headlineEl, summaryEl, extrasEl);
  } catch (err) {
    console.error("[enrichFHCSpotlightPast]", err);
    showAIError(summaryEl, extrasEl, err.message, true);
  }
}

function applySummaryResult(result, headlineEl, summaryEl, extrasEl) {
  headlineEl.textContent = result.headline || "Official Performance Summary";
  summaryEl.textContent = result.summary || "";

  const chips = [];
  (result.strengths || []).forEach(s => chips.push(`
    <div class="flex items-start gap-2 text-xs">
      <span class="text-emerald-400 font-mono mt-0.5">▲</span>
      <span class="text-slate-300">${s}</span>
    </div>
  `));
  (result.weaknesses || []).forEach(w => chips.push(`
    <div class="flex items-start gap-2 text-xs">
      <span class="text-amber-400 font-mono mt-0.5">▼</span>
      <span class="text-slate-300">${w}</span>
    </div>
  `));
  if (result.trajectory) {
    chips.push(`
      <div class="flex items-start gap-2 text-xs pt-1 border-t border-slate-800/60 mt-1">
        <span class="text-indigo-400 font-mono mt-0.5">→</span>
        <span class="text-slate-400 italic">${result.trajectory}</span>
      </div>
    `);
  }
  extrasEl.innerHTML = chips.join("");
  extrasEl.classList.remove("hidden");
}

// =============================================================================
// AI Enrichment — Field-Wide Projected Standings
// =============================================================================
async function enrichProjectedStandings(comp, allEntries, selectedRound, contestSeasons) {
  const roster = activeWorkbookData.prelims.length > 0
    ? activeWorkbookData.prelims
    : activeWorkbookData.finals;
  if (roster.length === 0) return;

  const bust = getContestBust(comp.key, comp.year);
  const cacheKey = hashData({
    kind: "field-projection",
    comp: comp.key,
    year: comp.year,
    roster: roster.map(b => b.name).sort(),
    bust
  });

  const cached = getCache(cacheKey);
  if (cached) {
    cacheProjectionResult(comp, cached, roster, bust);
    applyFieldProjections(cached, roster, comp, selectedRound, contestSeasons, allEntries);
    return;
  }

  showProjectionLoading();

  try {
    const result = await generateAndCacheProjection(comp, allEntries);
    if (!result) { clearProjectionLoading(); return; }
    setCache(cacheKey, result, 24);
    applyFieldProjections(result, roster, comp, selectedRound, contestSeasons, allEntries);
  } catch (err) {
    console.error("[enrichProjectedStandings]", err);
    clearProjectionLoading();
  }
}

function getOrCreateOverviewEl() {
  let el = document.getElementById("leaderboardOverview");
  if (el) return el;
  const title = document.getElementById("leaderboardTitle");
  if (!title) return null;
  el = document.createElement("div");
  el.id = "leaderboardOverview";
  el.className = "hidden mb-3 p-3 bg-violet-950/20 border border-violet-500/20 rounded-xl text-xs text-violet-200 leading-relaxed";
  title.parentElement.insertAdjacentElement("afterend", el);
  return el;
}

function showProjectionLoading() {
  const body = document.getElementById("leaderboardTableBody");
  const titleEl = document.getElementById("leaderboardTitle");
  const badgeEl = document.getElementById("leaderboardBadge");
  if (!body) return;
  titleEl.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 text-violet-400"></i> Projected Standings`;
  badgeEl.textContent = "AI Projection";
  badgeEl.className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono";
  body.innerHTML = `
    <tr><td colspan="4" class="py-8 text-center text-slate-400 text-xs font-mono">
      <span class="inline-flex items-center gap-2">
        <span class="w-3 h-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin"></span>
        Analyzing field history and generating projections...
      </span>
    </td></tr>
  `;
  lucide.createIcons();
}

function clearProjectionLoading() {
  renderLeaderboard(activeWorkbookData.prelims, false);
}

function applyFieldProjections(result, roster, comp, selectedRound, contestSeasons, allEntries) {
  if (!result || !Array.isArray(result.projections)) return;

  result.projections.forEach(p => {
    const band = roster.find(b => bandNameMatches(b.name, p.name));
    if (band) band.projection = p;
  });

  activeFieldProjections = result;

  const overviewEl = getOrCreateOverviewEl();
  if (overviewEl && result.overview) {
    const hasFinals = result.finalsSize > 0;
    const finalsBadge = hasFinals
      ? `<div class="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-violet-500/15 border border-violet-400/30 text-violet-200">
           <span class="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
           Top ${result.finalsSize} advance • Cut line ~${result.finalsCutoff.toFixed(2)}
         </div>`
      : "";
    overviewEl.innerHTML = `
      <div class="text-xs text-violet-200 leading-relaxed">${result.overview}</div>
      ${finalsBadge}
    `;
    overviewEl.classList.remove("hidden");
  }

  renderLeaderboard(roster, false);
  populateUpcomingSpotlightTiles(comp, selectedRound);

  if (comp && contestSeasons && allEntries) {
    enrichFHCSpotlightUpcoming(comp, contestSeasons, allEntries).catch(err => {
      console.warn("[enrichFHCSpotlightUpcoming]", err);
    });
  }
}

function populateUpcomingSpotlightTiles(comp, currentRound) {
  const roster = activeWorkbookData.prelims.length > 0
    ? activeWorkbookData.prelims
    : activeWorkbookData.finals;
  const fhc = roster.find(b => b.name.toLowerCase().includes("howell central"));
  const spotlight = document.getElementById("fhcSpotlightSection");
  if (!fhc || !spotlight) {
    if (spotlight) spotlight.classList.add("hidden");
    return;
  }

  const proj = fhc.projection;
  if (!proj) return;

  document.getElementById("statLabel1").textContent = "Projected Score";
  const peakEl = document.getElementById("fhcStatPeak");
  peakEl.textContent = proj.projectedScore.toFixed(2);
  peakEl.className = "stat-value text-violet-300 font-mono";
  document.getElementById("fhcStatPeakSub").textContent = "AI Projection";

  document.getElementById("statLabel2").textContent = "Projected Standing";
  document.getElementById("fhcStatRank").textContent = `#${proj.projectedRank}`;
  document.getElementById("fhcStatRankSub").textContent = `${proj.confidence} confidence`;

  const finalsCard = document.getElementById("finalsBenchmarkCard");
  const hasFinals = activeFieldProjections && activeFieldProjections.finalsSize > 0;
  const showFinalsTile = hasFinals && (!showRoundToggle() || currentRound === "prelims");

  if (showFinalsTile) {
    finalsCard.classList.remove("hidden");
    const fc = proj.finalsChance ?? 0;
    const cls = fc >= 90 ? "text-emerald-300"
              : fc >= 60 ? "text-indigo-300"
              : fc >= 30 ? "text-amber-300"
              : "text-slate-400";
    document.getElementById("statLabel3").textContent = "Finals Chance";
    const cutoffEl = document.getElementById("fhcStatCutoff");
    cutoffEl.textContent = `${Math.round(fc)}%`;
    cutoffEl.className = `stat-value font-mono ${cls}`;
    document.getElementById("fhcStatCutoffSub").textContent = `Top ${activeFieldProjections.finalsSize} advance`;
  } else {
    finalsCard.classList.add("hidden");
  }
}

function showRoundToggle() {
  const rc = document.getElementById("roundToggleContainer");
  return rc && !rc.classList.contains("hidden");
}

async function enrichFHCSpotlightUpcoming(comp, contestSeasons, allEntries) {
  const headlineEl = document.getElementById("fhcEventHeadline");
  const summaryEl = document.getElementById("fhcEventSummary");
  if (!headlineEl || !summaryEl) return;

  const roster = activeWorkbookData.prelims.length > 0
    ? activeWorkbookData.prelims
    : activeWorkbookData.finals;
  const fhc = roster.find(b => b.name.toLowerCase().includes("howell central"));
  const proj = fhc?.projection;
  if (!proj) return;

  const fhcRecentScores = await gatherFHCRecentScores(comp, allEntries);
  const fhcCaptions = fhcRecentScores.length > 0
    ? (fhcRecentScores[fhcRecentScores.length - 1].captions || null)
    : null;

  const cacheKey = hashData({
    kind: "outlook",
    comp: comp.key,
    year: comp.year,
    rosterSize: roster.length,
    fhcScore: proj.projectedScore,
    fhcRank: proj.projectedRank,
    fhcFinalsChance: proj.finalsChance,
    recentScores: fhcRecentScores.map(s => `${s.year}-${s.score.toFixed(2)}`).join("|"),
    captionsHash: fhcCaptions ? JSON.stringify(fhcCaptions) : ""
  });

  const cached = getCache(cacheKey);
  if (cached) {
    headlineEl.textContent = cached.headline || "Contest Outlook";
    summaryEl.textContent = cached.reasoning || "";
    return;
  }

  headlineEl.textContent = "Contest Outlook";
  summaryEl.innerHTML = `
    <span class="inline-flex items-center gap-2 text-slate-400">
      <span class="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></span>
      Generating outlook...
    </span>
  `;

  const priorSameContest = await gatherPriorSameContestScores(comp, contestSeasons, allEntries);

  try {
    const result = await generateContestOutlook(comp, proj, priorSameContest, cacheKey, fhcRecentScores, fhcCaptions);
    setCache(cacheKey, result, 24);
    headlineEl.textContent = result.headline || "Contest Outlook";
    summaryEl.textContent = result.reasoning || "";
  } catch (err) {
    console.error("[enrichFHCSpotlightUpcoming]", err);
    summaryEl.innerHTML = `<span class="text-amber-400 text-xs font-mono">Outlook unavailable — ${err.message}</span>`;
  }
}

async function gatherFHCRecentScores(comp, allEntries) {
  const now = new Date();
  const completed = allEntries
    .filter(e => e.year === comp.year && e.key !== comp.key)
    .map(e => ({ ...e, dateObj: parseLocalDate(e.date, e.year) }))
    .filter(e => e.dateObj < now)
    .sort((a, b) => a.dateObj - b.dateObj);

  const out = [];
  for (const e of completed) {
    try {
      const rows = await fetchSheetGrid(e.id, e.prelimsTab);
      const parsed = parseFullWorkbookCSV(rows);
      const fhc = parsed.prelims.find(b => b.name.toLowerCase().includes("howell central"));
      if (fhc && fhc.base > 0) {
        out.push({
          year: e.year,
          contest: e.name,
          date: e.date,
          score: fhc.base,
          captions: fhc.captions || null
        });
      }
    } catch (err) {
      console.warn(`[gatherFHCRecentScores] Skipping ${e.name}:`, err);
    }
  }
  return out;
}

async function gatherPriorSameContestScores(comp, contestSeasons, allEntries) {
  const priors = contestSeasons.filter(c => c.year !== comp.year && parseInt(c.year, 10) < parseInt(comp.year, 10));
  const out = [];
  for (const p of priors) {
    try {
      const rows = await fetchSheetGrid(p.id, p.prelimsTab);
      const parsed = parseFullWorkbookCSV(rows);
      const fhc = parsed.prelims.find(b => b.name.toLowerCase().includes("howell central"));
      if (fhc && fhc.base > 0) out.push({ year: p.year, score: fhc.base });
    } catch (e) {
      console.warn(`[gatherPriorSameContestScores] Skipping ${p.year}:`, e);
    }
  }
  return out.sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
}

function showAILoading(summaryEl, isPast) {
  summaryEl.innerHTML = `
    <span class="inline-flex items-center gap-2 text-slate-400">
      <span class="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></span>
      ${isPast ? "Analyzing performance..." : "Generating outlook..."}
    </span>
  `;
}

function showAIError(summaryEl, extrasEl, msg, isPast) {
  summaryEl.innerHTML = `<span class="text-red-400 text-xs font-mono">AI ${isPast ? "analysis" : "outlook"} unavailable — ${msg}</span>`;
  extrasEl.classList.add("hidden");
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
      document.getElementById("statLabel1").textContent = "Projected Score";
      document.getElementById("statLabel2").textContent = "Projected Standing";
      document.getElementById("statLabel3").textContent = "Finals Chance";
      document.getElementById("fhcStatPeak").textContent = "…";
      document.getElementById("fhcStatPeakSub").textContent = "Generating";
      document.getElementById("fhcStatRank").textContent = "…";
      document.getElementById("fhcStatRankSub").textContent = "Generating";
      document.getElementById("fhcEventHeadline").textContent = "Contest Outlook";
      document.getElementById("fhcEventSummary").textContent = `Analyzing field history and generating projections...`;
      if (showToggle && currentRound === "prelims") {
        finalsCard.classList.remove("hidden");
        document.getElementById("fhcStatCutoff").textContent = "…";
        document.getElementById("fhcStatCutoffSub").textContent = "Generating";
      } else {
        finalsCard.classList.add("hidden");
      }
    }
  }

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

  renderLeaderboard(activeRoster, isPast);
  lucide.createIcons();
}

function renderLeaderboard(activeRoster, isPast) {
  const leaderboardBody = document.getElementById("leaderboardTableBody");
  const titleEl = document.getElementById("leaderboardTitle");
  const badgeEl = document.getElementById("leaderboardBadge");
  const colScoreEl = document.getElementById("colScore");
  const colStatusEl = document.getElementById("colStatus");
  const overviewEl = getOrCreateOverviewEl();
  if (!leaderboardBody) return;

  const showingProjection = !isPast && activeFieldProjections && activeFieldProjections.projections?.length > 0;

  if (showingProjection) {
    titleEl.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 text-violet-400"></i> Projected Standings`;
    badgeEl.textContent = "AI Projection";
    badgeEl.className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono";
    colScoreEl.textContent = "Proj. Score";
    colStatusEl.textContent = "Confidence";
  } else {
    titleEl.innerHTML = `<i data-lucide="award" class="w-4 h-4 text-emerald-400"></i> Results & Standings`;
    badgeEl.textContent = isPast ? "Official Results" : "Awaiting Results";
    badgeEl.className = "badge-emerald";
    colScoreEl.textContent = "Total Score";
    colStatusEl.textContent = "Class / Round";
    if (overviewEl) overviewEl.classList.add("hidden");
  }

  leaderboardBody.innerHTML = "";

  if (showingProjection) {
    const sorted = [...activeFieldProjections.projections].sort((a, b) => b.projectedScore - a.projectedScore);
    sorted.forEach((p, idx) => {
      const rosterBand = activeRoster.find(b => bandNameMatches(b.name, p.name));
      const isFHC = p.name.toLowerCase().includes("howell central");
      const confColor = p.confidence === "high" ? "text-emerald-400" : p.confidence === "low" ? "text-amber-400" : "text-indigo-400";

      const tr = document.createElement("tr");
      tr.className = isFHC
        ? "bg-blue-950/40 border-l-2 border-blue-400 cursor-pointer hover:bg-blue-950/60 transition"
        : "hover:bg-slate-900/50 transition cursor-pointer";
      tr.innerHTML = `
        <td class="py-2.5 px-3 font-mono font-bold ${idx < 3 ? 'text-amber-400' : 'text-slate-400'}">#${p.projectedRank}</td>
        <td class="py-2.5 px-3 ${isFHC ? 'text-blue-300 font-bold' : 'text-white'}">
          ${p.name}
          ${rosterBand && rosterBand.classification ? `<span class="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono ml-1">${rosterBand.classification}</span>` : ''}
        </td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-violet-300 italic">
          ${p.projectedScore.toFixed(2)}
        </td>
        <td class="py-2.5 px-3 text-right">
          <span class="text-[10px] font-mono uppercase tracking-wider ${confColor}">${p.confidence}</span>
        </td>
      `;
      tr.onclick = () => openBandModal(
        rosterBand || { name: p.name, base: 0, captions: {} },
        activeRoster
      );
      leaderboardBody.appendChild(tr);
    });
  } else {
    const sorted = [...activeRoster].sort((a, b) => b.base - a.base);
    const emptyScoreLabel = isPast ? "—" : "Pending";
    const fmtScore = (val) => val > 0 ? val.toFixed(3) : emptyScoreLabel;

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
  }

  lucide.createIcons();
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
  const proj = band.projection;
  if (proj) {
    metaEl.textContent = `${band.classification || "Unclassified"} • Projected #${proj.projectedRank} • ${band.round || "Prelims"}`;
  } else {
    metaEl.textContent = `${band.classification || "Unclassified"} • Rank #${rank} of ${allBands.length} • ${band.round || "Prelims"}`;
  }

  const c = band.captions || {};
  const hasCaptions = Object.keys(c).length > 0;
  const hasFinalsData = proj && activeFieldProjections && activeFieldProjections.finalsSize > 0;
  const gridCols = hasFinalsData ? "grid-cols-3" : "grid-cols-2";

  let html = `
    <div class="grid ${gridCols} gap-3">
      <div class="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
        <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">${proj ? "Projected Score" : "Total Score"}</div>
        <div class="text-2xl font-black ${proj ? 'text-violet-300 italic' : 'text-emerald-400'} font-mono mt-1">
          ${proj ? proj.projectedScore.toFixed(2) : (band.base > 0 ? band.base.toFixed(3) : "—")}
        </div>
      </div>
      <div class="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
        <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">${proj ? "Projected Rank" : "Placement"}</div>
        <div class="text-2xl font-black ${proj ? 'text-violet-400' : 'text-indigo-400'} font-mono mt-1">
          #${proj ? proj.projectedRank : rank}
        </div>
      </div>
      ${hasFinalsData ? `
      <div class="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
        <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Finals Chance</div>
        <div class="text-2xl font-black font-mono mt-1 ${
          proj.finalsChance >= 90 ? 'text-emerald-400'
          : proj.finalsChance >= 60 ? 'text-indigo-400'
          : proj.finalsChance >= 30 ? 'text-amber-400'
          : 'text-slate-500'
        }">${Math.round(proj.finalsChance)}%</div>
      </div>
      ` : ""}
    </div>
  `;

  if (proj && proj.note) {
    const projMeta = [];
    if (proj.confidence) projMeta.push(`${proj.confidence} confidence`);
    if (proj.finalsChance != null && activeFieldProjections?.finalsSize > 0) {
      projMeta.push(`${Math.round(proj.finalsChance)}% finals chance`);
    }
    html += `
      <div class="border border-violet-500/30 bg-violet-950/20 rounded-xl overflow-hidden">
        <div class="px-4 py-2 bg-violet-500/10 border-b border-violet-500/20 flex items-center gap-2">
          <i data-lucide="sparkles" class="w-3.5 h-3.5 text-violet-300"></i>
          <span class="text-xs font-bold text-violet-300 uppercase tracking-wider">AI Projection — ${projMeta.join(" • ")}</span>
        </div>
        <div class="px-4 py-3 text-xs text-violet-100 leading-relaxed">
          ${proj.note}
        </div>
      </div>
    `;
  }

  if (!hasCaptions) {
    html += `
      <div class="border border-dashed border-slate-700 rounded-xl p-6 text-center text-slate-500 text-xs font-mono">
        No caption data available for this band.
      </div>
    `;
  } else {
    const groups = [
      { title: "Music Performance", color: "emerald", items: [
        { label: "Individual", val: c.musicInd }, { label: "Ensemble", val: c.musicEns }, { label: "Total", val: c.musicTotal, bold: true }
      ]},
      { title: "Visual Performance", color: "pink", items: [
        { label: "Individual", val: c.visualInd }, { label: "Ensemble", val: c.visualEns }, { label: "Total", val: c.visualTotal, bold: true }
      ]},
      { title: "General Effect", color: "indigo", items: [
        { label: "Music", val: c.geMusic }, { label: "Visual", val: c.geVisual }, { label: "Total", val: c.geTotal, bold: true }
      ]}
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

  if (!proj) {
    html += `
      <div class="border border-dashed border-slate-700 rounded-xl p-5 text-center">
        <div class="inline-flex items-center gap-2 text-slate-500 text-xs font-mono">
          <i data-lucide="sparkles" class="w-4 h-4"></i>
          AI Review — Coming Soon
        </div>
      </div>
    `;
  }

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

  const modal = document.getElementById("bandModal");
  const closeBtn = document.getElementById("modalCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeBandModal);
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeBandModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBandModal(); });

  const refreshBtn = document.getElementById("refreshSheetBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", handleRefreshClick);

  const { event, year, round } = getUrlParams();
  loadCompetitionView(event, year, round);
});