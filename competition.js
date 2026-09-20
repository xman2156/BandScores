// =============================================================================
// Competition File Registry
// Add the Spreadsheet ID for each distinct competition file in your Drive
// =============================================================================

const competitionRegistry = {
  // 1. Lafayette Contest of Champions Spreadsheet File
  lafayette: {
    spreadsheetId: "10e1ghOqkzOyNt7lPOC_TRiw_WWPU2cIHVzxUK_YCPd4",
    tabs: {
      "2026": "Lafayette Contest of Champions - 2026 Prelims - 9/26/26",
      "2024": "Lafayette Contest of Champions - 2024 - 9/28/24",
      "2023": "Lafayette Contest of Champions - 2023 - 9/30/23",
      "2022": "Lafayette Contest of Champions - 2022 - 9/24/22"
    },
    meta: {
      title: "Lafayette Contest of Champions",
      subtitle: "Wildwood, MO • Prelims & Finals",
      tag: "LAFAYETTE COC",
      fhcHeadline: "FHC Lafayette Legacy & Division History",
      fhcSummary: "FHC swept all captions in the Black Division in 2024 (77.750) and took 2nd in Finals (80.950).",
      fhcPeak: "80.950",
      fhcPeakSub: "2024 Finals",
      fhcTarget: "Alum",
      fhcTargetSub: "Class AA Legend",
      fhcRank: "#2 ('24)",
      fhcCutoff: "78.20+",
      fhcCutoffSub: "Top Flight Cutoff"
    }
  },

  // 2. Renegade Review Spreadsheet File
  renegade: {
    spreadsheetId: "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo",
    tabs: {
      "2026": "Renegade Review - 2026 - 10/10/26",
      "2025": "Renegade Review - 2025 - 10/11/25",
      "2024": "Renegade Review - 2024 - 10/12/25",
      "2021": "Renegade Review - 2021 - 10/9/21"
    },
    meta: {
      title: "Renegade Review",
      subtitle: "Owasso, OK • 24 Performing Programs",
      tag: "RENEGADE REVIEW",
      fhcHeadline: "FHC Renegade Finals Bubble Campaign",
      fhcSummary: "FHC travels to Oklahoma for mid-season competition against top programs from OK, AR, and MO.",
      fhcPeak: "71.800",
      fhcPeakSub: "Tiger Ambush '26",
      fhcTarget: "75.350",
      fhcTargetSub: "+3.55 Delta",
      fhcRank: "#11 - #13",
      fhcCutoff: "~74.90",
      fhcCutoffSub: "Finals 12 Cutoff"
    }
  },

  // 3. Broken Arrow Invitational Spreadsheet File
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
      fhcCutoff: "72.00+",
      fhcCutoffSub: "Finals Spread"
    }
  },

  // 4. Bands of America St. Louis Super Regional Spreadsheet File
  boastl: {
    spreadsheetId: "1ipg6FG-omTfFcDLieyOO1wQbHfWLJIG1aiZAS9bZJh4",
    tabs: {
      "2026": "BOA St Louis - 2026 Prelims",
      "2025": "BOA St Louis - 2025 Prelims - 10/17/25",
      "2024": "BOA St Louis - 2024 Prelims - 10/25/24",
      "2023": "BOA St Louis - 2023 Prelims - 10/27/23",
      "2021": "BOA St Louis - 2021 Prelims - 10/22/21"
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
  }
};

