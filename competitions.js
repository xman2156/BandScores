// =============================================================================
// Live Master Directory Engine (Directory Page)
// =============================================================================

const MASTER_INDEX_SPREADSHEET_ID = "106s_uuX5YOXAS_cXPCqj4HaO69DK8wHMWGevKUhTWd0";

// Verified Fallback Catalog (Saturday Dates 2021-2026)
const fallbackMasterDirectory = [
  // 2026
  { name: "Metro-East Marching Classic (MEMC)", key: "memc", loc: "O'Fallon, IL", year: "2026", date: "9/12/2026", id: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo" },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2026", date: "9/19/2026", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc" },
  { name: "Broken Arrow Invitational", key: "brokenarrow", loc: "Broken Arrow, OK", year: "2026", date: "9/19/2026", id: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s" },
  { name: "Deer Creek Invitational", key: "deercreek", loc: "Edmond, OK", year: "2026", date: "9/19/2026", id: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k" },
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", year: "2026", date: "9/26/2026", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4" },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2026", date: "10/10/2026", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo" },
  { name: "River City Showcase", key: "rivercity", loc: "Washington, MO", year: "2026", date: "10/10/2026", id: "1FSNl3icY0eNV0oJO5QHYfBUPt6Q9wCRW6rFQEm4VbN4" },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2026", date: "10/23/2026", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4" },

  // 2025 (All verified to September 20, 2025)
  { name: "Metro-East Marching Classic (MEMC)", key: "memc", loc: "O'Fallon, IL", year: "2025", date: "9/13/2025", id: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo" },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2025", date: "9/20/2025", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc" },
  { name: "Broken Arrow Invitational", key: "brokenarrow", loc: "Broken Arrow, OK", year: "2025", date: "9/20/2025", id: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s" },
  { name: "Deer Creek Invitational", key: "deercreek", loc: "Edmond, OK", year: "2025", date: "9/20/2025", id: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k" },
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", year: "2025", date: "9/20/2025", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4" },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2025", date: "10/11/2025", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo" },
  { name: "River City Showcase", key: "rivercity", loc: "Washington, MO", year: "2025", date: "10/11/2025", id: "1FSNl3icY0eNV0oJO5QHYfBUPt6Q9wCRW6rFQEm4VbN4" },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2025", date: "10/17/2025", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4" },

  // 2024
  { name: "Metro-East Marching Classic (MEMC)", key: "memc", loc: "O'Fallon, IL", year: "2024", date: "9/7/2024", id: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo" },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2024", date: "9/21/2024", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc" },
  { name: "Broken Arrow Invitational", key: "brokenarrow", loc: "Broken Arrow, OK", year: "2024", date: "10/5/2024", id: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s" },
  { name: "Deer Creek Invitational", key: "deercreek", loc: "Edmond, OK", year: "2024", date: "9/21/2024", id: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k" },
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", year: "2024", date: "9/28/2024", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4" },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2024", date: "10/12/2024", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo" },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2024", date: "10/25/2024", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4" },

  // 2023
  { name: "Metro-East Marching Classic (MEMC)", key: "memc", loc: "O'Fallon, IL", year: "2023", date: "9/9/2023", id: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo" },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2023", date: "9/16/2023", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc" },
  { name: "Broken Arrow Invitational", key: "brokenarrow", loc: "Broken Arrow, OK", year: "2023", date: "10/7/2023", id: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s" },
  { name: "Deer Creek Invitational", key: "deercreek", loc: "Edmond, OK", year: "2023", date: "9/23/2023", id: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k" },
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", year: "2023", date: "9/30/2023", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4" },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2023", date: "10/14/2023", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo" },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2023", date: "10/27/2023", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4" },

  // 2022 (Guaranteed in directory)
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2022", date: "9/17/2022", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc" },
  { name: "Broken Arrow Invitational", key: "brokenarrow", loc: "Broken Arrow, OK", year: "2022", date: "10/1/2022", id: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s" },
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", year: "2022", date: "9/24/2022", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4" },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2022", date: "10/8/2022", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo" },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2022", date: "10/14/2022", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4" },

  // 2021
  { name: "Metro-East Marching Classic (MEMC)", key: "memc", loc: "O'Fallon, IL", year: "2021", date: "9/11/2021", id: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo" },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2021", date: "9/18/2021", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc" },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2021", date: "10/9/2021", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo" },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2021", date: "10/22/2021", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4" }
];

let allMasterRows = [];

// Safe string date parser (Never rolls back a day)
function formatSafeDate(dateStr) {
  if (!dateStr) return "Scheduled";
  const str = dateStr.trim();
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      year = parts[0]; month = parts[1]; day = parts[2];
    } else {
      month = parts[0]; day = parts[1]; year = parts[2];
      if (year.length === 2) year = "20" + year;
    }
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${monthNames[mIdx]} ${parseInt(day, 10)}, ${year}`;
    }
  }
  return dateStr;
}

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
    console.warn("Could not load Master Directory, using fallback:", err);
  }

  if (allMasterRows.length === 0) {
    allMasterRows = fallbackMasterDirectory;
  }

  return allMasterRows;
}

async function loadCompetitionsDirectory(selectedYear = "2026") {
  const container = document.getElementById("competitionsGrid");
  if (!container) return;

  container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 font-mono text-xs">Loading competitions for ${selectedYear}...</div>`;

  const rows = await fetchDirectorySheetData();

  // Dynamically ensure 2022 and all seasons exist in any dropdown or button group
  const availableYears = ["2026", "2025", "2024", "2023", "2022", "2021"];
  const selectElem = document.querySelector("select#seasonSelect, select#yearFilter, select#yearDropdown");
  if (selectElem) {
    selectElem.innerHTML = `<option value="all">All Seasons (2021-2026)</option>`;
    availableYears.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = `${y} Season`;
      if (y === selectedYear.toString()) opt.selected = true;
      selectElem.appendChild(opt);
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
    // Year comparison is primary; past years are completed
    const isPast = parseInt(comp.year, 10) < now.getFullYear();

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