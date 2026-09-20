// =============================================================================
// Live Google Spreadsheet Registry
// Paste the Spreadsheet ID for each file in your Google Drive
// (Found between /d/ and /edit in each spreadsheet's URL)
// =============================================================================

const competitionRegistry = {
  lafayette: {
    spreadsheetId: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4",
    tabs: {
      "2026": "Lafayette Contest of Champions - 2026 Prelims - 9/26/26",
      "2025": "Lafayette Contest of Champions - 2025 - 9/20/25",
      "2024": "Lafayette Contest of Champions - 2024 - 9/28/24",
      "2023": "Lafayette Contest of Champions - 2023 - 9/30/23"
    },
    meta: {
      title: "Lafayette Contest of Champions",
      subtitle: "Wildwood, MO • Prelims & Finals",
      tag: "LAFAYETTE COC",
      fhcHeadline: "FHC Lafayette Campaign & History",
      fhcSummary: "FHC swept all captions in the Black Division in 2024 (77.750) and took 2nd in Finals (80.950).",
      fhcPeak: "80.950",
      fhcPeakSub: "2024 Finals Score",
      fhcTarget: "Alum",
      fhcTargetSub: "Class AA Benchmark",
      fhcRank: "#2 ('24)",
      fhcCutoff: "78.20+",
      fhcCutoffSub: "Finals Standard"
    }
  },

  renegade: {
    spreadsheetId: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo",
    tabs: {
      "2026": "Renegade Review - 2026 - 10/10/26",
      "2025": "Renegade Review - 2025 - 10/11/25",
      "2024": "Renegade Review - 2024 - 10/12/25"
    },
    meta: {
      title: "Renegade Review",
      subtitle: "Owasso, OK • 24 Performing Programs",
      tag: "RENEGADE REVIEW",
      fhcHeadline: "FHC Renegade Finals Bubble Campaign",
      fhcSummary: "FHC travels to Oklahoma for mid-season competition against top regional programs.",
      fhcPeak: "71.800",
      fhcPeakSub: "Tiger Ambush '26",
      fhcTarget: "75.350",
      fhcTargetSub: "+3.55 Delta",
      fhcRank: "#11 - #13",
      fhcCutoff: "~74.90",
      fhcCutoffSub: "Finals 12 Cutoff"
    }
  },

  boastl: {
    spreadsheetId: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4",
    tabs: {
      "2026": "BOA St Louis - 2026 Prelims",
      "2025": "BOA St Louis - 2025 Finals - 10/18/25",
      "2024": "BOA St Louis - 2024 Finals - 10/26/24",
      "2023": "BOA St Louis - 2023 Prelims - 10/27/23",
      "2021": "BOA St Louis - 2021 Finals - 10/23/21"
    },
    meta: {
      title: "BOA St. Louis Super Regional",
      subtitle: "The Dome at America's Center, St. Louis, MO",
      tag: "BOA SUPER REGIONAL",
      fhcHeadline: "FHC Class AA Super Regional Track Record",
      fhcSummary: "FHC has appeared continuously: 69.700 (2021), 75.100 (2023), 71.200 (2024), and 74.600 (2025).",
      fhcPeak: "75.100",
      fhcPeakSub: "2023 Prelims Score",
      fhcTarget: "74.800",
      fhcTargetSub: "Class AA Target",
      fhcRank: "#28 - #33",
      fhcCutoff: "79.80+",
      fhcCutoffSub: "Finals 14 Cutoff"
    }
  },

  brokenarrow: {
    spreadsheetId: "1iatqDcFWffwrRzMKMDXUy5hAizRhfxYqGFSmOpzlQ7s",
    tabs: {
      "2026": "Broken Arrow Invitational - 2026 - 9/19/26",
      "2025": "Broken Arrow Invitational - 2025 - 9/20/25",
      "2024": "Broken Arrow Invitational - 2024 - 10/5/24",
      "2023": "Broken Arrow Invitational - 2023 - 10/7/23",
      "2022": "Broken Arrow Invitational - 2022 - 10/1/22"
    },
    meta: {
      title: "Broken Arrow Invitational",
      subtitle: "Broken Arrow, OK • Regional Invitational",
      tag: "BA INVITATIONAL",
      fhcHeadline: "Regional Performance Record",
      fhcSummary: "Early-season benchmark scores for Oklahoma and national contender programs.",
      fhcPeak: "82.550",
      fhcPeakSub: "Southmoore '23 Champ",
      fhcTarget: "--",
      fhcTargetSub: "Regional Comparison",
      fhcRank: "--",
      fhcCutoff: "70.00+",
      fhcCutoffSub: "Finals Spread"
    }
  },

  deercreek: {
    spreadsheetId: "1XTo8j1gzAYEbnaIYbGSjWaKMCqCXTM484-6Q29Gcy_k",
    tabs: {
      "2026": "Deer Creek Invitational - 2026 - 9/19/26",
      "2025": "Deer Creek Invitational - 2025 - 9/20/25",
      "2024": "Deer Creek Invitational - 2024 - 9/21/24",
      "2023": "Deer Creek Invitational - 2023 - 9/23/23"
    },
    meta: {
      title: "Deer Creek Invitational",
      subtitle: "Edmond, OK • Contest Finals",
      tag: "DEER CREEK INV",
      fhcHeadline: "Oklahoma Early Season Benchmark",
      fhcSummary: "Historical scoring trajectory for Oklahoma 6A contenders.",
      fhcPeak: "83.800",
      fhcPeakSub: "Southmoore '26 Score",
      fhcTarget: "--",
      fhcTargetSub: "Regional Comparison",
      fhcRank: "--",
      fhcCutoff: "75.00+",
      fhcCutoffSub: "Finals Spread"
    }
  }
};

