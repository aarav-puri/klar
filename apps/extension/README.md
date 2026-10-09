# Klar for Schoology (extension)

Optional Chrome Manifest V3 companion to the Klar web app (students sign in and sync through Schoology's official API without it). It reads the student's own Schoology gradebook page, with consent, and hands the result to Klar. It never reads passwords, cookies or tokens.

```bash
KLAR_APP_ORIGINS="http://localhost:3000" npm run build   # outputs dist/
npm test                                                   # sender validation and routing
```

Load `dist/` with **Load unpacked** in `chrome://extensions`. Use `npm run watch` while developing.

| File | Role |
| --- | --- |
| `src/background.ts` | Service worker: validates messages, runs syncs, keeps minimal state |
| `src/bridge.ts` | Content script on Klar's origin only; relays validated page messages |
| `src/capture.ts` | Content script on `/grades/grades` only; reads the gradebook after a consent check |
| `src/popup/` | Popup UI (status, sync now, open dashboard, preferences, disconnect) and the custom-domain approval page |
| `src/lib/policy.ts` | Pure security and routing checks (unit tested) |
| `build.mjs` | Builds popup + worker (ES modules) and content scripts (IIFE), writes `manifest.json` |

See `docs/INTEGRATION.md` and `docs/SECURITY.md` at the repo root for the full design.
