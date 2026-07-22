const adminPassword = "1234";
const southAfricaTimeZone = "Africa/Johannesburg";
const MARGIN_TOLERANCE = 5;
const GRAND_SLAM_BONUS = 3;
const REFRESH_INTERVAL_MS = 60000;

let supabaseClient = null;
let session = null;
let currentPlayer = null;
let players = [];
let matches = [];
let predictions = [];
let adminMode = false;
let pendingEmail = "";

const syncStatus = document.getElementById("syncStatus");
const accountStatus = document.getElementById("accountStatus");
const signOutBtn = document.getElementById("signOutBtn");
const adminModeBtn = document.getElementById("adminModeBtn");

const loginPanel = document.getElementById("loginPanel");
const loginEmailStep = document.getElementById("loginEmailStep");
const loginEmail = document.getElementById("loginEmail");
const sendCodeBtn = document.getElementById("sendCodeBtn");
const loginCodeStep = document.getElementById("loginCodeStep");
const loginCodeEmail = document.getElementById("loginCodeEmail");
const loginCode = document.getElementById("loginCode");
const verifyCodeBtn = document.getElementById("verifyCodeBtn");
const changeEmailBtn = document.getElementById("changeEmailBtn");
const loginClaimStep = document.getElementById("loginClaimStep");
const claimPlayerList = document.getElementById("claimPlayerList");
const claimNewName = document.getElementById("claimNewName");
const claimNewNameBtn = document.getElementById("claimNewNameBtn");
const loginMessage = document.getElementById("loginMessage");

const appContent = document.getElementById("appContent");
const progressPill = document.getElementById("progressPill");
const matchesPlayedText = document.getElementById("matchesPlayedText");
const nextMatchText = document.getElementById("nextMatchText");
const liveMatchesText = document.getElementById("liveMatchesText");
const upcomingMatchesText = document.getElementById("upcomingMatchesText");
const matchProgressFill = document.getElementById("matchProgressFill");
const myPicksSummary = document.getElementById("myPicksSummary");
const matchesGroups = document.getElementById("matchesGroups");
const leaderboardSummary = document.getElementById("leaderboardSummary");
const leaderboardList = document.getElementById("leaderboardList");
const adminPanel = document.getElementById("adminPanel");
const adminMatchesGrid = document.getElementById("adminMatchesGrid");
const addPlayerBtn = document.getElementById("addPlayerBtn");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalInput = document.getElementById("modalInput");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const modalSaveBtn = document.getElementById("modalSaveBtn");
const togglePanelBtns = document.querySelectorAll(".toggle-panel-btn");

function setSyncStatus(text, status = "") {
  syncStatus.textContent = text;
  syncStatus.className = `sync-status ${status}`.trim();
}

function setLoginMessage(text, isError = false) {
  loginMessage.textContent = text;
  loginMessage.className = `login-message ${isError ? "error" : ""}`.trim();
}

function showLoginStep(step) {
  [loginEmailStep, loginCodeStep, loginClaimStep].forEach((el) => el.classList.add("hidden"));
  step.classList.remove("hidden");
}

function isMatchLocked(match) {
  return new Date(match.kickoff_at).getTime() <= Date.now();
}

function formatKickoff(match) {
  const date = new Date(match.kickoff_at);
  return `${date.toLocaleString("en-ZA", {
    timeZone: southAfricaTimeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} SAST`;
}

// ---------------------------------------------------------------------------
// Supabase init + data loading
// ---------------------------------------------------------------------------

function initSupabase() {
  const config = window.SUPABASE_CONFIG;
  if (!config || !config.url || !config.anonKey || !window.supabase) {
    setSyncStatus("Supabase not configured", "error");
    return false;
  }

  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  setSyncStatus("Connected", "synced");
  return true;
}

async function loadPlayers() {
  const { data, error } = await supabaseClient.from("players").select("*").order("name");
  if (error) {
    setSyncStatus("Supabase error", "error");
    return;
  }
  players = data || [];
}

async function loadMatches() {
  const { data, error } = await supabaseClient.from("matches").select("*").order("sort_order");
  if (error) {
    setSyncStatus("Supabase error", "error");
    return;
  }
  matches = data || [];
}

async function loadPredictions() {
  const { data, error } = await supabaseClient.from("predictions").select("*");
  if (error) {
    setSyncStatus("Supabase error", "error");
    return;
  }
  predictions = data || [];
}

