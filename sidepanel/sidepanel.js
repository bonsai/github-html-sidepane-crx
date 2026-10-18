const repoLabel = document.querySelector("#repo-label");
const statusEl = document.querySelector("#status");
const fileList = document.querySelector("#file-list");
const filterInput = document.querySelector("#filter");
const previewFrame = document.querySelector("#preview");
const selectedFileLabel = document.querySelector("#selected-file");
const downloadButton = document.querySelector("#download");

let htmlFiles = [];
let selectedPath = "";
let selectedRawUrl = "";

function setStatus(message) {
  statusEl.textContent = message;
}

function parseGitHubUrl(urlString) {
  const url = new URL(urlString);
  if (url.hostname !== "github.com") throw new Error("Open a github.com repository page first.");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2 || ["settings", "marketplace", "notifications", "organizations"].includes(parts[0])) {
    throw new Error("This page does not look like a repository.");
  }
  const [owner, repo] = parts;
  let branch = null;
  let pathPrefix = "";
  if (parts[2] === "tree" || parts[2] === "blob") {
    branch = parts[3] || null;
    pathPrefix = parts.slice(4).join("/");
  }
  return { owner, repo: repo.replace(/\.git$/, ""), branch, pathPrefix, viewType: parts[2] || "" };
}

function rawUrl(owner, repo, branch, path) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return "https://raw.githubusercontent.com/" + encodeURIComponent(owner) + "/" +
    encodeURIComponent(repo) + "/" + branch.split("/").map(encodeURIComponent).join("/") + "/" + encodedPath;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub API rate limit reached. Wait a little and refresh.");
    }
    throw new Error("GitHub API request failed (" + response.status + ").");
  }
  return response.json();
}

async function loadRepository() {
  fileList.replaceChildren();
  htmlFiles = [];
  selectedPath = "";
  selectedRawUrl = "";
  downloadButton.disabled = true;
  previewFrame.removeAttribute("srcdoc");
  selectedFileLabel.textContent = "Preview";

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.url) throw new Error("Could not read the active tab URL.");
    const parsed = parseGitHubUrl(tab.url);
    const base = "https://api.github.com/repos/" +
      encodeURIComponent(parsed.owner) + "/" + encodeURIComponent(parsed.repo);
    const repoInfo = await fetchJson(base);
    const branch = parsed.branch || repoInfo.default_branch;
    repoLabel.textContent = parsed.owner + "/" + parsed.repo + " · " + branch;

    const tree = await fetchJson(base + "/git/trees/" +
      branch.split("/").map(encodeURIComponent).join("%2F") + "?recursive=1");
    if (tree.truncated) {
      setStatus("Tree is large; GitHub returned a partial file list.");
    } else {
      setStatus("Found " + tree.tree.filter(item => item.type === "blob" && /\.html?$/i.test(item.path)).length + " HTML files");
    }
    htmlFiles = tree.tree
      .filter(item => item.type === "blob" && /\.html?$/i.test(item.path))
      .map(item => ({ path: item.path, sha: item.sha }))
      .sort((a, b) => a.path.localeCompare(b.path));

    if (parsed.pathPrefix && parsed.viewType === "tree") {
      const prefix = parsed.pathPrefix.replace(/\/$/, "");
      const scoped = htmlFiles.filter(file => file.path.startsWith(prefix + "/") || file.path === prefix);
      if (scoped.length) htmlFiles = scoped;
    }
    renderList();
    if (!htmlFiles.length) {
      fileList.append(makeEmpty("No HTML files found in this repository."));
      setStatus(tree.truncated ? "Partial scan complete" : "No HTML files found");
    }
  } catch (error) {
    repoLabel.textContent = "Repository unavailable";
    setStatus(error.message || "Could not load repository.");
    fileList.append(makeEmpty(error.message || "Could not load repository."));
  }
}

function makeEmpty(message) {
  const li = document.createElement("li");
  li.className = "empty";
  li.textContent = message;
  return li;
}

function renderList() {
  const query = filterInput.value.trim().toLowerCase();
  fileList.replaceChildren();
  const visible = htmlFiles.filter(file => file.path.toLowerCase().includes(query));
  if (!visible.length) {
    fileList.append(makeEmpty("No matching HTML files."));
    return;
  }
  for (const file of visible) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "file-button";
    button.textContent = file.path;
    button.title = file.path;
    button.setAttribute("aria-pressed", String(file.path === selectedPath));
    button.addEventListener("click", () => selectFile(file));
    li.append(button);
    fileList.append(li);
  }
}

async function selectFile(file) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const parsed = parseGitHubUrl(tab.url);
    const branch = parsed.branch || "HEAD";
    selectedPath = file.path;
    selectedRawUrl = rawUrl(parsed.owner, parsed.repo, branch, file.path);
    selectedFileLabel.textContent = file.path;
    downloadButton.disabled = false;
    setStatus("Loading preview…");
    renderList();

    const response = await fetch(selectedRawUrl);
    if (!response.ok) throw new Error("Could not fetch HTML (" + response.status + ").");
    const html = await response.text();
    const parentPath = file.path.split("/").slice(0, -1).join("/");
    const basePath = parentPath ? parentPath + "/" : "";
    const baseUrl = rawUrl(parsed.owner, parsed.repo, branch, basePath);
    const baseTag = '<base href="' + baseUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">';
    const withBase = /<head\b[^>]*>/i.test(html)
      ? html.replace(/<head\b[^>]*>/i, match => match + baseTag)
      : "<head>" + baseTag + "</head>" + html;
    previewFrame.srcdoc = withBase;
    setStatus("Preview ready · scripts run in a sandbox");
  } catch (error) {
    previewFrame.removeAttribute("srcdoc");
    setStatus(error.message || "Preview failed.");
  }
}

downloadButton.addEventListener("click", async () => {
  if (!selectedRawUrl || !selectedPath) return;
  try {
    await chrome.downloads.download({
      url: selectedRawUrl,
      filename: selectedPath.replace(/^\/+/, ""),
      conflictAction: "uniquify",
      saveAs: true
    });
    setStatus("Download started");
  } catch (error) {
    setStatus(error.message || "Download failed.");
  }
});

document.querySelector("#refresh").addEventListener("click", loadRepository);
filterInput.addEventListener("input", renderList);
loadRepository();