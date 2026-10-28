const $ = (id) => document.getElementById(id);
const tokenKey = (id) => `rpg-arena.token.${id}`;
const params = new URLSearchParams(location.search);

let catalog = null;
let run = null;
let token = null;
let connection = null;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(token ? { "X-Run-Token": token } : {}) };
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const problem = await response.json();
      message = Object.values(problem.errors ?? {}).flat().join(" ") || problem.detail || problem.title || message;
    } catch {
      /* keep the generic message */
    }
    throw new Error(response.status === 429 ? "Slow down a little and try again." : message);
  }
  return response.json();
}

function showError(id, error) {
  $(id).textContent = error ? error.message ?? String(error) : "";
  $(id).hidden = !error;
}

function renderChoices() {
  const classes = $("classes");
  catalog.classes.forEach((c, i) =>
    classes.append(
      el("label", { className: "choice" },
        el("input", { type: "radio", name: "class", value: c.class, checked: i === 0, required: true }),
        el("span", {}, el("strong", { textContent: c.class }), el("small", { textContent: ` ${c.description} Special: ${c.special}, ${c.specialDescription.toLowerCase()}` })))));

  const weapons = $("weapons");
  catalog.weapons.forEach((w, i) =>
    weapons.append(
      el("label", { className: "choice" },
        el("input", { type: "radio", name: "weapon", value: w.weapon, checked: i === 0, required: true }),
        el("span", {}, el("strong", { textContent: w.weapon }), el("small", { textContent: ` ${w.description}` })))));
}

function render() {
  const { hero, enemy } = run;
  $("setup").hidden = true;
  $("battle").hidden = false;

  $("hero-title").textContent = hero.name;
  $("hero-sub").textContent = `Level ${hero.level} ${hero.class}`;
  $("hero-hp").style.width = `${(100 * hero.hp) / hero.maxHp}%`;
  $("hero-stats").textContent = `HP ${hero.hp}/${hero.maxHp} · XP ${hero.xp}/${hero.level * 100} · ${hero.gold} gold · ${hero.potions} potion(s) · ${run.wins} win(s)`;

  $("enemy-title").textContent = enemy.name;
  $("enemy-hp").style.width = `${(100 * enemy.hp) / enemy.maxHp}%`;
  $("enemy-stats").textContent = `HP ${enemy.hp}/${enemy.maxHp} · attack ${enemy.attack} · defense ${enemy.defense}`;

  const special = catalog.classes.find((c) => c.class === hero.class).special;
  $("special-btn").textContent = hero.specialCooldown > 0 ? `${special} (${hero.specialCooldown})` : special;
  $("special-btn").disabled = hero.specialCooldown > 0;
  $("potion-btn").textContent = `Potion (${hero.potions})`;
  $("potion-btn").disabled = hero.potions === 0 || hero.hp === hero.maxHp;

  const mine = Boolean(token);
  const fighting = run.status === "InBattle";
  $("controls").hidden = !mine || !fighting;
  $("after").hidden = !mine || fighting;
  $("spectating").hidden = mine;
  $("next-btn").hidden = run.status !== "Victory";
  $("outcome").textContent = run.status === "Victory" ? `Victory! ${hero.name} stands over the ${enemy.name}.` : run.status === "Defeated" ? `${hero.name} has fallen after ${run.wins} win(s).` : "";

  const log = $("log");
  log.replaceChildren(...run.log.slice(-20).map((line) => el("li", { textContent: line })));
  log.scrollTop = log.scrollHeight;

  const watch = `${location.origin}${location.pathname}?watch=${run.id}`;
  $("watch-link").href = watch;
  $("watch-link").textContent = watch;
}

async function watch(id) {
  if (connection) await connection.stop();
  connection = new signalR.HubConnectionBuilder().withUrl("hubs/battle").withAutomaticReconnect().build();
  connection.on("state", (state) => {
    if (!run || state.id !== run.id || state.updatedAt < run.updatedAt) return;
    run = state;
    render();
    loadLeaderboard();
  });
  connection.onreconnecting(() => ($("spectating").textContent = "Reconnecting…"));
  connection.onreconnected(async () => {
    await connection.invoke("Watch", id);
    $("spectating").textContent = "You're watching this battle live.";
  });
  await connection.start();
  await connection.invoke("Watch", id);
  $("spectating").textContent = "You're watching this battle live.";
}

async function open(id) {
  token = localStorage.getItem(tokenKey(id));
  run = await api(`api/runs/${id}`);
  render();
  watch(id).catch(() => ($("spectating").textContent = "Live updates aren't available. Reload to see the latest turn."));
}

async function loadLeaderboard() {
  const rows = await api("api/leaderboard?top=10");
  const body = $("leaderboard");
  if (rows.length === 0) {
    body.replaceChildren(el("tr", {}, el("td", { colSpan: 7, className: "muted", textContent: "No heroes yet. Be the first." })));
    return;
  }
  body.replaceChildren(
    ...rows.map((r, i) =>
      el("tr", {},
        el("td", { textContent: i + 1 }),
        el("td", {}, el("a", { href: `?watch=${r.id}`, textContent: r.heroName })),
        el("td", { textContent: r.heroClass }),
        el("td", { className: "num", textContent: r.level }),
        el("td", { className: "num", textContent: r.wins }),
        el("td", { className: "num", textContent: r.gold }),
        el("td", { className: "muted small", textContent: r.status === "Defeated" ? "fallen" : "fighting" }))));
}

$("start-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("start-error", null);
  const form = new FormData(event.target);
  try {
    const started = await api("api/runs", {
      method: "POST",
      body: JSON.stringify({ heroName: $("hero-name").value.trim(), heroClass: form.get("class"), weapon: form.get("weapon") }),
    });
    localStorage.setItem(tokenKey(started.run.id), started.token);
    history.replaceState(null, "", `?run=${started.run.id}`);
    token = started.token;
    run = started.run;
    render();
    watch(run.id).catch(() => {});
    loadLeaderboard();
  } catch (error) {
    showError("start-error", error);
  }
});

$("controls").addEventListener("click", async (event) => {
  const action = event.target.dataset?.action;
  if (!action) return;
  showError("action-error", null);
  for (const b of $("controls").querySelectorAll("button")) b.disabled = true;
  try {
    run = await api(`api/runs/${run.id}/actions`, { method: "POST", body: JSON.stringify({ action }) });
  } catch (error) {
    showError("action-error", error);
  }
  for (const b of $("controls").querySelectorAll("button")) b.disabled = false;
  render();
  if (run.status !== "InBattle") loadLeaderboard();
});

$("next-btn").addEventListener("click", async () => {
  showError("action-error", null);
  try {
    run = await api(`api/runs/${run.id}/next`, { method: "POST" });
    render();
  } catch (error) {
    showError("action-error", error);
  }
});

$("new-btn").addEventListener("click", () => {
  location.href = location.pathname;
});

(async function init() {
  catalog = await api("api/catalog");
  renderChoices();
  loadLeaderboard();
  const id = params.get("run") ?? params.get("watch");
  if (id) {
    try {
      await open(id);
      return;
    } catch (error) {
      showError("start-error", new Error("That battle doesn't exist. Start a new hero."));
    }
  }
  $("setup").hidden = false;
})();
