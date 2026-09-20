const competitionsArchive = [
  // --- 2026 Season ---
  {
    id: "lafayette",
    year: 2026,
    name: "Lafayette Contest of Champions",
    date: "September 26, 2026",
    location: "Wildwood, MO",
    status: "Upcoming",
    winner: "Prelims Draw Locked (16 Programs)",
    fhcStatus: "Alum (2024 Black Div Champion)",
    link: "competition.html?event=lafayette"
  },
  {
    id: "renegade",
    year: 2026,
    name: "Renegade Review",
    date: "October 10, 2026",
    location: "Owasso, OK",
    status: "Upcoming",
    winner: "Prelims Draw Locked (24 Programs)",
    fhcStatus: "FHC Slotted (Flight 3)",
    link: "competition.html?event=renegade"
  },
  {
    id: "boastl",
    year: 2026,
    name: "BOA St. Louis Super Regional",
    date: "October 16-17, 2026",
    location: "The Dome at America's Center, St. Louis, MO",
    status: "Upcoming",
    winner: "Championship Model Running",
    fhcStatus: "Target: 74.80+ (Class AA)",
    link: "competition.html?event=boastl"
  },

  // --- 2025 Season ---
  {
    id: "boastl-2025",
    year: 2025,
    name: "BOA St. Louis Super Regional",
    date: "October 17-18, 2025",
    location: "The Dome at America's Center, St. Louis, MO",
    status: "Archived",
    winner: "Broken Arrow (89.250)",
    fhcStatus: "FHC Prelims Score: 74.600 (Class AAA 13th)",
    link: "competition.html?event=boastl-2025"
  },
  {
    id: "renegade-2025",
    year: 2025,
    name: "Renegade Review",
    date: "October 11, 2025",
    location: "Owasso, OK",
    status: "Archived",
    winner: "Owasso (86.700 Finals)",
    fhcStatus: "Historical Data Ingested",
    link: "competition.html?event=renegade-2025"
  },
  {
    id: "lafayette-2025",
    year: 2025,
    name: "Lafayette Contest of Champions",
    date: "September 20, 2025",
    location: "Wildwood, MO",
    status: "Archived",
    winner: "Timberland (71.500 Finals)",
    fhcStatus: "FHC Won Class AA (67.350) / 4th in Finals (68.350)",
    link: "competition.html?event=lafayette-2025"
  },

  // --- 2024 Season ---
  {
    id: "boastl-2024",
    year: 2024,
    name: "BOA St. Louis Super Regional",
    date: "October 25-26, 2024",
    location: "The Dome at America's Center, St. Louis, MO",
    status: "Archived",
    winner: "Blue Springs (92.450)",
    fhcStatus: "FHC Prelims Score: 71.200 (Class AA 10th)",
    link: "competition.html?event=boastl-2024"
  },
  {
    id: "renegade-2024",
    year: 2024,
    name: "Renegade Review",
    date: "October 12, 2024",
    location: "Owasso, OK",
    status: "Archived",
    winner: "Owasso (85.350 Finals)",
    fhcStatus: "Historical Data Ingested",
    link: "competition.html?event=renegade-2024"
  },
  {
    id: "lafayette-2024",
    year: 2024,
    name: "Lafayette Contest of Champions",
    date: "September 28, 2024",
    location: "Wildwood, MO",
    status: "Archived",
    winner: "Timberland (84.250)",
    fhcStatus: "FHC Swept Black Div (77.750) / 2nd in Finals (80.950)",
    link: "competition.html?event=lafayette-2024"
  },
  {
    id: "memc-2024",
    year: 2024,
    name: "Metro-East Marching Classic (MEMC)",
    date: "September 7, 2024",
    location: "O'Fallon, IL",
    status: "Archived",
    winner: "Edwardsville (71.575)",
    fhcStatus: "FHC 2nd in Class AAA (67.050)",
    link: "competition.html?event=memc-2024"
  },

  // --- 2023 Season ---
  {
    id: "boastl-2023",
    year: 2023,
    name: "BOA St. Louis Super Regional",
    date: "October 27-28, 2023",
    location: "The Dome at America's Center, St. Louis, MO",
    status: "Archived",
    winner: "Broken Arrow (Prelims 90.350)",
    fhcStatus: "FHC Prelims Score: 75.100 (Class AA 10th)",
    link: "competition.html?event=boastl-2023"
  },
  {
    id: "memc-2023",
    year: 2023,
    name: "Metro-East Marching Classic (MEMC)",
    date: "September 9, 2023",
    location: "O'Fallon, IL",
    status: "Archived",
    winner: "Edwardsville (71.825)",
    fhcStatus: "FHC Class AAA 4th (66.275)",
    link: "competition.html?event=memc-2023"
  },

  // --- 2021 Season ---
  {
    id: "boastl-2021",
    year: 2021,
    name: "BOA St. Louis Super Regional",
    date: "October 22, 2021",
    location: "The Dome at America's Center, St. Louis, MO",
    status: "Archived",
    winner: "Broken Arrow (90.300)",
    fhcStatus: "FHC Prelims Score: 69.700 (Class AAA 11th)",
    link: "competition.html?event=boastl-2021"
  }
];

function filterByYear(year) {
  const container = document.getElementById("competitionsGrid");
  container.innerHTML = "";

  const filtered = year === "all"
    ? competitionsArchive
    : competitionsArchive.filter(c => c.year === parseInt(year));

  document.getElementById("compCount").textContent = filtered.length;
  document.getElementById("seasonTitle").textContent = year === "all"
    ? "All-Time Competition Archives (2021-2026)"
    : `${year} Competitive Season`;

  document.getElementById("seasonSub").textContent = year === "2026"
    ? "Showing active draws, confirmed results, and projected championships."
    : `Archived contest results, scoresheets, and historical recaps from ${year}.`;

  filtered.forEach(comp => {
    const card = document.createElement("div");
    card.className = "dashboard-tile hover:border-indigo-500/50 transition flex flex-col justify-between";

    const isUpcoming = comp.status === "Upcoming";
    const statusBadge = isUpcoming
      ? '<span class="badge-indigo">Upcoming Draw</span>'
      : '<span class="badge-emerald">Recap Available</span>';

    card.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">${comp.year} Season</span>
            <h3 class="text-lg font-bold text-white tracking-tight">${comp.name}</h3>
            <p class="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <i data-lucide="map-pin" class="w-3 h-3 text-slate-500"></i> ${comp.location}
            </p>
          </div>
          ${statusBadge}
        </div>

        <div class="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500">Date:</span>
            <span class="font-mono text-slate-300 font-medium">${comp.date}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Champion / Benchmark:</span>
            <span class="font-mono text-emerald-400 font-bold">${comp.winner}</span>
          </div>
        </div>

        <div class="p-2.5 bg-blue-950/20 border border-blue-500/20 rounded-lg text-xs flex items-center gap-2">
          <span class="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">FHC</span>
          <span class="text-slate-300 text-[11px]">${comp.fhcStatus}</span>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-800">
        <a href="${comp.link}" class="w-full text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20">
          <span>${isUpcoming ? 'Open Full Draw & Predictions' : 'Open Full Official Recap'}</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </a>
      </div>
    `;
    container.appendChild(card);
  });

  lucide.createIcons();
}

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  filterByYear("2026");
});