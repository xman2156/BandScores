// =============================================================================
// Universal Dynamic Year & Date Ingestion Engine
// =============================================================================

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    event: urlParams.get("event") || "renegade",
    sheetId: urlParams.get("sheetId") || "1aOD7KDcLPMYkFEkxQUcoYY48amnPMWs01s96t6yNqJo",
    year: urlParams.get("year") || "2026"
  };
}

// Extract human-readable contest name from event key
function formatContestTitle(key) {
  const titles = {
    lafayette: "Lafayette Contest of Champions",
    renegade: "Renegade Review",
    boastl: "BOA St. Louis Super Regional",
    brokenarrow: "Broken Arrow Invitational",
    deercreek: "Deer Creek Invitational",
    tigerambush: "Tiger Ambush Classic",
    memc: "Metro-East Marching Classic",
    rivercity: "River City Showcase"
  };
  return titles[key] || key.toUpperCase();
}

// Adaptive CSV Parser
function parseRawRecapCSV(rawCsvText) {
  const parsed = Papa.parse(rawCsvText, { skipEmptyLines: false });
  const rows = parsed.data;

  let currentBlock = "Prelims";
  let currentClass = "Open Flight";
  let roster = [];

  const ignoreWords = [
    "music performance", "visual performance", "general effect", "judge panel",
    "individual", "ensemble", "total", "order", "school name", "field & timing",
    "prelims", "finals", "class a", "class aa", "class aaa", "class aaaa",
    "gold", "black", "white", "gold division", "black division", "white division",
    "1st place", "2nd place", "3rd place", "overall rank", "class rank", "rating"
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map(c => (c || "").toString().trim());
    const line = row.join(" ").toLowerCase();

    if (row.every(c => c === "")) continue;

    if (line.includes("finals") && !line.includes("field & timing")) {
      currentBlock = "Finals";
      continue;
    }
    if (line.includes("prelims")) {
      currentBlock = "Prelims";
      continue;
    }

    if (line.includes("gold division") || line === "gold") currentClass = "Gold Division";
    else if (line.includes("black division") || line === "black") currentClass = "Black Division";
    else if (line.includes("white division") || line === "white") currentClass = "White Division";
    else if (line.includes("class aaaa")) currentClass = "Class AAAA";
    else if (line.includes("class aaa")) currentClass = "Class AAA";
    else if (line.includes("class aa")) currentClass = "Class AA";
    else if (line.includes("class a")) currentClass = "Class A";

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

    let scoreVal = 0.0;
    for (let c = row.length - 1; c >= 0; c--) {
      const val = parseFloat(row[c]);
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

// Fetch the requested competition tab dynamically
async function loadCompetition() {
  const { event, sheetId, year } = getUrlParams();
  const contestTitle = formatContestTitle(event);

  document.getElementById("contestTitle").textContent = `${contestTitle} (${year})`;
  document.getElementById("contestSubtitle").textContent = `Querying Google Drive spreadsheet for ${year} scores...`;

  // Pattern matching for typical tab formats across your sheets
  const candidateTabs = [
    `${contestTitle} - ${year}`,
    `${contestTitle} - ${year} Prelims`,
    `${year}`,
    `${year} Prelims`,
    `${year} Finals`
  ];

  let rawCsvText = "";
  let matchedTab = "";

  // Try direct gviz tab queries
  for (const tab of candidateTabs) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
      const res = await fetch(url);
      const txt = await res.text();
      if (!txt.trim().startsWith("<!DOCTYPE html>") && txt.length > 100) {
        rawCsvText = txt;
        matchedTab = tab;
        break;
      }
    } catch (e) {
      // Continue to next tab candidate
    }
  }

  // Fallback to default tab if specific named tabs differ
  if (!rawCsvText) {
    try {
      const defaultUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
      const res = await fetch(defaultUrl);
      rawCsvText = await res.text();
    } catch (err) {
      console.error("Could not fetch default tab:", err);
    }
  }

  const roster = parseRawRecapCSV(rawCsvText);

  // Extract embedded date if present in tab name (e.g., "9/19/26")
  const dateMatch = matchedTab.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  const parsedEventDate = dateMatch ? new Date(dateMatch[0]) : new Date(`${year}-10-31`);
  const now = new Date();
  const isPast = parseInt(year) < now.getFullYear() || parsedEventDate < now;

  renderRecapUI(contestTitle, year, roster, isPast, parsedEventDate);
}

function renderRecapUI(title, year, roster, isPast, eventDate) {
  document.getElementById("contestTitle").textContent = `${title} (${year})`;
  document.getElementById("contestSubtitle").textContent = isPast
    ? `Official Completed Recap • Date: ${eventDate.toLocaleDateString()}`
    : `Upcoming Performance Draw • Date: ${eventDate.toLocaleDateString()}`;
  document.getElementById("contestTag").textContent = isPast ? `${year} OFFICIAL RECAP` : `${year} UPCOMING DRAW`;
  document.getElementById("bandCountBadge").textContent = `${roster.length} Programs`;

  // Dynamically locate Francis Howell Central in the ingested roster
  const fhc = roster.find(b => b.name.toLowerCase().includes("howell central"));
  const sorted = [...roster].sort((a, b) => b.base - a.base);
  const fhcRank = sorted.findIndex(b => b.name.toLowerCase().includes("howell central")) + 1;

  if (isPast) {
    document.getElementById("statLabel1").textContent = "Official Score";
    document.getElementById("statLabel2").textContent = "Performance Flight";
    document.getElementById("statLabel3").textContent = "Official Placement";
    document.getElementById("statLabel4").textContent = "Event Champion";

    document.getElementById("fhcStatPeak").textContent = fhc && fhc.base > 0 ? fhc.base.toFixed(3) : "Participated";
    document.getElementById("fhcStatPeakSub").textContent = "Sheet Score";
    document.getElementById("fhcStatTarget").textContent = fhc ? fhc.flight : "Completed";
    document.getElementById("fhcStatTargetSub").textContent = "Division";
    document.getElementById("fhcStatRank").textContent = fhcRank > 0 ? `#${fhcRank} Overall` : "Recorded";
    document.getElementById("fhcStatRankSub").textContent = "Field Standing";

    const winner = sorted.length > 0 ? sorted[0] : null;
    document.getElementById("fhcStatCutoff").textContent = winner && winner.base > 0 ? winner.base.toFixed(3) : "--";
    document.getElementById("fhcStatCutoffSub").textContent = winner ? winner.name : "Champion";
    document.getElementById("fhcEventSummary").textContent = fhc && fhc.base > 0
      ? `Francis Howell Central recorded an official score of ${fhc.base.toFixed(3)} at ${title}.`
      : `Viewing official archive results for ${title} (${year}).`;
  } else {
    document.getElementById("statLabel1").textContent = "Historical Peak";
    document.getElementById("statLabel2").textContent = "Target Score";
    document.getElementById("statLabel3").textContent = "Projected Standing";
    document.getElementById("statLabel4").textContent = "Finals Benchmark";

    document.getElementById("fhcStatPeak").textContent = "--";
    document.getElementById("fhcStatPeakSub").textContent = "Pre-Contest";
    document.getElementById("fhcStatTarget").textContent = "74.500+";
    document.getElementById("fhcStatTargetSub").textContent = "Model Target";
    document.getElementById("fhcStatRank").textContent = "Flight 3";
    document.getElementById("fhcStatRankSub").textContent = "Scheduled Slot";
    document.getElementById("fhcStatCutoff").textContent = "~74.90";
    document.getElementById("fhcStatCutoffSub").textContent = "Finals Bubble";
    document.getElementById("fhcEventSummary").textContent = `Draw locked. Awaiting live score inputs from ${title} (${year}).`;
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
        <span class="text-[10px] text-slate-500 font-mono font-normal">(${band.state || 'MO'})</span>
        ${isFHC ? '<span class="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold">FHC</span>' : ''}
      </td>
      <td class="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">${band.flight}</td>
    `;
    rosterBody.appendChild(tr);
  });

  // Populate Leaderboard Table
  const leaderboardBody = document.getElementById("leaderboardTableBody");
  leaderboardBody.innerHTML = "";
  sorted.forEach((band, idx) => {
    const isFHC = band.name.toLowerCase().includes("howell central");
    const tr = document.createElement("tr");
    tr.className = isFHC ? "bg-blue-950/40 border-l-2 border-blue-400" : "hover:bg-slate-900/50 transition";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono font-bold ${idx < 3 ? 'text-amber-400' : 'text-slate-400'}">#${idx + 1}</td>
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

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  loadCompetition();
});