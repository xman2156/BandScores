// =============================================================================
// Competition Master Registry
// =============================================================================

const competitionRegistry = {
  lafayette: {
    name: "Lafayette Contest of Champions",
    location: "Wildwood, MO",
    spreadsheetId: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4",
    hasFinals: true,
    availableYears: ["2026", "2025", "2024", "2023", "2022"],
    tabs: {
      "2026": "Lafayette Contest of Champions - 2026 Prelims - 9/26/26",
      "2025": "Lafayette Contest of Champions - 2025 - 9/20/25",
      "2024": "Lafayette Contest of Champions - 2024 - 9/28/24",
      "2023": "Lafayette Contest of Champions - 2023 - 9/30/23",
      "2022": "Lafayette Contest of Champions - 2022 - 9/24/22"
    }
  },
  renegade: {
    name: "Renegade Review",
    location: "Owasso, OK",
    spreadsheetId: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo",
    hasFinals: true,
    availableYears: ["2026", "2025", "2024", "2023", "2022", "2021"],
    tabs: {
      "2026": "Renegade Review - 2026 - 10/10/26",
      "2025": "Renegade Review - 2025 - 10/11/25",
      "2024": "Renegade Review - 2024 - 10/12/25",
      "2023": "Renegade Review - 2023 - 10/14/23",
      "2022": "Renegade Review - 2022 - 10/8/22",
      "2021": "Renegade Review - 2021 - 10/9/21"
    }
  },
  boastl: {
    name: "BOA St. Louis Super Regional",
    location: "The Dome at America's Center, St. Louis, MO",
    spreadsheetId: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4",
    hasFinals: true,
    availableYears: ["2026", "2025", "2024", "2023", "2022", "2021"],
    tabs: {
      "2026": "BOA St Louis - 2026 Prelims",
      "2025": "BOA St Louis - 2025 Finals - 10/18/25",
      "2024": "BOA St Louis - 2024 Finals - 10/26/24",
      "2023": "BOA St Louis - 2023 Finals - 10/28/23",
      "2022": "BOA St Louis - 2022 Prelims - 10/14/22",
      "2021": "BOA St Louis - 2021 Prelims - 10/22/21"
    }
  },
  brokenarrow: {
    name: "Broken Arrow Invitational",
    location: "Broken Arrow, OK",
    spreadsheetId: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s",
    hasFinals: true,
    availableYears: ["2026", "2024", "2023", "2022"],
    tabs: {
      "2026": "Broken Arrow Invitational - 2026 - 9/19/26",
      "2024": "Broken Arrow Invitational - 2024 - 10/5/24",
      "2023": "Broken Arrow Invitational - 2023 - 10/7/23",
      "2022": "Broken Arrow Invitational - 2022 - 10/1/22"
    }
  },
  deercreek: {
    name: "Deer Creek Invitational",
    location: "Edmond, OK",
    spreadsheetId: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k",
    hasFinals: true,
    availableYears: ["2026", "2025", "2024", "2023"],
    tabs: {
      "2026": "Deer Creek Invitational - 2026 - 9/19/26",
      "2025": "Deer Creek Invitational - 2025 - 9/20/25",
      "2024": "Deer Creek Invitational - 2024 - 9/21/24",
      "2023": "Deer Creek Invitational - 2023 - 9/23/23"
    }
  },
  tigerambush: {
    name: "Tiger Ambush Classic",
    location: "Edwardsville, IL",
    spreadsheetId: "1-UiYEzZIc0wF-fGSwi4uQZ92Y-itl7LGE4SBK2XKJOc",
    hasFinals: false,
    availableYears: ["2026", "2025", "2024", "2023", "2022", "2021"],
    tabs: {
      "2026": "Tiger Ambush Classic - 2026 - 9/19/26",
      "2025": "Tiger Ambush Classic - 2025 - 9/20/25",
      "2024": "Tiger Ambush Classic - 2024 - 9/21/24",
      "2023": "Tiger Ambush Classic - 2023 - 9/16/23",
      "2022": "Tiger Ambush Classic - 2022 - 9/17/22",
      "2021": "Tiger Ambush Classic - 2021 - 9/18/21"
    }
  },
  memc: {
    name: "Metro-East Marching Classic (MEMC)",
    location: "O'Fallon, IL",
    spreadsheetId: "1yB6emCUzTJMDxpFFtxnZrCPQ9LaiLDU85xoWH5hSOjo",
    hasFinals: false,
    availableYears: ["2026", "2025", "2024", "2023"],
    tabs: {
      "2026": "MEMC - 2026 - 9/12/26",
      "2025": "MEMC - 2025 - 9/13/25",
      "2024": "MEMC - 2024 - 9/7/24",
      "2023": "MEMC - 2023 - 9/9/23"
    }
  },
  rivercity: {
    name: "River City Showcase",
    location: "Washington, MO",
    spreadsheetId: "1FSNl3icY0eNV0oJO5QHYfBUPt6Q9wCRW6rFQEm4VbN4",
    hasFinals: true,
    availableYears: ["2026", "2025"],
    tabs: {
      "2026": "River City Showcase - 2026 - 10/10/26",
      "2025": "River City Showcase - 2025 - 10/11/26"
    }
  }
};

