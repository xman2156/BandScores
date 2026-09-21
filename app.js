// =============================================================================
// Dashboard — Live Master Directory + Recent Contest + FHC Trajectory
// =============================================================================

const MASTER_INDEX_SPREADSHEET_ID = "106s_uuX5YOXAS_cXPCqj4HaO69DK8wHMWGevKUhTWd0";

let fhcChartInstance = null;

// ---------------------------------------------------------------------------
// Shared helpers (mirrors competition.js)
// ---------------------------------------------------------------------------
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

function formatShortDate(dateStr) {
  const d = dateStr instanceof Date ? dateStr : parseLocalDate(dateStr, new Date().getFullYear());
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
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

  if (entries.length === 0) throw new Error("Directory empty");
  return entries;
}

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

// ---------------------------------------------------------------------------
// Slim parser — we only need band name + total here (captions live on the contest page)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Tile 1 — Recent Scores (from most recent completed contest)
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

    if (titleEl) {
      titleEl.textContent = `Recent Scores (${formatShortDate(recent.date)})`;
    }

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
// Tile 2 — Upcoming Contests
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
// Tile 4 — FHC Trajectory Chart (live from BOA STL sheets across years)
// ---------------------------------------------------------------------------
async function loadFhcChart() {
  const ctx = document.getElementById("fhcChart")?.getContext("2d");
  if (!ctx) return;

  let labels = [], totals = [], musicAverages = [], visualAverages = [];

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
          // Derive music/visual averages from the raw row — approximate:
          musicAverages.push(null);
          visualAverages.push(null);
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
// Sync button behavior
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
  loadFhcChart();
});