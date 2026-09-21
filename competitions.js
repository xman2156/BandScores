// =============================================================================
// Live Master Directory Engine (Directory Page)
// =============================================================================

const MASTER_INDEX_SPREADSHEET_ID = "106s_uuX5YOXAS_cXPCqj4HaO69DK8wHMWGevKUhTWd0";

// Robust Date Formatter (Prevents UTC 1-Day Rollback)
function formatSafeDate(dateStr) {
  if (!dateStr) return "Scheduled";
  const parts = dateStr.trim().split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      month = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    }
    const d = new Date(year, month, day);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return dateStr;
}

function parseSafeDateObj(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      month = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    }
    return new Date(year, month, day, 23, 59, 59);
  }
  return new Date(dateStr);
}

let allMasterRows = [];

async function fetchDirectorySheetData() {
  if (allMasterRows.length > 0) return allMasterRows;

  try {
    const endpoint = `https://docs.google.com/spreadsheets/d/${MASTER_INDEX_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&_cb=${Date.now()}`;
    const res = await fetch(endpoint);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

    if (parsed.data && parsed.data.length > 0) {
      allMasterRows = parsed.data.map(r => ({
        name: r["Contest Name"] || r["Name"] || "Unnamed Contest",
        key: (r["Event Key"] || r["eventKey"] || r["Key"] || "").trim().toLowerCase(),
        loc: r["Location"] || r["City"] || "Location Pending",
        year: (r["Year"] || "").toString().trim(),
        date: (r["Date"] || "").trim(),
        id: (r["Spreadsheet ID"] || r["spreadsheetId"] || "").trim()
      })).filter(c => c.key && c.year);
    }
  } catch (err) {
    console.warn("Could not load Master Directory sheet:", err);
  }

  return allMasterRows;
}

async function loadCompetitionsDirectory(selectedYear = "2026") {
  const container = document.getElementById("competitionsGrid");
  container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 font-mono text-xs">Loading competitions for ${selectedYear}...</div>`;

  const rows = await fetchDirectorySheetData();

  // Dynamically populate season dropdown including all available years (2026, 2025, 2024, 2023, 2022, 2021)
  const availableYears = [...new Set(rows.map(r => r.year))].filter(Boolean).sort((a, b) => b - a);
  
  const seasonSelect = document.getElementById("seasonSelect") || document.getElementById("yearFilter") || document.getElementById("yearDropdown");
  if (seasonSelect) {
    const currentVal = seasonSelect.value || selectedYear;
    seasonSelect.innerHTML = `<option value="all">All Seasons (2021-2026)</option>`;
    availableYears.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = `${y} Season`;
      if (y === currentVal) opt.selected = true;
      seasonSelect.appendChild(opt);
    });
  }

  // Filter competitions for the requested year
  const filtered = selectedYear === "all"
    ? rows
    : rows.filter(r => r.year === selectedYear.toString());

  const compCountElem = document.getElementById("compCount");
  if (compCountElem) compCountElem.textContent = filtered.length;
  
  const seasonTitleElem = document.getElementById("seasonTitle");
  if (seasonTitleElem) {
    seasonTitleElem.textContent = selectedYear === "all"
      ? "All-Time Competitions (2021-2026)"
      : `${selectedYear} Competitive Season`;
  }

  container.innerHTML = "";

  const now = new Date();

  filtered.forEach(comp => {
    const compDate = parseSafeDateObj(comp.date);
    const isPast = parseInt(comp.year, 10) < now.getFullYear() || (compDate && compDate < now);

    const card = document.createElement("div");
    card.className = "dashboard-tile hover:border-indigo-500/50 transition flex flex-col justify-between";

    const badge = isPast
      ? '<span class="badge-emerald">Completed</span>'
      : '<span class="badge-indigo">Upcoming</span>';

    const formattedDate = formatSafeDate(comp.date);

    card.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">${comp.year} Season</span>
            <h3 class="text-lg font-bold text-white tracking-tight">${comp.name}</h3>
            <p class="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <i data-lucide="map-pin" class="w-3 h-3 text-slate-500"></i> ${comp.loc}
            </p>
          </div>
          ${badge}
        </div>

        <div class="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500">Contest Date:</span>
            <span class="font-mono text-slate-300 font-medium">${formattedDate}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Status:</span>
            <span class="font-mono ${isPast ? 'text-emerald-400 font-bold' : 'text-indigo-400 font-medium'}">
              ${isPast ? 'Scores Recorded' : 'Upcoming'}
            </span>
          </div>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-800">
        <a href="competition.html?event=${comp.key}&year=${comp.year}" 
           class="w-full text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20">
          <span>${isPast ? 'Open Official Recap' : 'Open Contest Page'}</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </a>
      </div>
    `;
    container.appendChild(card);
  });

  lucide.createIcons();
}

function filterByYear(year) {
  loadCompetitionsDirectory(year);
}

document.addEventListener("DOMContentLoaded", () => {
  loadCompetitionsDirectory("2026");
});