# Phase 8 — Execution Record

Spec: [`notes/specs/2026-08-13-module-rbac-design.md`](../specs/2026-08-13-module-rbac-design.md)
Plan: [`notes/plans/2026-08-13-phase8-module-rbac.md`](2026-08-13-phase8-module-rbac.md)

All 13 tasks complete. **358 unit tests, 63 browser checks**, all passing.

---

## What shipped

The application had role *checks*, not RBAC. Role names were hardcoded in three
places — `[Authorize(Roles = "Faculty")]` on seven controllers, 23 gates in
`Sidebar.jsx`, and nothing at all on the routes. `ProtectedRoute` checked only
the token, so **any signed-in user could reach any page by typing its URL**.

Now: permissions are stored per page, assignable to roles from a SuperAdmin UI,
with per-user exceptions and a data scope (Own / Department / Institute). The
sidebar, the route guard and the API policy all read the same rows.

| | |
|---|---|
| Duplicate routes removed | `9307f55` |
| Entities + Department | `7d61863` |
| DbContext + migration | `e854985` |
| Page catalogue seed | `fa42c1a` |
| Access resolution + `/api/my/pages` | `24132c0` |
| `[PageAccess]` policy | `493eefa` |
| Sidebar from API + route guards | `368508d` |
| Role management + admin API | `199f97b` |
| Admin UI | `662eabc` |

---

## The claim, proven end to end

A SuperAdmin grants a page in the browser; the affected user's access changes
in the same running process, with no redeploy.

```
clerk1 holds 15 pages, not including projects.list
SuperAdmin selects clerk1, picks the page, types a reason, clicks add
clerk1 holds 16 pages          ← same process, same token
the exception is removed        → back to 15
```

Also verified live: `[PageAccess]` refuses a clerk on `/api/projects` with 403
and admits faculty with 200; deny removes a page the user's *role* grants; an
empty reason is rejected with 400; seeded roles refuse rename and delete with
the reason stated; a custom role can be created, renamed and deleted.

---

## A real defect the verification caught

**The Director was granted ten office pages they never had.**

The seed's `Office` list included `Director`. The pre-Phase-8 sidebar's
`isOffice` was `isDean || isDeputyRegistrar || isSuperintendent ||
isRegularStaff` — no Director. Reading the code had not caught it; neither had
13 seeder tests, all of which asserted what the catalogue said rather than what
the old sidebar did.

What caught it was extracting the old `Sidebar.jsx` from git, re-implementing
its gate expressions, and diffing every role's resolved links against it
mechanically. Six roles matched; the Director did not.

Fixed in three places, because a code fix alone would have left the wrong rows
in place:

1. `PageCatalogue.Office` — Director removed, with the reason recorded.
2. A regression test, `DirectorIsNotAnOfficeRoleForThesePages`, verified by
   restoring the bug and watching it fail.
3. The live database — the seed is idempotent, so it would never have corrected
   the 12 wrong rows. Repaired through the admin API rather than raw SQL.

Whether the Director *should* hold those pages is a real question. It is now a
configuration change an operator makes deliberately, which is the point of the
phase.

---

## Corrections made along the way

- **HOD "no page access"** contradicted "everyone reaches the dashboard". A test
  caught it. The dashboard rule wins: a role that authenticates but reaches
  nothing is a broken account. HOD gets the two universal pages and no module.
- **The handler was written into `API.Application`**, which carries no ASP.NET
  reference. Split into `PageAccessDecision` (Application, testable) and a thin
  adapter in the web project rather than eroding the layer boundary.
- **The seed table in the spec** was still module-shaped with route globs after
  the switch to page-level permissions. Rewritten as explicit page rows.
- **Two browser-test failures were mine, not the app's** — an assertion running
  before the element rendered, and 401s from the harness's own API calls racing
  the browser session. Both diagnosed rather than suppressed.

---

## Verified live vs. not

**Verified against MySQL and a running stack:** the migration; the seed (18
modules, 37 pages, 104 access rows); every role's resolved links against the old
sidebar; the policy on real endpoints; grant and deny changing access at
runtime; seeded-role protections; the admin UI end to end.

**Not verified:** `Department` scope changing which *rows* a user sees. The
scope is stored, resolved and returned by the API, but no query filters on it
yet — `IScopedQuery` (plan Task 5b) was specced and not built, because no page
in the application currently has a Department-scoped grant to exercise it. The
proposal module is where that becomes real.

**Left as found:** every test grant removed; the database confirmed at 10 roles,
0 grants, and the corrected access rows.

---

## Not done, and why

- **Edit-level permissions.** This phase governs whether a page opens, not
  view-versus-edit within one. It belongs with the field-level work.
- **`IScopedQuery`.** See above — deferred until a scoped page exists.
- **The `announcements` `ALTER TABLE`** from Phase 7 is still unrun; harmless
  today, documented in `Migrations/Manual/2026-08-13-readopt-announcements.sql`.
