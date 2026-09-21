// =============================================================================
// Master Directory Auto-Discovery Engine
// =============================================================================

// Paste your Master Directory Google Sheet ID here:
const MASTER_INDEX_SPREADSHEET_ID = "106s_uuX5YOXAS_cXPCqj4HaO69DK8wHMWGevKUhTWd0";

// Fallback registry using your exact Google Sheet IDs if index sheet is not yet linked
const fallbackContestList = [
  { name: "Metro-East Marching Classic (MEMC)", key: "memc", loc: "O'Fallon, IL", id: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo", date: "2026-09-12" },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc", date: "2026-09-19" },
  { name: "Broken Arrow Invitational", key: "brokenarrow", loc: "Broken Arrow, OK", id: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s", date: "2026-09-19" },
  { name: "Deer Creek Invitational", key: "deercreek", loc: "Edmond, OK", id: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k", date: "2026-09-19" },
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4", date: "2026-09-26" },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo", date: "2026-10-10" },
  { name: "River City Showcase", key: "rivercity", loc: "Washington, MO", id: "1FSNl3icY0eNV0oJO5QHYfBUPt6Q9wCRW6rFQEm4VbN4", date: "2026-10-10" },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4", date: "2026-10-23" }
];

async function loadCompetitionsDirectory(targetYear = "2026") {
  const container = document.getElementById("competitionsGrid");
  container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 font-mono text-xs">Discovering competition sheets and dates...</div>`;

  let contests = fallbackContestList;

  // Attempt live query from the master directory sheet if configured
  if (MASTER_INDEX_SPREADSHEET_ID && !MASTER_INDEX_SPREADSHEET_ID.includes("YOUR_")) {
    try {
      const endpoint = `https://docs.google.com/spreadsheets/d/${MASTER_INDEX_SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;
      const res = await fetch(endpoint);
      const csv = await res.text();
      const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
      if (parsed.data && parsed.data.length > 0) {
        contests = parsed.data.map(r => ({
          name: r["Contest Name"],
          key: (r["Event Key"] || "").trim().toLowerCase(),
          loc: r["Location"],
          id: (r["Spreadsheet ID"] || "").trim(),
          date: r["Date"] || ""
        }));
      }
    } catch (err) {
      console.warn("Using fallback contest list:", err);
    }
  }

  container.innerHTML = "";
  document.getElementById("compCount").textContent = contests.length;
  document.getElementById("seasonTitle").textContent = `${targetYear} Competitive Season`;

  const now = new Date();

  for (const comp of contests) {
    const compDate = comp.date ? new Date(comp.date) : new Date("2099-01-01");
    const isPast = compDate < now;

    const card = document.createElement("div");
    card.className = "dashboard-tile hover:border-indigo-500/50 transition flex flex-col justify-between";

    const badge = isPast
      ? '<span class="badge-emerald">Official Recap Final</span>'
      : '<span class="badge-indigo">Upcoming Draw</span>';

    card.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">${targetYear} Season</span>
            <h3 class="text-lg font-bold text-white tracking-tight">${comp.name}</h3>
            <p class="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <i data-lucide="map-pin" class="w-3 h-3 text-slate-500"></i> ${comp.loc}
            </p>
          </div>
          ${badge}
        </div>

        <div class="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500">Date:</span>
            <span class="font-mono text-slate-300 font-medium">${comp.date || "Scheduled"}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Status:</span>
            <span class="font-mono ${isPast ? 'text-emerald-400 font-bold' : 'text-indigo-400 font-medium'}">
              ${isPast ? 'Scores Recorded' : 'Flight Draw Active'}
            </span>
          </div>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-800">
        <a href="competition.html?event=${comp.key}&sheetId=${comp.id}&year=${targetYear}" 
           class="w-full text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20">
          <span>${isPast ? 'Open Verified Recap' : 'Open Draw & Predictions'}</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </a>
      </div>
    `;
    container.appendChild(card);
  }

  lucide.createIcons();
}

function filterByYear(year) {
  loadCompetitionsDirectory(year);
}

document.addEventListener("DOMContentLoaded", () => {
  loadCompetitionsDirectory("2026");
});