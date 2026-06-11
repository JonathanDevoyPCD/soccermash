const pots = [
  {
    id: 1,
    label: "Pot 1",
    teams: ["Canada", "Mexico", "USA", "Spain", "Argentina", "France", "England", "Brazil", "Portugal", "Netherlands", "Belgium", "Germany"],
  },
  {
    id: 2,
    label: "Pot 2",
    teams: ["Croatia", "Morocco", "Colombia", "Uruguay", "Switzerland", "Japan", "Senegal", "IR Iran", "Korea Republic", "Ecuador", "Austria", "Australia"],
  },
  {
    id: 3,
    label: "Pot 3",
    teams: ["Norway", "Panama", "Egypt", "Algeria", "Scotland", "Paraguay", "Tunisia", "C\u00f4te d\u2019Ivoire", "Uzbekistan", "Qatar", "Saudi Arabia", "South Africa"],
  },
  {
    id: 4,
    label: "Pot 4",
    teams: ["Jordan", "Cabo Verde", "Ghana", "Cura\u00e7ao", "Haiti", "New Zealand", "Bosnia and Herzegovina", "Sweden", "T\u00fcrkiye", "Czechia", "Congo DR", "Iraq"],
  },
];

const teamNameReplacements = {
  "European Play-Off A winner": "Bosnia and Herzegovina",
  "European Play-Off B winner": "Sweden",
  "European Play-Off C winner": "T\u00fcrkiye",
  "European Play-Off D winner": "Czechia",
  "FIFA Play-Off Tournament winner 1": "Congo DR",
  "FIFA Play-Off Tournament winner 2": "Iraq",
};

const adminPassword = "1234";
const storageKey = "swcPotGameState";
const supabaseTable = "game_state";
const supabaseRecordId = "main";
const matchApiSources = [
  "https://worldcup26.ir/get/games",
  "https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.matches.json",
];
const teamApiSource = "https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.teams.json";
let supabaseClient = null;
let cloudSaveTimer = null;

const state = {
  players: [],
  selectedPlayerId: null,
  adminMode: false,
  results: {},
};

const playersList = document.getElementById("playersList");
const potsGrid = document.getElementById("potsGrid");
const matchApiStatus = document.getElementById("matchApiStatus");
const matchesPlayedText = document.getElementById("matchesPlayedText");
const nextMatchText = document.getElementById("nextMatchText");
const liveMatchesText = document.getElementById("liveMatchesText");
const upcomingMatchesText = document.getElementById("upcomingMatchesText");
const matchProgressFill = document.getElementById("matchProgressFill");
const leaderboardSummary = document.getElementById("leaderboardSummary");
const leaderboardList = document.getElementById("leaderboardList");
const adminModeBtn = document.getElementById("adminModeBtn");
const resultsGrid = document.getElementById("resultsGrid");
const winnersPanel = document.getElementById("winnersPanel");
const importPlayersBtn = document.getElementById("importPlayersBtn");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const syncStatus = document.getElementById("syncStatus");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalInput = document.getElementById("modalInput");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const modalSaveBtn = document.getElementById("modalSaveBtn");
const togglePanelBtns = document.querySelectorAll(".toggle-panel-btn");

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  queueCloudSave();
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return;

  try {
    Object.assign(state, JSON.parse(saved));
    migrateTeamNames();
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function migrateTeamNames() {
  let changed = false;

  state.players.forEach((player) => {
    pots.forEach((pot) => {
      const replacement = teamNameReplacements[player.picks[pot.id]];
      if (!replacement) return;
      player.picks[pot.id] = replacement;
      changed = true;
    });
  });

  Object.keys(state.results).forEach((potId) => {
    const replacement = teamNameReplacements[state.results[potId]];
    if (!replacement) return;
    state.results[potId] = replacement;
    changed = true;
  });

  if (changed) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }
}

function setSyncStatus(text, status = "") {
  syncStatus.textContent = text;
  syncStatus.className = `sync-status ${status}`.trim();
}