// =============================================================================
// Adaptive CSV Parser
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

    // Detect Divisions / Classes if explicitly noted
    if (line.includes("gold division") || line === "gold") currentClass = "Gold Division";
    else if (line.includes("black division") || line === "black") currentClass = "Black Division";
    else if (line.includes("white division") || line === "white") currentClass = "White Division";
    else if (line.includes("class aaaa")) currentClass = "Class AAAA";
    else if (line.includes("class aaa")) currentClass = "Class AAA";
    else if (line.includes("class aa")) currentClass = "Class AA";
    else if (line.includes("class a")) currentClass = "Class A";

    // Detect School Name
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
        !cellLower.includes("division")
      ) {
        candidateName = cell;
        break;
      }
    }

    if (!candidateName) continue;

    // Detect Total Score
    let scoreVal = 0.0;
    for (let c = row.length - 1; c >= 0; c--) {
      const val = parseFloat(row[c]);
      if (!isNaN(val) && val >= 35.0 && val <= 100.0) {
        scoreVal = val;
        break;
      }
    }

    // Build the classification label cleanly (No "Flight" words)
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
// Routing & URL Management
// =============================================================================
function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    event: urlParams.get("event") || "lafayette",
    year: urlParams.get("year") || "2026"
  };
}

function switchYear(newYear) {
  const { event } = getUrlParams();
  const newUrl = `${window.location.pathname}?event=${event}&year=${newYear}`;
  window.history.pushState({ path: newUrl }, "", newUrl);
  loadCompetitionView(event, newYear);
}

// =============================================================================
// Dynamic Fetch & Render
// =============================================================================
async function loadCompetitionView(eventKey, year) {
  const comp = competitionRegistry[eventKey];
  if (!comp) {
    document.getElementById("contestTitle").textContent = "Competition Not Found";
    return;
  }

  // Populate the year dropdown specifically with this competition's historical years
  const yearSelect = document.getElementById("yearDropdown");
  yearSelect.innerHTML = "";
  comp.availableYears.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = `${y} Season`;
    if (y === year) opt.selected = true;
    yearSelect.appendChild(opt);
  });

  const tabName = comp.tabs[year] || Object.values(comp.tabs)[0];
  const endpoint = `https://docs.google.com/spreadsheets/d/${comp.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

  try {
    const response = await fetch(endpoint);
    const rawCsv = await response.text();
    const roster = parseRawRecapCSV(rawCsv);
    renderUI(comp, year, roster, tabName);
  } catch (err) {
    console.error("Failed to load competition:", err);
    renderUI(comp, year, [], tabName);
  }
}

function renderUI(comp, year, roster, tabName) {
  // Extract date from tab name if present
  const dateMatch = tabName.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  const eventDate = dateMatch ? new Date(dateMatch[0]) : new Date(`${year}-10-31`);
  const now = new Date();
  const isPast = parseInt(year) < now.getFullYear() || eventDate < now;

  // Title and Header
  document.getElementById("contestTitle").textContent = `${comp.name} (${year})`;
  document.getElementById("contestSubtitle").textContent = isPast
    ? `Official Completed Recap • ${comp.location}`
    : `Upcoming Performance Draw • ${comp.location}`;
  document.getElementById("contestTag").textContent = isPast ? `${year} OFFICIAL RECAP` : `${year} UPCOMING DRAW`;
  document.getElementById("bandCountBadge").textContent = `${roster.length} Programs`;

  // Determine if FHC is in this competition
  const fhc = roster.find(b => b.name.toLowerCase().includes("howell central"));
  const spotlightSection = document.getElementById("fhcSpotlightSection");
  const finalsCard = document.getElementById("finalsBenchmarkCard");

  if (!fhc) {
    // Hide spotlight completely if FHC is not competing here
    spotlightSection.classList.add("hidden");
  } else {
    // Show spotlight and populate data
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

      // Finals Benchmark: Show ONLY for Prelims/Finals formats
      if (comp.hasFinals) {
        finalsCard.classList.remove("hidden");
        document.getElementById("statLabel3").textContent = "Finals Benchmark";
        // Calculate the bubble score (e.g., 10th or 12th band)
        const bubbleScore = sorted.length >= 10 ? sorted[9].base.toFixed(3) : sorted[sorted.length - 1].base.toFixed(3);
        document.getElementById("fhcStatCutoff").textContent = bubbleScore;
        document.getElementById("fhcStatCutoffSub").textContent = "Advance Threshold";
      } else {
        finalsCard.classList.add("hidden");
      }
    } else {
      // Future competition (Placeholders awaiting Gemini API integration)
      document.getElementById("statLabel1").textContent = "Historical Mark";
      document.getElementById("statLabel2").textContent = "Projected Standing";
      document.getElementById("fhcStatPeak").textContent = "--";
      document.getElementById("fhcStatPeakSub").textContent = "Season Peak";

      document.getElementById("fhcStatRank").textContent = "Pending";
      document.getElementById("fhcStatRankSub").textContent = "Gemini API Projection";

      document.getElementById("fhcEventHeadline").textContent = "Contest Outlook";
      document.getElementById("fhcEventSummary").textContent = `Draw locked. Projections will be generated via the Gemini API.`;

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

window.addEventListener("popstate", () => {
  const { event, year } = getUrlParams();
  loadCompetitionView(event, year);
});

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  const { event, year } = getUrlParams();
  loadCompetitionView(event, year);
});