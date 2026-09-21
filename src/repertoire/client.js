// Browser code for the skills page. The build inlines search.js and then this
// file into one <script type="module">, so `search` is in scope here without an
// import. Every piece of skill text reaches the DOM through textContent only.

const data = JSON.parse(document.getElementById("repertoire-data").textContent);
const skills = data.skills;
const total = data.counts.total;

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
  button.append(
    el("span", "nm", `/${skill.name}`),
    el("span", `src ${skill.source}`, SOURCE_LABEL[skill.source]),
    el("span", "desc", skill.description),
    el("span", `m ${skill.mode}`, MODE_LABEL[skill.mode]),
  );
  button.addEventListener("click", () => {
    setActive(skill.name);
    openSkill(skill.name);
  });
  return button;
}

function group(id, title, list) {
  const wrap = el("div", "grp");
  wrap.id = id;
  wrap.setAttribute("role", "group");
  const header = el("div", "gh");
  header.id = `${id}-label`;
  header.append(el("span", "", title), el("small", "", String(list.length)));
  wrap.setAttribute("aria-labelledby", header.id);
  wrap.append(header, ...list.map(row));
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

  let shown;
  if (!query) {
    // Slice 1: one alphabetical list; the category catalog replaces it in slice 2.
    const all = [...skills].sort((a, b) => a.name.localeCompare(b.name));
    listbox.append(group("results-all-group", "All skills", all));
    shown = all.length;
  } else {
    const { nameMatches, intentMatches, weak } = search(query, skills);
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
  if (!skill) return;
  $("detail-empty").hidden = true;
  $("detail-header").hidden = false;
  $("detail-body").hidden = false;
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

const counts = data.counts;
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
