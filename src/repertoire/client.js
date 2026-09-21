// Browser code for the skills page. The build inlines search.js and then this
// file into one <script type="module">, so `search` is in scope here without an
// import. Every piece of skill text reaches the DOM through textContent only.

const data = JSON.parse(document.getElementById("repertoire-data").textContent);
const skills = data.skills;
const unreadable = data.unreadable;
const total = data.counts.total;
const COULDNT_READ = "Couldn't read";

const $ = (id) => document.getElementById(id);
const input = $("search-input");
const listbox = $("result-listbox");
const moreButton = $("more-matches");
const noResults = $("no-results");
const noResultsWeak = $("no-results-weak");

const MODE_LABEL = { auto: "auto", "typed-only": "typed only", "claude-only": "Claude only" };
const SOURCE_LABEL = { own: "mine", pulled: "pulled", plugin: "plugin", desktop: "desktop" };

let showWeak = false;
let activeName = null;
// Filters: source is "all" | "own" | "pulled" (plugin and desktop count as pulled in); category and lane are null for all.
let sourceFilter = "all";
let categoryFilter = null;
let laneFilter = null;

const isOwn = (skill) => skill.source === "own";
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const laneStages = (name) => data.lanes.find((lane) => lane.name === name)?.stages ?? [];
const passesFilters = (skill) =>
  (sourceFilter === "all" || (sourceFilter === "own") === isOwn(skill)) &&
  (categoryFilter === null || skill.category === categoryFilter) &&
  (laneFilter === null || laneStages(laneFilter).includes(skill.name));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function row(skill) {
  const button = el("button", "r");
  button.type = "button";
  button.id = `row-${skill.name}`;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", "false");
  button.dataset.name = skill.name;
  const source = el("span", `src ${skill.source}`, SOURCE_LABEL[skill.source]);
  if (skill.origin) source.title = skill.origin;
  button.append(
    el("span", "nm", `/${skill.name}`),
    source,
    el("span", "desc", skill.description),
    el("span", `m ${skill.mode}`, MODE_LABEL[skill.mode]),
  );
  button.addEventListener("click", () => {
    setActive(skill.name);
    openSkill(skill.name);
  });
  return button;
}

function unreadableRow(entry) {
  const button = el("button", "r");
  button.type = "button";
  button.id = `row-${entry.name}`;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", "false");
  button.dataset.name = entry.name;
  button.append(el("span", "nm", `/${entry.name}`), el("span", ""), el("span", "desc", entry.path), el("span", "m", "unreadable"));
  button.addEventListener("click", () => {
    setActive(entry.name);
    openSkill(entry.name);
  });
  return button;
}

function catalogGroup(category, list) {
  const own = list.filter(isOwn).length;
  return group(`group-${slug(category)}`, category, list, `${list.length} · ${own} mine · ${list.length - own} pulled in`);
}

function group(id, title, list, count = String(list.length), makeRow = row) {
  const wrap = el("div", "grp");
  wrap.id = id;
  wrap.setAttribute("role", "group");
  const header = el("div", "gh");
  header.id = `${id}-label`;
  header.append(el("span", "", title), el("small", "", count));
  wrap.setAttribute("aria-labelledby", header.id);
  wrap.append(header, ...list.map(makeRow));
  return wrap;
}

