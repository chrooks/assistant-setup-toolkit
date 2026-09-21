// Search and ranking for the skills page. Plain JavaScript because the page
// inlines this file verbatim (with client.js) into one <script type="module">;
// the tests import it through search.d.ts.

const STOPWORDS = new Set(["the", "and", "for", "with", "into", "from", "that", "this", "what", "how", "when"]);
const MIN_TOKEN_LENGTH = 3;

function words(text) {
  return String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function queryTokens(query) {
  return words(query).filter((w) => w.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(w));
}

// How many query tokens start at least one word, and how many word hits in total.
function score(tokens, textWords) {
  let matched = 0;
  let hits = 0;
  for (const token of tokens) {
    const n = textWords.filter((w) => w.startsWith(token)).length;
    if (n > 0) matched += 1;
    hits += n;
  }
  return { matched, hits };
}

/**
 * Name matches: any query word in the skill name. Matches what it does: every
 * query word in the description. Weak: some, but not all, in the description.
 */
export function search(query, skills) {
  const tokens = queryTokens(query);
  // The query as a skill name: "/commit" and "watch video" read as "commit" and "watch-video".
  const asName = words(query).join("-");
  const nameMatches = [];
  const intentMatches = [];
  const weak = [];
  if (tokens.length === 0) return { nameMatches, intentMatches, weak };

  for (const skill of skills) {
    const name = score(tokens, words(skill.name));
    const desc = score(tokens, words(skill.description));
    const skillName = words(skill.name).join("-");
    // 2 = the query is the whole name, 1 = the name starts with it, 0 = neither.
    name.exact = skillName === asName ? 2 : asName && skillName.startsWith(asName) ? 1 : 0;
    const ranked = { skill, name, desc };
    if (name.matched > 0) nameMatches.push(ranked);
    else if (desc.matched === tokens.length) intentMatches.push(ranked);
    else if (desc.matched > 0) weak.push(ranked);
  }

  const byName = (a, b) => b.name.exact - a.name.exact || b.name.matched - a.name.matched || b.desc.matched - a.desc.matched || b.desc.hits - a.desc.hits || a.skill.name.localeCompare(b.skill.name);
  const byDesc = (a, b) => b.desc.matched - a.desc.matched || b.desc.hits - a.desc.hits || a.skill.name.localeCompare(b.skill.name);
  const unwrap = (list) => list.map((r) => r.skill);
  return {
    nameMatches: unwrap(nameMatches.sort(byName)),
    intentMatches: unwrap(intentMatches.sort(byDesc)),
    weak: unwrap(weak.sort(byDesc)),
  };
}