// =============================================================================
// Adaptive Universal Parser
// Intelligently scans columns to identify school names regardless of layout
// =============================================================================
function parseRawRecapCSV(rawCsvText) {
  const parsed = Papa.parse(rawCsvText, { skipEmptyLines: false });
  const rows = parsed.data;

  let currentBlock = "Prelims";
  let currentClass = "Open Flight";
  let roster = [];

  // Words that are never school names
  const ignoreWords = [
    "music performance", "visual performance", "general effect", "judge panel",
    "individual", "ensemble", "total", "order", "school name", "field & timing",
    "prelims", "finals", "class a", "class aa", "class aaa", "class aaaa",
    "gold", "black", "white", "gold division", "black division", "white division",
    "oustanding music", "outstanding visual", "outstanding general effect", "1st place", "2nd place", "3rd place"
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map(c => (c || "").toString().trim());
    const line = row.join(" ").toLowerCase();

    if (row.every(c => c === "")) continue;

    // Detect Section Banners
    if (line.includes("finals") && !line.includes("field & timing")) {
      currentBlock = "Finals";
      continue;
    }
    if (line.includes("prelims")) {
      currentBlock = "Prelims";
      continue;
    }

    // Detect Class/Division Markers
    if (line.includes("gold division") || line === "gold") currentClass = "Gold Division";
    else if (line.includes("black division") || line === "black") currentClass = "Black Division";
    else if (line.includes("white division") || line === "white") currentClass = "White Division";
    else if (line.includes("class aaaa")) currentClass = "Class AAAA";
    else if (line.includes("class aaa")) currentClass = "Class AAA";
    else if (line.includes("class aa")) currentClass = "Class AA";
    else if (line.includes("class a")) currentClass = "Class A";

    // Search for a candidate School Name in the row
    let candidateName = "";
    for (let c = 0; c < Math.min(row.length, 3); c++) {
      const cell = row[c];
      const cellLower = cell.toLowerCase();

      // If cell has text, isn't a pure number, and isn't a known header word
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

    // Scan backwards from the end of the row for the highest number (Total Score)
    let scoreVal = 0.0;
    for (let c = row.length - 1; c >= 0; c--) {
      const val = parseFloat(row[c]);
      // Match reasonable score totals (between 40.0 and 100.0)
      if (!isNaN(val) && val >= 40.0 && val <= 100.0) {
        scoreVal = val;
        break;
      }
    }

    roster.push({
      name: candidateName,
      flight: `${currentBlock} • ${currentClass}`,
      state: "MO",
      base: scoreVal
    });
  }

  return roster;
}

// =============================================================================
// Router & Fetch Execution
// =============================================================================
function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    event: urlParams.get("event") || "renegade",
    year: urlParams.get("year") || "2026"
  };
}

function switchEvent(eventKey, yearKey) {
  const newUrl = `${window.location.pathname}?event=${eventKey}&year=${yearKey || '2026'}`;
  window.history.pushState({ path: newUrl }, "", newUrl);
  fetchAndRenderCompetition(eventKey, yearKey || '2026');
}