function render() {
  const query = input.value.trim();
  listbox.replaceChildren();
  noResultsWeak.replaceChildren();
  moreButton.hidden = true;
  noResults.hidden = true;
  noResultsWeak.hidden = true;
  listbox.hidden = false;

  const visible = skills.filter(passesFilters);
  let shown;
  if (!query && laneFilter !== null) {
    // A lane: its installed stages in lane order.
    const list = laneStages(laneFilter).map((name) => visible.find((s) => s.name === name)).filter(Boolean);
    if (list.length) listbox.append(group("group-lane", `Lane: ${laneFilter}`, list));
    shown = list.length;
  } else if (!query) {
    // The catalog: every skill by category, in the collector's order.
    shown = 0;
    for (const category of data.categories) {
      const list = visible.filter((s) => s.category === category);
      if (list.length) listbox.append(catalogGroup(category, list));
      shown += list.length;
    }
    // Unreadable skills have no source or category, so any filter hides them.
    if (unreadable.length && sourceFilter === "all" && categoryFilter === null && laneFilter === null) {
      listbox.append(group("group-couldnt-read", COULDNT_READ, unreadable, String(unreadable.length), unreadableRow));
      shown += unreadable.length;
    }
  } else {
    const { nameMatches, intentMatches, weak } = search(query, visible);
    shown = nameMatches.length + intentMatches.length;
    if (shown > 0) {
      if (nameMatches.length) listbox.append(group("results-name-group", "Name matches", nameMatches));
      if (intentMatches.length) listbox.append(group("results-intent-group", "Matches what it does", intentMatches));
      if (weak.length && showWeak) listbox.append(group("results-weak-group", "Weaker matches", weak));
      if (weak.length && !showWeak) {
        moreButton.textContent = `Show ${weak.length} weaker ${weak.length === 1 ? "match" : "matches"}`;
        moreButton.hidden = false;
      }
    } else {
      listbox.hidden = true;
      noResults.hidden = false;
      $("no-results-message").textContent = `No skill matches '${query}'`;
      if (weak.length) {
        noResultsWeak.append(group("no-results-weak-group", "Weak matches", weak));
        noResultsWeak.hidden = false;
      }
    }
  }
  $("filter-status-text").textContent = query ? `Showing ${shown} of ${total} · "${query}"` : `Showing ${shown} of ${total}`;
  const sourceName = { all: "All", own: "Mine", pulled: "Pulled in" }[sourceFilter];
  $("filter-status-detail").textContent =
    `Source: ${sourceName} · Category: ${categoryFilter ?? "All"}` + (laneFilter === null ? "" : ` · Lane: ${laneFilter}`);
  for (const button of document.querySelectorAll("#source-filter button")) {
    button.setAttribute("aria-pressed", String(button.dataset.source === sourceFilter));
  }
  for (const button of document.querySelectorAll("#category-list button")) {
    button.setAttribute("aria-pressed", String(laneFilter === null && (button.dataset.category ?? null) === categoryFilter));
  }
  for (const button of document.querySelectorAll("#lane-list button")) {
    button.setAttribute("aria-pressed", String(button.dataset.lane === laneFilter));
  }
  setActive(rows().some((r) => r.dataset.name === activeName) ? activeName : null);
}

function rows() {
  return [...document.querySelectorAll("#result-list .r")];
}

function setActive(name) {
  activeName = name;
  let activeRow = null;
  for (const r of rows()) {
    const on = r.dataset.name === name;
    r.setAttribute("aria-selected", String(on));
    if (on) activeRow = r;
  }
  for (const box of [listbox, noResultsWeak, input]) box.removeAttribute("aria-activedescendant");
  if (activeRow) {
    activeRow.closest("[role=listbox]").setAttribute("aria-activedescendant", activeRow.id);
    input.setAttribute("aria-activedescendant", activeRow.id);
    activeRow.scrollIntoView({ block: "nearest" });
  }
}

function move(step) {
  const list = rows();
  if (!list.length) return;
  const index = list.findIndex((r) => r.dataset.name === activeName);
  const next = index === -1 ? (step > 0 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, index + step));
  setActive(list[next].dataset.name);
}

const PANE_PARTS = ["usage-line", "detail-tabs", "trigger-phrases", "confused-with", "compare-panel", "handoff-strip"];
const MAX_COMPARE = 3;
let openName = null;
let compared = [];

function openSkill(name) {
  const skill = skills.find((s) => s.name === name);
  const broken = skill ? null : unreadable.find((u) => u.name === name);
  if (!skill && !broken) return;
  openName = name;
  compared = [];
  $("detail-empty").hidden = true;
  $("detail-header").hidden = false;
  $("detail-source").hidden = !skill;
  $("mode-badge").hidden = !skill;
  for (const id of PANE_PARTS) $(id).hidden = !skill;
  selectTab("overview");
  if (broken) {
    $("detail-crumb").textContent = `All › ${COULDNT_READ} › ${broken.name}`;
    $("detail-name").textContent = `/${broken.name}`;
    $("detail-description").textContent = `Couldn't read ${broken.path}\n${broken.error}`;
    return;
  }
  $("detail-crumb").textContent = `All › ${skill.category} › ${skill.name}`;
  $("detail-name").textContent = `/${skill.name}`;
  $("detail-source").textContent = SOURCE_LABEL[skill.source];
  $("detail-source").className = `src ${skill.source}`;
  $("mode-badge").textContent = MODE_LABEL[skill.mode];
  $("mode-badge").className = `m ${skill.mode}`;
  $("usage-code").textContent = usage(skill);
  $("copy-feedback").textContent = "";
  $("detail-description").textContent = skill.description;
  $("detail-trigger").textContent = skill.firesWhen;
  $("skill-source-path").textContent = skill.path;
  $("skill-source").textContent = skill.body;
  renderConfusedWith(skill);
  renderCompare();
  renderHandoffs(skill);
}

const usage = (skill) => `/${skill.name}${skill.argumentHint ? ` ${skill.argumentHint}` : ""}`;