async function loadAllData() {
  await Promise.all([loadPlayers(), loadMatches(), loadPredictions()]);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function sendLoginCode() {
  const email = loginEmail.value.trim().toLowerCase();
  if (!email) return;

  sendCodeBtn.disabled = true;
  setLoginMessage("Sending code...");

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  sendCodeBtn.disabled = false;

  if (error) {
    setLoginMessage(error.message, true);
    return;
  }

  pendingEmail = email;
  loginCodeEmail.textContent = email;
  loginCode.value = "";
  setLoginMessage("");
  showLoginStep(loginCodeStep);
}

async function verifyLoginCode() {
  const token = loginCode.value.trim();
  if (!token) return;

  verifyCodeBtn.disabled = true;
  setLoginMessage("Verifying...");

  const { data, error } = await supabaseClient.auth.verifyOtp({
    email: pendingEmail,
    token,
    type: "email",
  });

  verifyCodeBtn.disabled = false;

  if (error) {
    setLoginMessage(error.message, true);
    return;
  }

  session = data.session;
  setLoginMessage("");
  await afterSignIn();
}

async function afterSignIn() {
  pendingEmail = pendingEmail || session.user.email || "";
  await loadPlayers();

  const linkedPlayer = players.find((player) => player.auth_uid === session.user.id);
  if (linkedPlayer) {
    currentPlayer = linkedPlayer;
    await startApp();
    return;
  }

  renderClaimStep();
  showLoginStep(loginClaimStep);
}

function renderClaimStep() {
  claimPlayerList.innerHTML = "";
  const unclaimed = players.filter((player) => !player.auth_uid);

  if (unclaimed.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No unclaimed names left - type yours below to be added.";
    claimPlayerList.appendChild(empty);
    return;
  }

  unclaimed.forEach((player) => {
    const btn = document.createElement("button");
    btn.className = "claim-player-btn";
    btn.textContent = player.name;
    btn.addEventListener("click", () => claimPlayer(player.id));
    claimPlayerList.appendChild(btn);
  });
}

async function claimPlayer(playerId) {
  const { data, error } = await supabaseClient
    .from("players")
    .update({ auth_uid: session.user.id, email: pendingEmail })
    .eq("id", playerId)
    .is("auth_uid", null)
    .select()
    .single();

  if (error || !data) {
    setLoginMessage("That name was just claimed by someone else - pick another.", true);
    await loadPlayers();
    renderClaimStep();
    return;
  }

  currentPlayer = data;
  await startApp();
}

async function claimNewPlayer() {
  const name = claimNewName.value.trim();
  if (!name) return;

  const { data, error } = await supabaseClient
    .from("players")
    .insert({ name, auth_uid: session.user.id, email: pendingEmail })
    .select()
    .single();

  if (error || !data) {
    setLoginMessage(error ? error.message : "Could not add that name.", true);
    return;
  }

  currentPlayer = data;
  await startApp();
}

async function signOut() {
  await supabaseClient.auth.signOut();
  session = null;
  currentPlayer = null;
  appContent.classList.add("hidden");
  accountStatus.classList.add("hidden");
  signOutBtn.classList.add("hidden");
  loginPanel.classList.remove("hidden");
  loginEmail.value = "";
  showLoginStep(loginEmailStep);
}

async function startApp() {
  loginPanel.classList.add("hidden");
  appContent.classList.remove("hidden");
  accountStatus.textContent = `Signed in as ${currentPlayer.name}`;
  accountStatus.classList.remove("hidden");
  signOutBtn.classList.remove("hidden");

  await loadAllData();
  render();
}

// ---------------------------------------------------------------------------
// Predictions
// ---------------------------------------------------------------------------

function getPrediction(matchId, playerId) {
  return predictions.find((pr) => pr.match_id === matchId && pr.player_id === playerId);
}

async function savePrediction(matchId, homeScore, awayScore, statusEl) {
  if (!currentPlayer) return;

  statusEl.textContent = "Saving...";

  const { data, error } = await supabaseClient
    .from("predictions")
    .upsert(
      {
        match_id: matchId,
        player_id: currentPlayer.id,
        predicted_home_score: homeScore,
        predicted_away_score: awayScore,
      },
      { onConflict: "match_id,player_id" }
    )
    .select()
    .single();

  if (error) {
    statusEl.textContent = "Could not save - match may have kicked off.";
    statusEl.classList.add("error");
    return;
  }

  const existingIndex = predictions.findIndex((pr) => pr.match_id === matchId && pr.player_id === currentPlayer.id);
  if (existingIndex >= 0) predictions[existingIndex] = data;
  else predictions.push(data);

  statusEl.textContent = "Saved";
  statusEl.classList.remove("error");
  renderMyPicksSummary();
  renderLeaderboard();
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function isFinal(match) {
  return match.home_score !== null && match.away_score !== null;
}

function computeLeaderboard() {
  const totals = new Map();
  players.forEach((player) => {
    totals.set(player.id, { player, wp: 0, mp: 0, bp: 0, gsp: 0, points: 0 });
  });

  const finalMatches = matches.filter(isFinal);

  finalMatches.forEach((match) => {
    const actualMargin = match.home_score - match.away_score;
    const matchPredictions = predictions.filter((pr) => pr.match_id === match.id);
    if (matchPredictions.length === 0) return;

    let minDiff = Infinity;
    const withDiff = matchPredictions.map((pr) => {
      const predictedMargin = pr.predicted_home_score - pr.predicted_away_score;
      const diff = Math.abs(predictedMargin - actualMargin);
      minDiff = Math.min(minDiff, diff);
      return { pr, predictedMargin, diff };
    });

    withDiff.forEach(({ pr, predictedMargin, diff }) => {
      const row = totals.get(pr.player_id);
      if (!row) return;

      if (Math.sign(predictedMargin) === Math.sign(actualMargin)) {
        row.wp += 1;
        row.points += 1;
      }
      if (diff <= MARGIN_TOLERANCE) {
        row.mp += 1;
        row.points += 1;
      }
      if (diff === minDiff) {
        row.bp += 1;
        row.points += 1;
      }
    });
  });

  const roundGroups = new Map();
  finalMatches.forEach((match) => {
    if (!roundGroups.has(match.round)) roundGroups.set(match.round, []);
    roundGroups.get(match.round).push(match);
  });

  roundGroups.forEach((roundMatches) => {
    players.forEach((player) => {
      const roundPredictions = roundMatches.map((match) => getPrediction(match.id, player.id));
      if (roundPredictions.some((pr) => !pr)) return;

      const allCorrect = roundPredictions.every((pr, index) => {
        const match = roundMatches[index];
        const actualMargin = match.home_score - match.away_score;
        const predictedMargin = pr.predicted_home_score - pr.predicted_away_score;
        return Math.sign(predictedMargin) === Math.sign(actualMargin);
      });

      if (allCorrect) {
        const row = totals.get(player.id);
        row.gsp += 1;
        row.points += GRAND_SLAM_BONUS;
      }
    });
  });

  return [...totals.values()].sort(
    (a, b) => b.points - a.points || b.wp - a.wp || a.player.name.localeCompare(b.player.name)
  );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderProgress() {
  const total = matches.length;
  const played = matches.filter(isFinal).length;
  const live = matches.filter((match) => match.status === "live" && !isFinal(match)).length;
  const upcoming = Math.max(total - played - live, 0);
  const percent = total ? Math.round((played / total) * 100) : 0;

  matchesPlayedText.textContent = `${played} / ${total} matches played`;
  liveMatchesText.textContent = `${live} live`;
  upcomingMatchesText.textContent = `${upcoming} upcoming`;
  matchProgressFill.style.width = `${percent}%`;
  matchProgressFill.textContent = percent > 8 ? `${percent}%` : "";

  const next = matches
    .filter((match) => !isFinal(match))
    .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))[0];

  nextMatchText.textContent = next
    ? `Next: ${next.home_team} vs ${next.away_team} - ${formatKickoff(next)}`
    : played === total
    ? "Tournament complete."
    : "No upcoming fixture found.";

  progressPill.textContent = live > 0 ? "Live now" : "On track";
  progressPill.className = `panel-pill ${live > 0 ? "saving" : "synced"}`;
}

function renderMyPicksSummary() {
  const predicted = matches.filter((match) => getPrediction(match.id, currentPlayer.id)).length;
  myPicksSummary.textContent = `${predicted} / ${matches.length} predicted`;
}

function renderMatchesGroups() {
  matchesGroups.innerHTML = "";

  const groups = [];
  matches.forEach((match) => {
    let group = groups.find((g) => g.round === match.round);
    if (!group) {
      group = { round: match.round, matches: [] };
      groups.push(group);
    }
    group.matches.push(match);
  });

  groups.forEach((group) => {
    const section = document.createElement("div");
    section.className = "match-round";

    const heading = document.createElement("h3");
    const decided = group.matches.filter(isFinal).length;
    heading.textContent = `${group.round} (${decided}/${group.matches.length} played)`;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "match-cards";

    group.matches.forEach((match) => grid.appendChild(renderMatchCard(match)));
    section.appendChild(grid);
    matchesGroups.appendChild(section);
  });
}

function renderMatchCard(match) {
  const card = document.createElement("div");
  card.className = "match-card";

  const locked = isMatchLocked(match);
  const final = isFinal(match);
  if (locked) card.classList.add("locked");

  const teams = document.createElement("div");
  teams.className = "match-teams";
  teams.textContent = `${match.home_team} vs ${match.away_team}`;
  card.appendChild(teams);

  const meta = document.createElement("div");
  meta.className = "match-meta";
  meta.textContent = `${match.venue || "Venue TBC"} - ${formatKickoff(match)}`;
  card.appendChild(meta);

  if (final) {
    const score = document.createElement("div");
    score.className = "match-final-score";
    score.textContent = `Final score: ${match.home_score} - ${match.away_score}`;
    card.appendChild(score);
  }

  const own = getPrediction(match.id, currentPlayer.id);

  const form = document.createElement("div");
  form.className = "prediction-form";

  const homeInput = document.createElement("input");
  homeInput.type = "number";
  homeInput.min = "0";
  homeInput.placeholder = match.home_team;
  homeInput.value = own ? own.predicted_home_score : "";

  const sep = document.createElement("span");
  sep.textContent = "-";

  const awayInput = document.createElement("input");
  awayInput.type = "number";
  awayInput.min = "0";
  awayInput.placeholder = match.away_team;
  awayInput.value = own ? own.predicted_away_score : "";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = own ? "Update" : "Predict";

  const statusEl = document.createElement("span");
  statusEl.className = "prediction-status";

  const canEdit = !locked;
  homeInput.disabled = !canEdit;
  awayInput.disabled = !canEdit;
  saveBtn.disabled = !canEdit;

  saveBtn.addEventListener("click", () => {
    const homeScore = Number(homeInput.value);
    const awayScore = Number(awayInput.value);
    if (homeInput.value === "" || awayInput.value === "" || Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
      statusEl.textContent = "Enter both scores.";
      statusEl.classList.add("error");
      return;
    }
    savePrediction(match.id, homeScore, awayScore, statusEl);
  });

  form.appendChild(homeInput);
  form.appendChild(sep);
  form.appendChild(awayInput);
  form.appendChild(saveBtn);
  form.appendChild(statusEl);
  card.appendChild(form);

  if (!canEdit && !own) {
    const missed = document.createElement("p");
    missed.className = "hint";
    missed.textContent = "Kicked off - no prediction was submitted.";
    card.appendChild(missed);
  }

  if (locked) {
    const others = predictions.filter((pr) => pr.match_id === match.id && pr.player_id !== currentPlayer.id);
    if (others.length > 0) {
      const picks = document.createElement("div");
      picks.className = "match-picks-reveal";
      picks.textContent = others
        .map((pr) => {
          const player = players.find((p) => p.id === pr.player_id);
          return `${player ? player.name : "Player"}: ${pr.predicted_home_score}-${pr.predicted_away_score}`;
        })
        .join(" · ");
      card.appendChild(picks);
    }
  }

  return card;
}

function renderLeaderboard() {
  leaderboardList.innerHTML = "";

  const decidedCount = matches.filter(isFinal).length;
  leaderboardSummary.textContent = `${decidedCount} match${decidedCount === 1 ? "" : "es"} decided`;

  if (players.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No players yet.";
    leaderboardList.appendChild(empty);
    return;
  }

  const rows = computeLeaderboard();

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
    subtext.textContent = `${row.wp} WP · ${row.mp} MP · ${row.bp} BP${row.gsp ? ` · ${row.gsp} Grand Slam` : ""}`;

    const score = document.createElement("div");
    score.className = "leaderboard-score";
    score.textContent = `${row.points} pts`;

    details.appendChild(name);
    details.appendChild(subtext);
    item.appendChild(rank);
    item.appendChild(details);
    item.appendChild(score);
    leaderboardList.appendChild(item);
  });
}

