# Code & UX Review — Portal GMC (portal_v2)

**Date:** 2026-10-07
**Branch reviewed:** `v1.3` (HEAD `5a81c01`, plus uncommitted `src/routes/admin/`, `src/routes/api/admin/criar/`, `src/routes/api/admin/remover/` and a modified `src/routes/+page.svelte`)
**Reviewer:** senior full-stack review, conducted against a running dev server and a real production build

> All findings below were observed, not inferred. I ran the dev server on `:5199`, fetched every route,
> probed the API endpoints with `curl`, screenshotted the login page at 1280px and 390px, and reproduced
> and fixed the build failure in a throwaway copy to confirm the diagnosis. The repository itself was
> left untouched.

---

## Table of contents

1. [Step 1 — What I found](#step-1--what-i-found)
2. [Step 2 — Review by dimension](#step-2--review-by-dimension)
   - [1. Code quality & architecture](#1-code-quality--architecture)
   - [2. UI & visual design](#2-ui--visual-design)
   - [3. UX & usability](#3-ux--usability)
   - [4. Responsiveness](#4-responsiveness)
   - [5. Accessibility](#5-accessibility)
   - [6. Performance](#6-performance)
   - [7. SEO & metadata](#7-seo--metadata)
   - [8. Security](#8-security)
   - [9. Testing & reliability](#9-testing--reliability)
   - [10. Stack-specific best practices](#10-stack-specific-best-practices-sveltekit-2--svelte-5)
3. [Step 3 — Prioritized findings](#step-3--prioritized-findings)
4. [Step 4 — What to study](#step-4--what-to-study)
5. [Honest overall take](#honest-overall-take)

---

# Step 1 — What I found

## Stack

SvelteKit 2.63 on Svelte 5 (runes mode forced in `vite.config.ts:10`), TypeScript 6 strict, Vite 8,
`@sveltejs/adapter-cloudflare` → Cloudflare Pages/Workers. Backend is Supabase
(`@supabase/supabase-js`). Prettier configured; no ESLint, no test runner, no CI.

## Structure

15 source files, ~700 lines total.

```
src/lib/supabaseClient.ts        anon client (browser)
src/lib/server/supabaseAdmin.ts  service-role client
src/lib/server/verificarAdmin.ts is_admin RPC check
src/routes/+layout.svelte        client-side auth gate
src/routes/+page.svelte          home (two tiles)
src/routes/login/+page.svelte
src/routes/bi/+page.svelte       Power BI iframes, tabbed
src/routes/treinamentos/         list + [id] player (Drive iframes)
src/routes/admin/+page.svelte    user table, roles, reset/remove
src/routes/api/admin/{criar,remover,reset-senha}/+server.ts
```

## Purpose

An internal employee portal for Grupo Maria Cristina — login with a fixed
`@grupomariacristina.com` domain, role-gated Power BI dashboards and training videos, plus an admin
panel. Audience is staff, not the public. The `lib/*.md` files are self-authored
learn-by-rebuilding guides, which indicates this is a deliberate skill-building rewrite of a live MVP.

## Build / run

`npm run dev` works. **`npm run build` does not.** It dies every time:

```
Error: supabaseUrl is required.
  at .svelte-kit/output/server/chunks/verificarAdmin.js:5:21
  at async analyse (@sveltejs/kit/src/core/postbuild/analyse.js:106)
```

---

# Step 2 — Review by dimension

## 1. Code quality & architecture

### Done well

Small and legible. Consistent Portuguese naming (`carregando`, `erro`, `usuarios`) — a real decision
consistently applied, which is better than half-English drift. Types are declared where they matter
(`Training`, `Usuario`, `Acesso`). Svelte 5 runes used correctly. The three API endpoints share an
identical, correct auth-check shape.

### Weak — the architecture is the core problem

Every page is a client-only component that fetches in `onMount`. There are **zero**
`+page.server.ts`, `+page.ts`, `+layout.server.ts`, or `hooks.server.ts` files. `@supabase/ssr` — the
package that exists precisely to solve this — is installed and never imported:

```
$ grep -rn "supabase/ssr" src/
NOT USED ANYWHERE
```

That one unused dependency is the whole review in miniature: the right tool was known to exist, and
the client-only version was built anyway.

### Duplication

The same role lookup is copy-pasted three times — `+page.svelte:14-22`, `bi/+page.svelte:18-25`,
`treinamentos/+page.svelte:22-29`. Extract it:

```ts
// src/lib/obterPerfil.ts
import { supabase } from '$lib/supabaseClient';

export async function obterPerfil() {
	const { data: userData } = await supabase.auth.getUser();
	const user = userData.user;
	if (!user) return null;
	const { data, error } = await supabase
		.from('profiles').select('role').eq('id', user.id).single();
	if (error) return { id: user.id, email: user.email ?? '', role: 'colaborador' };
	return { id: user.id, email: user.email ?? '', role: data.role as string };
}
```

### Dead code

- `/api/admin/criar/+server.ts` has no caller anywhere — the admin UI has no "create user" button.
- `src/lib/index.ts` is a one-line template comment.
- `@supabase/ssr` is an unused dependency.

### Errors discarded by destructuring

This pattern is everywhere:

```ts
const { data: perfil } = await supabase.from('profiles')...   // +page.svelte:16
const { data: log } = await supabase.from('access_log')...     // admin:31
await supabase.from('profiles').update({ role: novaRole })...  // admin:41
```

`admin:41` is the worst — a role change can fail silently and `carregar()` re-renders the old value
with no message. The user sees the dropdown snap back and has no idea why.

### Formatting

There is a prettier config and a `lint` script. Running it:

```
$ npx prettier --check .
Code style issues found in 19 files.
```

That is **every file in the project**. `+page.svelte` uses 4 spaces, `admin/+page.svelte` uses tabs,
`bi/+page.svelte` uses 2. The API files have body code dedented to column 0 inside the handler
(`criar/+server.ts:13-19`). `svelte-check` passes with 0 errors, so that one is being run — the other
is not.

### Type sloppiness

`verificarAdmin.ts:4`: `accessToken: String` — capital `S`, the boxed object wrapper, not the
`string` primitive. It compiles because `string` is assignable to `String`, but it is wrong and TS
lint rules ban it.

---

## 2. UI & visual design

### Done well

`app.css` is a genuine design system start — named institutional tokens (`--azul-pleno`,
`--verde-heritage`, `--ouro-legado`), a serif/sans pairing (Cormorant Garamond + Lato). The login page
looks clean and intentional.

### Weak — the design system is defined and then opted out of

Three of five pages override the brand font back to the OS default:

```css
.home   { font-family: system-ui, sans-serif; }   /* +page.svelte:58 */
.lista  { font-family: system-ui, sans-serif; }   /* treinamentos:69 */
.player { font-family: system-ui, sans-serif; }   /* [id]:60 */
```

So login is Lato/Cormorant and everything behind it is Segoe/Roboto. Delete those three declarations —
`body` in `app.css:14` already sets Lato.

Same for color: `.card` uses `#ddd`, `.voltar` uses `#555`, `.desc` uses `#444`, `.bloco` uses `#ddd` —
all hardcoded, all bypassing `--borda` and `--texto-suave`.

### Classes referenced in markup with no styles at all

`.topo`, `.marca`, `.usuario`, `.badge` (`+page.svelte:34-39`). The `.badge` renders as bare text next
to the email. The admin link added in the working diff drops into a `space-between` flex as a third
child, so the header becomes `marca | link | usuario` with the link floating awkwardly in dead center.

### The admin page has no `<style>` block whatsoever

`src/routes/admin/+page.svelte` is raw unstyled `<table>` with default serif borders. It is the most
destructive screen in the app and looks the least finished.

### Contrast failure

`app.css:37`, `button.destaque { background: var(--ouro-legado) }` inherits `color: #fff` from
`app.css:26`. White on `#D5B038` is **2.08:1** — WCAG AA needs 4.5:1. Use `color: var(--azul-pleno)`
on gold.

### Verified layout bug

Screenshots of the login page at 1280px and 390px both show the `@grupomariacristina.com` suffix
**clipped mid-word** — `@grupomariacristina.co` + a cut `m` on desktop, `@grupomariacris` on mobile.

Cause is `login/+page.svelte:93-99`: the input has `flex: 1` but default `min-width: auto`, so it
refuses to shrink below its intrinsic ~20ch width, pushing `.dominio` (which is
`white-space: nowrap`) past the container, where `overflow: hidden` on `.campo-usuario:91` chops it off.

```css
/* before — login/+page.svelte:93 */
.campo-usuario input { flex: 1; border: none; padding: 12px; font-size: 15px; outline: none; }

/* after */
.campo-usuario input {
	flex: 1;
	min-width: 0;        /* lets the flex item actually shrink */
	border: none; padding: 12px; font-size: 15px;
}
```

This is on the only public page, visible on the first screen, on every device. Worth internalizing:
**`min-width: 0` on flex children** is the single most common flexbox gotcha.

---

## 3. UX & usability

### Done well

`carregando` loading states on four pages. A real empty state at `treinamentos:53`. Thoughtful login
design (type the username, domain is appended for you). Typed-email confirmation for account deletion
(`admin:61`) is a better pattern than a plain `confirm()`.

### There is no `<form>` on the login page

The button at `login:63` is `onclick`, not `type="submit"`. Pressing **Enter** in the password field
does nothing. Every user will try this.

```svelte
<!-- after -->
<form class="login" onsubmit={(e) => { e.preventDefault(); fazerLogin(); }}>
  ...
  <button type="submit" disabled={carregando}>…</button>
</form>
```

Browser password-manager save prompts come for free with this, which they currently do not.

### `prompt()` and `alert()` for destructive admin operations

`admin:46, 57, 61, 73`. Browser modals are unstyled, unthemed, blocked by some configs, and
`prompt()` for a **new password** shows it in plaintext in a box with no masking and no confirmation
field. Replace with an in-page form.

### No error states anywhere except login

If `/treinamentos` fails to load, `treinamentos:42` (`if (!error && data)`) leaves `videos` empty and
renders "Nenhum treinamento disponível" — a network failure is indistinguishable from an empty
catalog. Track a third state:

```ts
let estado: 'carregando' | 'ok' | 'erro' = $state('carregando');
```

### No empty state on `/bi`

If a user's role matches no dashboard, `abasVisiveis` is `[]`, `dashboardAtual` is `undefined`, and
the page renders a heading, an empty tab bar, and nothing else.

### Login error message is swallowed

`login:27` hardcodes `'E-mail ou senha inválidos.'` for every failure — including "network down",
"rate limited", and "email not confirmed". Branch on `error.message` / `error.status` for at least
the rate-limit case.

### Race on login

`login:29` calls `goto('/')` un-awaited, then lines 32-39 fire a `getUser()` + `access_log` insert on
a component that is navigating away. That insert can be cancelled. Move it before the `goto`, or
better, to the server (see [Security](#8-security)).

### No input validation

Submitting an empty username posts `@grupomariacristina.com`. Typing a full email produces
`fernando@grupomariacristina.com@grupomariacristina.com`.

---

## 4. Responsiveness

### Done well

`treinamentos:71` uses `repeat(auto-fill, minmax(220px, 1fr))` — correctly fluid, no media query
needed. Both iframe wrappers use the padding-top aspect-ratio trick (`bi:88`, `[id]:62`).

### Weak

- **No media queries exist in the project.** Zero.
- `+page.svelte:60` — `grid-template-columns: 1fr 1fr` is hardcoded. On a 390px phone the two tiles
  are ~175px wide with 24px padding, leaving ~127px of content. Use
  `repeat(auto-fit, minmax(220px, 1fr))` as already done on treinamentos.
- `+page.svelte:59` — `header` is `display: flex` with no `flex-wrap`. On mobile this crams brand +
  admin link + email address + role badge + Sair button onto one unwrapping row. Add
  `flex-wrap: wrap; gap: 12px`.
- `+page.svelte:58` — `.home { margin: 40px auto }` with no horizontal padding, so on mobile content
  touches both screen edges. `treinamentos` and `player` have the same gap.
- `admin/+page.svelte` — two wide tables, no wrapper. They will overflow the viewport body
  horizontally on any phone. Wrap each in `<div style="overflow-x:auto">`.
- Power BI iframes at 56.25% padding-top are ~220px tall on a phone. Power BI report canvases are not
  usable at that size; consider an "open full screen" link on narrow viewports.

---

## 5. Accessibility

### Done well

`<html lang="pt-BR">` in `app.html:2`. Both iframes have `title` attributes (`bi:61`, `[id]:49`) —
genuinely often missed. `autocomplete="username"` / `"current-password"` are correct. Images have
`alt` (`treinamentos:59`). The admin tables use proper `<thead>` / `<th>`.

### Keyboard focus is invisible on the login page

`login:98` and `login:116` both set `outline: none` with no replacement. A keyboard user tabbing
through the login form has no idea where they are. This is WCAG 2.4.7, Level AA, and it is the most
common a11y mistake in hand-rolled CSS.

```css
/* after — add, and delete both outline:none */
.campo-usuario:focus-within { border-color: var(--verde-heritage); }
input:focus-visible { outline: 2px solid var(--verde-heritage); outline-offset: 2px; }
```

### No labels — placeholders are not labels

`login:47` and `login:56` have `placeholder` only. Screen readers in some combinations announce
nothing; the text vanishes as soon as the user types, so anyone who loses their place cannot recover.
The `<label>` at line 46 wraps the input but has no text content.

```svelte
<label class="campo-usuario" for="usuario">
  <span class="rotulo-oculto">Usuário</span>
  <input id="usuario" type="text" placeholder="seu.nome" bind:value={usuario} … />
```

### Error not announced

`login:67-69` renders the error into a plain `<p>`. A screen-reader user clicks Entrar and hears
silence. Add `role="alert"` (or `aria-live="polite"`) so it is announced on appearance.

### No loading announcement

Every `{#if carregando}<p>Carregando...</p>{/if}` is visual-only. Use `<p role="status">`.

### Other

- Role badge has no accessible meaning — `+page.svelte:39` renders a bare role string with no context;
  "admin" read out after an email address is ambiguous.
- No skip link, no `<nav>` landmark on the home header.
- Gold-button contrast failure from [§2](#2-ui--visual-design).
- Admin tables need `<th scope="col">` and a `<caption>`; the delete button's accessible name is just
  "Remover" repeated N times with no indication of which row.

---

## 6. Performance

Measured from a real production build (in a scratch copy, with the build fixed):

| Metric | Value |
|---|---|
| Total client JS | 306 KB raw / **88 KB gzipped** |
| Largest chunk | **214 KB** = `@supabase/supabase-js` |
| CSS | ~3.4 KB total |

### `supabase-js` is on the critical path of the login page

Verified the import graph — node 3 (login) and node 0 (layout) both pull chunk `BwL1W9mn.js`. A user
on hotel wifi stares at a white screen until 214 KB of JS downloads, parses, and runs, *before* the
login form becomes interactive.

### Every page SSRs to an empty body

The actual HTML the server returns for `/`:

```html
<body data-sveltekit-preload-data="hover">
  <div style="display: contents"><!--[--><!--[0--><!--[--><!--[-1--><!--]--><!--]--><!--]--> …
```

Nothing. Same for `/bi`, `/treinamentos`, `/admin`. The cause is `+layout.svelte:34` —
`{#if estaNoLogin || pronto}` and `pronto` is only set in `onMount`, which never runs on the server.
So: blank page → JS loads → supabase loads → `getSession()` → *then* content. Users will see a white
flash on every cold load. `/login` is the only route that renders server-side.

### Other

- `verificarAdmin.ts:5` calls `createClient()` on **every single admin API request**, constructing a
  whole new Supabase client per call. Hoist it or use the admin client with an explicit JWT.
- `treinamentos:59` — `<img>` with no `width`/`height` (guaranteed CLS as thumbnails pop in), no
  `loading="lazy"`, no `decoding="async"`, and no `onerror` fallback, so a dead `thumbnail_url` leaves
  a broken-image icon.
- `app.html:5` loads two Google Fonts families with 6 weights total including italic. Maybe three are
  used. Trim the URL.
- No `preload` on the critical font; `display=swap` is set, which is correct.

---

## 7. SEO & metadata

**Not one page has a `<title>`.** The only `<svelte:head>` in the project is `+layout.svelte:30-32`
and it contains just the favicon link. Every tab reads the bare URL. Also missing: `meta description`,
Open Graph, canonical.

This is an **internal portal**, so public SEO is irrelevant. But `static/robots.txt` currently says:

```
User-agent: *
Disallow:
```

That is "crawl everything." For a staff-only portal it should be:

```
User-agent: *
Disallow: /
```

Titles still matter for a different reason: users keep this open in a tab alongside ten others and
need to find it. Add per-page titles:

```svelte
<svelte:head><title>Treinamentos · Portal GMC</title></svelte:head>
```

Semantic markup is decent — `<main>`, `<header>`, `<nav>`, `<section>`, real `<table>`.
`app.html:12`'s `<div style="display: contents">` wrapper is SvelteKit's own default, fine to leave.

---

## 8. Security

This is where the most serious findings are.

### 🔴 Restricted dashboard URLs are shipped to every user

`bi/+page.svelte:7-9` hardcodes both Power BI URLs in the component, then filters client-side at line
30. Grepping the production bundle:

```
$ grep -rl "MDk2Y2ZkMTMtODg0Ni00Y2VlLTg0NjItMjY5Nzg0MzZmNzky" .svelte-kit/output/client/
.svelte-kit/output/client/_app/immutable/nodes/4.Cpqx6b7R.js
```

The `financeiro` URL is in a static JS file served to anyone who requests it. And these are Power BI
**"publish to web"** links — they require no authentication at all. So any employee (and anyone they
forward the URL to, and any crawler that finds that JS file) can open the financial dashboard. `role`
filtering in JavaScript is decoration, not access control. Move the URL list behind a
`+page.server.ts` load that checks the role server-side and returns only the permitted entries.

### 🔴 The admin check is `perfis.length > 1`

`admin/+page.svelte:27`:

```ts
if (perfis && perfis.length > 1) { souAdmin = true; … }
```

This infers "this user is an admin" from "RLS returned more than one row." The comment above it is
honest about the trick. It breaks the moment RLS lets a manager see their team, and it breaks the
other way when the org has exactly one user. More importantly it establishes that the admin UI's gate
is a *client-side guess*. A correct `is_admin()` RPC already exists — call it:

```ts
const { data: ehAdmin } = await supabase.rpc('is_admin');
souAdmin = ehAdmin === true;
```

### 🔴 No server-side route protection at all

Every route returns `200` unauthenticated — verified for `/`, `/bi`, `/treinamentos`, `/admin`.
Protection is `+layout.svelte:21`'s `goto('/login')`, which runs in the browser and can be skipped by
anyone with devtools. The actual security perimeter today is **Supabase RLS alone**. If every RLS
policy on `profiles`, `trainings`, and `access_log` is airtight, this is survivable; if any one of
them is permissive, there is nothing behind it. Add `src/hooks.server.ts` + `+layout.server.ts` with
`@supabase/ssr` (already installed) so the session is validated on the server and `/admin` 302s before
a byte of HTML is sent.

### 🔴 The audit log is written by the client

`login:34` inserts into `access_log` from the browser. Anyone can open the console and insert
arbitrary rows — fake logins for other people's emails, fake events, or flood it. An audit log the
audited party can write is not an audit log. Move it server-side (a Postgres trigger on
`auth.users.last_sign_in_at`, or a `+page.server.ts` login action).

### 🟠 PostgREST filter injection

`treinamentos:38`:

```ts
query = query.or(`area.eq.${role}, area.eq.todos`);
```

`role` is interpolated raw into a PostgREST filter expression. Today `role` comes from an internal
`profiles` table so it is low-risk — but if an admin ever sets a role containing `,` or `)`, or a
future code path lets a user influence it, this becomes a filter-injection hole. Validate against the
`ROLES` whitelist (which already exists at `admin:13` — another reason to share it in `$lib`) before
interpolating.

Note the existing string also has a space after the comma: `area.eq.todos` is sent as
`" area.eq.todos"`, which may or may not match depending on PostgREST's trimming — worth testing.

### 🟠 Admin endpoints are 500-ing on everything

Because of the build bug ([C1](#-critical)), module import throws, so the handler never runs:

```
POST /api/admin/remover  (no auth)    → 500 Internal Error
POST /api/admin/criar    (bad token)  → 500
GET  /api/admin/criar    (wrong verb) → 500
```

It happens to fail closed, but these should be **403** and **405**, which means a misconfiguration
cannot be distinguished from an attack in the logs. Also: no rate limiting on any of these, and no
`Origin`/CSRF consideration (SvelteKit's built-in CSRF protection covers form posts, not `fetch` with
a JSON content-type).

### 🟡 `.env` handling is mostly right, with one bug

`.env` is gitignored, never committed, never in history — verified. The anon key is a
`sb_publishable_*` key, public by design. **But**: there is no `SUPABASE_SERVICE_ROLE_KEY` in `.env`
at all, and `supabaseAdmin.ts:6` reads `PUBLIC_SUPABASE_URL` from `$env/dynamic/private` — the wrong
namespace for a public variable. Also missing: a `.env.example` (`.gitignore:19` explicitly allows
one) so the next person knows which three vars to set.

### 🟡 Dependency vulnerabilities

```
10 vulnerabilities (4 low, 6 high)
undici 7.0.0–7.29.0 — 10 advisories incl. TLS cert validation bypass,
                      cross-user cookie disclosure, response splitting
```

`npm audit fix` resolves these without breaking changes. Separately, SvelteKit, both adapters, and
TypeScript are each a **full major version** behind (Kit 2→3, adapters 7→8, TS 6→7).

### 🟡 Iframes have no `sandbox` or `referrerpolicy`

`bi:60`, `[id]:48`. Third-party origins are embedded with full permissions. `[id]:50` renders
`video_url` straight from the database into `src` — if a row ever contains `javascript:`, that is XSS.
Validate the URL's origin before rendering:

```svelte
{#if video.video_url.startsWith('https://drive.google.com/')}
  <iframe src={video.video_url} referrerpolicy="no-referrer" … ></iframe>
{/if}
```

Svelte escapes all `{expr}` text interpolation, so there is no XSS in the text path — that part is
clean.

---

## 9. Testing & reliability

There is nothing here. No test runner, no test files, no `.github/`, no ESLint. For a 700-line
internal portal that is a defensible trade — but **two specific things must be tested**, because they
are the ones that silently destroy data or leak it:

1. **The RLS policies.** Log in as a `colaborador` and attempt `select * from profiles`,
   `update profiles set role='admin'`, `insert into access_log`. If any succeed, the whole security
   model is gone. This is a 15-minute manual check and the highest-value testing available today.
2. **The three admin endpoints.** No token → 403. Valid non-admin token → 403. Valid admin token → 200.

Then add a smoke test. `@sveltejs/adapter-cloudflare` + Vitest + `@testing-library/svelte` for
`verificarAdmin`, or Playwright for a login → home → logout flow. Either beats zero.

### Reliability gaps today

- No error boundary (`src/routes/+error.svelte` does not exist, so failures show SvelteKit's default
  page).
- No `try/catch` around any `await`.
- No timeout on any fetch.
- `[id]:27`'s `.single()` throws a PostgREST error on a bad UUID rather than returning null, and it is
  swallowed into "Vídeo não encontrado" — correct outcome, accidental mechanism.

---

## 10. Stack-specific best practices (SvelteKit 2 / Svelte 5)

### Doing right

Runes (`$state`, `$derived`, `$props`) used correctly and consistently — no `export let` left over, no
`$:` reactive statements. `{ children }` + `{@render children()}` is the current snippet API.
`onclick` not `on:click`. Typed `RequestHandler` imports from `./$types`.

### Doing wrong

**1. `$app/stores` is deprecated.** `+layout.svelte:6` and `[id]/+page.svelte:4`. In SvelteKit 2.12+
use `$app/state`, which is runes-based and drops the `$` prefix:

```ts
import { page } from '$app/state';
let estaNoLogin = $derived(page.url.pathname === '/login');  // no $page
```

**2. `onMount` is not SvelteKit's data-loading primitive.** `load` functions are. All five pages fetch
in `onMount`, which is what forces the blank SSR, the waterfall, and the client-side-only auth. This
is the single highest-leverage change in the whole review.

**3. `throw error(...)` is legacy.** In SvelteKit 2, `error()` throws internally — `return error(403, …)`
or just `error(403, …)`. `throw` still works but will warn.

**4. `#each` without keys** (`admin:89`, `admin:112`, `bi:47`, `treinamentos:57`). On `admin:89` this
matters: after `mudarRole` → `carregar()`, Svelte re-uses DOM by index. Use
`{#each usuarios as u (u.id)}`.

**5. Module-level side effects in `$lib/server`.** Covered below — it is the build break.

---

# Step 3 — Prioritized findings

## 🔴 Critical

### C1. The build is broken. Nothing can be deployed.

`src/lib/server/supabaseAdmin.ts:5` calls `createClient()` at module scope with
`$env/dynamic/private`, which is empty during SvelteKit's postbuild `analyse` pass. `vite build`
crashes 100% of the time. Supplying the env vars does not help — dynamic private env is unavailable at
build by design. The fix is laziness:

```ts
// before — src/lib/server/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export const supabaseAdmin = createClient(
    env.PUBLIC_SUPABASE_URL ?? '',
    env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession:false } }
);
```

```ts
// after
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
	if (client) return client;
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
	client = createClient(PUBLIC_SUPABASE_URL, key, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
	return client;
}
```

Then `supabaseAdmin.auth.admin.x()` → `getSupabaseAdmin().auth.admin.x()` in all three endpoints.

> **Verified:** exactly this change was applied in a scratch copy and the build went green in 3.2s.
> Two bugs fixed at once: the eager-init crash, and `PUBLIC_SUPABASE_URL` being read from the private
> namespace.

Also add `SUPABASE_SERVICE_ROLE_KEY=` to `.env` (it is not there) and to Cloudflare Pages env settings.

**Why it matters:** nothing else on this list can ship until this does.

### C2. Financial dashboard URL is public

See [§8](#-restricted-dashboard-urls-are-shipped-to-every-user). Anyone with the bundle has an
unauthenticated Power BI link to finance data. **Rotate that publish-to-web link after moving it
server-side** — the one currently in `bi/+page.svelte:8` must be assumed compromised.

### C3. Zero server-side authorization

See [§8](#-no-server-side-route-protection-at-all). RLS is the only perimeter. Audit every policy
today; add `hooks.server.ts` this week.

### C4. Client-writable audit log

See [§8](#-the-audit-log-is-written-by-the-client). The `access_log` table is currently a suggestion
box, not a log.

## 🟠 High

| # | Issue | Where | Fix |
|---|---|---|---|
| **H1** | Enter doesn't submit login | `login:43-65` | Wrap in `<form onsubmit>`, `type="submit"` |
| **H2** | Keyboard focus invisible | `login:98,116` | Delete `outline:none`, add `:focus-visible` |
| **H3** | Every page SSRs blank | `+layout.svelte:34` | Move auth to server load |
| **H4** | Domain suffix clipped on all viewports | `login:93` | `min-width: 0` |
| **H5** | Admin check is `length > 1` | `admin:27` | `supabase.rpc('is_admin')` |
| **H6** | 500s instead of 403/405 | all 3 endpoints | Fixed by C1 |
| **H7** | `undici` high-severity CVEs | `package-lock` | `npm audit fix` |
| **H8** | Errors silently discarded | ~12 sites | Destructure `error`, surface it |
| **H9** | `prompt()` for new passwords | `admin:46` | In-page masked form |
| **H10** | No `<title>` on any page | all | `<svelte:head><title>` |
| **H11** | `robots.txt` invites crawlers | `static/robots.txt` | `Disallow: /` |

## 🟡 Medium

- Brand font overridden on 3 pages (`+page:58`, `treinamentos:69`, `[id]:60`)
- Admin page completely unstyled
- `.badge` / `.marca` / `.usuario` have no CSS
- Gold-on-white 2.08:1 contrast (`app.css:37`)
- Role lookup duplicated 3×
- `@supabase/ssr` unused, `/api/admin/criar` has no caller
- `prettier --check` fails on 19/19 files
- `$app/stores` deprecated (2 files)
- `accessToken: String` (`verificarAdmin:4`)
- New Supabase client per request (`verificarAdmin:5`)
- No error/empty states (`/bi`, `/treinamentos`)
- Home grid doesn't stack on mobile (`+page:60`)
- No media queries anywhere
- Admin tables overflow mobile
- Images lack dimensions / lazy / fallback (`treinamentos:59`)
- PostgREST filter interpolation (`treinamentos:38`)
- No `+error.svelte`
- Iframes unsandboxed
- Deps a major version behind

## 🟢 Low

- `#each` without keys (4 sites)
- `throw error()` legacy form
- Mixed tab/space indentation
- `README.md` is the untouched `sv` template
- No `.env.example`
- Google Fonts loads 6 weights for ~3 used
- Typo `"Dasboards"` (`+page:52`)
- `"Seu Usuario"` missing accent (`login:51`)
- Two leading blank lines in `.env`
- No ESLint

---

# Step 4 — What to study

Ranked by how much each would have changed *this* codebase.

## 1. SvelteKit's server-side data loading model ⭐ highest leverage

**What I saw:** five pages, five `onMount` fetches, zero `load` functions, zero server files.
`@supabase/ssr` installed and never imported. This one gap directly caused C3 (no auth perimeter), H3
(blank SSR), the 214 KB-before-login waterfall, and the duplicated role lookup.

**Learn:** `+page.server.ts` vs `+page.ts` vs `+layout.server.ts` — when each runs and what each can
see. `hooks.server.ts` with `event.locals`. Why `getSession()` is not trustworthy on the server and
`getUser()` is. The `@supabase/ssr` cookie-based session pattern.

**Practice:** port `/bi` first. Move `DASHBOARDS` into `src/routes/bi/+page.server.ts`, filter by the
server-verified role, return only permitted entries. The page component becomes
`let { data } = $props()` and the leak in C2 is closed structurally. Then do `/treinamentos`, then the
layout guard. Supabase's official SvelteKit auth guide is the exact walkthrough.

## 2. The client/server trust boundary

**What I saw:** `perfis.length > 1` as an admin test. Role filtering in a `$derived`. `access_log`
written from the browser. Secret-ish URLs in a client component. The pattern is consistent: the
browser is treated as part of the system. It is not — it is input from an untrusted party.

**Learn:** "never trust the client" as a mechanical habit, not a slogan. Supabase RLS deeply —
`auth.uid()`, policy debugging, `security definer` functions. The difference between *hiding* a
capability in the UI and *denying* it at the data layer.

**Practice:** open devtools on the portal as a `colaborador` and try to break it. Set
`role = 'admin'` in the console. Call `supabase.from('profiles').select('*')` directly. Insert a fake
`access_log` row. Every attempt that succeeds is a missing RLS policy. Write down what you find — that
list is the real security backlog.

## 3. Error handling and state modeling

**What I saw:** `const { data } = await …` twelve times, dropping `error` on the floor. `admin:41` can
fail completely silently. Two-state `carregando: boolean` everywhere, so "failed" and "empty" render
identically.

**Learn:** model UI state as a union, not a boolean — `'carregando' | 'ok' | 'vazio' | 'erro'`.
SvelteKit's `error()` / `+error.svelte` / `handleError`. Why the Go-style `{ data, error }` tuple
Supabase returns is a *prompt* to handle the error, not decoration.

**Practice:** pick `/treinamentos`, add the four-state union, then kill wifi and reload. Then do the
same for the other three pages.

## 4. CSS layout fundamentals + accessibility basics

**What I saw:** a clipped field on the only public page, `outline: none` with nothing replacing it,
zero media queries, placeholder-as-label, a design system defined and then overridden on 60% of pages.
These are not taste problems — they are a handful of specific mechanics not yet encountered.

**Learn:** flexbox `min-width: 0` and the `min-content` floor (fixes H4 and will fix a dozen future
bugs). `:focus-visible`. Why placeholders are not labels. `aria-live` / `role="alert"`. CSS custom
properties as a *contract* — if `--texto-suave` is defined, never write `#555` again.

**Practice:** run the login and home pages through axe DevTools or Lighthouse's a11y audit. Fix
everything flagged. Then tab through the entire app with the mouse unplugged — losing track of
position anywhere is a bug.

## 5. Tooling discipline

**What I saw:** a prettier config and a `lint` script, and 19 of 19 files failing it. A build that has
presumably been broken for a while, uncaught. 10 CVEs.

**Learn:** pre-commit hooks (husky + lint-staged). A GitHub Action that runs
`npm run lint && npm run check && npm run build` on every push — that alone would have caught C1 the
day it landed. `npm audit` in CI.

**Practice:** add the workflow file today. It is ~15 lines and it is the highest
reliability-per-effort change available.

---

# Honest overall take

The fundamentals of the judgment here are better than the execution. The stack choice is sane, Svelte
5 runes are used correctly, there is a real color/type system, consistent domain-language naming, and
an `is_admin()` RPC plus a server-side endpoint layer — that last one means the principle that secrets
belong on the server is *understood*. The `lib/*.md` guides show deliberate learning rather than
pasting.

What is missing is one specific thing, and everything on the Critical list traces back to it:
**the build is client-side-first, and the server is an afterthought.** The exact library that fixes
this (`@supabase/ssr`) is installed, and the client-only version was written anyway. That is not a
knowledge gap so much as a habit — reaching for `onMount` because it is familiar. Break that habit and
C2, C3, C4, H3, H5, and most of the performance section disappear together.

Second honest note: **a broken build shipped.** `npm run build` has never worked with the admin
endpoints in place. Nothing caught it because nothing runs it. That is the gap between writing code
and operating software, and CI closes it in fifteen lines.

## Suggested order of work

1. **C1** — fix the build. Nothing else can ship.
2. **C2** — move the Power BI URLs server-side, then rotate the finance link.
3. **C3** — audit every RLS policy manually (the devtools exercise in Study §2).
4. **H1, H2, H4** — three mechanical fixes to the login page, ~20 minutes total.
5. **C3 cont.** — add `hooks.server.ts` + `+layout.server.ts` with `@supabase/ssr`.
6. **C4** — move `access_log` writes to the server.
7. Add the CI workflow, then work down the High table.
