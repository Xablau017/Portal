# Feature Roadmap — Portal GMC (portal_v2)

**Date:** 2026-10-10 · **Companion to:** [`security-review-2026-10-10.md`](./security-review-2026-10-10.md)

Features that would make the Portal more complete, **grouped by category** and **ordered by
complexity inside each category** (easiest first).

## Legend

| Complexity | Meaning (for one developer at the current skill level) |
|---|---|
| 🟢 **S** — Small | ≤ 1 day. One file or one SQL migration. No new concepts. |
| 🟡 **M** — Medium | 2–5 days. New table + RLS + page, or one new concept (server `load`, Storage, RPC). |
| 🟠 **L** — Large | 1–3 weeks. Several tables, new integration, or a new architectural piece. |
| 🔴 **XL** — Extra large | > 3 weeks or depends on an external party / budget (Microsoft, HR system, paid service). |

**Depends on** points to other items or to findings in the security review (e.g. *C3* = server-side
auth). Items marked ⭐ are the ones I'd do first in each category.

> **Pre-requisite for everything below:** close C1–C4 from the reviews. In particular **C3**
> (`hooks.server.ts` + `@supabase/ssr` + server `load`) is a dependency of about a third of this list —
> it's the foundation, not a feature.

---

## 1. Security & Access Control

| ID | Feature | Size | Depends on | Why |
|---|---|---|---|---|
| SEC-1 ⭐ | **Security headers + CSP** (report-only → enforce) | 🟢 S | — | Second wall against XSS; clickjacking protection for `/admin` (review 4.9) |
| SEC-2 ⭐ | **"Forgot password" flow** (`resetPasswordForEmail` + `/redefinir-senha` page) | 🟢 S | Custom SMTP | Today a forgotten password needs an admin who then *knows* the new password |
| SEC-3 | **Change own password** in `/perfil` (with current-password re-check) | 🟢 S | — | Basic self-service; pairs with SEC-2 |
| SEC-4 | **Session inactivity timeout** + "log out of all devices" button | 🟢 S | — | Store PCs are shared |
| SEC-5 ⭐ | **Server-side route guards** (`hooks.server.ts`, `+layout.server.ts`, admin 403) | 🟡 M | — | Review C3; unlocks most of the list |
| SEC-6 | **Role-based RLS everywhere** — trainings by area, column privileges on `profiles`, role CHECK | 🟡 M | — | Review 4.4–4.6 |
| SEC-7 | **MFA (TOTP) for admins**, optional for others | 🟡 M | SEC-5 | Admin is the crown jewel |
| SEC-8 | **Server-written audit trail** for logins *and* admin actions (`admin_audit` table) | 🟡 M | SEC-5 | Review C4 / 4.7 / 4.8 |
| SEC-9 | **Multiple roles per user** (`user_roles` join table instead of one `role` text) | 🟠 L | SEC-6 | Real people are "loja" *and* "regional"; one text column won't scale |
| SEC-10 | **Single Sign-On with Microsoft 365 / Google Workspace** (Supabase OAuth/SAML) | 🟠 L | SEC-5 | No more portal passwords; off-boarding happens automatically when IT disables the corporate account |
| SEC-11 | **Fine-grained permissions** (permissions table: `ver_bi_financeiro`, `gerenciar_treinamentos`…) mapped to roles | 🔴 XL | SEC-9 | When roles stop being enough — not before |

## 2. Administration & Governance

| ID | Feature | Size | Depends on | Why |
|---|---|---|---|---|
| ADM-1 ⭐ | **Styled admin page + in-page modals** (replace `prompt()`/`alert()`) | 🟢 S | — | Most destructive screen is the least finished |
| ADM-2 | **Search, filter and paginate** the user table and access log | 🟢 S | — | Unusable past ~100 users |
| ADM-3 ⭐ | **Create user from the UI** (the `criar` endpoint already exists, unused) + send invite link | 🟢 S | C1 | Completes the CRUD; invite instead of setting a password |
| ADM-4 | **Disable (ban) user** instead of delete (`auth.admin.updateUserById(id, { ban_duration })`) | 🟢 S | C1 | Off-boarding without losing history; reversible |
| ADM-5 | **Export access log to CSV** | 🟢 S | — | Auditors and HR ask for this |
| ADM-6 | **Admin dashboard home** — active users today/week, logins by store, most-watched trainings | 🟡 M | SEC-8 | Turns the log into information |
| ADM-7 | **Bulk import users from CSV** (new store opening, seasonal staff) | 🟡 M | ADM-3 | Creating 40 accounts by hand won't happen |
| ADM-8 | **Organisation structure** — `lojas` / `regionais` / `cds` tables, user → unit link | 🟡 M | — | Foundation for per-store content, reports, announcements |
| ADM-9 | **Delegated admin** — regional manager manages only their stores' users | 🟠 L | ADM-8, SEC-9 | Takes load off central admins |
| ADM-10 | **Automatic provisioning/off-boarding from HR system** (scheduled sync / webhook) | 🔴 XL | ADM-8, HR system API | Ex-employees lose access the day they leave |

## 3. Training (LMS)

