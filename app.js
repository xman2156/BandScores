// =============================================================================
// Dashboard — uses shared.js for all fetching/parsing/projection logic
// =============================================================================

let fhcChartInstance = null;

function formatShortDate(dateStr) {
  const d = dateStr instanceof Date ? dateStr : parseLocalDate(dateStr, new Date().getFullYear());
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// Lightweight parser for the recent-scores tile — total score + name only
function parseSheetForDashboard(rows) {
  const out = [];
  const forbidden = ["music performance","visual performance","general effect","judge panel",
    "individual","ensemble","total","order","school name","field & timing","prelims","finals",
    "rating","score","music","visual","panel","outstanding","oustanding","awards","class",
    "rank","division","penalty"];

  for (const rawRow of rows) {
    const row = (rawRow || []).map(c => (c || "").toString().trim().replace(/\u00a0/g, " "));
    if (row.every(c => c === "")) continue;

    const line = row.join(" ").toLowerCase();
    if (line.includes("judge panel") || line.includes("school name")) continue;
    if (line.includes("individual") && line.includes("ensemble")) continue;
    if (line.includes("finals") && !line.includes("prelims") && !line.includes("field & timing")) break;

    let scoreVal = 0;
    for (let c = row.length - 1; c >= 0; c--) {
      const v = parseFloat(row[c]);
      if (!isNaN(v) && v >= 35 && v <= 100) { scoreVal = v; break; }
    }
    if (scoreVal === 0) continue;

    let name = "";
    for (let c = 0; c < Math.min(row.length, 4); c++) {
      const cell = row[c];
      const lc = cell.toLowerCase();
      if (cell.length > 2 && isNaN(Number(cell))) {
        const isForbidden = forbidden.some(w => lc === w || lc.startsWith(w + " "));
        const isOrdinal = /^\d+(st|nd|rd|th)\b/i.test(lc);
        if (!isForbidden && !isOrdinal) { name = cell; break; }
      }
    }
    if (!name) continue;

    if (out.find(b => b.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({ name, base: scoreVal });
  }
  return out;
}

// Does the given roster contain FHC?
function rosterHasFHC(roster) {
  return roster.some(b => bandNameMatches(b.name, "Francis Howell Central"));
}

// ---------------------------------------------------------------------------
// Spotlight Tiles (FHC) — reads from cached projections, generates on miss.
// Only includes contests where FHC is on the roster / results list.
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

  // ---- 1. Most recent completed contests FHC actually attended ----
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
      if (!rosterHasFHC(roster)) {
        console.log(`[spotlight] ${comp.year} ${comp.name}: FHC not in results, skipping`);
        continue;
      }
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

  // ---- 2. Soonest upcoming contests FHC is registered for ----
  const upcomingSorted = withDates
    .filter(e => e.dateObj >= now)
    .sort((a, b) => a.dateObj - b.dateObj);

  const upcomingForFHC = [];
  for (const comp of upcomingSorted) {
    if (upcomingForFHC.length >= 2) break;
    try {
      const rows = await fetchSheetGrid(comp.id, comp.prelimsTab);
      const parsed = parseFullWorkbookCSV(rows);
      if (!rosterHasFHC(parsed.prelims)) {
        console.log(`[spotlight] ${comp.year} ${comp.name}: FHC not registered, skipping`);
        continue;
      }
      upcomingForFHC.push(comp);
    } catch (err) {
      console.warn("[spotlight] Skipping upcoming", comp.name, err);
    }
  }

  // ---- 3. Assemble final tile list ----
  const tiles = [
    ...recentCompleted.map(x => ({ comp: x.comp, isPast: true, result: x.result })),
    ...upcomingForFHC.map(comp => ({ comp, isPast: false, result: null }))
  ];

  if (tiles.length === 0) {
    container.innerHTML = `
      <div class="stat-card flex-1 min-w-[140px]">
        <div class="stat-label">Spotlight</div>
        <div class="stat-value text-slate-500 italic text-sm">No contests</div>
        <div class="stat-sub">FHC has no recorded appearances</div>
      </div>
    `;
    return;
  }

  // ---- 4. Render tile shells ----
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

  // ---- 5. Fill tiles sequentially so shared sheet fetches are reused ----
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
// Recent Scores Tile
// ---------------------------------------------------------------------------
async function loadRecentScores() {
  const tbody = document.getElementById("scoresTableBody");
  const titleEl = document.getElementById("recentScoresTitle");
  if (!tbody) return;

  try {
    const directory = await fetchMasterDirectory();
    const now = new Date();

    const completed = directory
      .map(e => ({ ...e, dateObj: parseLocalDate(e.date, e.year) }))
      .filter(e => e.dateObj < now)
      .sort((a, b) => b.dateObj - a.dateObj);

    if (completed.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-slate-500 text-xs italic">No completed contests yet.</td></tr>`;
      if (titleEl) titleEl.textContent = "Recent Scores";
      return;
    }

    const recent = completed[0];
    const rows = await fetchSheetGrid(recent.id, recent.prelimsTab);
    const parsed = parseSheetForDashboard(rows);
    const top = parsed.sort((a, b) => b.base - a.base).slice(0, 7);

    if (titleEl) titleEl.textContent = `Recent Scores (${formatShortDate(recent.date)})`;

    tbody.innerHTML = "";
    top.forEach(band => {
      const isFHC = band.name.toLowerCase().includes("howell central");
      const tr = document.createElement("tr");
      tr.className = isFHC ? "bg-blue-950/30" : "";
      tr.innerHTML = `
        <td class="py-2 ${isFHC ? 'text-blue-300 font-bold' : 'text-white'}">
          ${band.name} ${isFHC ? '<span class="text-[10px] bg-blue-500/20 text-blue-300 px-1 rounded ml-1">FHC</span>' : ''}
        </td>
        <td class="py-2 text-right text-slate-400">${recent.name}</td>
        <td class="py-2 text-right font-mono text-emerald-400 font-bold">${band.base.toFixed(3)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("[loadRecentScores]", err);
    tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-red-400 text-xs font-mono">Could not load recent scores.</td></tr>`;
  }
}

// ---------------------------------------------------------------------------
// Upcoming Contests Tile
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
      container.innerHTML = `<div class="text-xs text-slate-500 italic text-center py-4">No upcoming contests on the calendar.</div>`;
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
    container.innerHTML = `<div class="text-xs text-red-400 font-mono text-center py-4">Could not load upcoming contests.</div>`;
  }
}

// ---------------------------------------------------------------------------
// FHC BOA STL Trajectory Chart
// ---------------------------------------------------------------------------
async function loadFhcChart() {
  const ctx = document.getElementById("fhcChart")?.getContext("2d");
  if (!ctx) return;

  let labels = [], totals = [];

  try {
    const directory = await fetchMasterDirectory();
    const boaEntries = directory
      .filter(e => e.key === "boastl")
      .map(e => ({ ...e, dateObj: parseLocalDate(e.date, e.year) }))
      .filter(e => e.dateObj < new Date())
      .sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));

    for (const entry of boaEntries) {
      try {
        const rows = await fetchSheetGrid(entry.id, entry.prelimsTab);
        const parsed = parseSheetForDashboard(rows);
        const fhc = parsed.find(b => b.name.toLowerCase().includes("howell central"));
        if (fhc) {
          labels.push(`${entry.year} Prelims`);
          totals.push(fhc.base);
        }
      } catch (e) {
        console.warn(`[loadFhcChart] Skipping ${entry.year}:`, e);
      }
    }
  } catch (err) {
    console.error("[loadFhcChart] Directory fetch failed:", err);
  }

  if (labels.length === 0) {
    labels = ["No BOA STL data yet"];
    totals = [0];
  }

  if (fhcChartInstance) fhcChartInstance.destroy();

  fhcChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Total BOA Score",
          data: totals,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          borderWidth: 3,
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#94a3b8", font: { family: "Plus Jakarta Sans", size: 11 } }
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
      loadRecentScores(),
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

  loadRecentScores();
  loadUpcomingContests();
  loadSpotlightTiles();
  loadFhcChart();
});