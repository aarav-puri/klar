# Schoology integration

This is the research and the decisions behind how Klar connects to Schoology. It was written before the app was built so the product wouldn't depend on a connection method that can't work.

## What Schoology offers

| Path | How it works | Who can use it | Fit for Klar |
| --- | --- | --- | --- |
| **REST API, two-legged OAuth 1.0a** | A consumer key/secret acts as one Schoology user. Keys come from `[school].schoology.com/api`, only for roles with the "Access Schoology API" permission. | Usually administrators; many districts disable it for students. | Not suitable: it would mean students pasting API secrets into Klar. |
| **REST API, three-legged OAuth 1.0a** | `GET api.schoology.com/v1/oauth/request_token` → student approves at `https://[school host]/oauth/authorize` → `GET /v1/oauth/access_token`. Requests are signed with HMAC-SHA1. | Requires a consumer key registered with Schoology; districts can block third-party apps. | **Optional connection method**, offered when the server has a consumer key. Klar accounts themselves are separate (Neon Auth). |
| **LTI 1.3** | The tool is launched from inside Schoology by an institution. | Requires institutional installation and approval. | Out of scope for a student-initiated product. Noted for a future school-sanctioned version. |
| **The gradebook page** (`/grades/grades`) | The student is already authorized to see their grades there. | Every student with grade access. | **Primary path**, read by the companion extension with explicit consent. No API key or district approval needed. |

Sources: the [Schoology authentication docs](https://developers.schoology.com/api-documentation/authentication/), the [grades endpoints](https://developers.schoology.com/api-documentation/rest-api-v1/grade/), and community notes about the authorization callback parameter changing in some deployments.

Key facts that shaped the design:

- Being signed in to Schoology does **not** grant API authorization. The extension path never pretends otherwise; it reads only what the page already shows.
- Klar accounts are separate from Schoology: students sign in to Klar with an email and a Klar-only password (Neon Auth), then connect Schoology.
- The API documents exception codes `1` (excused) and `2` (incomplete). Code `3` is used for "missing" in practice; the mapper handles it but treats missing-without-score as "not counted", matching Schoology's own math.
- Schoology does not provide a history of course grades. Klar records a snapshot from the first sync onward and never back-fills.

## The optional extension in detail

```
Klar page ──postMessage──▶ bridge.js (content script on Klar's origin only)
                              │ validates source window, origin, schema
                              ▼
                        background.js (service worker)
                              │ validates sender id, frame, origin allow-list
                              │ checks consent + host permission
                              ▼
               chrome.tabs.create(https://<school>/grades/grades)
                              │
              signed out? ────┴──▶ Schoology / Google / Microsoft / SAML sign-in
                              │    (tab brought forward; extension only watches the URL)
                              ▼
                capture.js (content script on /grades/grades only)
                              │ asks background "may I read?" (consent check)
                              │ parses the rendered gradebook DOM
                              ▼
                        background.js ──reply──▶ bridge.js ──▶ Klar page
                                                                 │
                                                  POST /api/sync/ingest (same-origin, session cookie)
```

Permissions requested:

- `storage` for connection state (host, consent time, last sync; never credentials).
- `scripting` to register the gradebook reader on schools that host Schoology on their own domain.
- Host access to `https://*.schoology.com/*` and Klar's own origin. Custom school domains are **optional** permissions, requested for that one host only, with a user gesture, on an explanation page.

No `cookies`, `tabs`, `history`, `webRequest` or all-sites permissions. URLs of identity-provider pages are invisible to the extension; it just waits while the tab is "elsewhere".

### Failure handling

| Situation | What the student sees |
| --- | --- |
| Extension missing or disabled | Install steps; the page continues automatically once detected. Non-Chromium browsers get an explanation; Klar still syncs through the API. |
| Custom domain without permission | An approval page opens; "Try again" afterwards. |
| Signed out of Schoology | The Schoology tab comes forward with "Sign in to Schoology in the tab that just opened". |
| School SSO redirect | Same as above; any provider works because Klar never touches the page. |
| Sign-in takes over 5 minutes | `LOGIN_TIMEOUT` with a retry. |
| Tab closed mid-way | `TAB_CLOSED` with a retry. |
| Gradebook layout not recognized | `PARSE_FAILED`, explained; no guessed numbers are stored. |
| No courses / grades hidden | `NO_COURSES`, explained. |
| Wrong school address | Schoology redirects unknown hosts to a PowerSchool marketing page; the onboarding warns about this while waiting. |
| Data from a different school than connected | `HOST_MISMATCH`; reconnect to switch schools (old data is cleared so schools never mix). |
| Network failure during save | The capture stays with the student; "try again when you're connected". |
| Official API: access revoked/expired | Connection marked expired; "Reconnect". |
| Student chooses Deny on Schoology | `AUTH_REJECTED` on the login page, with what to do. |
| API approval started in another browser or over 10 minutes ago | `AUTH_STATE_INVALID`; start again. |
| District blocks apps | `FORBIDDEN`: explained on the login page. |
| Server has no consumer key | The official API option isn't offered; the extension path is unaffected. |

## What needs outside approval

- **Chrome Web Store publication** of the extension (review, privacy disclosures, a verified publisher).
- **A Schoology consumer key** for the optional official-API path, with the callback `<app URL>/api/schoology/oauth/callback`, and per-district willingness to allow third-party apps.
- **Custom SMTP for Neon Auth** before launch, so password-reset emails come from your own domain.
- **School or district review.** Many districts vet tools that handle student records (FERPA in the US, state student-privacy laws, and district data-privacy agreements). Klar is designed to make that review easy, but deployment to students at a school may require it.
- **Trademark and domain checks** for the "Klar" name.

## Updating the gradebook reader

`packages/core/src/schoology-dom.ts` is the only code that depends on Schoology's page markup. If Schoology changes it:

1. Save a gradebook page (remove personal information), add it to `packages/core/test/fixtures/`.
2. Add a test in `packages/core/test/schoology-dom.test.ts` asserting the expected courses, categories and scores.
3. Adjust selectors until it passes, then rebuild the extension.