function setMatchApiStatus(text, status = "") {
  matchApiStatus.textContent = text;
  matchApiStatus.className = `panel-pill ${status}`.trim();
}

function getSyncedState() {
  return {
    players: state.players,
    selectedPlayerId: state.selectedPlayerId,
    adminMode: false,
    results: state.results,
  };
}

function initSupabase() {
  const config = window.SUPABASE_CONFIG;
  if (!config || !config.url || !config.anonKey || !window.supabase) {
    setSyncStatus("Local only");
    return false;
  }

  supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: false },
  });
  setSyncStatus("Supabase ready", "synced");
  return true;
}

async function loadCloudState() {
  if (!supabaseClient) return false;
  setSyncStatus("Loading Supabase", "saving");

  const { data, error } = await supabaseClient
    .from(supabaseTable)
    .select("state")
    .eq("id", supabaseRecordId)
    .maybeSingle();

  if (error) {
    setSyncStatus("Supabase error", "error");
    return false;
  }

  if (!data || !data.state) {
    setSyncStatus("Supabase ready", "synced");
    return false;
  }

  Object.assign(state, data.state, { adminMode: false });
  migrateTeamNames();
  localStorage.setItem(storageKey, JSON.stringify(state));
  render();
  setSyncStatus("Synced", "synced");
  return true;
}

function queueCloudSave() {
  if (!supabaseClient) return;

  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(() => {
    saveCloudState();
  }, 350);
}

async function saveCloudState() {
  if (!supabaseClient) return;
  setSyncStatus("Saving", "saving");

  const { error } = await supabaseClient.from(supabaseTable).upsert({
    id: supabaseRecordId,
    state: getSyncedState(),
    updated_at: new Date().toISOString(),
  });

  setSyncStatus(error ? "Supabase error" : "Synced", error ? "error" : "synced");
}

function createPlayer(name) {
  const randomId =
    globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(16).slice(2);
  const id = `${Date.now()}-${randomId}`;
  state.players.push({ id, name, locked: false, picks: { 1: null, 2: null, 3: null, 4: null } });
  state.selectedPlayerId = id;
}

function createPlayers(names) {
  const existingNames = new Set(state.players.map((player) => player.name.toLowerCase()));

  names.forEach((name) => {
    const normalized = name.toLowerCase();
    if (existingNames.has(normalized)) return;
    createPlayer(name);
    existingNames.add(normalized);
  });

  saveState();
  render();
}

function parsePlayerNames(text) {
  return text
    .split(/\r?\n|,/)
    .map((name) => name.trim())
    .filter(Boolean);
}

async function importPlayersFromFile(showMessage = false) {
  try {
    const response = await fetch("players.txt", { cache: "no-store" });
    if (!response.ok) throw new Error("players.txt could not be loaded.");

    const names = parsePlayerNames(await response.text());
    const countBefore = state.players.length;
    if (names.length > 0) createPlayers(names);

    if (showMessage) {
      const importedCount = state.players.length - countBefore;
      alert(importedCount > 0 ? `Imported ${importedCount} player(s).` : "No new players found in players.txt.");
    }
  } catch {
    if (showMessage) {
      alert("Could not import players.txt. Open the app from the local server URL instead of directly from disk.");
    }
  }
}

async function loadPlayersFromFileIfEmpty() {
  if (state.players.length > 0) return;
  await importPlayersFromFile(false);
}

async function fetchJsonFromSources(sources) {
  for (const source of sources) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) continue;
      return { data: await response.json(), source };
    } catch {
      // Try the next source.
    }
  }

  return { data: null, source: null };
}

function normalizeBoolean(value) {
  return String(value).toLowerCase() === "true" || value === true;
}

function parseFixtureDate(value) {
  if (!value) return null;

  const [datePart, timePart = "00:00"] = String(value).split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);

  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
}

