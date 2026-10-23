// Lists GitHub Releases as a catalog, newest version of each tool first.
// Releases in this site repo are grouped by tag prefix: "climbing-cave-v1.2.0" -> tool "climbing-cave".
// Releases in other repos listed in REPOS are grouped under the repo name.
const OWNER = "gregmulvihill";
const SITE_REPO = "gregmulvihill.github.io";
const REPOS = [SITE_REPO]; // add other public repos that publish their own releases

function toolName(repo, tag) {
  if (repo !== SITE_REPO) return repo;
  const m = /^(.*?)-v?\d+(?:\.\d+)*(?:-[\w.]+)?$/.exec(tag);
  return m ? m[1] : tag;
}

function formatSize(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

async function fetchReleases(repo) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/releases?per_page=100`,
    { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`${repo}: HTTP ${res.status}`);
  return (await res.json())
    .filter(r => !r.draft)
    .map(r => ({ ...r, repo, tool: toolName(repo, r.tag_name) }));
}

function groupByTool(releases) {
  const groups = new Map();
  for (const r of releases) {
    if (!groups.has(r.tool)) groups.set(r.tool, []);
    groups.get(r.tool).push(r);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  }
  return [...groups.entries()]
    .sort((a, b) => new Date(b[1][0].published_at) - new Date(a[1][0].published_at));
}

function renderTool(tool, releases) {
  const [latest, ...older] = releases;
  const card = el("section", { class: "tool" });
  card.append(el("h2", {}, tool));
  const date = new Date(latest.published_at).toLocaleDateString(undefined,
    { year: "numeric", month: "short", day: "numeric" });
  const meta = el("p", { class: "meta" });
  meta.append(`${latest.name || latest.tag_name} · ${date}${latest.prerelease ? " · pre-release" : ""} · `);
  meta.append(el("a", { href: latest.html_url }, "release page"));
  card.append(meta);
  if (latest.body) card.append(el("p", { class: "notes" }, latest.body.trim()));

  const assets = el("ul", { class: "assets" });
  for (const a of latest.assets) {
    const li = el("li");
    li.append(el("a", { href: a.browser_download_url }, a.name));
    li.append(el("span", { class: "size" }, formatSize(a.size)));
    assets.append(li);
  }
  if (latest.assets.length) card.append(assets);

  if (older.length) {
    const details = el("details");
    details.append(el("summary", {}, `${older.length} older release${older.length > 1 ? "s" : ""}`));
    const ul = el("ul");
    for (const r of older) {
      const li = el("li");
      li.append(el("a", { href: r.html_url }, r.name || r.tag_name));
      ul.append(li);
    }
    details.append(ul);
    card.append(details);
  }
  return card;
}

async function main() {
  const list = document.getElementById("list");
  const results = await Promise.allSettled(REPOS.map(fetchReleases));
  const releases = results.filter(r => r.status === "fulfilled").flatMap(r => r.value);
  const errors = results.filter(r => r.status === "rejected").map(r => r.reason.message);
  list.replaceChildren();
  if (!releases.length) {
    const p = el("p", { class: "status" },
      errors.length ? `Could not load releases (${errors.join("; ")}). ` : "No releases yet. ");
    p.append(el("a", { href: `https://github.com/${OWNER}/${SITE_REPO}/releases` }, "View on GitHub"));
    list.append(p);
    return;
  }
  for (const [tool, rs] of groupByTool(releases)) list.append(renderTool(tool, rs));
}

if (typeof document !== "undefined") main();
if (typeof module !== "undefined") module.exports = { toolName, formatSize, groupByTool };
