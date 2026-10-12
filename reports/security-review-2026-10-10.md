# Security Review & Testing Guide — Portal GMC (portal_v2)

**Date:** 2026-10-10
**Branch reviewed:** `v1.3` (HEAD `0677d3b` "Feat - Profile Page", plus uncommitted change to `src/routes/login/+page.svelte`)
**Inputs:** full source, `lib/*.md` guides (used as the source of truth for the database SQL), `reports/code-review-2026-10-07.md`, `reports/Lighthouse/localhost_5173-20261010T010518.json`
**Companion file:** [`feature-roadmap-2026-10-10.md`](./feature-roadmap-2026-10-10.md)

> **How this was done.** Same rules as last time: observed, not guessed. I ran the dev server on `:5199`
> and probed every route and API endpoint with `curl`, ran `vite build`, `svelte-check` and `npm audit`,
> and made **read-only, anonymous** requests to the Supabase project using the public key from `.env`
> (no sign-ups, no writes, no logged-in tests). Things I could **not** verify — anything that needs a
> logged-in session or a look at the live database — are marked **[verify]** with the exact test to run.
> No source files were modified. (The failed `vite build` attempt rewrote the git-ignored
> `.svelte-kit/output/` folder; that is a build artifact, not code.)

---

## Table of contents

1. [What changed since the last review](#1-what-changed-since-the-last-review)
2. [The Lighthouse report — what it actually says](#2-the-lighthouse-report--what-it-actually-says)
3. [Threat model in one page](#3-threat-model-in-one-page)
4. [Security findings (in depth)](#4-security-findings-in-depth)
5. [Prioritized security backlog](#5-prioritized-security-backlog)
6. [How to test your own project's weaknesses](#6-how-to-test-your-own-projects-weaknesses)
7. [Learning path](#7-learning-path)
8. [Honest take](#8-honest-take)

---

# 1. What changed since the last review

Since `5a81c01` the diff is: new `/perfil` page, the admin page and the `criar`/`remover` endpoints
committed, a "perfil" link on the home page, and an uncommitted attempt at the login `<form>` fix.

### Status of the 2026-10-07 findings

| ID | Finding | Status | Evidence |
|---|---|---|---|
| C1 | Build broken (`supabaseUrl is required`) | ❌ **Still open** — and it breaks **dev** too | `vite build` fails at `analyse`; in dev all 3 admin endpoints return **500** (log: `Error when evaluating SSR module .../criar/+server.ts: supabaseUrl is required`). The "Resetar senha" and "Remover" buttons in `/admin` cannot work at all today. |
| C2 | Finance Power BI URL shipped to everyone | ❌ Open | `bi/+page.svelte:8` unchanged |
| C3 | No server-side auth | ❌ Open | `/`, `/admin`, `/perfil`, `/bi`, `/treinamentos`, `/treinamentos/x` all return **200** unauthenticated |
| C4 | Client-written audit log | ❌ Open | `login/+page.svelte:32-39` unchanged |
| H1 | Enter doesn't submit login | ⚠️ **Attempted, not fixed** | see [§4.11](#411-the-login-form-fix-does-not-work) |
| H5 | Admin check is `perfis.length > 1` | ❌ Open | `admin/+page.svelte:27` |
| H7 | Dependency CVEs | ❌ Open | `npm audit`: **10 (4 low, 6 high)** — same set; `npm audit fix` was not run |
| H11 | `robots.txt` allows crawling | ❌ Open | `static/robots.txt` unchanged |
| — | `#each` keys, `$app/stores`, prettier, `String` type, etc. | ❌ Open | unchanged |

**What did go right:** the `/perfil` feature was built *with* a database-side guard against
self-promotion (`protege_role` trigger, guide part 3 §8). That is exactly the "deny at the data layer"
instinct the last review asked for. And the anonymous surface is clean (see §4.1).

**The honest pattern:** a new feature was added, but none of the four Criticals were touched. C1 in
particular means half of the admin panel has never worked. Treat the Critical list as a gate: no new
features until C1–C4 are closed.

---

# 2. The Lighthouse report — what it actually says

Run: Lighthouse 13.4.1, `http://localhost:5173/treinamentos`, **mobile, simulated throttling**, logged in.

| Category | Score |
|---|---|
| Performance | **49** |
| Accessibility | 92 |
| Best Practices | 77 |
| SEO | 83 |

## 2.1 The performance score is not measuring your site

`:5173` is `vite dev`. The dev server ships every module unbundled and unminified, plus Vite's HMR
client. Lighthouse says so itself:

| Audit | Value |
|---|---|
| Minify JavaScript | est. savings **4,435 KiB** |
| Reduce unused JavaScript | 898 KiB |
| Total byte weight | 5,027 KiB |
| FCP / LCP / TTI | 15.1 s / 29.8 s / 29.9 s |

The production build measured in the last review was **88 KB gzipped** total JS. The 49 is an artifact
of the measurement, not a property of the app. **Rule: never Lighthouse a dev server.** Correct method:

```bash
npm run build && npm run preview     # needs C1 fixed first — build currently fails
# then Lighthouse http://localhost:4173/treinamentos  (DevTools → Lighthouse, while logged in)
```

## 2.2 The findings that *are* real (they would appear in production too)

| Lighthouse audit | Real cause in the code | Fix |
|---|---|---|
| **Document doesn't have a `<title>`** (A11y + SEO) | No page sets one — same as H10 last time | `<svelte:head><title>Treinamentos · Portal GMC</title></svelte:head>` per page |
| **Heading order** (A11y) | `treinamentos/+page.svelte:49,60` jumps `h1` → `h3` | Use `<h2>` for card titles (style it to look the same) |
| **Render-blocking request — 909 ms** | Google Fonts CSS in `app.html:6` | Trim to the weights you use; or self-host the two fonts (`@fontsource/lato`, `@fontsource/cormorant-garamond`) — removes the third-party request entirely |
| **LCP request not discoverable / no `fetchpriority`** | LCP element is the first card thumbnail, but the HTML is empty until JS runs (blank SSR, H3 last time) | Fixed structurally by server `load` (C3). Then `fetchpriority="high"` on the first thumbnail, `loading="lazy"` on the rest |
| **Uses third-party cookies — 35 found** (Best Practices) | Thumbnails are `drive.google.com/thumbnail?...` → Google sets `COMPASS`, `__Secure-OSID`, `GSP`… on every view | Move thumbnails to a Supabase Storage bucket (your guide part 2 already proposes this). Privacy win too: Google currently learns which employee viewed which training list. |
| **Issues in DevTools panel** | Same Drive cookie warnings | Same fix |
| **Meta description missing** (SEO) | — | Ignore. Internal portal; set `robots.txt` to `Disallow: /` and add `<meta name="robots" content="noindex">` instead |

**Accessibility 92 is misleading-high.** Lighthouse only tests what is on the page it loaded. The
login page (focus outline removed, placeholder-only labels, error not announced) and the admin page
were not audited. Run it on `/login` too, and supplement with axe DevTools.

---

# 3. Threat model in one page

Before testing anything, write down **who** might attack, **what** they want, and **where** they can
touch the system. For this portal:

### Assets (what is worth protecting)

1. **Financial dashboard** contents (Power BI)
2. **Admin capabilities** — change roles, reset passwords, delete accounts, create accounts
3. **Employee PII** — e-mails, `telefone`, `observacoes`, login history
4. **Integrity of the audit log** — who logged in when
5. Role-restricted **training content**

### Actors

| Actor | Realistic? | Starting point |
|---|---|---|
| Anonymous internet user | Yes — the site is public | Can read every JS file, call Supabase REST with the public key |
| **Curious / disgruntled employee** | **Most likely threat** | Valid `colaborador` login, browser DevTools, the public key |
| Ex-employee | Yes | Old session token, old bookmarked URLs (Power BI links never expire) |
| Compromised admin account | Yes — shared PCs in stores | Full admin session |

### Entry points (attack surface)

```
Browser ──► SvelteKit pages (Cloudflare)      ← no server checks today
   │──────► /api/admin/{criar,remover,reset-senha}   ← bearer token + is_admin RPC
   │──────► Supabase REST (PostgREST) directly  ← ★ RLS is the ONLY guard here
   │──────► Supabase Auth                       ← sign-up disabled ✔
   └──────► Power BI "publish to web" links     ← NO guard at all
```

**Key insight:** because the browser talks to Supabase directly with the public key, *every table
is effectively a public API, filtered only by RLS*. The UI is irrelevant to security — an attacker
uses the console, not your buttons. Every finding below is framed that way.

---

# 4. Security findings (in depth)

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low. Database statements are based on the SQL in
`lib/Guia_de_reconstrução_portal_part3.md` / `part2.md`; if what you ran in Supabase differs, the
**[verify]** tests tell you the truth.

## 4.1 ✅ What is solid (verified)

Anonymous probing of the live project (public key only):

```
GET  /rest/v1/profiles?select=*     → []      (200)   RLS hides all rows from anon ✔
GET  /rest/v1/access_log?select=*   → []      (200)   ✔
GET  /rest/v1/trainings?select=*    → []      (200)   ✔
POST /rest/v1/rpc/is_admin          → false            ✔
GET  /rest/v1/   (OpenAPI schema)   → 401              schema not exposed to anon ✔
GET  /auth/v1/settings              → disable_signup: true, only "email" provider ✔
```

- **Public sign-up is disabled.** This matters a lot: otherwise anyone could create an account and
  become a `colaborador`. Keep it that way.
- The key in `.env` is an `sb_publishable_*` key — public by design. No service-role key is in the
  repo or its history.
- `verificarAdmin` checks admin by calling `is_admin()` **with the caller's own JWT**, so PostgREST
  validates the signature and `auth.uid()` can't be faked. Correct design.
- Admin endpoints use a **bearer header, not cookies**, so they are not CSRF-able (a malicious site
  can't make the browser attach that header). Correction to last review's CSRF note. This changes
  if you move to cookie sessions with `@supabase/ssr` — then rely on SvelteKit's `csrf.checkOrigin`
  and use form actions.
- Svelte escapes all `{text}` interpolation → no stored XSS through `nome_exibicao`, `observacoes`,
  e-mails or training titles.
- The `protege_role` trigger is the right idea (see 4.5 for its gaps).
- Login error message is generic → no user enumeration via the form.

## 4.2 🔴 C2 (still open) — finance dashboard is effectively public

`bi/+page.svelte:7-9`. Both Power BI URLs are in the client bundle; the role filter at line 30 runs in
the browser. Power BI **"Publish to web"** links are *anonymous by design* — Microsoft's own docs say
not to use them for confidential data. Anyone holding the URL (any employee who opens DevTools, any
ex-employee, anyone they forward it to) sees finance data, forever, with no log.

**Moving the URL server-side reduces exposure but does not fix this** — the iframe `src` still lands
in the user's browser, and it can be copied. Real fixes, in order of strength:

1. **Short term:** serve the URL list from `+page.server.ts` filtered by server-verified role, then
   **rotate** the finance link (delete the embed code in Power BI → generate a new one). The current
   one must be assumed leaked.
2. **Proper:** Power BI "**Embed in your organization**" (secure embed — requires the viewer's
   Microsoft 365 login) or **Power BI Embedded** with server-issued embed tokens. See roadmap item
   BI-4.

## 4.3 🔴 C3 (still open) — no server perimeter; RLS is everything

All six page routes return 200 to `curl` with no cookie. That is "only" an information leak of the
page *shell* today, because data comes from Supabase. But it means **every RLS policy must be
perfect**, and section 4.4–4.7 show places where it is not. Fix plan unchanged from last review:
`hooks.server.ts` + `@supabase/ssr` + `+layout.server.ts` that redirects, and a
`src/routes/admin/+layout.server.ts` that checks `is_admin()` and returns **403** server-side.

## 4.4 🟠 NEW — Training access control is UI-only (horizontal access)

The guide (part 1 line 740, part 2 line 379) defines `trainings` RLS as "logged-in users read
published rows" and explicitly leaves area filtering "as a future phase". So:

- `treinamentos/+page.svelte:37-39` — the `area` filter is a query the browser *chooses* to send.
  Any user can run in the console:
  ```js
  const { supabase } = await import('/src/lib/supabaseClient.ts');   // dev; in prod use the network tab
  await supabase.from('trainings').select('*')                        // every area's videos
  ```
- `treinamentos/[id]/+page.svelte:23-27` — fetches by `id` with **no area check at all**. Any user who
  learns an id (shared link, history) opens any area's training.
- Every `video_url` (Google Drive) comes back too, and Drive "anyone with the link" files are public.

**Fix — move the rule into RLS:**

```sql
drop policy if exists "<current trainings select policy>" on public.trainings;

create policy "trainings_select_por_area"
  on public.trainings for select to authenticated
  using (
    publicado
    and (
      area = 'todos'
      or area = (select role from public.profiles where id = auth.uid())
      or (select public.is_admin())
    )
  );
```

Then delete the `.or(...)` in the page — which also removes the PostgREST filter-injection concern
from last review. **[verify]** as `colaborador`: `select('*')` must return only `todos` + own area;
`.eq('id', <rh video id>)` must return nothing.

## 4.5 🟠 NEW — Users can rewrite their own `email` (and other columns) in `profiles`

`profiles_update_proprio` (guide part 3 §8) allows a user to update **any column of their own row**.
The trigger only protects `role`. That leaves `email` (and `created_at`) writable:

```js
await supabase.from('profiles').update({ email: 'diretor.financeiro@grupomariacristina.com' })
  .eq('id', (await supabase.auth.getUser()).data.user.id)
```

Why it matters — the admin panel (`admin/+page.svelte:91`) lists users **by `profiles.email`**, and
the role dropdown sits next to it. An employee can masquerade as the finance director in that table;
an admin who goes to "give Maria the `financeiro` role" may pick the attacker's row.
That is **privilege escalation via admin confusion** — a real-world pattern.

**Fix — column-level privileges (stronger than a trigger, and simpler):**

```sql
-- authenticated users may only UPDATE these three columns, whatever RLS says
revoke update on public.profiles from authenticated;
grant  update (nome_exibicao, telefone, observacoes) on public.profiles to authenticated;

-- role changes go through a function that checks admin + validates the value
create or replace function public.admin_definir_role(alvo uuid, nova_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if nova_role not in ('colaborador','financeiro','rh','loja','regional','cd','admin') then
    raise exception 'role inválida';
  end if;
  update public.profiles set role = nova_role where id = alvo;
end $$;

-- and a CHECK so a bad role can never be stored, no matter who writes it
alter table public.profiles add constraint profiles_role_valida
  check (role in ('colaborador','financeiro','rh','loja','regional','cd','admin'));
```

Admin page then calls `supabase.rpc('admin_definir_role', { alvo, nova_role })`. Keep `email` in sync
from `auth.users` with a trigger (or stop storing it in `profiles` and read it via the admin API).

**[verify]** right now, as a `colaborador`, run the `update({ email: ... })` above. If it succeeds,
this finding is confirmed.

## 4.6 🟠 NEW — `protege_role` trigger: two gaps

```sql
if new.role is distinct from old.role and not public.is_admin() then raise exception ...
```

1. **It blocks you, too.** In the Supabase SQL editor / Table editor / service-role scripts there is
   no logged-in user, so `auth.uid()` is null → `is_admin()` is false → **every role change from the
   dashboard raises**. Promoting the very first admin (or recovering if all admins are demoted)
   requires disabling the trigger. **[verify]** by editing a role in the Table Editor.
2. **It's not the only path.** Column privileges (4.5) are the robust primitive; a trigger is a
   second layer. If 4.5 is applied, keep the trigger but allow trusted roles:
   ```sql
   if new.role is distinct from old.role
      and current_user not in ('postgres', 'service_role')
      and not public.is_admin() then ...
   ```

## 4.7 🟠 C4 (still open, now with detail) — the audit log accepts any e-mail

Policy `access_log_insert_proprio` checks only `user_id = auth.uid()`. The `email` and `evento`
columns are free text, and the admin page displays **`email`, not `user_id`**
(`admin/+page.svelte:114`). So a user can write:

```js
await supabase.from('access_log').insert({ user_id: myId, email: 'ceo@grupomariacristina.com', evento: 'login' })
```

…and the admin sees "ceo logged in", as many times as the attacker likes (also a cheap way to bloat
the table). Fix, smallest-to-best:

1. A `before insert` trigger that overwrites `email` with `(select email from auth.users where id = new.user_id)` and forces `evento` into an allowed list.
2. Revoke direct `insert`, expose `registrar_evento(evento text)` as a `security definer` RPC that fills `user_id`/`email` itself.
3. Record logins server-side (login form action in `+page.server.ts`), or use a Supabase **Auth Hook** / `auth.audit_log_entries`, so the client never writes the log.

## 4.8 🟠 Admin API endpoints — hardening gaps

Files: `src/routes/api/admin/{criar,remover,reset-senha}/+server.ts`. Once C1 is fixed these become
live, so fix these at the same time:

| Gap | Where | Risk | Fix |
|---|---|---|---|
| No input validation | all 3 `request.json()` | Malformed body → unhandled throw → 500; `novaSenha` can be `"1"` | Validate: `userId` is a UUID, password ≥ 12 chars, email ends with `@grupomariacristina.com`. Use a tiny schema (Valibot/Zod) |
| Raw error messages returned | `error(500, e.message)` | Leaks internal Supabase/Auth messages to the client | Log `e` server-side, return a generic message |
| Admin can delete / demote **themselves** or the **last admin** | `remover`, role select | Lock-out of the whole org | Refuse `userId === caller.id`; refuse if it would leave 0 admins |
| No audit of admin actions | all | No trace of who deleted/reset whom | Insert into an `admin_audit` table *from the server* with the admin's id |
| Admin **knows** the user's new password | `reset-senha` + `prompt()` | Admin can log in as that user; password shown in clear in a `prompt()` | Send a recovery link instead: `auth.admin.generateLink({ type: 'recovery', email })` or `resetPasswordForEmail`. If you keep manual reset, force change on next login |
| Wrong-verb / bad token → 500 | all (today, due to C1) | Can't tell attack from bug in logs | After C1: verify `GET` → 405, no token → 403 |
| No rate limiting | all | Brute-forcing is impractical (needs admin JWT), but a stolen admin token can mass-delete | Cloudflare rate-limiting rule on `/api/admin/*` |
| `criar` has no caller | `criar/+server.ts` | Unused attack surface | Delete it, or build the UI (roadmap ADM-3) |

## 4.9 🟡 No security headers / no CSP

Response headers from the dev server for `/login`:

```
HTTP/1.1 200 OK
Vary: Origin
content-type: text/html
etag: "1hlsako"
x-sveltekit-page: true
```

Nothing else. **[verify]** the deployed Cloudflare site at <https://securityheaders.com> — Cloudflare
adds some, but not CSP or `frame-ancestors`. Why each matters *here*:

- **CSP** — the Supabase session lives in **`localStorage`**, so *any* XSS = full account takeover
  (the attacker reads the refresh token). CSP is your second wall. SvelteKit generates nonces for you:
  ```js
  // svelte.config.js (or the sveltekit() options)
  kit: { csp: { mode: 'auto', directives: {
    'default-src': ['self'],
    'script-src':  ['self'],
    'style-src':   ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
    'font-src':    ['self', 'https://fonts.gstatic.com'],
    'img-src':     ['self', 'data:', 'https://*.supabase.co', 'https://drive.google.com', 'https://lh3.googleusercontent.com'],
    'connect-src': ['self', 'https://*.supabase.co'],
    'frame-src':   ['https://app.powerbi.com', 'https://drive.google.com'],
    'frame-ancestors': ['none'],
    'base-uri':    ['self'],
    'form-action': ['self']
  } } }
  ```
  Start in `reportOnly` mode, watch the console for a week, then enforce.
- **`frame-ancestors 'none'` / `X-Frame-Options: DENY`** — without it, a malicious page can frame
  `/admin` invisibly and trick a logged-in admin into clicking the role `<select>` (clickjacking).
- **`Referrer-Policy: strict-origin-when-cross-origin`**, **`X-Content-Type-Options: nosniff`**,
  **`Permissions-Policy: camera=(), microphone=(), geolocation=()`**, **HSTS** — set them in
  `hooks.server.ts` with `event.setHeaders` or a Cloudflare Pages `static/_headers` file.

## 4.10 🟡 Iframes: unvalidated `video_url`, no `sandbox`

`treinamentos/[id]/+page.svelte:50` renders `video.video_url` from the DB straight into
`<iframe src>`. An iframe with `src="javascript:..."` runs in **your origin** → XSS → token theft
(see 4.9). Today only someone with write access to `trainings` can plant that, so likelihood is low —
but impact is total. Validate the origin (`new URL(u).origin === 'https://drive.google.com'`), add
`referrerpolicy="no-referrer"`, and add `sandbox="allow-scripts allow-same-origin allow-presentation"`
to the Drive/Power BI frames (test that they still play). Add a DB `check (video_url like 'https://drive.google.com/%')` as the data-layer twin.

## 4.11 🟠 The login `<form>` fix does not work

Uncommitted change, `login/+page.svelte:63-65`:

```svelte
<form class="login" onsubmit={...}>
    <button type="submit" disabled={carregando}>Entrar</button>
</form>
```

The `<form>` wraps **only the button** — the two inputs (lines 46-61) are outside it. Pressing Enter in
the password field still does nothing (implicit submission only fires for inputs *inside* the form),
and password managers still won't offer to save. Side effects: the form reuses `class="login"`, so it
gets `max-width: 380px; margin: 80px auto` *again*, nested inside `main.login` → an extra 80px gap
above the button; and the "Entrando..." feedback text was dropped.

Correct shape — the form *replaces* the `<main>` contents' wrapper:

```svelte
<main class="login">
  <h1>Portal Grupo Maria Cristina</h1>
  <form onsubmit={(e) => { e.preventDefault(); fazerLogin(); }}>
    <label class="campo-usuario"> … <input … /> … </label>
    <input type="password" … />
    <button type="submit" disabled={carregando}>{carregando ? 'Entrando...' : 'Entrar'}</button>
  </form>
  {#if erro}<p class="erro" role="alert">{erro}</p>{/if}
</main>
```

Security relevance: password-manager support is a real security feature — it's what makes users pick
strong unique passwords.

## 4.12 🟡 `/perfil` — failures are reported as success

`perfil/+page.svelte:28-37`. `salvar()` ignores the `error` from `update()` and always shows
"Salvo!". If the update is rejected (RLS, trigger, network), the user is told it worked. Also:

- `.eq('id', u.user?.id)` sends `id=eq.undefined` if the session expired — fails silently.
- No length limits: `observacoes` accepts megabytes. Add `check (char_length(observacoes) <= 2000)`
  and `maxlength` on the inputs; validate `telefone` format.
- No `<form>`, so Enter doesn't save.

Not exploitable, but a security-adjacent habit: **an unchecked error is how a denied write looks
like a successful one** — you'll never notice your RLS blocking (or *not* blocking) something.

## 4.13 🟡 Database hygiene (Supabase Security Advisor will flag these)

- `is_admin()`, `handle_new_user()`, `protege_role()` are `security definer` **without
  `set search_path = ''`**. Supabase's linter flags this as `function_search_path_mutable`: a
  definer function that resolves names through a mutable search_path can be hijacked. Add
  `set search_path = ''` and fully qualify names (`public.profiles`, `auth.uid()`).
- In policies, wrap function calls as `(select public.is_admin())` / `(select auth.uid())` — Postgres
  then evaluates them once per query instead of once per row (Supabase performance advisor).
- `public.is_admin()` is executable by `anon` (it returned `false` to me). Harmless, but
  `revoke execute on function public.is_admin() from anon;` is cleaner.
- **[verify]** Dashboard → Advisors → *Security Advisor* and *Performance Advisor*. Fix everything red.

## 4.14 🟡 Account security settings (Supabase dashboard)

**[verify]** each in Authentication settings:

- **Leaked-password protection** (HaveIBeenPwned check) — on.
- **Minimum password length** ≥ 12 and character requirements.
- **MFA (TOTP)** — at minimum required for `admin` accounts. Admin is the crown jewel and store PCs
  are shared.
- **Session timebox / inactivity timeout** — shorter for a portal used on shared machines.
- **Custom SMTP** — the default Supabase mailer is rate-limited; needed before password-recovery
  e-mails (4.8) are reliable.

## 4.15 🟡 Supply chain

`npm audit`: **10 vulnerabilities (4 low, 6 high)** — `undici`, `devalue`, `wrangler`, `miniflare`,
`sharp`, `source-map-js` (high, fix available non-breaking) and `cookie` → `@sveltejs/kit` (low, needs
Kit 3). Not one is in code the browser runs, but `devalue` is used by SvelteKit's server to serialize
`load` data — it will matter the moment you add `+page.server.ts`. Run `npm audit fix` now and enable
**Dependabot** on GitHub.

## 4.16 🟢 Smaller items

- `robots.txt` still says crawl everything (H11).
- `signOut()` then `goto('/login')` — fine; `supabase-js` v2 defaults to `scope: 'global'`, so all
  devices are logged out. Decide whether that's what you want.
- `verificarAdmin` strips `'Bearer '` with `.replace` — a header like `bearer x` (lowercase) passes
  the whole string as a token. It fails closed, just sloppy. Use a regex `/^Bearer\s+(.+)$/i`.
- Session tokens in `localStorage` are readable by any script on the origin, including third-party
  ones — another reason to self-host fonts and keep CSP tight. `@supabase/ssr` moves the session to
  cookies.

---

# 5. Prioritized security backlog

Ordered by risk × effort. Each one is small enough for one evening.

| # | Item | Sev. | Effort | Section |
|---|---|---|---|---|
| 1 | Fix C1 (lazy admin client) — admin panel is dead without it | 🔴 | 15 min | prev. review C1 |
| 2 | **Rotate the finance Power BI link**, move URL list to `+page.server.ts` | 🔴 | 1 h | 4.2 |
| 3 | Run the RLS attack checklist (§6.3) as `colaborador` — confirm 4.4 / 4.5 / 4.7 | 🔴 | 30 min | 6.3 |
| 4 | Column privileges on `profiles` + `admin_definir_role` RPC + role CHECK | 🟠 | 1 h | 4.5, 4.6 |
| 5 | Area-based RLS on `trainings`; remove client `.or()` | 🟠 | 30 min | 4.4 |
| 6 | Lock down `access_log` inserts (trigger or RPC) | 🟠 | 30 min | 4.7 |
| 7 | `hooks.server.ts` + `@supabase/ssr` + server redirect + admin 403 | 🔴 | 1 day | 4.3 |
| 8 | Admin endpoint validation, self-delete guard, admin audit table, recovery-link reset | 🟠 | 2–3 h | 4.8 |
| 9 | `npm audit fix` + Dependabot | 🟡 | 10 min | 4.15 |
| 10 | Security headers + CSP (report-only first) | 🟡 | 2 h | 4.9 |
| 11 | Supabase: leaked-password protection, MFA for admins, Advisors clean | 🟡 | 1 h | 4.13, 4.14 |
| 12 | Iframe URL validation + sandbox + DB CHECK | 🟡 | 30 min | 4.10 |
| 13 | Real login `<form>`; `/perfil` error handling + length limits | 🟠/🟡 | 30 min | 4.11, 4.12 |
| 14 | `robots.txt` → `Disallow: /`, `noindex` meta | 🟢 | 2 min | 4.16 |

---

# 6. How to test your own project's weaknesses

The single most useful mindset shift: **you are not testing whether the app works — you are testing
whether it refuses.** Every security test is "do X as someone who shouldn't be allowed; expect a
denial." Below is a practical program, from zero-tooling to automated.

## 6.1 Set up a safe place to attack

**Never attack production with write operations.** Create a second Supabase project (free tier) as
*staging*, or use the local stack:

```bash
npx supabase init
npx supabase start          # local Postgres + Auth + REST in Docker
npx supabase db diff -f init  # capture your schema as migration files (see roadmap OPS-2)
```

Create three test users there: `teste.colab` (`colaborador`), `teste.fin` (`financeiro`), `teste.admin`
(`admin`). Every test below is run as each of them.

## 6.2 Level 1 — Manual, with only the browser (start here, today)

Log in as `teste.colab`, open DevTools → Console. On the dev server you can usually import the app's
own client module (Vite serves it at its source path):

```js
const { supabase } = await import('/src/lib/supabaseClient.ts');
const me = (await supabase.auth.getUser()).data.user;
```

(On a production build, copy the `apikey` + `Authorization` headers from the Network tab and use
`curl` instead — same API.)

## 6.3 The RLS attack checklist for *this* portal

Run each line as `teste.colab`. **Expected** column is what a secure system returns.

| # | Attack | Command | Expected |
|---|---|---|---|
| 1 | Read all profiles | `supabase.from('profiles').select('*')` | only own row |
| 2 | Self-promote | `supabase.from('profiles').update({role:'admin'}).eq('id', me.id)` | error (trigger) |
| 3 | Spoof own e-mail | `…update({email:'x@grupomariacristina.com'}).eq('id', me.id)` | error / 0 rows (**likely succeeds today — 4.5**) |
| 4 | Edit someone else | `…update({nome_exibicao:'hacked'}).neq('id', me.id)` | 0 rows |
| 5 | Read audit log | `supabase.from('access_log').select('*')` | `[]` |
| 6 | Forge audit entry | `…from('access_log').insert({user_id: me.id, email:'ceo@…', evento:'login'})` | error (**likely succeeds today — 4.7**) |
| 7 | Forge for another user | `…insert({user_id:'<other uuid>', evento:'login'})` | error |
| 8 | Read other areas' trainings | `supabase.from('trainings').select('*')` | only `todos` + own area (**likely all today — 4.4**) |
| 9 | Read unpublished | `…from('trainings').select('*').eq('publicado', false)` | `[]` |
| 10 | Write trainings | `…from('trainings').insert({titulo:'x'})` / `.update(...)` / `.delete()` | error |
| 11 | Delete own profile | `…from('profiles').delete().eq('id', me.id)` | error / 0 rows |
| 12 | Admin endpoints | `fetch('/api/admin/reset-senha', {method:'POST', headers:{Authorization:'Bearer '+(await supabase.auth.getSession()).data.session.access_token,'content-type':'application/json'}, body: JSON.stringify({userId: me.id, novaSenha:'x'})})` | 403 |
| 13 | Restricted dashboard | Search DevTools → Sources for `powerbi.com` | finance URL **absent** (**present today — 4.2**) |
| 14 | Restricted page | `curl -i https://<site>/admin` (no cookie) | 302/403 (**200 today — 4.3**) |
| 15 | Token after logout | copy access token → Sair → replay #1 with that token | rejected (note: JWTs stay valid until expiry ~1h — know this) |

Then repeat the whole table as `teste.fin` (should see finance) and `teste.admin` (should see all).
**Write the results down** — that table *is* your security test plan; the next step is automating it.

## 6.4 Level 2 — Automate the RLS tests (database-side, pgTAP)

Supabase has first-class support for pgTAP tests. `supabase/tests/rls_profiles.test.sql`:

```sql
begin;
select plan(3);

-- act as a colaborador
set local role authenticated;
set local request.jwt.claims to '{"sub":"<uuid teste.colab>","role":"authenticated"}';

select is( (select count(*) from public.profiles)::int, 1, 'colaborador vê só o próprio perfil');

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '<uuid teste.colab>' $$,
  null, 'colaborador não pode se promover');

select is( (select count(*) from public.trainings where area not in ('todos','colaborador'))::int, 0,
  'colaborador não vê treinamentos de outras áreas');

select * from finish();
rollback;
```

Run with `npx supabase test db`. These run in a transaction and roll back — safe and fast. Every
row of the checklist in 6.3 becomes one assertion.

## 6.5 Level 3 — Automate the app-side tests (Vitest / Playwright)

- **Endpoint authorization** (Vitest, against `npm run preview` + staging Supabase): for each admin
  endpoint × {no token, colab token, admin token} assert {403, 403, 200}. Also `GET` → 405 and a
  malformed body → 400.
- **E2E** (Playwright): login → `/admin` as colab shows "Acesso restrito" *and* the server returned
  403; financeiro sees the Financeiro tab; colab's page source never contains the finance URL:
  ```ts
  test('colab never receives the finance dashboard URL', async ({ page }) => {
    await login(page, 'teste.colab');
    const bodies: string[] = [];
    page.on('response', async (r) => { if (/\.(js|html)$|\/bi$/.test(r.url())) bodies.push(await r.text()); });
    await page.goto('/bi');
    await page.waitForLoadState('networkidle');
    for (const b of bodies) expect(b).not.toContain('MDk2Y2ZkMTMt');  // finance report id
  });
  ```

## 6.6 Level 4 — Scanners and continuous checks

| Tool | What it finds | How to run |
|---|---|---|
| **Supabase Security & Performance Advisors** | Missing RLS, mutable search_path, exposed functions, slow policies | Dashboard → Advisors; or `npx supabase db lint` |
| **npm audit** / **Dependabot** / **OSV-Scanner** | Vulnerable dependencies | `npm audit`; enable Dependabot alerts on GitHub |
| **gitleaks** | Secrets accidentally committed | `gitleaks detect` (run on full history once) |
| **Semgrep** | Insecure code patterns (SAST) | `semgrep --config p/javascript --config p/typescript` |
| **OWASP ZAP** (baseline) | Missing headers, cookie flags, info leaks | `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://<preview-url>` |
| **Burp Suite Community** | Manual interception: replay requests with another user's token, tamper bodies | Proxy the browser through Burp; use *Repeater* for 6.3 |
| **securityheaders.com** / **Mozilla Observatory** | Header grade of the deployed site | Paste the URL |
| **Lighthouse CI** | Perf/a11y regressions per commit | `@lhci/cli` in GitHub Actions against `npm run preview` |

## 6.7 Put it in CI

One workflow, `.github/workflows/ci.yml`, running on every push:

```
npm ci → npm run lint → npm run check → npm run build → npm audit --audit-level=high
       → supabase start && supabase test db   (RLS tests)
       → vitest / playwright                  (authz tests)
       → gitleaks
```

The build step alone would have caught C1 the day it was introduced.

## 6.8 A recurring habit

Every time you add a feature, before merging, answer three questions in the PR description:

1. **What new data or action does this expose?** (new table, column, endpoint, iframe)
2. **Who must NOT be able to use it, and where is that enforced?** — the answer must be "RLS" or
   "server", never "the button is hidden".
3. **Which test proves the denial?** — add a row to the 6.3 table / a pgTAP assertion.

Applying this to `/perfil` would have caught 4.5 before it was written.

---

# 7. Learning path

Ordered for this project. Free unless noted.

1. **PortSwigger Web Security Academy** — the best free web-security course. Do, in order: *Access
   control* (directly 4.2, 4.4, 4.5), *Authentication*, *Clickjacking* (4.9), *Cross-site scripting*
   (4.10), *CSRF*. Labs run in your browser.
2. **Supabase docs** — *Row Level Security*, *Column Level Security*, *Database Functions → Security
   definer*, *Testing Your Database (pgTAP)*, *Auth: Server-Side Rendering (SvelteKit)*, *Production
   checklist*. These are the exact primitives used in §4.
3. **OWASP Top 10** (read once, as a map) and **OWASP ASVS Level 1** (use as a checklist — ~100 items,
   about half apply here). **OWASP Cheat Sheet Series**: *Authorization*, *Content Security Policy*,
   *Logging*, *Password Storage*, *Session Management*.
4. **OWASP Juice Shop** — a deliberately vulnerable app; run it locally (`docker run -p 3000:3000
   bkimminich/juice-shop`) and practice with Burp/ZAP before pointing them at your own app.
5. **Threat modeling** — *Threat Modeling: Designing for Security* (Shostack, paid) or the free
   *OWASP Threat Modeling Cheat Sheet*. Redo §3 for every new feature.
6. **Then** TryHackMe / HackTheBox web paths if you enjoy the offensive side.

---

# 8. Honest take

The database side is in better shape than the app side: anonymous access is fully denied, sign-up
is off, admin checks happen in Postgres with the caller's own JWT, and the self-promotion trigger shows
you're thinking in "deny at the data layer" terms. That is the hardest instinct to build, and it is
there.

The weak spots all have the same shape: **a rule that protects one column or one path, while a
neighbouring column or path is left open** — role is protected but email isn't; `user_id` in the log
is checked but `email` isn't; the list page filters by area but the detail page doesn't; the finance
URL is hidden in the UI but present in the bundle. The fix for that is not more cleverness, it's
**systematic testing** — the 6.3 table, run as each role, every time. An afternoon with that table
will teach you more about this app's security than any review.

And please fix C1 before anything else: the admin panel's two most powerful buttons have never worked.
