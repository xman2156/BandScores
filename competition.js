// =============================================================================
// Live Master Directory Connection & Deterministic Universal Recap Engine
// =============================================================================

const MASTER_INDEX_SPREADSHEET_ID = "106s_uuX5YOXAS_cXPCqj4HaO69DK8wHMWGevKUhTWd0";

const fallbackDirectory = [
  // BOA St. Louis Super Regional
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2026", prelimsTab: "BOA St Louis - 2026 Prelims", finalsTab: "", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4", hasFinals: true },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2025", prelimsTab: "BOA St Louis - 2025 Prelims - 10/17/25", finalsTab: "BOA St Louis - 2025 Finals - 10/18/25", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4", hasFinals: true },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2024", prelimsTab: "BOA St Louis - 2024 Prelims - 10/25/24", finalsTab: "BOA St Louis - 2024 Finals - 10/26/24", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4", hasFinals: true },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2023", prelimsTab: "BOA St Louis - 2023 Prelims - 10/27/23", finalsTab: "BOA St Louis - 2023 Finals - 10/28/23", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4", hasFinals: true },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2022", prelimsTab: "BOA St Louis - 2022 Prelims - 10/14/22", finalsTab: "BOA St Louis - 2022 Finals - 10/15/22", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4", hasFinals: true },
  { name: "BOA St. Louis Super Regional", key: "boastl", loc: "St. Louis, MO", year: "2021", prelimsTab: "BOA St Louis - 2021 Prelims - 10/22/21", finalsTab: "BOA St Louis - 2021 Finals - 10/23/21", id: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4", hasFinals: true },

  // Lafayette Contest of Champions
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", year: "2026", prelimsTab: "Lafayette Contest of Champions - 2026 - 9/26/26", finalsTab: "", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4", hasFinals: true },
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", year: "2025", prelimsTab: "Lafayette Contest of Champions - 2025 - 9/20/25", finalsTab: "", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4", hasFinals: true },
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", year: "2024", prelimsTab: "Lafayette Contest of Champions - 2024 - 9/28/24", finalsTab: "", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4", hasFinals: true },
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", year: "2023", prelimsTab: "Lafayette Contest of Champions - 2023 - 9/30/23", finalsTab: "", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4", hasFinals: true },
  { name: "Lafayette Contest of Champions", key: "lafayette", loc: "Wildwood, MO", year: "2022", prelimsTab: "Lafayette Contest of Champions - 2022 - 9/24/22", finalsTab: "", id: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4", hasFinals: true },

  // Renegade Review
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2026", prelimsTab: "Renegade Review - 2026 - 10/10/26", finalsTab: "", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo", hasFinals: true },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2025", prelimsTab: "Renegade Review - 2025 - 10/11/25", finalsTab: "", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo", hasFinals: true },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2024", prelimsTab: "Renegade Review - 2024 - 10/12/24", finalsTab: "", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo", hasFinals: true },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2023", prelimsTab: "Renegade Review - 2023 - 10/14/23", finalsTab: "", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo", hasFinals: true },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2022", prelimsTab: "Renegade Review - 2022 - 10/8/22", finalsTab: "", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo", hasFinals: true },
  { name: "Renegade Review", key: "renegade", loc: "Owasso, OK", year: "2021", prelimsTab: "Renegade Review - 2021 - 10/9/21", finalsTab: "", id: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo", hasFinals: true },

  // Broken Arrow Invitational
  { name: "Broken Arrow Invitational", key: "brokenarrow", loc: "Broken Arrow, OK", year: "2026", prelimsTab: "Broken Arrow Invitational - 2026 - 9/19/26", finalsTab: "", id: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s", hasFinals: true },
  { name: "Broken Arrow Invitational", key: "brokenarrow", loc: "Broken Arrow, OK", year: "2024", prelimsTab: "Broken Arrow Invitational - 2024 - 10/5/24", finalsTab: "", id: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s", hasFinals: true },
  { name: "Broken Arrow Invitational", key: "brokenarrow", loc: "Broken Arrow, OK", year: "2023", prelimsTab: "Broken Arrow Invitational - 2023 - 10/7/23", finalsTab: "", id: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s", hasFinals: true },
  { name: "Broken Arrow Invitational", key: "brokenarrow", loc: "Broken Arrow, OK", year: "2022", prelimsTab: "Broken Arrow Invitational - 2022 - 10/1/22", finalsTab: "", id: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s", hasFinals: true },

  // Deer Creek Invitational
  { name: "Deer Creek Invitational", key: "deercreek", loc: "Edmond, OK", year: "2026", prelimsTab: "Deer Creek Invitational - 2026 - 9/19/26", finalsTab: "", id: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k", hasFinals: true },
  { name: "Deer Creek Invitational", key: "deercreek", loc: "Edmond, OK", year: "2025", prelimsTab: "Deer Creek Invitational - 2025 - 9/20/25", finalsTab: "", id: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k", hasFinals: true },
  { name: "Deer Creek Invitational", key: "deercreek", loc: "Edmond, OK", year: "2024", prelimsTab: "Deer Creek Invitational - 2024 - 9/21/24", finalsTab: "", id: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k", hasFinals: true },
  { name: "Deer Creek Invitational", key: "deercreek", loc: "Edmond, OK", year: "2023", prelimsTab: "Deer Creek Invitational - 2023 - 9/23/23", finalsTab: "", id: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k", hasFinals: true },

  // Tiger Ambush Classic
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2026", prelimsTab: "Tiger Ambush Classic - 2026 - 9/19/26", finalsTab: "", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc", hasFinals: false },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2025", prelimsTab: "Tiger Ambush Classic - 2025 - 9/20/25", finalsTab: "", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc", hasFinals: false },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2024", prelimsTab: "Tiger Ambush Classic - 2024 - 9/21/24", finalsTab: "", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc", hasFinals: false },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2023", prelimsTab: "Tiger Ambush Classic - 2023 - 9/16/23", finalsTab: "", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc", hasFinals: false },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2022", prelimsTab: "Tiger Ambush Classic - 2022 - 9/17/22", finalsTab: "", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc", hasFinals: false },
  { name: "Tiger Ambush Classic", key: "tigerambush", loc: "Edwardsville, IL", year: "2021", prelimsTab: "Tiger Ambush Classic - 2021 - 9/18/21", finalsTab: "", id: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc", hasFinals: false },

  // Metro-East Marching Classic
  { name: "Metro-East Marching Classic (MEMC)", key: "memc", loc: "O'Fallon, IL", year: "2026", prelimsTab: "MEMC - 2026 - 9/12/26", finalsTab: "", id: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo", hasFinals: false },
  { name: "Metro-East Marching Classic (MEMC)", key: "memc", loc: "O'Fallon, IL", year: "2025", prelimsTab: "MEMC - 2025 - 9/13/25", finalsTab: "", id: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo", hasFinals: false },
  { name: "Metro-East Marching Classic (MEMC)", key: "memc", loc: "O'Fallon, IL", year: "2024", prelimsTab: "MEMC - 2024 - 9/7/24", finalsTab: "", id: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo", hasFinals: false },
  { name: "Metro-East Marching Classic (MEMC)", key: "memc", loc: "O'Fallon, IL", year: "2023", prelimsTab: "MEMC - 2023 - 9/9/23", finalsTab: "", id: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo", hasFinals: false },

  // River City Showcase
  { name: "River City Showcase", key: "rivercity", loc: "Washington, MO", year: "2026", prelimsTab: "River City Showcase - 2026 - 10/10/26", finalsTab: "", id: "1FSNl3icY0eNV0oJO5QHYfBUPt6Q9wCRW6rFQEm4VbN4", hasFinals: true },
  { name: "River City Showcase", key: "rivercity", loc: "Washington, MO", year: "2025", prelimsTab: "River City Showcase - 2025 - 10/11/26", finalsTab: "", id: "1FSNl3icY0eNV0oJO5QHYfBUPt6Q9wCRW6rFQEm4VbN4", hasFinals: true }
];

let activeWorkbookData = {
  prelims: [],
  finals: [],
  hasFinalsInSheet: false
};

async function fetchMasterDirectory() {
  if (!MASTER_INDEX_SPREADSHEET_ID) return fallbackDirectory;

  try {
    const endpoint = `https://docs.google.com/spreadsheets/d/${MASTER_INDEX_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&_cb=${Date.now()}`;
    const res = await fetch(endpoint);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

    if (parsed.data && parsed.data.length > 0) {
      const liveEntries = parsed.data.map(r => {
        const hasFinalsStr = (r["Has Finals"] || r["hasFinals"] || "yes").toString().toLowerCase();
        return {
          name: r["Contest Name"] || r["Name"] || "Contest",
          key: (r["Event Key"] || r["eventKey"] || r["Key"] || "").trim().toLowerCase(),
          loc: r["Location"] || r["City"] || "Location Pending",
          year: (r["Year"] || "").toString().trim(),
          date: (r["Date"] || "").trim(),
          prelimsTab: (r["Prelims Tab"] || r["Tab Name"] || r["Tab"] || "").trim(),
          finalsTab: (r["Finals Tab"] || "").trim(),
          id: (r["Spreadsheet ID"] || r["spreadsheetId"] || "").trim(),
          hasFinals: ["yes", "true", "1"].includes(hasFinalsStr)
        };
      }).filter(c => c.key && c.id);

      if (liveEntries.length > 0) return liveEntries;
    }
  } catch (err) {
    console.warn("Could not reach Master Directory, utilizing fallback catalog:", err);
  }

  return fallbackDirectory;
}

// =============================================================================
// Deterministic Single-Stream CSV Parser
// =============================================================================
function parseFullWorkbookCSV(rawCsvText) {
  const parsed = Papa.parse(rawCsvText, { skipEmptyLines: false });
  const rows = parsed.data;

  let currentBlock = "Prelims";
  let activeSectionClass = "";
  let inlineClassColIdx = -1;
  let prelims = [];
  let finals = [];
  let detectedFinals = false;

  const forbiddenNameWords = [
    "music performance", "visual performance", "general effect", "judge panel",
    "individual", "ensemble", "total", "order", "school name", "field & timing",
    "prelims", "finals", "overall rank", "class rank", "rating", "score", "sub total",
    "music", "visual", "panel", "oustanding", "outstanding", "awards", "caption awards",
    "recap", "summary", "stats", "timing", "division", "penalty", "rank", "gold", "black", "white", "class"
  ];

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i] || [];
    const row = rawRow.map(c => (c || "").toString().trim().replace(/\u00a0/g, " "));

    // Skip totally empty rows
    if (row.every(c => c === "")) continue;

    const line = row.join(" ").toLowerCase();

    // 1. Detect Finals Block Switch
    if (line.includes("finals") && !line.includes("field & timing")) {
      currentBlock = "Finals";
      activeSectionClass = ""; // Finals in Lafayette / Broken Arrow are open-class
      detectedFinals = true;
      continue;
    }
    if (line.includes("prelims")) {
      currentBlock = "Prelims";
      continue;
    }

    // 2. BOA Inline Column Detection
    const lowerRow = row.map(c => c.toLowerCase());
    if (lowerRow.includes("class") && (lowerRow.includes("rating") || lowerRow.includes("music performance") || lowerRow.includes("field & timing"))) {
      inlineClassColIdx = lowerRow.indexOf("class");
      continue;
    }

    // 3. Detect Section Banners (MEMC & Lafayette)
    // A banner row has only 1, 2, or 3 filled items across all columns
    const filledCells = row.filter(c => c.length > 0);
    if (filledCells.length >= 1 && filledCells.length <= 4) {
      let matchedBanner = "";

      for (let c = 0; c < filledCells.length; c++) {
        const item = filledCells[c].toLowerCase();

        // Exact match rules:
        if (item === "class aaaa" || item === "class 4a" || item === "4a") {
          matchedBanner = "Class AAAA"; break;
        } else if (item === "class aaa" || item === "class 3a" || item === "3a") {
          matchedBanner = "Class AAA"; break;
        } else if (item === "class aa" || item === "class 2a" || item === "2a") {
          matchedBanner = "Class AA"; break;
        } else if (item === "class a" || item === "class 1a" || item === "1a") {
          matchedBanner = "Class A"; break;
        } else if (item === "gold" || item === "gold division") {
          matchedBanner = "Gold Division"; break;
        } else if (item === "black" || item === "black division") {
          matchedBanner = "Black Division"; break;
        } else if (item === "white" || item === "white division") {
          matchedBanner = "White Division"; break;
        }
      }

      if (matchedBanner) {
        activeSectionClass = matchedBanner;
        continue; // This was a banner row, move to next row
      }
    }

    // 4. Skip Judge Panels, Caption Breakdown Headers, and Award Summaries
    if (
      line.includes("judge panel") ||
      (line.includes("individual") && line.includes("ensemble")) ||
      line.includes("caption awards") ||
      (line.includes("outstanding") && !row.some(c => parseFloat(c) >= 35.0))
    ) {
      continue;
    }

    // 5. Extract Total Score (Scanning right-to-left for number 35.0 - 100.0)
    let scoreVal = 0.0;
    for (let c = row.length - 1; c >= 0; c--) {
      const val = parseFloat(row[c]);
      if (!isNaN(val) && val >= 35.0 && val <= 100.0) {
        scoreVal = val;
        break;
      }
    }

    // 6. Extract Candidate School Name (first 4 columns)
    let candidateName = "";
    for (let c = 0; c < Math.min(row.length, 4); c++) {
      const cell = row[c];
      const cellLower = cell.toLowerCase();

      if (cell.length > 2 && isNaN(Number(cell))) {
        const isForbidden = forbiddenNameWords.some(w => cellLower === w || cellLower.startsWith(w + " "));
        const isOrdinal = /^\d+(st|nd|rd|th)\b/i.test(cellLower);
        const isJudge = cellLower.startsWith("b.") || cellLower.startsWith("s.") || cellLower.startsWith("r.") || cellLower.startsWith("j.") || cellLower.startsWith("c.") || cellLower.startsWith("m.") || cellLower.startsWith("a.");

        if (!isForbidden && !isOrdinal && !isJudge) {
          candidateName = cell;
          break;
        }
      }
    }

    if (!candidateName) continue;

    // Deduplicate: If this school was already added to this block, don't re-add from award rows
    const targetList = currentBlock === "Finals" ? finals : prelims;
    const existingEntry = targetList.find(b => b.name.toLowerCase() === candidateName.toLowerCase());
    if (existingEntry) {
      if (scoreVal > 0 && existingEntry.base === 0) {
        existingEntry.base = scoreVal;
      }
      continue;
    }

    // 7. Assign Classification
    let finalClass = "";
    if (inlineClassColIdx !== -1 && row[inlineClassColIdx] && row[inlineClassColIdx].length > 0) {
      const val = row[inlineClassColIdx].trim();
      finalClass = val.toLowerCase().startsWith("class") ? val : `Class ${val}`;
    } else if (currentBlock === "Prelims") {
      finalClass = activeSectionClass;
    }

    const bandObj = {
      name: candidateName,
      classification: finalClass,
      round: currentBlock,
      state: "MO",
      base: scoreVal
    };

    targetList.push(bandObj);
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
  const allEntries = await fetchMasterDirectory();
  const contestSeasons = allEntries.filter(e => e.key === eventKey.toLowerCase());

  if (contestSeasons.length === 0) {
    document.getElementById("contestTitle").textContent = "Competition Not Found";
    document.getElementById("contestSubtitle").textContent = `Could not resolve "${eventKey}".`;
    return;
  }

  // Populate Season Dropdown on individual competition page
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

  document.getElementById("contestTitle").textContent = `${targetEntry.name} (${selectedYear})`;
  document.getElementById("contestSubtitle").textContent = `Loading ${selectedYear} scores from Google Drive...`;

  let targetTab = targetEntry.prelimsTab;
  const hasSeparateTabs = Boolean(targetEntry.finalsTab);

  if (hasSeparateTabs && selectedRound === "finals") {
    targetTab = targetEntry.finalsTab;
  }

  const tabParam = targetTab ? `&sheet=${encodeURIComponent(targetTab)}` : "";
  const endpoint = `https://docs.google.com/spreadsheets/d/${targetEntry.id}/gviz/tq?tqx=out:csv${tabParam}&_cb=${Date.now()}`;

  try {
    const response = await fetch(endpoint);
    const rawCsv = await response.text();
    const parsedData = parseFullWorkbookCSV(rawCsv);

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

    renderUI(targetEntry, selectedYear, selectedRound, targetTab);
  } catch (err) {
    console.error("Failed to load competition data:", err);
    renderUI(targetEntry, selectedYear, selectedRound, targetTab);
  }
}

// =============================================================================
// DOM Renderer
// =============================================================================
function renderUI(comp, year, currentRound, tabName) {
  const isPast = parseInt(year, 10) < new Date().getFullYear();

  // Round Toggle Visibility
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

  // Spotlight Band Logic
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
      document.getElementById("fhcStatPeak").textContent = fhc.base > 0 ? fhc.base.toFixed(3) : "Recorded";
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
      document.getElementById("fhcStatPeak").textContent = "--";
      document.getElementById("fhcStatPeakSub").textContent = "Season Mark";

      document.getElementById("fhcStatRank").textContent = "Pending";
      document.getElementById("fhcStatRankSub").textContent = "Gemini API Projection";

      document.getElementById("fhcEventHeadline").textContent = "Contest Outlook";
      document.getElementById("fhcEventSummary").textContent = `Upcoming competition. Projections will be generated via the Gemini API.`;

      if (showToggle && currentRound === "prelims") {
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
  activeRoster.forEach((band, idx) => {
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
  const sorted = [...activeRoster].sort((a, b) => b.base - a.base);

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
        ${band.base > 0 ? band.base.toFixed(3) : "Recorded"}
      </td>
      <td class="py-2.5 px-3 text-right">
        ${band.classification ? `<span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">${band.classification}</span>` : `<span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">—</span>`}
      </td>
    `;
    leaderboardBody.appendChild(tr);
  });

  lucide.createIcons();
}

function updateRoundUI(newRound) {
  const { event, year } = getUrlParams();
  loadCompetitionView(event, year, newRound);
}

// =============================================================================
// Browser History Listener & Initializer
// =============================================================================
window.addEventListener("popstate", () => {
  const { event, year, round } = getUrlParams();
  loadCompetitionView(event, year, round);
});

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  const { event, year, round } = getUrlParams();
  loadCompetitionView(event, year, round);
});