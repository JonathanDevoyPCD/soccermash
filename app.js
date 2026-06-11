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
    teams: ["Jordan", "Cabo Verde", "Ghana", "Cura\u00e7ao", "Haiti", "New Zealand", "European Play-Off A winner", "European Play-Off B winner", "European Play-Off C winner", "European Play-Off D winner", "FIFA Play-Off Tournament winner 1", "FIFA Play-Off Tournament winner 2"],
  },
];

const adminPassword = "2026soccer";
const storageKey = "swcPotGameState";

const state = {
  players: [],
  selectedPlayerId: null,
  adminMode: false,
  results: {},
};

const playersList = document.getElementById("playersList");
const potsGrid = document.getElementById("potsGrid");
const selectedPlayerCard = document.getElementById("selectedPlayerCard");
const lockPickBtn = document.getElementById("lockPickBtn");
const unlockPickBtn = document.getElementById("unlockPickBtn");
const adminModeBtn = document.getElementById("adminModeBtn");
const resultsGrid = document.getElementById("resultsGrid");
const winnersPanel = document.getElementById("winnersPanel");
const importPlayersBtn = document.getElementById("importPlayersBtn");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalInput = document.getElementById("modalInput");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const modalSaveBtn = document.getElementById("modalSaveBtn");

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return;

  try {
    Object.assign(state, JSON.parse(saved));
  } catch {
    localStorage.removeItem(storageKey);
  }
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

function updatePlayerPick(playerId, potId, team) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || (player.locked && !state.adminMode)) return;

  player.picks[potId] = team;
  saveState();
  render();
}

function toggleLock(playerId) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || (!state.adminMode && player.locked)) return;

  if (!player.locked && !hasCompletePicks(player)) {
    alert("Choose one team from every pot before locking picks.");
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

  state.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = `player-card ${player.id === state.selectedPlayerId ? "selected" : ""}`;

    const name = document.createElement("h3");
    name.textContent = player.name;

    const status = document.createElement("p");
    status.textContent = `${player.locked ? "Locked" : "Open"} - ${getPickCount(player)}/4 picked`;
    status.className = player.locked ? "status-locked" : "status-open";

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    selectBtn.addEventListener("click", () => selectPlayer(player.id));

    const lockBtn = document.createElement("button");
    lockBtn.textContent = player.locked ? "Unlock" : "Lock";
    lockBtn.className = player.locked ? "danger-button" : "success-button";
    lockBtn.disabled = !state.adminMode && player.locked;
    lockBtn.addEventListener("click", () => toggleLock(player.id));

    actions.appendChild(selectBtn);
    actions.appendChild(lockBtn);

    card.appendChild(name);
    card.appendChild(status);
    card.appendChild(createPickLines(player));
    card.appendChild(actions);
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
      }

      if (selectedPlayer && selectedPlayer.locked && state.adminMode) {
        teamBtn.title = "Admin can change locked picks";
      }

      teamBtn.addEventListener("click", () => updatePlayerPick(selectedPlayer.id, pot.id, team));
      card.appendChild(teamBtn);
    });

    potsGrid.appendChild(card);
  });
}

function renderSelectedPlayerCard() {
  const player = getSelectedPlayer();
  selectedPlayerCard.innerHTML = "";

  if (!player) {
    selectedPlayerCard.className = "player-card empty";
    selectedPlayerCard.textContent = "Choose a player to assign teams";
    lockPickBtn.disabled = true;
    unlockPickBtn.disabled = true;
    return;
  }

  selectedPlayerCard.className = "player-card";

  const name = document.createElement("h3");
  name.textContent = player.name;

  const status = document.createElement("p");
  status.textContent = `Status: ${player.locked ? "Locked" : "Open"} - ${getPickCount(player)}/4 picked`;
  status.className = player.locked ? "status-locked" : "status-open";

  selectedPlayerCard.appendChild(name);
  selectedPlayerCard.appendChild(status);
  selectedPlayerCard.appendChild(createPickLines(player, "Not chosen"));

  lockPickBtn.disabled = player.locked || !hasCompletePicks(player);
  unlockPickBtn.disabled = !player.locked || !state.adminMode;
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
  renderSelectedPlayerCard();
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

addPlayerBtn.addEventListener("click", () => {
  openModal("Add players", "Enter one co-worker name per line", (value) => {
    const names = parsePlayerNames(value);
    if (names.length > 0) createPlayers(names);
  });
});

importPlayersBtn.addEventListener("click", () => {
  importPlayersFromFile(true);
});

lockPickBtn.addEventListener("click", () => {
  const player = getSelectedPlayer();
  if (!player) return;

  if (!hasCompletePicks(player)) {
    alert("Choose one team from every pot before locking picks.");
    return;
  }

  player.locked = true;
  saveState();
  render();
});

unlockPickBtn.addEventListener("click", () => {
  const player = getSelectedPlayer();
  if (player && state.adminMode) {
    player.locked = false;
    saveState();
    render();
  }
});

adminModeBtn.addEventListener("click", promptAdmin);

window.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal.classList.add("hidden");
  }
});

async function init() {
  loadState();
  render();
  await loadPlayersFromFileIfEmpty();
}

init();