| ID | Feature | Size | Depends on | Why |
|---|---|---|---|---|
| TRN-1 ⭐ | **Thumbnails in Supabase Storage** instead of Drive | 🟢 S | — | Removes 35 third-party cookies (Lighthouse), faster, no broken images |
| TRN-2 | **Categories / tags + search** on `/treinamentos` | 🟢 S | — | List grows; people look for "caixa", "estoque" |
| TRN-3 ⭐ | **"Watched" progress** — `training_progress(user_id, training_id, concluido_em)` + checkmarks | 🟡 M | SEC-6 | The first thing managers will ask: "who watched it?" |
| TRN-4 | **Admin CRUD for trainings** (create/edit/publish/order in the UI, URL validated) | 🟡 M | SEC-5 | Today content is edited in the Supabase dashboard |
| TRN-5 | **Mandatory trainings + due dates** per role/area, with "pending" badge on home | 🟡 M | TRN-3 | Onboarding and compliance (LGPD, safety) |
| TRN-6 | **Completion report** per store/role, CSV export | 🟡 M | TRN-3, ADM-8 | Managers chase their teams |
| TRN-7 | **Quizzes** after a video, pass mark, attempts stored | 🟠 L | TRN-3 | Proves understanding, not just play |
| TRN-8 | **Learning paths / tracks** (ordered sequence: "Onboarding Caixa") | 🟠 L | TRN-3, TRN-5 | Structured onboarding |
| TRN-9 | **PDF certificates** on completion | 🟠 L | TRN-7 | Recognition; HR records |
| TRN-10 | **Self-hosted, access-controlled video** (Supabase Storage signed URLs / Cloudflare Stream) instead of public Drive links | 🔴 XL | SEC-5 | Real access control and real watch-time tracking; Drive links are public to anyone who has them |

## 4. BI & Dashboards

| ID | Feature | Size | Depends on | Why |
|---|---|---|---|---|
| BI-1 ⭐ | **Dashboards list in a table** (`dashboards(id, label, url, roles[])`) + server-side filtering | 🟢 S | SEC-5 | Closes review C2; add dashboards without a deploy |
| BI-2 | **Empty state + "open full screen" link** on mobile | 🟢 S | — | Power BI is unreadable in a 220px iframe |
| BI-3 | **Admin UI to manage dashboards** and which roles see them | 🟡 M | BI-1 | Self-service for the BI team |
| BI-4 ⭐ | **Secure Power BI embedding** ("Embed in your organization" with M365 login, or Power BI Embedded + server-issued embed tokens) | 🔴 XL | SEC-5, licensing/budget | The only *real* fix for confidential dashboards; also enables row-level security inside Power BI (each store sees only its numbers) |
| BI-5 | **Native KPI cards** on the home page (sales today, goal %) from a Supabase view fed by the ERP | 🔴 XL | data pipeline from ERP | Faster than opening Power BI for the 3 numbers everyone checks |

## 5. Communication & Content

