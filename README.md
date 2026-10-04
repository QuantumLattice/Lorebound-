# Lorebound PWA

Lorebound is a local-first RPG character backstory creator. This build is an installable Progressive Web App (PWA) designed to work well on iPhone/iPad and desktop browsers.

## What this build includes

- Installable Home Screen experience
- iOS-specific app metadata and Apple touch icon
- Offline app-shell caching via service worker
- Local character library using browser localStorage
- No backend, database, login provider, API key, or paid AI service
- JSON library import/export and text export
- Built-in offline backstory composer

## Important: how iPhone installation works

A PWA must be served as a website over HTTPS for its service worker/offline features to work correctly. Opening `index.html` directly from the Files app is useful for testing, but is not the normal install path.

You can host this folder on any static HTTPS host. It requires no server-side code. Free options include GitHub Pages or Cloudflare Pages, or you can self-host it on an HTTPS-capable web server you control.

Once hosted:

1. Open the Lorebound HTTPS address in Safari on iPhone.
2. Tap Safari's Share button.
3. Choose **Add to Home Screen**.
4. Tap **Add**.
5. Launch Lorebound from its Home Screen icon.
6. Visit it once while online so all files are cached; subsequent launches can work offline.

## Files

- `index.html` — UI and PWA metadata
- `styles.css` — responsive/iOS-safe-area styles
- `app.js` — character creator, local persistence and install guidance
- `manifest.webmanifest` — PWA install metadata
- `sw.js` — offline cache/service worker
- `icons/` — PWA and iOS icons

## Data note

Characters live in the browser storage belonging to the exact site address where Lorebound is hosted. Use **Export library** periodically if the data is important. Clearing Safari website data or removing that site's storage can remove the local library.