async function fetchAndRenderCompetition(eventKey, year) {
  const comp = competitionRegistry[eventKey];
  if (!comp) {
    showDiagnostic(`Unknown contest event: "${eventKey}"`);
    return;
  }

  const tabName = comp.tabs[year] || Object.values(comp.tabs)[0];

  if (!comp.spreadsheetId || comp.spreadsheetId.includes("YOUR_")) {
    showDiagnostic(`Spreadsheet ID not configured in competition.js for "${eventKey}".`);
    populateCompetitionView(comp.meta, [], year);
    return;
  }

  const endpoint = `https://docs.google.com/spreadsheets/d/${comp.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

  try {
    const response = await fetch(endpoint);
    const rawCsvText = await response.text();

    // Check if Google returned an HTML error page (permission denied or tab not found)
    if (rawCsvText.trim().startsWith("<!DOCTYPE html>") || rawCsvText.includes("google-site-verification")) {
      showDiagnostic(`Google returned an error page. Check that the tab name "${tabName}" exactly matches the tab name in Google Sheets and that General Access is set to "Anyone with the link can view".`);
      populateCompetitionView(comp.meta, [], year);
      return;
    }

    const liveRoster = parseRawRecapCSV(rawCsvText);

    if (liveRoster.length === 0) {
      showDiagnostic(`Sheet connected, but 0 schools matched. Verify the tab contains school names.`);
    }

    populateCompetitionView(comp.meta, liveRoster, year);
  } catch (err) {
    showDiagnostic(`Network fetch error: ${err.message}`);
    populateCompetitionView(comp.meta, [], year);
  }
}

function showDiagnostic(message) {
  console.warn(message);
  let bar = document.getElementById("diagnosticBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "diagnosticBar";
    bar.className = "p-3 bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs rounded-xl font-mono mb-4";
    const header = document.querySelector("header");
    if (header) header.insertAdjacentElement("afterend", bar);
  }
  bar.textContent = `[DIAGNOSTIC] ${message}`;
}

// =============================================================================
// DOM Renderer
// =============================================================================
function populateCompetitionView(meta, roster, year) {
  const isRecap = parseInt(year) < 2026;

  document.getElementById("contestTitle").textContent = `${meta.title} (${year})`;
  document.getElementById("contestSubtitle").textContent = meta.subtitle;
  document.getElementById("contestTag").textContent = isRecap ? `${year} RECAP` : meta.tag;
  document.getElementById("bandCountBadge").textContent = `${roster.length} Programs`;

  const selectElem = document.getElementById("contestSelect");
  if (selectElem) {
    const { event, year: activeYear } = getUrlParams();
    selectElem.value = `${event}|${activeYear}`;
  }

  document.getElementById("fhcEventHeadline").textContent = meta.fhcHeadline;
  document.getElementById("fhcEventSummary").textContent = meta.fhcSummary;
  document.getElementById("fhcStatPeak").textContent = meta.fhcPeak;
  document.getElementById("fhcStatPeakSub").textContent = meta.fhcPeakSub;
  document.getElementById("fhcStatTarget").textContent = meta.fhcTarget;
  document.getElementById("fhcStatTargetSub").textContent = meta.fhcTargetSub;
  document.getElementById("fhcStatRank").textContent = meta.fhcRank;
  document.getElementById("fhcStatCutoff").textContent = meta.fhcCutoff;
  document.getElementById("fhcStatCutoffSub").textContent = meta.fhcCutoffSub;

  document.getElementById("statLabel1").textContent = isRecap ? "Achieved Score" : "Historical Peak";
  document.getElementById("statLabel2").textContent = isRecap ? "Class / Caption" : "Target Score";
  document.getElementById("statLabel3").textContent = isRecap ? "Official Placement" : "Projected Place";
  document.getElementById("statLabel4").textContent = isRecap ? "Champion Score" : "Finals Benchmark";

  // Roster Table
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
        <span class="text-[10px] text-slate-500 font-mono font-normal">(${band.state || 'MO'})</span>
        ${isFHC ? '<span class="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold">FHC</span>' : ''}
      </td>
      <td class="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">${band.flight}</td>
    `;
    rosterBody.appendChild(tr);
  });

  // Leaderboard Table
  const leaderboardBody = document.getElementById("leaderboardTableBody");
  leaderboardBody.innerHTML = "";
  const sorted = [...roster].sort((a, b) => b.base - a.base);

  sorted.forEach((band, idx) => {
    const rank = idx + 1;
    const isFHC = band.name.toLowerCase().includes("howell central");
    const isTopTier = rank <= 12;

    const tr = document.createElement("tr");
    tr.className = isFHC
      ? "bg-blue-950/40 border-l-2 border-blue-400"
      : isTopTier
      ? "hover:bg-slate-900/50 transition"
      : "hover:bg-slate-900/30 opacity-70 transition";

    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono font-bold ${rank <= 3 ? 'text-amber-400' : 'text-slate-400'}">
        #${rank}
      </td>
      <td class="py-2.5 px-3 ${isFHC ? 'text-blue-300 font-bold' : 'text-white'}">
        ${band.name} <span class="text-[10px] text-slate-500 font-mono font-normal">(${band.state || 'MO'})</span>
      </td>
      <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
        ${band.base > 0 ? band.base.toFixed(3) : "Pending"}
      </td>
      <td class="py-2.5 px-3 text-right">
        <span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">${band.flight}</span>
      </td>
    `;
    leaderboardBody.appendChild(tr);
  });

  lucide.createIcons();
}

window.addEventListener("popstate", () => {
  const { event, year } = getUrlParams();
  fetchAndRenderCompetition(event, year);
});

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  const { event, year } = getUrlParams();
  fetchAndRenderCompetition(event, year);
});