function selectTab(which) {
  for (const [tab, panel] of [["overview", "overview-panel"], ["source", "source-panel"]]) {
    const on = tab === which;
    $(`tab-${tab}`).setAttribute("aria-selected", String(on));
    $(`tab-${tab}`).tabIndex = on ? 0 : -1;
    $(panel).hidden = !on;
  }
}
$("tab-overview").addEventListener("click", () => selectTab("overview"));
$("tab-source").addEventListener("click", () => selectTab("source"));
$("detail-tabs").addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const next = $("tab-overview").getAttribute("aria-selected") === "true" ? "source" : "overview";
  selectTab(next);
  $(`tab-${next}`).focus();
});

// Copy: the async clipboard API needs a secure context, which a plain-http
// Tailscale link is not; fall back to execCommand, then to selecting the text.
async function copyUsage() {
  const text = $("usage-code").textContent;
  const feedback = $("copy-feedback");
  try {
    await navigator.clipboard.writeText(text);
    feedback.textContent = "Copied";
    return;
  } catch {
    // No clipboard API here, or it refused: try the older path.
  }
  const area = el("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  if (copied) {
    feedback.textContent = "Copied";
    return;
  }
  const range = document.createRange();
  range.selectNodeContents($("usage-code"));
  getSelection().removeAllRanges();
  getSelection().addRange(range);
  feedback.textContent = "Press Ctrl+C to copy";
}
$("copy-usage").addEventListener("click", copyUsage);

function renderConfusedWith(skill) {
  const list = $("confused-with-list");
  list.replaceChildren();
  for (const n of data.neighbors) {
    if (n.a !== skill.name && n.b !== skill.name) continue;
    const other = n.a === skill.name ? n.b : n.a;
    const pair = el("div", "pair");
    const button = el("button", "compare-btn", "Compare");
    button.type = "button";
    button.id = `compare-${other}`;
    button.dataset.name = other;
    button.addEventListener("click", () => addCompare(other));
    pair.append(el("span", "other", `/${other}`), el("span", "diff", n.difference), button);
    list.append(pair);
  }
  if (!list.children.length) list.append(el("div", "hint", "No curated neighbors."));
}

function addCompare(name) {
  if (name === openName || compared.includes(name) || compared.length >= MAX_COMPARE - 1) return;
  if (!skills.some((s) => s.name === name)) return;
  compared = [...compared, name];
  renderCompare();
}

// The next stage in every lane the skill sits in.
const handsOffTo = (name) => {
  const next = data.lanes.flatMap((lane) => {
    const at = lane.stages.indexOf(name);
    return at === -1 || at === lane.stages.length - 1 ? [] : [lane.stages[at + 1]];
  });
  return [...new Set(next)].join(", ") || "—";
};
const COMPARE_ROWS = [
  ["When it fires", (s) => s.firesWhen],
  ["What it does", (s) => s.description],
  ["Input / args", (s) => s.argumentHint ?? "—"],
  ["Hands off to", (s) => handsOffTo(s.name)],
  ["How it runs", (s) => MODE_LABEL[s.mode]],
  ["Source", (s) => (s.origin ? `${SOURCE_LABEL[s.source]} (${s.origin})` : SOURCE_LABEL[s.source])],
];

function renderCompare() {
  const columns = [openName, ...compared].map((name) => skills.find((s) => s.name === name));
  const placeholder = columns.length < MAX_COMPARE;
  const head = el("tr");
  head.append(el("td"));
  for (const skill of columns) {
    const th = el("th", "col", `/${skill.name}`);
    th.scope = "col";
    head.append(th);
  }
  if (placeholder) head.append(el("td", "empty", "Compare from the list above"));
  const body = COMPARE_ROWS.map(([label, value]) => {
    const tr = el("tr");
    const th = el("th", "", label);
    th.scope = "row";
    tr.append(th, ...columns.map((skill) => el("td", "", value(skill))));
    if (placeholder) tr.append(el("td", "empty"));
    return tr;
  });
  $("compare-table").tHead.replaceChildren(head);
  $("compare-table").tBodies[0].replaceChildren(...body);
  const full = compared.length >= MAX_COMPARE - 1;
  for (const button of document.querySelectorAll("#confused-with-list .compare-btn")) {
    const done = compared.includes(button.dataset.name);
    button.textContent = done ? "Compared" : "Compare";
    button.disabled = done || full;
  }
  $("compare-any-input").disabled = full;
}