function renderAdminMatches() {
  adminMatchesGrid.innerHTML = "";

  matches.forEach((match) => {
    const row = document.createElement("div");
    row.className = "admin-match-row";

    const homeTeamInput = document.createElement("input");
    homeTeamInput.value = match.home_team;
    homeTeamInput.className = "admin-team-input";

    const awayTeamInput = document.createElement("input");
    awayTeamInput.value = match.away_team;
    awayTeamInput.className = "admin-team-input";

    const homeScoreInput = document.createElement("input");
    homeScoreInput.type = "number";
    homeScoreInput.min = "0";
    homeScoreInput.className = "admin-score-input";
    homeScoreInput.value = match.home_score ?? "";

    const awayScoreInput = document.createElement("input");
    awayScoreInput.type = "number";
    awayScoreInput.min = "0";
    awayScoreInput.className = "admin-score-input";
    awayScoreInput.value = match.away_score ?? "";

    const statusSelect = document.createElement("select");
    ["upcoming", "live", "final"].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = match.status === value;
      statusSelect.appendChild(option);
    });

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    const statusEl = document.createElement("span");
    statusEl.className = "prediction-status";

    saveBtn.addEventListener("click", () =>
      saveMatchUpdate(
        match.id,
        {
          home_team: homeTeamInput.value.trim(),
          away_team: awayTeamInput.value.trim(),
          home_score: homeScoreInput.value === "" ? null : Number(homeScoreInput.value),
          away_score: awayScoreInput.value === "" ? null : Number(awayScoreInput.value),
          status: statusSelect.value,
        },
        statusEl
      )
    );

    const label = document.createElement("div");
    label.className = "admin-match-label";
    label.textContent = `#${match.sort_order} ${match.round}`;

    row.appendChild(label);
    row.appendChild(homeTeamInput);
    row.appendChild(homeScoreInput);
    row.appendChild(awayScoreInput);
    row.appendChild(awayTeamInput);
    row.appendChild(statusSelect);
    row.appendChild(saveBtn);
    row.appendChild(statusEl);
    adminMatchesGrid.appendChild(row);
  });
}

