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
// Filters: source is "all" | "own" | "pulled" (plugin and desktop count as pulled in); category is null for all.
let sourceFilter = "all";
let categoryFilter = null;

const isOwn = (skill) => skill.source === "own";
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const passesFilters = (skill) =>
  (sourceFilter === "all" || (sourceFilter === "own") === isOwn(skill)) &&
  (categoryFilter === null || skill.category === categoryFilter);

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
  if (!query) {
    // The catalog: every skill by category, in the collector's order.
    shown = 0;
    for (const category of data.categories) {
      const list = visible.filter((s) => s.category === category);
      if (list.length) listbox.append(catalogGroup(category, list));
      shown += list.length;
    }
    // Unreadable skills have no source or category, so any filter hides them.
    if (unreadable.length && sourceFilter === "all" && categoryFilter === null) {
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
  $("filter-status-detail").textContent = `Source: ${sourceName} · Category: ${categoryFilter ?? "All"}`;
  for (const button of document.querySelectorAll("#source-filter button")) {
    button.setAttribute("aria-pressed", String(button.dataset.source === sourceFilter));
  }
  for (const button of document.querySelectorAll("#category-list button")) {
    button.setAttribute("aria-pressed", String((button.dataset.category ?? null) === categoryFilter));
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

function openSkill(name) {
  const skill = skills.find((s) => s.name === name);
  const broken = skill ? null : unreadable.find((u) => u.name === name);
  if (!skill && !broken) return;
  $("detail-empty").hidden = true;
  $("detail-header").hidden = false;
  $("detail-body").hidden = false;
  $("detail-source").hidden = !skill;
  $("mode-badge").hidden = !skill;
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
  $("detail-description").textContent = skill.description;
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

function setFilters(source, category) {
  sourceFilter = source;
  categoryFilter = category;
  render();
}

const counts = data.counts;
const setCount = (id, label, n) => { $(id).textContent = `${label} ${n}`; };
setCount("source-own", "Mine", counts.own);
setCount("source-pulled", "Pulled in", counts.pulled + counts.plugin + counts.desktop);
setCount("source-all", "All", total);
for (const button of document.querySelectorAll("#source-filter button")) {
  button.addEventListener("click", () => setFilters(button.dataset.source, categoryFilter));
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
