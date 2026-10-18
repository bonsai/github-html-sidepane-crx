# GitHub HTML Sidepane CRX

A minimal Chrome Manifest V3 extension to list HTML files in the currently open GitHub repository, preview a selected file in a sandboxed Side Panel iframe, and download the selected HTML file.

## MVP features

- Detects the repository from the active `github.com` tab.
- Lists `.html` and `.htm` files using the Git Trees API.
- Supports filtering the list by path.
- Previews the selected file in a sandboxed iframe.
- Downloads the selected HTML file on explicit user action.
- Starts with public repositories; private repositories and authenticated API access are out of scope.

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this repository directory.
4. Open a public GitHub repository and click the extension icon.

## Current limitations

- Downloads the selected HTML file only; it does not package CSS, JavaScript, images, or other assets.
- Preview asset resolution is best-effort. Relative assets may not all work for every repository layout.
- The Git Trees API may return a truncated tree for very large repositories.
- GitHub API unauthenticated rate limits apply.
- The preview runs in a sandboxed iframe, but HTML and scripts from repositories should still be treated as untrusted content.

## Permissions

- `sidePanel`: show the extension UI in Chrome's Side Panel.
- `downloads`: download a file only after the user clicks the Download button.
- `activeTab`: read the active tab context when the extension is used.
- Host permissions are limited to GitHub, GitHub's API, and raw file hosting.

## Development

The MVP uses plain HTML, CSS, and JavaScript without a build step.