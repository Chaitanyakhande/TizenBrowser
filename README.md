# TizenBrowser

TizenBrowser is a remote-first TizenBrew browser module with built-in ad and tracker blocking.

## Install

1. Open TizenBrew on the TV.
2. Add this folder as a local/GitHub module, or publish/install it as the npm package name `tizenbrowser`.
3. Launch `TizenBrowser` from the TizenBrew modules list.

## Notes

- This does not run the real uBlock Origin or Privacy Badger browser extensions.
- It uses built-in filter logic for common ads, trackers, beacons, tracking query parameters, and ad-like page elements.
- TizenBrew does not expose Chrome extension APIs, so filtering is best-effort and happens from injected page JavaScript.

## Package Shape

TizenBrew reads the module metadata from `package.json`:

- `packageType`: `mods`
- `appName`: `TizenBrowser`
- `websiteURL`: `https://www.google.com/`
- `main`: `src/tizenbrowser.js`
