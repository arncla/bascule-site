// Page du jour : les 3 dilemmes du jour (heure de Paris), le vote, le résultat mondial, le partage.
// Contenu : content/days/AAAA-MM-JJ.json, publié chaque jour par content/scripts/build_site.py (aujourd'hui et
// demain seulement, jamais le calendrier complet).
import { SITE_URL } from "./config.js";
import * as votes from "./vote.js";

const LANG = document.documentElement.lang === "fr" ? "fr" : "en";
const NNBSP = " ";

const duration = (h, m, sp) => [h > 0 ? `${h}${sp}h` : "", m > 0 || h === 0 ? `${m}${sp}min` : ""].filter(Boolean).join(" ");

const T = {
  fr: {
    kind: { moral: "Moral", vie: "Vie", leger: "Léger" },
    toVote: "À voter",
    voted: "Voté",
    ask: "Que fais-tu ?",
    hintArgs: "Les arguments des deux camps s'affichent après ton vote.",
    hintLight: "Pas d'arguments ici, juste ton instinct.",
    counting: "On compte le monde…",
    youChose: (l) => `Tu as choisi ${l}`,
    majority: "Tu es avec la majorité.",
    minority: "Tu es dans la minorité.",
    alreadyVoted: "Tu avais déjà voté sur ce dilemme depuis ce navigateur.",
    worldVoted: "Le monde a voté",
    forSide: (l) => `Pour ${l}`,
    philo: "Ce qu'en diraient les écoles",
    share: "Partager",
    copied: "Texte copié",
    shareText: (title, option, pct) => `${title} : j'ai choisi « ${option} », comme ${pct}${NNBSP}% du monde. Et toi ?`,
    splitLabel: (a, b) => `Option A ${a} pour cent, option B ${b} pour cent.`,
    voteError: "Vote impossible pour l'instant. Vérifie ta connexion et réessaie.",
    resultError: "Résultat indisponible pour l'instant. Ton vote est bien enregistré.",
    voteClosed: "Le vote en ligne n'est pas encore ouvert. Reviens bientôt.",
    empty: "Les dilemmes du jour arrivent. Recharge la page dans un instant.",
    loadError: "Impossible de charger les dilemmes du jour. Vérifie ta connexion et recharge la page.",
    next: (h, m) => `Trois nouveaux dilemmes à minuit, heure de Paris, dans ${duration(h, m, NNBSP)}.`,
  },
  en: {
    kind: { moral: "Moral", vie: "Life", leger: "Light" },
    toVote: "Not voted",
    voted: "Voted",
    ask: "What do you do?",
    hintArgs: "Both sides' arguments appear after you vote.",
    hintLight: "No arguments here, just your gut.",
    counting: "Counting the world…",
    youChose: (l) => `You chose ${l}`,
    majority: "You are with the majority.",
    minority: "You are in the minority.",
    alreadyVoted: "You had already voted on this dilemma from this browser.",
    worldVoted: "The world has voted",
    forSide: (l) => `For ${l}`,
    philo: "What the schools would say",
    share: "Share",
    copied: "Text copied",
    shareText: (title, option, pct) => `${title}: I chose “${option}”, like ${pct}% of the world. What about you?`,
    splitLabel: (a, b) => `Option A ${a} percent, option B ${b} percent.`,
    voteError: "Couldn't send your vote. Check your connection and try again.",
    resultError: "Result unavailable right now. Your vote is saved.",
    voteClosed: "Online voting isn't open yet. Come back soon.",
    empty: "Today's dilemmas are on their way. Reload the page in a moment.",
    loadError: "Couldn't load today's dilemmas. Check your connection and reload the page.",
    next: (h, m) => `Three new dilemmas at midnight Paris time, in ${duration(h, m, " ")}.`,
  },
}[LANG];

// ---------- Jour de Paris ----------

const parisParts = (date) => Object.fromEntries(
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((p) => [p.type, p.value]),
);

function dayKey(date = new Date()) {
  // Aperçu local seulement : ?date=AAAA-MM-JJ.
  const forced = new URLSearchParams(location.search).get("date");
  if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced) && ["localhost", "127.0.0.1"].includes(location.hostname)) {
    return forced;
  }
  const p = parisParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function displayDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  const text = new Intl.DateTimeFormat(LANG === "fr" ? "fr-FR" : "en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function minutesToParisMidnight() {
  const p = parisParts(new Date());
  const elapsed = Number(p.hour) * 60 + Number(p.minute);
  return Math.max(1, 24 * 60 - elapsed);
}