// =============================================================================
// Universal Recap Parser (Handles every sheet in your notebook)
// =============================================================================
function parseRawRecapCSV(rawCsvText) {
  const parsed = Papa.parse(rawCsvText, { skipEmptyLines: false });
  const rows = parsed.data;

  let currentBlock = "Prelims";
  let currentClass = "Open Flight";
  let roster = [];
  let schoolColIdx = -1;
  let totalColIdx = -1;
  let inDataZone = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map(c => (c || "").toString().trim());
    const line = row.join(" ").toLowerCase();

    if (row.every(c => c === "")) continue;

    // Detect Prelims vs Finals
    if (line.includes("finals") && !line.includes("field & timing")) {
      currentBlock = "Finals";
      inDataZone = false;
      continue;
    }
    if (line.includes("prelims")) {
      currentBlock = "Prelims";
      inDataZone = false;
      continue;
    }

    // Detect Divisions (Gold, Black, White) or Classes (A, AA, AAA, AAAA)
    const divMatch = row.find(c => ["gold", "black", "white", "gold division", "black division", "white division"].includes(c.toLowerCase()));
    if (divMatch) {
      currentClass = divMatch.includes("Division") ? divMatch : divMatch + " Division";
      inDataZone = false;
      continue;
    }
    const classMatch = row.find(c => /^class\s+[a-z]+/i.test(c.toLowerCase()));
    if (classMatch) {
      currentClass = classMatch;
      inDataZone = false;
      continue;
    }

    // Detect Header Row
    if (row.includes("School Name") || (row.includes("Individual") && row.includes("Total"))) {
      schoolColIdx = row.findIndex(c => c.toLowerCase() === "school name");
      if (schoolColIdx === -1) {
        // Fallback when first column is empty
        schoolColIdx = row[0] === "" ? 1 : 0;
      }
      for (let c = row.length - 1; c >= 0; c--) {
        if (row[c].toLowerCase() === "total") {
          totalColIdx = c;
          break;
        }
      }
      inDataZone = true;
      continue;
    }

    // Skip Judge headers
    if (!inDataZone || line.includes("judge panel") || line.includes("music performance") || line.includes("visual performance")) {
      continue;
    }

    // Ingest School Row
    const schoolName = row[schoolColIdx];
    const rawScore = row[totalColIdx];
    const scoreVal = parseFloat(rawScore);

    if (
      schoolName &&
      schoolName.toLowerCase() !== "order" &&
      schoolName.toLowerCase() !== "school name" &&
      !schoolName.toLowerCase().includes("division") &&
      !schoolName.toLowerCase().includes("prelims")
    ) {
      roster.push({
        name: schoolName,
        flight: `${currentBlock} • ${currentClass}`,
        state: "MO",
        base: !isNaN(scoreVal) && scoreVal > 0 ? scoreVal : 0.000
      });
    }
  }

  return roster;
}

// =============================================================================
// Live Fetch Engine
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
  if (!comp) return;

  const tabName = comp.tabs[year] || Object.values(comp.tabs)[0];
  const isSheetConfigured = comp.spreadsheetId && !comp.spreadsheetId.includes("YOUR_");

  if (!isSheetConfigured || !tabName) {
    console.warn(`Spreadsheet ID not set for ${eventKey}. Rendering placeholders.`);
    populateCompetitionView(comp.meta, [], year);
    return;
  }

  // Fetch the specific tab directly from that competition's Google Sheet
  const endpoint = `https://docs.google.com/spreadsheets/d/${comp.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

  try {
    const response = await fetch(endpoint);
    const rawCsvText = await response.text();
    const liveRoster = parseRawRecapCSV(rawCsvText);
    populateCompetitionView(comp.meta, liveRoster, year);
  } catch (err) {
    console.warn(`Could not reach sheet for ${eventKey}:`, err);
    populateCompetitionView(comp.meta, [], year);
  }
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

  // Sync Dropdown
  const selectElem = document.getElementById("contestSelect");
  if (selectElem) {
    const { event } = getUrlParams();
    selectElem.value = event;
  }

  // FHC Spotlight Box
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

  // Render Roster Order
  const rosterBody = document.getElementById("rosterTableBody");
  rosterBody.innerHTML = "";
  roster.forEach((band, idx) => {
    const isFHC = band.name.includes("Howell Central");
    const tr = document.createElement("tr");
    tr.className = isFHC ? "bg-blue-950/40 border-l-2 border-blue-400" : "hover:bg-slate-900/60 transition";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-slate-500">${idx + 1}</td>
      <td class="py-2.5 px-3 ${isFHC ? 'text-blue-300 font-bold flex items-center gap-1.5' : 'text-slate-200'}">
        ${band.name}
        <span class="text-[10px] text-slate-500 font-mono font-normal">(${band.state})</span>
        ${isFHC ? '<span class="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold">FHC</span>' : ''}
      </td>
      <td class="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">${band.flight}</td>
    `;
    rosterBody.appendChild(tr);
  });

  // Render Leaderboard (Sorted descending)
  const leaderboardBody = document.getElementById("leaderboardTableBody");
  leaderboardBody.innerHTML = "";
  const sorted = [...roster].sort((a, b) => b.base - a.base);

  sorted.forEach((band, idx) => {
    const rank = idx + 1;
    const isFHC = band.name.includes("Howell Central");
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
        ${band.name} <span class="text-[10px] text-slate-500 font-mono font-normal">(${band.state})</span>
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

// Bootstrap router
window.addEventListener("popstate", () => {
  const { event, year } = getUrlParams();
  fetchAndRenderCompetition(event, year);
});

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  const { event, year } = getUrlParams();
  fetchAndRenderCompetition(event, year);
});