# TizenBrowser

TizenBrowser is a remote-first TizenBrew browser module with a visible TV-remote cursor and built-in blocker script.

## Install

1. Open TizenBrew on the TV.
2. Add this folder as a local/GitHub module, or publish/install it as the npm package name `tizenbrowser`.
3. Launch `TizenBrowser` from the TizenBrew modules list.

## Notes

- This does not run the real uBlock Origin or Privacy Badger browser extensions.
- TizenBrew does not expose Chrome extension APIs, so filtering is best-effort.
- The visible pointer is injected into browsed pages by the module script. The local app start page only keeps the cursor while you stay on that page.

## Package Shape

TizenBrew reads the module metadata from `package.json`:

- `packageType`: `mods`
- `appName`: `TizenBrowser`
- `websiteURL`: `https://www.google.com/`
- `main`: `src/tizenbrowser.js`