function getFixtureStatus(match) {
  const elapsed = String(match.time_elapsed || match.status || "").toLowerCase();
  if (normalizeBoolean(match.finished) || ["finished", "ft", "aet", "pen"].includes(elapsed)) return "played";
  if (["live", "inplay", "playing", "halftime", "ht"].includes(elapsed) || Number(elapsed) > 0) return "live";
  return "upcoming";
}

function createTeamNameMap(teams) {
  const map = new Map();
  if (!Array.isArray(teams)) return map;

  teams.forEach((team) => {
    const id = String(team.id || team.team_id || "");
    const name = team.name_en || team.name || team.country || id;
    if (id && name) map.set(id, name);
  });

  return map;
}

function formatMatchDate(date) {
  if (!date) return "date TBC";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updateMatchProgress(matches, teams, source) {
  const safeMatches = Array.isArray(matches) ? matches : [];
  const teamNames = createTeamNameMap(teams);
  const total = safeMatches.length || 104;
  const statuses = safeMatches.map((match) => ({ match, status: getFixtureStatus(match), date: parseFixtureDate(match.local_date || match.date) }));
  const played = statuses.filter((item) => item.status === "played").length;
  const live = statuses.filter((item) => item.status === "live").length;
  const upcoming = Math.max(total - played - live, 0);
  const percent = total ? Math.round((played / total) * 100) : 0;
  const next = statuses
    .filter((item) => item.status === "upcoming")
    .sort((a, b) => (a.date || new Date(8640000000000000)) - (b.date || new Date(8640000000000000)))[0];

  matchesPlayedText.textContent = `${played} / ${total} matches played`;
  liveMatchesText.textContent = `${live} live`;
  upcomingMatchesText.textContent = `${upcoming} upcoming`;
  matchProgressFill.style.width = `${percent}%`;
  matchProgressFill.textContent = percent > 8 ? `${percent}%` : "";

  if (next) {
    const home = teamNames.get(String(next.match.home_team_id)) || `Team ${next.match.home_team_id}`;
    const away = teamNames.get(String(next.match.away_team_id)) || `Team ${next.match.away_team_id}`;
    nextMatchText.textContent = `Next: ${home} vs ${away} - ${formatMatchDate(next.date)}`;
  } else {
    nextMatchText.textContent = played === total ? "Tournament complete." : "No upcoming fixture found.";
  }

  setMatchApiStatus(source && source.includes("raw.githubusercontent.com") ? "Static fixtures" : "Live API connected", "synced");
}

async function loadMatchProgress() {
  setMatchApiStatus("Loading fixtures", "saving");

  const [{ data: matches, source }, { data: teams }] = await Promise.all([
    fetchJsonFromSources(matchApiSources),
    fetchJsonFromSources([teamApiSource]),
  ]);

  if (!matches) {
    setMatchApiStatus("Fixture API unavailable", "error");
    matchesPlayedText.textContent = "0 / 104 matches played";
    nextMatchText.textContent = "Could not load fixtures. Try refreshing later.";
    return;
  }

  updateMatchProgress(matches, teams, source);
}

function selectPlayer(playerId) {
  state.selectedPlayerId = playerId;
  render();
}

function getSelectedPlayer() {
  return state.players.find((player) => player.id === state.selectedPlayerId);
}

function hasCompletePicks(player) {
  return pots.every((pot) => Boolean(player.picks[pot.id]));
}

function getPickCount(player) {
  return pots.filter((pot) => Boolean(player.picks[pot.id])).length;
}

function getMissingPickCount(player) {
  return pots.length - getPickCount(player);
}

function getLockButtonText(player) {
  if (player.locked) return state.adminMode ? "Unlock this player" : "Locked";
  if (hasCompletePicks(player)) return "Lock this player";
  return `${getMissingPickCount(player)} pick${getMissingPickCount(player) === 1 ? "" : "s"} left`;
}

function updatePlayerPick(playerId, potId, team) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || (player.locked && !state.adminMode)) return;

  const isCurrentPick = player.picks[potId] === team;
  if (isCurrentPick && (state.adminMode || !player.locked)) {
    player.picks[potId] = null;
  } else {
    player.picks[potId] = team;
  }

  saveState();
  render();
}

