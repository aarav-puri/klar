# Security and privacy model

## Principles

1. Klar never sees a Schoology or school password, cookie, session token or identity-provider token.
2. A student can only ever read their own data, enforced by the database, not just application code.
3. Everything that comes from Schoology is untrusted input.
4. Collect the minimum; make deletion easy and immediate.

## Credentials

- **Schoology sign-in** happens only on Schoology's or the school's own pages. The extension has no `cookies` permission and never reads form fields.
- **Klar accounts** are Neon Auth (managed Better Auth): email plus a Klar-only password. Neon stores the users, password hashes and sessions in its `neon_auth` schema; Klar's code never stores or logs a password. The UI repeatedly says never to enter a Schoology password.
- **Sessions** are Better Auth sessions, proxied on Klar's own origin (`/api/auth/*`) and cached in an `httpOnly` cookie signed with `NEON_AUTH_COOKIE_SECRET`. Sign-out ends the session.
- **Forgot password** uses Neon Auth's reset links: single-use (verified), expiring after 60 minutes (observed on this project). The request returns the same response whether or not the account exists. Klar does not currently claim that a reset signs out other sessions; that is Neon Auth configuration and hasn't been verified.
- **Official API tokens** (optional path) are sealed with AES-256-GCM (`TOKEN_ENCRYPTION_KEY`, random IV per value) and stored in a `private` schema the student role cannot read. The OAuth handshake state is sealed the same way in a path-scoped, 10-minute cookie bound to the student.
- **CSP and the redirect.** `form-action` allows `https:` targets, because connecting through the official API redirects to the school's own Schoology host (any domain). Plain `http:` targets stay blocked.

## Data isolation

- Every student-owned table has `user_id` and row-level security policies for select, insert, update and delete.
- The server runs each student's queries inside a transaction as the restricted `klar_student` role with `klar.user_id` set to the Neon Auth user id (`asStudent()` in `apps/web/src/server/db.ts`). Both settings are transaction-local, so they're safe over Neon's pooled connections. A bug that forgets a `where user_id = ...` still cannot cross students. Verified on the live Neon database as well as in tests.
- Restrictive policies stop a student attaching assignments or grades to another student's course.
- `neon_auth.*` and `private.*` are unreachable from the student role.
- Tested in `apps/web/test/database.test.ts`.

## Extension messaging

- The bridge only runs on allow-listed Klar origins (fixed at build time; https only, except localhost).
- Page to bridge: the message must come from the same window and origin and pass schema validation (`parseAppEnvelope`); unknown fields are dropped; `CONNECT` requires `consent: true` and a valid hostname.
- Bridge to background: the background checks the sender is this extension, a top-level frame, and an allow-listed origin.
- Gradebook reader to background: accepted only from the consented Schoology host over https.
- Replies go to `location.origin` only; the page accepts replies only for its own request id.
- Covered by unit tests (`packages/core/test/protocol.test.ts`, `apps/extension/test/policy.test.ts`, `apps/web/test/extension-client.test.ts`) and the end-to-end suite.

## Web application

- Every state-changing API checks that `Origin` matches the app (CSRF), requires a signed-in session, and is rate limited.
- Sign-in, sign-up and password-reset requests are rate limited per network and per email.
- Request bodies have size caps; the sync payload is validated with zod (bounded lengths and counts, control characters stripped, links kept only if they point to the student's own Schoology host over https). The database also rejects non-https links.
- React escapes all rendered text; no HTML from Schoology is ever rendered.
- Headers: a strict Content-Security-Policy, `frame-ancestors 'none'`, HSTS in production, `nosniff`, a strict referrer policy and a locked-down permissions policy. App pages are `Cache-Control: private, no-store`.
- Logs record error codes, never grade contents.

## Ask Klar (AI assistant)

- Off unless `AI_GATEWAY_API_KEY` (or Vercel OIDC) is set. Requests go through Vercel AI Gateway to the configured model (`openai/gpt-6-luna` by default).
- Only on request: the student's question plus their own synced grade data (loaded under row-level security) is sent. Nothing is sent in the background.
- Chats are not stored by Klar. The browser holds them until the page is left.
- The route takes only the text of earlier turns from the browser; tool calls and results are always produced on the server, so a client can't forge a calculation.
- Grade math comes from the grade engine through two read-only tools (`requiredScore`, `whatIf`). The assistant cannot change data or reach Schoology.
- The prompt marks assignment titles, course names and teacher comments as data, not instructions. This reduces, but can't eliminate, prompt injection from teacher-written text; the worst case is a misleading answer, since the tools are read-only.
- Same-origin check, sign-in, 30 requests per 10 minutes per student, 200 KB body cap, 4,000 characters per message, 40 messages per chat.

## Deletion

- **Disconnect**: deletes the connection and any stored OAuth token; the extension forgets the host and removes any optional host permission.
- **Delete my grade data**: removes courses, assignments, grades, snapshots, sync history and the connection.
- **Delete my account**: removes everything Klar stores for the student, then deletes their Neon Auth account.

## Known limits

- Rate limits are in memory per server instance.
- The CSP allows inline scripts because Next.js hydration requires them without a nonce setup.
- Password-reset emails use Neon's shared sender until custom SMTP is configured.
