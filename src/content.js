(() => {
  // Keep the content script deliberately small. The Side Panel reads the active
  // tab URL and queries the public GitHub API for the current repository tree.
  const isRepoPage = /^\/[\w.-]+\/[\w.-]+(?:\/|$)/.test(location.pathname);
  if (!isRepoPage) return;
  document.documentElement.dataset.githubHtmlSidepane = "available";
})();