function resetPlayerPicks(playerId) {
  if (!state.adminMode) return;

  const player = state.players.find((item) => item.id === playerId);
  if (!player) return;

  const confirmed = confirm(`Clear all picks for ${player.name} and unlock this player?`);
  if (!confirmed) return;

  player.picks = { 1: null, 2: null, 3: null, 4: null };
  player.locked = false;
  saveState();
  render();
}

function toggleLock(playerId) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || (!state.adminMode && player.locked)) return;

  if (!player.locked && !hasCompletePicks(player)) {
    alert(`${player.name} needs one team from every pot before their picks can be locked.`);
    return;
  }

  player.locked = !player.locked;
  saveState();
  render();
}

function setResult(potId, team) {
  if (!state.adminMode) return;
  state.results[potId] = state.results[potId] === team ? null : team;
  saveState();
  render();
}

function createPickLines(player, emptyText = "-") {
  const picksList = document.createElement("div");
  picksList.className = "pick-lines";

  pots.forEach((pot) => {
    const line = document.createElement("div");
    line.textContent = `${pot.label}: ${player.picks[pot.id] || emptyText}`;
    picksList.appendChild(line);
  });

  return picksList;
}

function renderPlayers() {
  playersList.innerHTML = "";

  if (state.players.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Add co-workers to start the pot pick game.";
    playersList.appendChild(empty);
    return;
  }

  const sortedPlayers = [...state.players].sort((a, b) => a.name.localeCompare(b.name));

  sortedPlayers.forEach((player) => {
    const card = document.createElement("div");
    card.className = `player-card collapsed ${player.id === state.selectedPlayerId ? "selected" : ""}`;

    const header = document.createElement("button");
    header.className = "player-card-header";
    header.type = "button";
    header.setAttribute("aria-expanded", "false");

    const name = document.createElement("h3");
    name.textContent = player.name;

    const tags = document.createElement("div");
    tags.className = "player-tags";

    const pickTag = document.createElement("span");
    pickTag.className = hasCompletePicks(player) ? "player-tag complete" : "player-tag incomplete";
    pickTag.textContent = hasCompletePicks(player) ? "4/4 picked" : `${getPickCount(player)}/4 picked`;

    const lockTag = document.createElement("span");
    lockTag.className = player.locked ? "player-tag locked" : "player-tag open";
    lockTag.textContent = player.locked ? "Locked" : "Open";

    const toggleTag = document.createElement("span");
    toggleTag.className = "player-toggle-label";
    toggleTag.textContent = "Expand";

    tags.appendChild(pickTag);
    tags.appendChild(lockTag);
    tags.appendChild(toggleTag);
    header.appendChild(name);
    header.appendChild(tags);

    const body = document.createElement("div");
    body.className = "player-card-body";

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    selectBtn.addEventListener("click", () => selectPlayer(player.id));

    const lockBtn = document.createElement("button");
    lockBtn.textContent = getLockButtonText(player);
    lockBtn.className = player.locked ? "danger-button" : "success-button";
    lockBtn.disabled = (!state.adminMode && player.locked) || (!player.locked && !hasCompletePicks(player));
    lockBtn.title = hasCompletePicks(player)
      ? `Only locks picks for ${player.name}`
      : `${player.name} still needs ${getMissingPickCount(player)} pick(s)`;
    lockBtn.addEventListener("click", () => toggleLock(player.id));

    actions.appendChild(selectBtn);
    actions.appendChild(lockBtn);

    if (state.adminMode) {
      const resetBtn = document.createElement("button");
      resetBtn.textContent = "Reset picks";
      resetBtn.className = "danger-button";
      resetBtn.disabled = getPickCount(player) === 0 && !player.locked;
      resetBtn.addEventListener("click", () => resetPlayerPicks(player.id));
      actions.appendChild(resetBtn);
    }

    body.appendChild(createPickLines(player));
    body.appendChild(actions);
    card.appendChild(header);
    card.appendChild(body);

    header.addEventListener("click", () => {
      const isCollapsed = card.classList.toggle("collapsed");
      toggleTag.textContent = isCollapsed ? "Expand" : "Collapse";
      header.setAttribute("aria-expanded", String(!isCollapsed));
    });

    playersList.appendChild(card);
  });
}

