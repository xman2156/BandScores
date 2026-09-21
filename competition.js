// =============================================================================
// Live Master Directory Connection
// Fetches contest names, locations, and spreadsheet IDs live from your sheet
// =============================================================================

const MASTER_INDEX_SPREADSHEET_ID = "106s_uuX5YOXAS_cXPCqj4HaO69DK8wHMWGevKUhTWd0";

// =============================================================================
// Live Directory Resolver
// Looks up the competition entry from your Master Directory Sheet
// =============================================================================
async function resolveCompetitionMeta(eventKey, explicitSheetId = "") {
  let matchedEntry = null;

  try {
    const endpoint = `https://docs.google.com/spreadsheets/d/${MASTER_INDEX_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&_cb=${Date.now()}`;
    const res = await fetch(endpoint);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

    // Normalize column headers to lowercase without spaces
    matchedEntry = parsed.data.find(r => {
      const rowKey = (r["Event Key"] || r["eventKey"] || r["Key"] || r["key"] || "").trim().toLowerCase();
      const rowName = (r["Contest Name"] || r["Name"] || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanEventKey = eventKey.toLowerCase().replace(/[^a-z0-9]/g, "");
      return rowKey === cleanEventKey || rowName.includes(cleanEventKey);
    });
  } catch (err) {
    console.warn("Could not reach Master Directory sheet, checking URL parameters:", err);
  }

  if (matchedEntry) {
    const hasFinalsVal = (matchedEntry["Has Finals"] || matchedEntry["hasFinals"] || matchedEntry["Finals"] || "").toString().trim().toLowerCase();
    const sheetId = (matchedEntry["Spreadsheet ID"] || matchedEntry["spreadsheetId"] || matchedEntry["ID"] || "").trim();

    return {
      key: eventKey,
      name: matchedEntry["Contest Name"] || matchedEntry["Name"] || eventKey.toUpperCase(),
      location: matchedEntry["Location"] || matchedEntry["City"] || "Contest Site",
      spreadsheetId: sheetId || explicitSheetId,
      hasFinals: ["yes", "true", "1"].includes(hasFinalsVal)
    };
  }

  // Fallback: If not found in index, use URL arguments
  return {
    key: eventKey,
    name: eventKey.replace(/[-_]/g, " ").toUpperCase(),
    location: "Contest Site",
    spreadsheetId: explicitSheetId,
    hasFinals: false
  };
}

// =============================================================================
// Dynamic Tab & Year Discovery Engine
// Queries the Google Sheet workbook to find all actual year tabs in that file
// =============================================================================
async function discoverWorkbookTabs(spreadsheetId) {
  if (!spreadsheetId) return ["2026", "2025", "2024", "2023", "2022", "2021"].map(y => ({ title: y, year: y }));

  try {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview?_cb=${Date.now()}`;
    const res = await fetch(url);
    const html = await res.text();

    // Parse sheet button names from the htmlview navigation bar
    const tabMatches = [...html.matchAll(/<li id="sheet-button-[^>]*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/li>/gi)];
    let discovered = [];

    tabMatches.forEach(m => {
      const title = m[1].trim();
      if (title.toLowerCase().includes("template")) return;

      // Extract 4-digit year (e.g., 2027, 2026, 2025, 2024...)
      const yearMatch = title.match(/20\d{2}/);
      const year = yearMatch ? yearMatch[0] : "";

      if (year) {
        discovered.push({ title, year });
      }
    });

    if (discovered.length === 0) {
      return ["2026", "2025", "2024", "2023", "2022", "2021"].map(y => ({ title: y, year: y }));
    }

    return discovered;
  } catch (err) {
    console.warn("Dynamic tab discovery failed, falling back to standard seasons:", err);
    return ["2026", "2025", "2024", "2023", "2022", "2021"].map(y => ({ title: y, year: y }));
  }
}

// =============================================================================
// Adaptive CSV Parser (Zero Flight Labels, Pure Classes)
// =============================================================================
function parseRawRecapCSV(rawCsvText) {
  const parsed = Papa.parse(rawCsvText, { skipEmptyLines: false });
  const rows = parsed.data;

  let currentBlock = "";
  let currentClass = "";
  let roster = [];

  const ignoreWords = [
    "music performance", "visual performance", "general effect", "judge panel",
    "individual", "ensemble", "total", "order", "school name", "field & timing",
    "prelims", "finals", "class a", "class aa", "class aaa", "class aaaa",
    "gold", "black", "white", "gold division", "black division", "white division",
    "1st place", "2nd place", "3rd place", "overall rank", "class rank", "rating", "score"
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map(c => (c || "").toString().trim());
    const line = row.join(" ").toLowerCase();

    if (row.every(c => c === "")) continue;

    // Detect Major Blocks
    if (line.includes("finals") && !line.includes("field & timing")) {
      currentBlock = "Finals";
      currentClass = "";
      continue;
    }
    if (line.includes("prelims")) {
      currentBlock = "Prelims";
      currentClass = "";
      continue;
    }

    // Detect Divisions & Classes if explicitly present
    if (line.includes("gold division") || line === "gold") currentClass = "Gold Division";
    else if (line.includes("black division") || line === "black") currentClass = "Black Division";
    else if (line.includes("white division") || line === "white") currentClass = "White Division";
    else if (line.includes("class aaaa")) currentClass = "Class AAAA";
    else if (line.includes("class aaa")) currentClass = "Class AAA";
    else if (line.includes("class aa")) currentClass = "Class AA";
    else if (line.includes("class a")) currentClass = "Class A";

    // Detect Candidate School Name in First 3 Columns
    let candidateName = "";
    for (let c = 0; c < Math.min(row.length, 3); c++) {
      const cell = row[c];
      const cellLower = cell.toLowerCase();

      if (
        cell.length > 2 &&
        isNaN(Number(cell)) &&
        !ignoreWords.includes(cellLower) &&
        !cellLower.startsWith("judge") &&
        !cellLower.startsWith("class") &&
        !cellLower.includes("division") &&
        !cellLower.includes("stats")
      ) {
        candidateName = cell;
        break;
      }
    }

    if (!candidateName) continue;

    // Scan backwards from row end for Total Score (35.0 to 100.0)
    let scoreVal = 0.0;
    for (let c = row.length - 1; c >= 0; c--) {
      const val = parseFloat(row[c]);
      if (!isNaN(val) && val >= 35.0 && val <= 100.0) {
        scoreVal = val;
        break;
      }
    }

    // Clean label (No "flight" terminology)
    let label = "";
    if (currentBlock && currentClass) {
      label = `${currentBlock} • ${currentClass}`;
    } else if (currentClass) {
      label = currentClass;
    } else if (currentBlock) {
      label = currentBlock;
    }

    roster.push({
      name: candidateName,
      classification: label,
      state: "MO",
      base: scoreVal
    });
  }

  return roster;
}

// =============================================================================
// Router & State Management
// =============================================================================
function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    event: urlParams.get("event") || "lafayette",
    sheetId: urlParams.get("sheetId") || "",
    year: urlParams.get("year") || "2026"
  };
}

function switchYear(newYear) {
  const { event, sheetId } = getUrlParams();
  const newUrl = `${window.location.pathname}?event=${event}&year=${newYear}${sheetId ? `&sheetId=${sheetId}` : ''}`;
  window.history.pushState({ path: newUrl }, "", newUrl);
  loadCompetitionView(event, newYear, sheetId);
}

// =============================================================================
// Live Google Sheets Loader
// =============================================================================
async function loadCompetitionView(eventKey, selectedYear, explicitSheetId = "") {
  // 1. Resolve competition metadata dynamically from Master Directory
  const comp = await resolveCompetitionMeta(eventKey, explicitSheetId);

  document.getElementById("contestTitle").textContent = `${comp.name} (${selectedYear})`;
  document.getElementById("contestSubtitle").textContent = `Querying Google Drive spreadsheet for available seasons...`;

  if (!comp.spreadsheetId) {
    document.getElementById("contestSubtitle").textContent = `Spreadsheet ID not found in Master Directory for "${eventKey}".`;
    renderUI(comp, selectedYear, [], "");
    return;
  }

  // 2. Discover all tabs in that specific competition's spreadsheet
  const availableTabs = await discoverWorkbookTabs(comp.spreadsheetId);
  const uniqueYears = [...new Set(availableTabs.map(t => t.year))].sort((a, b) => b - a);

  // Update Year Dropdown dynamically
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

  // 3. Find matching tab for the selected year
  const yearTabs = availableTabs.filter(t => t.year === selectedYear);
  let targetTabTitle = "";

  if (yearTabs.length > 0) {
    // Prioritize Finals for completed past years, Prelims for upcoming
    const finalsTab = yearTabs.find(t => t.title.toLowerCase().includes("finals"));
    targetTabTitle = finalsTab ? finalsTab.title : yearTabs[0].title;
  } else {
    targetTabTitle = selectedYear;
  }

  // 4. Fetch CSV from that tab
  const endpoint = `https://docs.google.com/spreadsheets/d/${comp.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(targetTabTitle)}&_cb=${Date.now()}`;

  try {
    const response = await fetch(endpoint);
    const rawCsv = await response.text();
    const roster = parseRawRecapCSV(rawCsv);

    // Auto-detect Finals if not explicitly defined
    if (rawCsv.toLowerCase().includes("finals")) {
      comp.hasFinals = true;
    }

    renderUI(comp, selectedYear, roster, targetTabTitle);
  } catch (err) {
    console.error("Failed to load competition data:", err);
    renderUI(comp, selectedYear, [], targetTabTitle);
  }
}

// =============================================================================
// DOM Renderer
// =============================================================================
function renderUI(comp, year, roster, tabName) {
  const dateMatch = tabName ? tabName.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) : null;
  const eventDate = dateMatch ? new Date(dateMatch[0]) : new Date(`${year}-10-31`);
  const now = new Date();
  const isPast = parseInt(year) < now.getFullYear() || eventDate < now;

  // Header Elements
  document.getElementById("contestTitle").textContent = `${comp.name} (${year})`;
  document.getElementById("contestSubtitle").textContent = isPast
    ? `Official Completed Recap • ${comp.location}`
    : `Upcoming Performance Draw • ${comp.location}`;
  document.getElementById("contestTag").textContent = isPast ? `${year} OFFICIAL RECAP` : `${year} UPCOMING DRAW`;
  document.getElementById("bandCountBadge").textContent = `${roster.length} Programs`;

  // Dynamic FHC Detection
  const fhc = roster.find(b => b.name.toLowerCase().includes("howell central"));
  const spotlightSection = document.getElementById("fhcSpotlightSection");
  const finalsCard = document.getElementById("finalsBenchmarkCard");

  if (!fhc) {
    // Hide spotlight card entirely if FHC did not compete at this contest
    spotlightSection.classList.add("hidden");
  } else {
    // Show spotlight card when FHC is in the competition roster
    spotlightSection.classList.remove("hidden");

    if (isPast) {
      document.getElementById("statLabel1").textContent = "Official Score";
      document.getElementById("statLabel2").textContent = "Final Placement";
      document.getElementById("fhcStatPeak").textContent = fhc.base > 0 ? fhc.base.toFixed(3) : "Recorded";
      document.getElementById("fhcStatPeakSub").textContent = "Achieved Score";

      // Compute standing dynamically
      const sorted = [...roster].sort((a, b) => b.base - a.base);
      const rank = sorted.findIndex(b => b.name.toLowerCase().includes("howell central")) + 1;
      document.getElementById("fhcStatRank").textContent = rank > 0 ? `#${rank} Overall` : "Recorded";
      document.getElementById("fhcStatRankSub").textContent = "Official Standing";

      document.getElementById("fhcEventHeadline").textContent = "Official Performance Summary";
      document.getElementById("fhcEventSummary").textContent = fhc.base > 0
        ? `Francis Howell Central recorded an official score of ${fhc.base.toFixed(3)} at ${comp.name}.`
        : `Francis Howell Central participated in ${comp.name} (${year}).`;

      // Finals Benchmark: Shown ONLY for multi-round Prelims/Finals formats
      if (comp.hasFinals) {
        finalsCard.classList.remove("hidden");
        document.getElementById("statLabel3").textContent = "Finals Benchmark";
        const bubbleScore = sorted.length >= 12 ? sorted[11].base.toFixed(3) : (sorted.length >= 10 ? sorted[9].base.toFixed(3) : "--");
        document.getElementById("fhcStatCutoff").textContent = bubbleScore;
        document.getElementById("fhcStatCutoffSub").textContent = "Score to Advance";
      } else {
        finalsCard.classList.add("hidden");
      }
    } else {
      // Future Contest: Placeholders reserved for Gemini API projections
      document.getElementById("statLabel1").textContent = "Historical Mark";
      document.getElementById("statLabel2").textContent = "Projected Standing";
      document.getElementById("fhcStatPeak").textContent = "--";
      document.getElementById("fhcStatPeakSub").textContent = "Season Mark";

      document.getElementById("fhcStatRank").textContent = "Pending";
      document.getElementById("fhcStatRankSub").textContent = "Gemini API Projection";

      document.getElementById("fhcEventHeadline").textContent = "Contest Outlook";
      document.getElementById("fhcEventSummary").textContent = `Draw confirmed. Projections will be generated via the Gemini API.`;

      if (comp.hasFinals) {
        finalsCard.classList.remove("hidden");
        document.getElementById("statLabel3").textContent = "Finals Benchmark";
        document.getElementById("fhcStatCutoff").textContent = "--";
        document.getElementById("fhcStatCutoffSub").textContent = "Gemini API Projection";
      } else {
        finalsCard.classList.add("hidden");
      }
    }
  }

  // Populate Roster Table
  const rosterBody = document.getElementById("rosterTableBody");
  rosterBody.innerHTML = "";
  roster.forEach((band, idx) => {
    const isFHC = band.name.toLowerCase().includes("howell central");
    const tr = document.createElement("tr");
    tr.className = isFHC ? "bg-blue-950/40 border-l-2 border-blue-400" : "hover:bg-slate-900/60 transition";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-slate-500">${idx + 1}</td>
      <td class="py-2.5 px-3 ${isFHC ? 'text-blue-300 font-bold flex items-center gap-1.5' : 'text-slate-200'}">
        ${band.name}
        <span class="text-[10px] text-slate-500 font-mono font-normal">(${band.state})</span>
        ${isFHC ? '<span class="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold">FHC</span>' : ''}
      </td>
      <td class="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">${band.classification || '—'}</td>
    `;
    rosterBody.appendChild(tr);
  });

  // Populate Leaderboard Table
  const leaderboardBody = document.getElementById("leaderboardTableBody");
  leaderboardBody.innerHTML = "";
  const sorted = [...roster].sort((a, b) => b.base - a.base);

  sorted.forEach((band, idx) => {
    const isFHC = band.name.toLowerCase().includes("howell central");
    const tr = document.createElement("tr");
    tr.className = isFHC ? "bg-blue-950/40 border-l-2 border-blue-400" : "hover:bg-slate-900/50 transition";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono font-bold ${idx < 3 ? 'text-amber-400' : 'text-slate-400'}">#${idx + 1}</td>
      <td class="py-2.5 px-3 ${isFHC ? 'text-blue-300 font-bold' : 'text-white'}">
        ${band.name} <span class="text-[10px] text-slate-500 font-mono font-normal">(${band.state})</span>
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
        ${band.base > 0 ? band.base.toFixed(3) : "Pending"}
      </td>
      <td class="py-2.5 px-3 text-right">
        ${band.classification ? `<span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">${band.classification}</span>` : '—'}
      </td>
    `;
    leaderboardBody.appendChild(tr);
  });

  lucide.createIcons();
}

// =============================================================================
// Browser History Listener & Initializer
// =============================================================================
window.addEventListener("popstate", () => {
  const { event, year, sheetId } = getUrlParams();
  loadCompetitionView(event, year, sheetId);
});

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  const { event, year, sheetId } = getUrlParams();
  loadCompetitionView(event, year, sheetId);
});