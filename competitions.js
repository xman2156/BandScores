// =============================================================================
// Live Master Directory Engine (Directory Page)
// =============================================================================

const MASTER_INDEX_SPREADSHEET_ID = "106s_uuX5YOXAS_cXPCqj4HaO69DK8wHMWGevKUhTWd0";

let allMasterRows = [];

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

function formatSafeDate(dateStr) {
  if (!dateStr) return "Scheduled";
  const parts = dateStr.trim().split(/[-/]/);
  if (parts.length === 3) {
    let y, m, d;
    if (parts[0].length === 4) {
      y = parts[0]; m = parts[1]; d = parts[2];
    } else {
      m = parts[0]; d = parts[1]; y = parts[2];
      if (y.length === 2) y = "20" + y;
    }
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mIdx = parseInt(m, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${months[mIdx]} ${parseInt(d, 10)}, ${y}`;
    }
  }
  return dateStr;
}

async function fetchDirectorySheetData() {
  if (allMasterRows.length > 0) return allMasterRows;

  const endpoint = `https://docs.google.com/spreadsheets/d/${MASTER_INDEX_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&_cb=${Date.now()}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Master directory HTTP ${res.status}`);

  const csv = await res.text();
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

  allMasterRows = (parsed.data || []).map(r => {
    const prelimsTab = (r["Prelims Tab"] || r["Tab Name"] || r["Tab"] || "").trim();
    const finalsTab  = (r["Finals Tab"] || "").trim();
    const dateFromSheet = (r["Date"] || "").trim();
    const dateFromTab = extractDateFromTab(prelimsTab);

    return {
      name: r["Contest Name"] || r["Name"] || "Unnamed Contest",
      key: (r["Event Key"] || r["eventKey"] || r["Key"] || "").trim().toLowerCase(),
      loc: r["Location"] || r["City"] || "Location Pending",
      year: (r["Year"] || "").toString().trim(),
      date: dateFromSheet || dateFromTab,
      prelimsTab: prelimsTab,
      finalsTab: finalsTab,
      id: (r["Spreadsheet ID"] || r["spreadsheetId"] || "").trim()
    };
  }).filter(c => c.key && c.year);

  if (allMasterRows.length === 0) {
    throw new Error("Master directory returned 0 valid rows — check column headers");
  }

  console.log(`[Directory] Loaded ${allMasterRows.length} entries. Sample:`, allMasterRows[0]);
  return allMasterRows;
}

async function loadCompetitionsDirectory(selectedYear = "2026") {
  const container = document.getElementById("competitionsGrid");
  if (!container) return;

  container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 font-mono text-xs">Syncing active contests...</div>`;

  let rows;
  try {
    rows = await fetchDirectorySheetData();
  } catch (err) {
    console.error("[loadCompetitionsDirectory] Directory fetch failed:", err);
    container.innerHTML = `
      <div class="col-span-full py-12 text-center">
        <div class="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 font-mono text-xs">
          <span class="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
          Could not reach the Master Directory sheet. Check the published CSV link and sharing permissions.
        </div>
      </div>
    `;
    const compCountElem = document.getElementById("compCount");
    if (compCountElem) compCountElem.textContent = "0";
    return;
  }

  const filtered = selectedYear === "all"
    ? rows
    : rows.filter(r => r.year === selectedYear.toString());

  // 👇 Sort chronologically — earliest first, latest last
  filtered.sort((a, b) =>
    parseLocalDate(a.date, a.year) - parseLocalDate(b.date, b.year)
  );

  const compCountElem = document.getElementById("compCount");
  if (compCountElem) compCountElem.textContent = filtered.length;

  const seasonTitleElem = document.getElementById("seasonTitle");
  if (seasonTitleElem) {
    seasonTitleElem.textContent = selectedYear === "all"
      ? "All-Time Competitions"
      : `${selectedYear} Competitive Season`;
  }

  container.innerHTML = "";
  const now = new Date();

  filtered.forEach(comp => {
    const compDateObj = parseLocalDate(comp.date, comp.year);
    const isPast = compDateObj < now;

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