function renderPots() {
  potsGrid.innerHTML = "";
  const selectedPlayer = getSelectedPlayer();

  pots.forEach((pot) => {
    const card = document.createElement("div");
    card.className = "pot-card";

    const title = document.createElement("h3");
    title.textContent = pot.label;
    card.appendChild(title);

    pot.teams.forEach((team) => {
      const teamBtn = document.createElement("button");
      teamBtn.className = "team-button";
      teamBtn.textContent = team;
      teamBtn.disabled = !selectedPlayer || (selectedPlayer.locked && !state.adminMode);

      if (selectedPlayer && selectedPlayer.picks[pot.id] === team) {
        teamBtn.classList.add("selected");
        teamBtn.title = "Click again to deselect";
      }

      if (selectedPlayer && selectedPlayer.locked && state.adminMode) {
        teamBtn.title = "Admin can change or deselect locked picks";
      }

      teamBtn.addEventListener("click", () => updatePlayerPick(selectedPlayer.id, pot.id, team));
      card.appendChild(teamBtn);
    });

    potsGrid.appendChild(card);
  });
}

function getPlayerScore(player) {
  const winningPots = pots.filter((pot) => state.results[pot.id]);
  const winningTeams = winningPots.filter((pot) => player.picks[pot.id] === state.results[pot.id]);

  return {
    player,
    score: winningTeams.length,
    decided: winningPots.length,
    winningTeams,
  };
}

function renderLeaderboard() {
  leaderboardList.innerHTML = "";

  const decidedCount = pots.filter((pot) => state.results[pot.id]).length;
  leaderboardSummary.textContent = `${decidedCount} pot${decidedCount === 1 ? "" : "s"} decided`;

  if (state.players.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Add players to see the leaderboard.";
    leaderboardList.appendChild(empty);
    return;
  }

  const rows = state.players
    .map(getPlayerScore)
    .sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));

  rows.forEach((row, index) => {
    const item = document.createElement("div");
    item.className = "leaderboard-item";

    const rank = document.createElement("div");
    rank.className = "leaderboard-rank";
    rank.textContent = index + 1;

    const details = document.createElement("div");
    details.className = "leaderboard-details";

    const name = document.createElement("strong");
    name.textContent = row.player.name;

    const subtext = document.createElement("span");
    const winningLabels = row.winningTeams.map((pot) => `${pot.label}: ${state.results[pot.id]}`).join(", ");
    subtext.textContent = winningLabels || `${getPickCount(row.player)}/4 picked - ${row.player.locked ? "locked" : "open"}`;

    const score = document.createElement("div");
    score.className = "leaderboard-score";
    score.textContent = `${row.score}/${row.decided}`;

    details.appendChild(name);
    details.appendChild(subtext);
    item.appendChild(rank);
    item.appendChild(details);
    item.appendChild(score);
    leaderboardList.appendChild(item);
  });
}

function renderResults() {
  resultsGrid.innerHTML = "";
  winnersPanel.innerHTML = "";

  pots.forEach((pot) => {
    const card = document.createElement("div");
    card.className = "result-card";

    const title = document.createElement("h3");
    title.textContent = `${pot.label} result`;
    card.appendChild(title);

    pot.teams.forEach((team) => {
      const button = document.createElement("button");
      button.className = "result-team-button";
      button.textContent = team;
      button.disabled = !state.adminMode;

      if (state.results[pot.id] === team) {
        button.classList.add("selected");
      }

      button.addEventListener("click", () => setResult(pot.id, team));
      card.appendChild(button);
    });

    const winnerText = document.createElement("p");
    winnerText.className = "selected-winner";
    winnerText.textContent = `Selected winner: ${state.results[pot.id] || "None"}`;
    card.appendChild(winnerText);
    resultsGrid.appendChild(card);
  });

  renderWinnerCards();
}