async function saveMatchUpdate(matchId, updates, statusEl) {
  statusEl.textContent = "Saving...";

  const { data, error } = await supabaseClient.from("matches").update(updates).eq("id", matchId).select().single();

  if (error) {
    statusEl.textContent = "Save failed.";
    statusEl.classList.add("error");
    return;
  }

  const index = matches.findIndex((match) => match.id === matchId);
  if (index >= 0) matches[index] = data;

  statusEl.textContent = "Saved";
  statusEl.classList.remove("error");
  render();
}

function render() {
  renderProgress();
  renderMyPicksSummary();
  renderMatchesGroups();
  renderLeaderboard();

  adminModeBtn.textContent = adminMode ? "Admin mode: ON" : "Admin mode";
  adminModeBtn.classList.toggle("admin-on", adminMode);
  adminPanel.classList.toggle("hidden", !adminMode);
  if (adminMode) renderAdminMatches();
}

// ---------------------------------------------------------------------------
// Admin gate + add player modal
// ---------------------------------------------------------------------------

function promptAdmin() {
  if (adminMode) {
    adminMode = false;
    render();
    return;
  }

  const password = prompt("Enter admin password to enable admin mode:");
  if (password === adminPassword) {
    adminMode = true;
    render();
  } else if (password !== null) {
    alert("Incorrect password.");
  }
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

async function addPlayerAsAdmin(name) {
  const { error } = await supabaseClient.from("players").insert({ name });
  if (error) {
    alert(`Could not add player: ${error.message}`);
    return;
  }
  await loadPlayers();
  render();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

sendCodeBtn.addEventListener("click", sendLoginCode);
loginEmail.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendLoginCode();
});

verifyCodeBtn.addEventListener("click", verifyLoginCode);
loginCode.addEventListener("keydown", (event) => {
  if (event.key === "Enter") verifyLoginCode();
});

changeEmailBtn.addEventListener("click", () => {
  setLoginMessage("");
  showLoginStep(loginEmailStep);
});

claimNewNameBtn.addEventListener("click", claimNewPlayer);
signOutBtn.addEventListener("click", signOut);
adminModeBtn.addEventListener("click", promptAdmin);

addPlayerBtn.addEventListener("click", () => {
  openModal("Add Player", "Enter the player's name", (name) => addPlayerAsAdmin(name));
});

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
  if (!initSupabase()) return;

  const { data } = await supabaseClient.auth.getSession();
  session = data.session;

  if (session) {
    await afterSignIn();
  }

  setInterval(async () => {
    if (!currentPlayer) return;
    await Promise.all([loadMatches(), loadPredictions()]);
    render();
  }, REFRESH_INTERVAL_MS);
}

init();