| ID | Feature | Size | Depends on | Why |
|---|---|---|---|---|
| COM-1 ⭐ | **Announcements board** (`avisos`, targeted by role/area, pinned, expiry date) on home | 🟡 M | SEC-6 | Turns the portal into the place people open every morning |
| COM-2 | **"Read and acknowledge"** on announcements (with report of who hasn't) | 🟡 M | COM-1 | Policy changes, price changes, recalls |
| COM-3 | **Document library** — manuals, policies, forms in Supabase Storage with role-based access (signed URLs) | 🟡 M | SEC-5, SEC-6 | Replaces WhatsApp-forwarded PDFs |
| COM-4 | **Internal directory** — name, store, role, phone (opt-in, uses `/perfil` fields) | 🟡 M | ADM-8 | Reuses data you already collect; mind LGPD consent |
| COM-5 | **Notifications** (in-app bell + e-mail) for new announcements, mandatory trainings, due dates | 🟠 L | COM-1, TRN-5, custom SMTP | People don't come back without a reason |
| COM-6 | **Corporate calendar** (meetings, inventory days, campaigns) | 🟠 L | ADM-8 | — |
| COM-7 | **Requests / tickets** to support areas (TI, RH, manutenção) with status | 🔴 XL | ADM-8, COM-5 | Big, but high value; a product of its own |

## 6. Profile & Personal Area

| ID | Feature | Size | Depends on | Why |
|---|---|---|---|---|
| PRF-1 ⭐ | **Fix `/perfil` basics** — real `<form>`, error handling, field validation, length limits | 🟢 S | — | Review 4.12 |
| PRF-2 | **Show own access history** ("last logins on your account") | 🟢 S | SEC-8 | Lets users spot account misuse themselves |
| PRF-3 | **Avatar upload** (Storage bucket with per-user folder RLS) | 🟡 M | — | First real practice with Storage policies |
| PRF-4 | **"My trainings"** — progress, pending mandatory items, certificates | 🟡 M | TRN-3, TRN-5 | Personal dashboard |
| PRF-5 | **LGPD self-service** — export my data, request deletion | 🟡 M | SEC-8 | Legal requirement in Brazil for personal data |

## 7. UX, Accessibility & PWA

| ID | Feature | Size | Depends on | Why |
|---|---|---|---|---|
| UX-1 ⭐ | **Page titles, skip link, focus styles, labels, `role="alert"`** | 🟢 S | — | Lighthouse + previous review H2/H10 |
| UX-2 | **Shared layout shell** — one header/nav component for all logged-in pages (`(app)/+layout.svelte`) | 🟢 S | — | Today each page reinvents "← Voltar" |
| UX-3 | **Custom `+error.svelte` and 404 page** | 🟢 S | — | Branded, helpful failures |
| UX-4 | **Responsive pass** — media queries, stacking home grid, scrollable admin tables | 🟢 S | — | Store staff are on phones |
| UX-5 | **Dark mode** using the existing CSS tokens | 🟢 S | — | Tokens already exist; cheap |
| UX-6 | **Global search** (trainings, announcements, documents) | 🟡 M | COM-1, COM-3 | One box to find anything |
| UX-7 | **Installable PWA** (manifest, icons, service worker for the shell) | 🟡 M | SEC-5 | "App" on the store tablet's home screen |
| UX-8 | **i18n-ready strings** (es-ES / en) | 🟠 L | — | Only if the group operates outside Brazil |

## 8. Platform, Operations & Developer Experience

| ID | Feature | Size | Depends on | Why |
|---|---|---|---|---|
| OPS-1 ⭐ | **CI pipeline** — lint, `svelte-check`, build, `npm audit` on every push | 🟢 S | C1 | Would have caught C1 on day one |
| OPS-2 ⭐ | **Database as code** — `supabase/migrations/*.sql` + `supabase/seed.sql` in the repo | 🟢 S | — | Today the schema only exists in Markdown guides and in prod; can't rebuild or review it |
| OPS-3 | **Staging environment** (second Supabase project + Cloudflare preview branch) | 🟢 S | OPS-2 | A safe place to test (security review §6.1) |
| OPS-4 | **`.env.example`, real README, ESLint + Prettier enforced via pre-commit** | 🟢 S | — | Onboarding the next developer (or future you) |
| OPS-5 | **Generated DB types** (`supabase gen types typescript`) | 🟢 S | OPS-2 | Removes hand-written `Usuario`/`Training` types that drift |
| OPS-6 | **RLS test suite** (pgTAP) in CI | 🟡 M | OPS-2, OPS-3 | Security review §6.4 — the most valuable tests you can own |
| OPS-7 | **E2E tests** (Playwright: login, role visibility, admin flows) in CI | 🟡 M | OPS-3 | Security review §6.5 |
| OPS-8 | **Error monitoring** (Sentry or Cloudflare Workers Logs) + uptime check | 🟡 M | — | Know about breakage before users call |
| OPS-9 | **Lighthouse CI** on the preview build with budgets | 🟡 M | OPS-1 | Stops perf/a11y regressions |
| OPS-10 | **Backups & restore drill** (Supabase PITR or scheduled `pg_dump` to storage) | 🟡 M | — | Free tier keeps limited backups; test restoring at least once |
| OPS-11 | **Upgrade to SvelteKit 3 / adapters 8 / TS 7** | 🟠 L | OPS-1, OPS-7 | Do it *after* tests exist |

---

## Suggested sequence (first ~8 weeks)

A path that keeps each step small and builds on the last:

1. **Week 1 — Foundation:** C1 fix · OPS-1 · OPS-2 · OPS-3 · OPS-4 · SEC-1 · UX-1 · PRF-1
2. **Week 2 — The server perimeter:** SEC-5 · BI-1 (+ rotate finance link) · SEC-6 · UX-2 · UX-3
3. **Week 3 — Make security testable:** OPS-6 · SEC-8 · ADM-1 · ADM-3 · ADM-4 · SEC-2 · SEC-3
4. **Weeks 4–5 — Training becomes an LMS:** TRN-1 · TRN-4 · TRN-3 · TRN-5 · PRF-4
5. **Weeks 6–7 — A reason to open it daily:** ADM-8 · COM-1 · COM-2 · COM-3
6. **Week 8 — Visibility:** ADM-6 · TRN-6 · OPS-8 · SEC-7

Then pick from the 🟠/🔴 items based on what users actually ask for. SEC-10 (SSO) and BI-4 (secure
Power BI) are the two big-ticket items worth raising with IT/management early, because they need
someone else's approval or budget.

## Summary count

| Category | 🟢 S | 🟡 M | 🟠 L | 🔴 XL | Total |
|---|---|---|---|---|---|
| Security & Access | 4 | 4 | 2 | 1 | 11 |
| Administration | 5 | 3 | 1 | 1 | 10 |
| Training (LMS) | 2 | 4 | 3 | 1 | 10 |
| BI & Dashboards | 2 | 1 | 0 | 2 | 5 |
| Communication | 0 | 4 | 2 | 1 | 7 |
| Profile | 2 | 3 | 0 | 0 | 5 |
| UX & PWA | 5 | 2 | 1 | 0 | 8 |
| Platform & Ops | 5 | 5 | 1 | 0 | 11 |
| **Total** | **25** | **26** | **10** | **6** | **67** |