function renderWinnerCards() {
  const activePots = pots.filter((pot) => state.results[pot.id]);

  if (activePots.length === 0) {
    const message = document.createElement("div");
    message.className = "alert";
    message.textContent = "No pot winners selected yet. Use admin mode to mark winners for each pot.";
    winnersPanel.appendChild(message);
    return;
  }

  activePots.forEach((pot) => {
    const winnerTeam = state.results[pot.id];
    const winners = state.players.filter((player) => player.picks[pot.id] === winnerTeam);
    const card = document.createElement("div");
    card.className = "winner-card";

    const title = document.createElement("strong");
    title.textContent = `${pot.label} winner: ${winnerTeam}`;
    card.appendChild(title);

    const details = document.createElement("div");
    details.textContent = winners.length
      ? `Winner${winners.length > 1 ? "s" : ""}: ${winners.map((winner) => winner.name).join(", ")}`
      : "No player picked that team yet.";
    card.appendChild(details);

    winnersPanel.appendChild(card);
  });
}

function render() {
  renderPlayers();
  renderPots();
  renderLeaderboard();
  renderResults();

  adminModeBtn.textContent = state.adminMode ? "Admin mode: ON" : "Admin mode";
  adminModeBtn.classList.toggle("admin-on", state.adminMode);
}

function openModal(title, placeholder, callback) {
  modalTitle.textContent = title;
  modalInput.value = "";
  modalInput.placeholder = placeholder;
  modal.classList.remove("hidden");
  modalInput.focus();

  function handleSave() {
    const value = modalInput.value.trim();
    if (!value) return;
    callback(value);
    closeModal();
  }

  function handleKeydown(event) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) handleSave();
    if (event.key === "Escape") closeModal();
  }

  function closeModal() {
    modal.classList.add("hidden");
    modalSaveBtn.removeEventListener("click", handleSave);
    modalCancelBtn.removeEventListener("click", closeModal);
    modalInput.removeEventListener("keydown", handleKeydown);
  }

  modalSaveBtn.addEventListener("click", handleSave);
  modalCancelBtn.addEventListener("click", closeModal);
  modalInput.addEventListener("keydown", handleKeydown);
}

function promptAdmin() {
  if (state.adminMode) {
    state.adminMode = false;
    saveState();
    render();
    return;
  }

  const password = prompt("Enter admin password to enable admin mode:");
  if (password === adminPassword) {
    state.adminMode = true;
    saveState();
    render();
  } else if (password !== null) {
    alert("Incorrect password.");
  }
}

if (addPlayerBtn) {
  addPlayerBtn.addEventListener("click", () => {
    openModal("Add players", "Enter one co-worker name per line", (value) => {
      const names = parsePlayerNames(value);
      if (names.length > 0) createPlayers(names);
    });
  });
}

if (importPlayersBtn) {
  importPlayersBtn.addEventListener("click", () => {
    importPlayersFromFile(true);
  });
}

adminModeBtn.addEventListener("click", promptAdmin);

togglePanelBtns.forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.target);
    if (!target) return;

    const isCollapsed = target.classList.toggle("collapsed");
    button.textContent = isCollapsed ? "Expand" : "Collapse";
    button.setAttribute("aria-expanded", String(!isCollapsed));
  });
});

window.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal.classList.add("hidden");
  }
});

async function init() {
  loadState();
  initSupabase();
  render();
  loadMatchProgress();
  const cloudLoaded = await loadCloudState();
  await loadPlayersFromFileIfEmpty();

  if (!cloudLoaded && supabaseClient && state.players.length > 0) {
    await saveCloudState();
  }
}

init();