// ---------- Mémoire locale des votes ----------

const STORE_KEY = "bascule.votes.v1";

function readVotes() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveVote(id, entry) {
  const all = readVotes();
  all[id] = { ...all[id], ...entry };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    // Navigation privée stricte : le vote reste valable côté serveur, seul l'affichage est oublié.
  }
}

// ---------- Rendu ----------

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c) node.append(c);
  return node;
};

function percents(result) {
  const total = result.a + result.b;
  const a = total > 0 ? Math.round((result.a / total) * 100) : 50;
  return { a, b: 100 - a };
}

function renderDilemma(d) {
  const text = d[LANG];
  const isLight = d.kind === "leger";
  const headingId = `t-${d.id}`;

  const state = el("span", { class: "state", text: T.toVote });
  const notice = el("p", { class: "notice", role: "status" });
  const result = el("div", { class: "result", hidden: true, tabindex: "-1" });

  const options = ["a", "b"].map((c) => el("button", {
    type: "button",
    class: `option option--${c}`,
    "aria-describedby": headingId,
    onclick: () => castVote(d, c, { buttons: options, state, notice, result, chooser }),
  }, el("span", { class: "badge", "aria-hidden": "true", text: c.toUpperCase() }), el("span", { text: text[c] })));

  const chooser = el("div", { class: "chooser" },
    el("p", { class: "ask", text: T.ask }),
    el("div", { class: "options" }, options),
    el("p", { class: "hint", text: isLight ? T.hintLight : T.hintArgs }),
  );

  const article = el("article", { class: "dilemma", id: d.kind, "aria-labelledby": headingId },
    el("div", { class: "meta" },
      el("span", { class: "kind" }, el("span", { class: "cut", "aria-hidden": "true" }), T.kind[d.kind]),
      state),
    el("h2", { id: headingId, text: text.title }),
    el("p", { class: "scenario", text: text.scenario }),
    chooser,
    notice,
    result,
  );

  const ui = { buttons: options, state, notice, result, chooser };
  const saved = readVotes()[d.id];
  if (saved) {
    showResult(d, ui, saved.choice ?? null, saved.result ?? null, { animate: false });
    refreshResult(d, ui, saved.choice ?? null);
  }
  return article;
}

function setBusy(ui, busy) {
  for (const b of ui.buttons) b.disabled = busy;
}

async function castVote(d, choice, ui) {
  if (!votes.isOpen()) {
    ui.notice.textContent = T.voteClosed;
    return;
  }
  setBusy(ui, true);
  ui.buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(["a", "b"][i] === choice)));
  ui.notice.textContent = T.counting;
  try {
    const result = await votes.submit(d.id, choice);
    saveVote(d.id, { choice, result, ts: Date.now() });
    ui.notice.textContent = "";
    showResult(d, ui, choice, result, { animate: true, focus: true });
  } catch (error) {
    if (error instanceof votes.AlreadyVoted) {
      saveVote(d.id, { choice: null, ts: Date.now() });
      ui.notice.textContent = T.alreadyVoted;
      showResult(d, ui, null, null, { animate: false, focus: true });
      refreshResult(d, ui, null);
      return;
    }
    console.error(error);
    ui.buttons.forEach((b) => b.removeAttribute("aria-pressed"));
    setBusy(ui, false);
    ui.notice.textContent = T.voteError;
  }
}

async function refreshResult(d, ui, choice) {
  try {
    const result = await votes.fetchResult(d.id);
    saveVote(d.id, { result });
    showResult(d, ui, choice, result, { animate: false });
  } catch (error) {
    console.error(error);
    if (!readVotes()[d.id]?.result) ui.notice.textContent = T.resultError;
  }
}

