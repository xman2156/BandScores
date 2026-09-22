// =============================================================================
// Dashboard — uses shared.js for all fetching/parsing/projection logic
// =============================================================================

let fhcChartInstance = null;
let fhcChartMode = "boa";
let fhcChartData = {
  boa: { labels: [], scores: [], projectedFrom: -1 },
  season: { labels: [], scores: [], projectedFrom: -1 }
};

function formatShortDate(dateStr) {
  const d = dateStr instanceof Date ? dateStr : parseLocalDate(dateStr, new Date().getFullYear());
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function rosterHasFHC(roster) {
  return roster.some(b => bandNameMatches(b.name, "Francis Howell Central"));
}

// ---------------------------------------------------------------------------
// Spotlight Tiles (FHC)
// ---------------------------------------------------------------------------
async function loadSpotlightTiles() {
  const container = document.getElementById("spotlightTiles");
  if (!container) return;

  container.innerHTML = `
    <div class="stat-card flex-1 min-w-[140px]">
      <div class="stat-label">Spotlight</div>
      <div class="stat-value text-slate-500 font-mono animate-pulse text-base">Loading…</div>
      <div class="stat-sub">Checking FHC schedule</div>
    </div>
  `;

  let allEntries;
  try {
    allEntries = await fetchMasterDirectory();
  } catch (err) {
    console.error("[loadSpotlightTiles] Directory fetch failed:", err);
    container.innerHTML = `
      <div class="stat-card flex-1 min-w-[140px]">
        <div class="stat-label">Spotlight</div>
        <div class="stat-value text-red-400 text-sm">Unavailable</div>
        <div class="stat-sub">Could not reach directory</div>
      </div>
    `;
    return;
  }

  const now = new Date();
  const withDates = allEntries.map(e => ({ ...e, dateObj: parseLocalDate(e.date, e.year) }));

  const completedSorted = withDates
    .filter(e => e.dateObj < now)
    .sort((a, b) => b.dateObj - a.dateObj);

  const recentCompleted = [];
  for (const comp of completedSorted) {
    if (recentCompleted.length >= 2) break;
    try {
      const rows = await fetchSheetGrid(comp.id, comp.prelimsTab);
      const parsed = parseFullWorkbookCSV(rows);
      const roster = parsed.prelims;
      if (!rosterHasFHC(roster)) continue;
      const sorted = [...roster].sort((a, b) => b.base - a.base);
      const idx = sorted.findIndex(b => b.name.toLowerCase().includes("howell central"));
      const fhc = sorted[idx];
      if (fhc.base > 0) {
        recentCompleted.push({
          comp,
          result: { score: fhc.base, rank: idx + 1, totalBands: roster.length }
        });
      }
    } catch (err) {
      console.warn("[spotlight] Skipping completed", comp.name, err);
    }
  }

  const upcomingSorted = withDates
    .filter(e => e.dateObj >= now)
    .sort((a, b) => a.dateObj - b.dateObj);

  const upcomingForFHC = [];
  for (const comp of upcomingSorted) {
    if (upcomingForFHC.length >= 2) break;
    try {
      const rows = await fetchSheetGrid(comp.id, comp.prelimsTab);
      const parsed = parseFullWorkbookCSV(rows);
      if (!rosterHasFHC(parsed.prelims)) continue;
      upcomingForFHC.push(comp);
    } catch (err) {
      console.warn("[spotlight] Skipping upcoming", comp.name, err);
    }
  }

  const tiles = [
    ...recentCompleted.map(x => ({ comp: x.comp, isPast: true, result: x.result })),
    ...upcomingForFHC.map(comp => ({ comp, isPast: false, result: null }))
  ];

  if (tiles.length === 0) {
    container.innerHTML = `
      <div class="stat-card flex-1 min-w-[140px]">
        <div class="stat-label">Spotlight</div>
        <div class="stat-value text-slate-500 italic text-sm">No competitions</div>
        <div class="stat-sub">FHC has no recorded appearances</div>
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  tiles.forEach(({ comp, isPast }) => {
    const tile = document.createElement("div");
    tile.className = isPast
      ? "stat-card flex-1 min-w-[140px]"
      : "stat-card flex-1 min-w-[140px] border-violet-500/30 bg-violet-950/20";
    tile.dataset.key = `${comp.key}_${comp.year}`;
    const label = shortContestLabel(comp) + " '" + comp.year.slice(-2);
    tile.innerHTML = `
      <div class="stat-label ${isPast ? '' : 'text-violet-400'}">${label}${isPast ? '' : ' Proj.'}</div>
      <div class="stat-value text-slate-500 animate-pulse">--</div>
      <div class="stat-sub">Loading…</div>
    `;
    container.appendChild(tile);
  });

  for (const { comp, isPast, result } of tiles) {
    const tile = container.querySelector(`[data-key="${comp.key}_${comp.year}"]`);
    if (!tile) continue;
    try {
      if (isPast) {
        fillCompletedTile(tile, comp, result);
      } else {
        await fillUpcomingTile(tile, comp, allEntries);
      }
    } catch (err) {
      console.error("[loadSpotlightTiles] tile fill failed:", err);
    }
  }
}

function fillCompletedTile(tile, comp, result) {
  const label = shortContestLabel(comp) + " '" + comp.year.slice(-2);
  if (!result) {
    tile.innerHTML = `
      <div class="stat-label">${label}</div>
      <div class="stat-value text-slate-500 italic">—</div>
      <div class="stat-sub">No result</div>
    `;
    return;
  }
  tile.innerHTML = `
    <div class="stat-label">${label}</div>
    <div class="stat-value text-white font-mono">${result.score.toFixed(3)}</div>
    <div class="stat-sub text-slate-400">#${result.rank} of ${result.totalBands}</div>
  `;
}

async function fillUpcomingTile(tile, comp, allEntries) {
  const label = shortContestLabel(comp) + " '" + comp.year.slice(-2);

  let cached = getCachedProjectionResult(comp);
  if (!cached) {
    tile.innerHTML = `
      <div class="stat-label text-violet-400">${label} Proj.</div>
      <div class="stat-value text-violet-300 font-mono animate-pulse">…</div>
      <div class="stat-sub text-violet-400">Generating AI projection</div>
    `;
    try {
      await generateAndCacheProjection(comp, allEntries);
      cached = getCachedProjectionResult(comp);
    } catch (err) {
      console.error("[fillUpcomingTile projection]", err);
    }
  }

  if (cached && cached.fhcProjection) {
    const p = cached.fhcProjection;
    tile.innerHTML = `
      <div class="stat-label text-violet-400">${label} Proj.</div>
      <div class="stat-value text-violet-300 font-mono">${p.projectedScore.toFixed(2)}</div>
      <div class="stat-sub text-violet-400">#${p.projectedRank} projected · ${p.confidence}</div>
    `;
  } else {
    tile.innerHTML = `
      <div class="stat-label text-violet-400">${label} Proj.</div>
      <div class="stat-value text-slate-500 italic">—</div>
      <div class="stat-sub">Not available</div>
    `;
  }
}

// ---------------------------------------------------------------------------
// Recent Competitions Tile
// ---------------------------------------------------------------------------
async function loadRecentCompetitions() {
  const tbody = document.getElementById("recentCompsTableBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-500 text-xs italic animate-pulse">Loading recent competitions…</td></tr>`;

  let directory;
  try {
    directory = await fetchMasterDirectory();
  } catch (err) {
    console.error("[loadRecentCompetitions]", err);
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-red-400 text-xs font-mono">Could not load recent competitions.</td></tr>`;
    return;
  }

  const now = new Date();
  const completed = directory
    .map(e => ({ ...e, dateObj: parseLocalDate(e.date, e.year) }))
    .filter(e => e.dateObj < now)
    .sort((a, b) => b.dateObj - a.dateObj)
    .slice(0, 4);

  if (completed.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-500 text-xs italic">No completed competitions yet.</td></tr>`;
    return;
  }

  const results = await Promise.all(completed.map(async (comp) => {
    try {
      const rows = await fetchSheetGrid(comp.id, comp.prelimsTab);
      const parsed = parseFullWorkbookCSV(rows);
      const roster = parsed.prelims;
      if (roster.length === 0) return { comp, winner: null, fhc: null };

      const sorted = [...roster].sort((a, b) => b.base - a.base);
      const winner = sorted[0];
      const fhcIdx = sorted.findIndex(b => bandNameMatches(b.name, "Francis Howell Central"));
      const fhc = fhcIdx >= 0 && sorted[fhcIdx].base > 0
        ? { rank: fhcIdx + 1, score: sorted[fhcIdx].base, totalBands: roster.length }
        : null;

      return { comp, winner, fhc };
    } catch (err) {
      console.warn(`[loadRecentCompetitions] Skipping ${comp.name}:`, err);
      return { comp, winner: null, fhc: null };
    }
  }));

  tbody.innerHTML = "";
  results.forEach(({ comp, winner, fhc }) => {
    const tr = document.createElement("tr");
    const dateStr = formatShortDate(comp.dateObj);

    const winnerCell = (winner && winner.base > 0)
      ? `<div class="text-white text-xs font-medium leading-tight">${winner.name}</div>
         <div class="font-mono text-emerald-400 text-[11px] leading-tight">${winner.base.toFixed(3)}</div>`
      : `<span class="text-slate-500 italic text-[11px]">No results</span>`;

    const fhcCell = fhc
      ? `<div class="text-right">
           <div class="text-blue-300 font-bold text-xs leading-tight">#${fhc.rank} of ${fhc.totalBands}</div>
           <div class="font-mono text-blue-400 text-[11px] leading-tight">${fhc.score.toFixed(3)}</div>
         </div>`
      : `<div class="text-right text-slate-600 italic text-[11px]">Did not attend</div>`;

    tr.innerHTML = `
      <td class="py-2.5 pr-3">
        <div class="text-white font-bold text-xs leading-tight">${comp.name}</div>
        <div class="text-slate-500 text-[10px] font-mono leading-tight">${comp.loc}</div>
      </td>
      <td class="py-2.5 px-3 text-slate-400 text-[11px] font-mono whitespace-nowrap">${dateStr}</td>
      <td class="py-2.5 px-3">${winnerCell}</td>
      <td class="py-2.5 pl-3">${fhcCell}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Upcoming Competitions Tile
// ---------------------------------------------------------------------------
async function loadUpcomingContests() {
  const container = document.getElementById("upcomingList");
  if (!container) return;

  try {
    const directory = await fetchMasterDirectory();
    const now = new Date();

    const upcoming = directory
      .map(e => ({ ...e, dateObj: parseLocalDate(e.date, e.year) }))
      .filter(e => e.dateObj >= now)
      .sort((a, b) => a.dateObj - b.dateObj)
      .slice(0, 3);

    container.innerHTML = "";
    if (upcoming.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-500 italic text-center py-4">No upcoming competitions on the calendar.</div>`;
      return;
    }

    upcoming.forEach(e => {
      const a = document.createElement("a");
      a.href = `competition.html?event=${e.key}&year=${e.year}`;
      a.className = "calendar-item hover:border-indigo-500 hover:bg-slate-900 transition block";
      a.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <div class="font-bold text-white text-sm">${e.name}</div>
            <div class="text-xs text-slate-400">${e.loc}</div>
          </div>
          <div class="font-mono text-xs text-indigo-400 font-bold">${formatShortDate(e.dateObj)} &rarr;</div>
        </div>
      `;
      container.appendChild(a);
    });
  } catch (err) {
    console.error("[loadUpcomingContests]", err);
    container.innerHTML = `<div class="text-xs text-red-400 font-mono text-center py-4">Could not load upcoming competitions.</div>`;
  }
}

// ---------------------------------------------------------------------------
// Chart — loads both datasets and renders the selected one
// ---------------------------------------------------------------------------
async function loadFhcChart() {
  let directory;
  try {
    directory = await fetchMasterDirectory();
  } catch (err) {
    console.error("[loadFhcChart] Directory fetch failed:", err);
    return;
  }

  const now = new Date();

  // ---------- BOA dataset ----------
  const boaAll = directory
    .filter(e => e.key === "boastl")
    .map(e => ({ ...e, dateObj: parseLocalDate(e.date, e.year) }));

  const boaPast = boaAll
    .filter(e => e.dateObj < now)
    .sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
  const boaNext = boaAll
    .filter(e => e.dateObj >= now)
    .sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10))[0];

  const boaLabels = [];
  const boaScores = [];
  for (const entry of boaPast) {
    try {
      const rows = await fetchSheetGrid(entry.id, entry.prelimsTab);
      const parsed = parseFullWorkbookCSV(rows);
      const fhc = parsed.prelims.find(b => bandNameMatches(b.name, "Francis Howell Central"));
      if (fhc && fhc.base > 0) {
        boaLabels.push(`${entry.year}`);
        boaScores.push(fhc.base);
      }
    } catch (e) {
      console.warn(`[loadFhcChart] Skipping BOA ${entry.year}:`, e);
    }
  }

  let boaProjectedFrom = -1;
  if (boaNext) {
    const proj = getCachedProjectionResult(boaNext);
    if (proj && proj.fhcProjection) {
      boaLabels.push(`${boaNext.year} Proj.`);
      boaScores.push(proj.fhcProjection.projectedScore);
      boaProjectedFrom = boaLabels.length - 1;
    }
  }

  fhcChartData.boa = { labels: boaLabels, scores: boaScores, projectedFrom: boaProjectedFrom };

  // ---------- 2026 Season dataset ----------
  const seasonAll = directory
    .filter(e => e.year === "2026")
    .map(e => ({ ...e, dateObj: parseLocalDate(e.date, e.year) }))
    .sort((a, b) => a.dateObj - b.dateObj);

  const seasonLabels = [];
  const seasonScores = [];
  let seasonProjectedFrom = -1;

  for (const comp of seasonAll) {
    try {
      const rows = await fetchSheetGrid(comp.id, comp.prelimsTab);
      const parsed = parseFullWorkbookCSV(rows);
      const fhc = parsed.prelims.find(b => bandNameMatches(b.name, "Francis Howell Central"));
      if (!fhc) continue;

      const isPast = comp.dateObj < now;
      const label = shortContestLabel(comp);

      if (isPast && fhc.base > 0) {
        seasonLabels.push(label);
        seasonScores.push(fhc.base);
      } else if (!isPast) {
        const proj = getCachedProjectionResult(comp);
        if (proj && proj.fhcProjection) {
          if (seasonProjectedFrom === -1) seasonProjectedFrom = seasonLabels.length;
          seasonLabels.push(`${label} Proj.`);
          seasonScores.push(proj.fhcProjection.projectedScore);
        }
      }
    } catch (e) {
      console.warn(`[loadFhcChart] Skipping season ${comp.name}:`, e);
    }
  }

  fhcChartData.season = { labels: seasonLabels, scores: seasonScores, projectedFrom: seasonProjectedFrom };

  renderFhcChart();

  // Background: generate BOA projection if missing
  if (boaNext && boaProjectedFrom === -1) {
    console.log(`[loadFhcChart] Generating ${boaNext.year} BOA STL projection in background...`);
    try {
      await generateAndCacheProjection(boaNext, directory);
      const proj = getCachedProjectionResult(boaNext);
      if (proj && proj.fhcProjection) {
        fhcChartData.boa.labels.push(`${boaNext.year} Proj.`);
        fhcChartData.boa.scores.push(proj.fhcProjection.projectedScore);
        fhcChartData.boa.projectedFrom = fhcChartData.boa.labels.length - 1;

        const alreadyInSeason = fhcChartData.season.labels.some(l => l.startsWith("BOA STL"));
        if (!alreadyInSeason) {
          const newIdx = fhcChartData.season.labels.length;
          if (fhcChartData.season.projectedFrom === -1) fhcChartData.season.projectedFrom = newIdx;
          fhcChartData.season.labels.push(`${boaNext.year} Proj.`);
          fhcChartData.season.scores.push(proj.fhcProjection.projectedScore);
        }

        console.log(`[loadFhcChart] BOA projection ready: ${proj.fhcProjection.projectedScore}`);
        renderFhcChart();
      }
    } catch (e) {
      console.warn("[loadFhcChart] BOA projection failed:", e);
    }
  }
}

function setChartMode(mode) {
  fhcChartMode = mode;

  const subtitleEl = document.getElementById("chartSubtitle");
  const descEl = document.getElementById("chartDescription");
  if (subtitleEl) subtitleEl.textContent = mode === "boa" ? "BOA STL Trajectory" : "2026 Season Progression";
  if (descEl) {
    descEl.textContent = mode === "boa"
      ? "Solid line: verified historical BOA STL Prelims scores. Dashed violet: projected current-season result."
      : "Solid line: completed 2026 competition scores. Dashed violet: AI-projected scores for upcoming competitions. Competitions FHC did not attend are omitted.";
  }

  renderFhcChart();
}

function renderFhcChart() {
  const ctx = document.getElementById("fhcChart")?.getContext("2d");
  if (!ctx) return;

  const data = fhcChartData[fhcChartMode];

  if (fhcChartInstance) fhcChartInstance.destroy();

  const historicalBorder = "#38bdf8";
  const projectedBorder = "#a78bfa";

  if (!data || data.labels.length === 0) {
    fhcChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["No data yet"],
        datasets: [{
          label: "—",
          data: [0],
          borderColor: "#334155",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "#1e293b" }, ticks: { color: "#64748b" } },
          y: { grid: { color: "#1e293b" }, ticks: { color: "#64748b" } }
        }
      }
    });
    return;
  }

  const { labels, scores, projectedFrom } = data;
  const projStart = projectedFrom;

  fhcChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: fhcChartMode === "boa" ? "BOA STL Prelims Score" : "2026 Season Score",
        data: scores,
        borderColor: historicalBorder,
        backgroundColor: "rgba(56, 189, 248, 0.1)",
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        segment: {
          borderColor: (s) => (projStart >= 0 && s.p1DataIndex >= projStart ? projectedBorder : historicalBorder),
          borderDash: (s) => (projStart >= 0 && s.p1DataIndex >= projStart ? [7, 5] : undefined)
        },
        pointBackgroundColor: (p) => (projStart >= 0 && p.dataIndex >= projStart ? projectedBorder : historicalBorder),
        pointBorderColor: (p) => (projStart >= 0 && p.dataIndex >= projStart ? projectedBorder : historicalBorder),
        pointRadius: (p) => (projStart >= 0 && p.dataIndex >= projStart ? 7 : 4),
        pointHoverRadius: (p) => (projStart >= 0 && p.dataIndex >= projStart ? 9 : 6)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#94a3b8", font: { family: "Plus Jakarta Sans", size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const isProj = projStart >= 0 && item.dataIndex >= projStart;
              return ` ${isProj ? "Projected: " : "Score: "}${item.parsed.y.toFixed(3)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "#1e293b" },
          ticks: { color: "#64748b", font: { family: "JetBrains Mono", size: 10 } }
        },
        y: {
          grid: { color: "#1e293b" },
          ticks: { color: "#64748b", font: { family: "JetBrains Mono", size: 10 } }
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Sync Button
// ---------------------------------------------------------------------------
function wireSyncButton() {
  const btn = document.getElementById("syncButton");
  if (!btn) return;
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    btn.classList.add("opacity-70", "cursor-wait");
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Syncing...`;
    lucide.createIcons();

    await Promise.all([
      loadRecentCompetitions(),
      loadUpcomingContests(),
      loadSpotlightTiles(),
      loadFhcChart()
    ]);

    btn.classList.remove("opacity-70", "cursor-wait");
    btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Up to Date`;
    lucide.createIcons();

    setTimeout(() => {
      btn.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> Sync Sheet Data`;
      lucide.createIcons();
    }, 2000);
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  wireSyncButton();

  loadRecentCompetitions();
  loadUpcomingContests();

  loadFhcChart();

  loadSpotlightTiles().then(() => {
    console.log("[bootstrap] Spotlight complete, refreshing chart...");
    loadFhcChart();
  });
});