const compareInput = $("compare-any-input");
$("compare-options").append(...skills.map((s) => {
  const option = el("option");
  option.value = s.name;
  return option;
}));
compareInput.addEventListener("change", () => {
  const name = compareInput.value.trim().replace(/^\//, "");
  if (skills.some((s) => s.name === name)) {
    addCompare(name);
    compareInput.value = "";
  }
});

function renderHandoffs(skill) {
  const box = $("handoff-lanes");
  box.replaceChildren();
  for (const lane of data.lanes) {
    const at = lane.stages.indexOf(skill.name);
    if (at === -1) continue;
    const node = (name, fallback, cls = "n") => el("div", name ? cls : "n none", name ?? fallback);
    const strip = el("div", "strip");
    strip.append(
      node(lane.stages[at - 1], "nothing before"), el("div", "", "→"),
      node(skill.name, "", "n me"), el("div", "", "→"),
      node(lane.stages[at + 1], "nothing after"),
    );
    const chain = el("button", "", "See full chain →");
    chain.type = "button";
    chain.id = `full-chain-${slug(lane.name)}`;
    chain.addEventListener("click", () => showLane(lane.name));
    const foot = el("div", "foot");
    foot.append(el("span", "", `Lane: ${lane.name}`), chain);
    const wrap = el("div", "lane");
    wrap.append(strip, foot);
    box.append(wrap);
  }
  if (!box.children.length) box.append(el("div", "hint", "Not in any curated lane."));
}

function showLane(name) {
  input.value = "";
  showWeak = false;
  writeHash();
  setFilters("all", null, name);
}

function writeHash() {
  const query = input.value.trim();
  try {
    history.replaceState(null, "", query ? `#q=${encodeURIComponent(query)}` : location.pathname + location.search);
  } catch {
    // Some file:// contexts refuse replaceState; the page still works without it.
  }
}

function readHash() {
  const match = /^#q=(.*)$/.exec(location.hash);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function clearSearch() {
  input.value = "";
  showWeak = false;
  writeHash();
  render();
}

input.addEventListener("input", () => {
  showWeak = false;
  writeHash();
  render();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
  else if (event.key === "Enter" && activeName) { event.preventDefault(); openSkill(activeName); }
  else if (event.key === "Escape") { event.preventDefault(); clearSearch(); }
});

document.addEventListener("keydown", (event) => {
  const isShortcut = (event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey);
  const typing = event.target instanceof HTMLElement && event.target.matches("input, textarea, [contenteditable]");
  if (isShortcut || (event.key === "/" && !typing)) {
    event.preventDefault();
    input.focus();
    input.select();
  }
});

moreButton.addEventListener("click", () => {
  showWeak = true;
  render();
});
$("browse-all").addEventListener("click", () => {
  clearSearch();
  input.focus();
});
window.addEventListener("hashchange", () => {
  const query = readHash();
  if (query !== input.value.trim()) {
    input.value = query;
    render();
  }
});

function setFilters(source, category, lane = null) {
  sourceFilter = source;
  categoryFilter = category;
  laneFilter = lane;
  render();
}

const counts = data.counts;
const setCount = (id, label, n) => { $(id).textContent = `${label} ${n}`; };
setCount("source-own", "Mine", counts.own);
setCount("source-pulled", "Pulled in", counts.pulled + counts.plugin + counts.desktop);
setCount("source-all", "All", total);
for (const button of document.querySelectorAll("#source-filter button")) {
  button.addEventListener("click", () => setFilters(button.dataset.source, categoryFilter, laneFilter));
}
$("clear-filters").addEventListener("click", () => setFilters("all", null));

function categoryButton(id, label, countText, category) {
  const button = el("button");
  button.type = "button";
  button.id = id;
  button.setAttribute("aria-pressed", "false");
  if (category !== null) button.dataset.category = category;
  button.append(el("span", "", label), el("small", "", countText));
  button.addEventListener("click", () => setFilters(sourceFilter, category));
  return button;
}
const categoryList = $("category-list");
categoryList.append(categoryButton("category-all", "All categories", String(total), null));
for (const category of data.categories) {
  const inCategory = skills.filter((s) => s.category === category);
  const own = inCategory.filter(isOwn).length;
  categoryList.append(categoryButton(`category-${slug(category)}`, category, `${own} · ${inCategory.length - own}`, category));
}
categoryList.append(el("div", "hint", "counts = mine · pulled in"));

const laneList = $("lane-list");
for (const lane of data.lanes) {
  const button = el("button");
  button.type = "button";
  button.id = `lane-${slug(lane.name)}`;
  button.dataset.lane = lane.name;
  button.setAttribute("aria-pressed", "false");
  button.append(el("span", "", lane.name), el("small", "", String(lane.stages.length)));
  button.addEventListener("click", () => showLane(lane.name));
  laneList.append(button);
}

const stamp = $("machine-stamp");
stamp.append(
  el("div", "", `Machine: ${data.machine}`),
  el("div", "", `Built: ${new Date(data.generatedAt).toLocaleString()}`),
  el("div", "", `${counts.own} mine · ${counts.pulled} pulled in · ${counts.plugin} plugin · ${counts.desktop} desktop`),
);
stamp.lastChild.id = "machine-stamp-counts";

input.value = readHash();
render();
input.focus();
