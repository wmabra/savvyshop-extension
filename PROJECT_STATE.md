# SavvyShop Extension (v2) — Project State

> **Repo:** https://github.com/wmabra/savvyshop-extension · **Branch:** `master` · **Local path:** `~/savvyshop-extension`
> **Fresh-machine resume:** `git clone` → `chrome://extensions` → Developer mode → **Load unpacked** → select the folder. No build step.
> **Last updated:** 2026-10-21 · **Last code change:** 2026-06-29 · **Status:** v2 works for the happy path; **no releases published**, load-unpacked only

## ⚠️ Duplicate checkout warning

`~/savvyshop-v2` is a **second local clone of this same repo** with identical content. It is
stale and should be deleted — work here (`~/savvyshop-extension`), never there. Delete with:

```bash
rm -rf ~/savvyshop-v2      # verified identical to ~/savvyshop-extension before removal
```

## What this is

**SavvyShop v2** — a Chrome extension that auto-detects product pages across your open tabs
and compares them, with AI analysis. Open 2+ product pages (Amazon, Walmart, Target, Best Buy…),
the badge shows the count, and the side panel presents the comparison.

## The four SavvyShop repos, disambiguated

| Path | Repo | Role | Status |
| --- | --- | --- | --- |
| `~/savvyshop-extension` | `wmabra/savvyshop-extension` | **this** — v2 extension | ✅ canonical |
| `~/savvyshop-v2` | `wmabra/savvyshop-extension` | duplicate clone | ❌ delete |
| `~/savvyshop-backend` | `wmabra/savvyshop-backend` | Express + Puppeteer scoring service | ✅ canonical backend |
| `~/github/savvyshop` | `wmabra/savvyshop` | v1 extension with embedded backend | 🗄️ archived |

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest, permissions, side panel |
| `background.js` | Service worker: tab detection, badge count, orchestration |
| `popup.html` / `popup.js` | Toolbar popup |
| `compare.html` / `compare.js` | The comparison side panel + AI analysis UI |
| `icons/` | Extension icons |

## What v2 changed vs v1

- **Google Shopping integration** — real price/link data instead of heuristic scraping
- Dark-theme redesign
- Proper **brand/model/product matching** + **URL verification** before showing a price
- Fixed pricing and "buy" buttons

## How to test

1. Load unpacked, then open two product pages from *different* retailers in separate tabs.
2. The badge should show `2`; click it and check the side panel lists both with verified prices.
3. Verify the AI analysis block renders — it needs whichever API the backend/extension calls to be reachable.

## Gotchas

- **No build, no tests, no CI.** A syntax error shows up only as a broken extension on reload.
- MV3 service workers are killed aggressively — all detection state must be re-derived on wake. Don't hold state only in memory in `background.js`.
- AI calls depend on the backend; if the panel shows prices but no analysis, the backend is the first thing to check.
- `~/savvyshop-extension.zip` in the home dir is a **stale** export from 2026-06-24 — do not ship it.

## Next steps

1. Delete `~/savvyshop-v2`.
2. Add a `manifest.json` version bump discipline + a packed `.crx`/zip per release so installs aren't all load-unpacked.
3. Decide whether the extension calls `savvyshop-backend` directly or Google Shopping — right now both paths exist in the code.