function showResult(d, ui, choice, result, { animate, focus = false }) {
  const text = d[LANG];
  const pct = result ? percents(result) : null;
  ui.chooser.hidden = true;
  ui.state.textContent = T.voted;

  const split = el("div", { class: "split", role: "img" },
    el("div", { class: "pct pct--a" },
      el("span", { class: "num", text: pct ? `${pct.a}${NNBSP}%` : "–" }),
      el("span", { class: "lbl", text: "A" })),
    el("div", { class: "pct pct--b" },
      el("span", { class: "lbl", text: "B" }),
      el("span", { class: "num", text: pct ? `${pct.b}${NNBSP}%` : "–" })),
  );
  if (pct) split.setAttribute("aria-label", T.splitLabel(pct.a, pct.b));
  else split.setAttribute("aria-label", T.counting);
  const target = pct ? pct.a : 50;
  if (target === 0) split.dataset.edge = "none";
  if (target === 100) split.dataset.edge = "all";
  split.style.setProperty("--a", animate ? "50" : String(target));
  if (animate) requestAnimationFrame(() => requestAnimationFrame(() => split.style.setProperty("--a", String(target))));

  const legend = el("ul", { class: "legend" }, ["a", "b"].map((c) => el("li", {},
    el("span", { class: `dot dot--${c}`, "aria-hidden": "true" }),
    el("span", { text: `${c.toUpperCase()} · ${text[c]}` }))));
  const nodes = [el("p", { class: "visually-hidden", text: T.worldVoted }), split, legend];

  if (choice) {
    const verdict = el("p", { class: "verdict" }, el("strong", { text: T.youChose(choice.toUpperCase()) }));
    if (pct) verdict.append(el("span", { text: pct[choice] >= 50 ? T.majority : T.minority }));
    nodes.push(verdict);
  }

  if (d.kind !== "leger" && text.argsA?.length) {
    nodes.push(el("div", { class: "args" },
      ["a", "b"].map((c) => el("section", { class: "side" },
        el("h3", {}, el("span", { class: `dot dot--${c}`, "aria-hidden": "true" }), T.forSide(c.toUpperCase())),
        el("ul", {}, (c === "a" ? text.argsA : text.argsB).map((arg) => el("li", { text: arg }))))),
    ));
  }
  if (text.philo) {
    nodes.push(el("p", { class: "philo" }, el("strong", { text: `${T.philo}${LANG === "fr" ? NNBSP : ""}: ` }), text.philo));
  }

  if (choice && pct) {
    const shareButton = el("button", { type: "button", class: "button", text: T.share });
    shareButton.addEventListener("click", () => share(text.title, text[choice], pct[choice], shareButton));
    nodes.push(el("div", { class: "actions" }, shareButton));
  }

  ui.result.replaceChildren(...nodes);
  ui.result.hidden = false;
  if (focus) ui.result.focus({ preventScroll: false });
}

async function share(title, option, pct, button) {
  const text = T.shareText(title, option, pct);
  if (navigator.share) {
    try {
      await navigator.share({ title: "Bascule", text, url: SITE_URL });
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${SITE_URL}`);
    const label = button.textContent;
    button.textContent = T.copied;
    setTimeout(() => { button.textContent = label; }, 2000);
  } catch {
    // Pas de presse papiers disponible : rien à faire de plus.
  }
}

// ---------- Chargement ----------

const list = document.getElementById("today");
const dateNode = document.getElementById("today-date");
const nextNode = document.getElementById("next");
let currentKey = null;

function message(text) {
  list.replaceChildren(el("div", { class: "empty" }, el("p", { text })));
}

async function load() {
  currentKey = dayKey();
  dateNode.textContent = displayDate(currentKey);
  let day;
  try {
    const response = await fetch(new URL(`../content/days/${currentKey}.json`, location.href), { cache: "no-cache" });
    if (response.status === 404) return message(T.empty);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    day = await response.json();
  } catch (error) {
    console.error(error);
    return message(T.loadError);
  }
  const order = ["moral", "vie", "leger"];
  const items = (day.dilemmas || []).filter((d) => order.includes(d.kind) && d[LANG])
    .sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));
  if (!items.length) return message(T.empty);
  list.replaceChildren(...items.map(renderDilemma));
}

function tick() {
  const left = minutesToParisMidnight();
  nextNode.textContent = T.next(Math.floor(left / 60), left % 60);
  if (currentKey && dayKey() !== currentKey) load();
}

load();
tick();
setInterval(tick, 30_000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
