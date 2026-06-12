# TizenBrowser

TizenBrowser is a remote-first TizenBrew browser start page with a bundled blocker script for site-injection contexts.

## Install

1. Open TizenBrew on the TV.
2. Add this folder as a local/GitHub module, or publish/install it as the npm package name `tizenbrowser`.
3. Launch `TizenBrowser` from the TizenBrew modules list.

## Notes

- This does not run the real uBlock Origin or Privacy Badger browser extensions.
- TizenBrew does not expose Chrome extension APIs, so filtering is best-effort.
- The app module shape is used because it is the most reliable way for TizenBrew to recognize the module from GitHub.

## Package Shape

TizenBrew reads the module metadata from `package.json`:

- `packageType`: `app`
- `appName`: `TizenBrowser`
- `appPath`: `app/index.html`
