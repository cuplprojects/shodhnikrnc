# Phase 8 — Module-Level RBAC (Implementation Plan)

Spec: [`notes/specs/2026-08-13-module-rbac-design.md`](../specs/2026-08-13-module-rbac-design.md)

Scope confirmed with the user:
- **Permissions stored per page**; the module checkbox ticks its pages and shows
  indeterminate when only some are on.
- **Per-role, plus per-user grants** (deny beats grant beats role).
- **Roles creatable from the UI**; the nine seeded roles are protected from
  rename and delete because workflow stages reference them by name.
- **Route guards included** — closing the hole where any signed-in user can
  reach any page by URL.
- **Department scoping included** (added after spec review): a permission
  carries Own / Department / Institute, so an HOD reviews their own
  department's work and a Dean reviews everyone's.

**Regression bar:** the existing 309 tests pass **unmodified**, and the Phase
4–7 browser suites still pass — they already assert sidebar contents for
Faculty, Fellow, office and SuperAdmin users, so they are the real check that
nobody's visibility changed.

---

## 8a — Groundwork

- [x] **Task 1 — Resolve the duplicate routes.**
  `/manage-announcements`, `/manage-news-events` and `/view-expenditure` are
  each registered twice with different components; React Router silently takes
  the first, so the `pages/office/` versions are dead code. A module cannot map
  cleanly to a path that resolves to two pages.
  *Resolved without needing the decision: the three `pages/office/*Page.jsx`
  files are 24-line "currently under construction" placeholders, superseded by
  the real 250–1253 line implementations React Router was already resolving to.
  Dead routes and placeholder files removed; 43 routes → 40, no duplicates, UI
  builds clean.*

## 8b — Domain and persistence

- [x] **Task 2 — Entities.** `Module`, `Page`, `RolePageAccess`, `UserPageGrant`
  per spec §2, each access row carrying a `Scope`. `Key` is the stable identity;
  `Name` is display only.
- [x] **Task 2b — Department.** A `Department` entity with `HeadUserId` (one HOD
  per department, nullable for vacancies) and `ApplicationUser.DepartmentId`,
  backfilled from `FacultyProfile.Department` where it matches. Leave the
  free-text column in place — it is a colleague's and other code may read it.
  PIs and HODs both scope through `DepartmentId`; `HeadUserId` answers the
  separate question of *who heads* a department.
  *Done: `Department`, `Module`, `Page`, `RolePageAccess`, `UserPageGrant`,
  `AccessScope`, `GrantEffect`, and `ApplicationUser.DepartmentId`. 6 tests
  pinning the scope order and enum values — verified by reordering `AccessScope`
  and watching three of them fail. Not yet on the DbContext; nothing reads them.
  Suite 315, the 309 unmodified.*
- [x] **Task 3 — DbContext + migration.** Unique `Module.Key`; composite keys on
  the two access tables; cascade from `Module`. All four test contexts together.
  *Done: `20260813122714_AddModuleAccessAndDepartments` (EF-generated, Designer +
  snapshot, `has-pending-model-changes` clean). Five tables, `DepartmentId` on
  Users, four unique indexes. Departments seeded from the six names hardcoded in
  `CreateFacultyUser.jsx` — the form that populates the free-text column — so the
  backfill matches rather than guesses. Suite 321, the 315 unmodified.*
  *Applied to MySQL by the user; all five tables and `Users.DepartmentId`
  verified present.*
- [ ] **Task 4 — Seed.** Modules and their pages, transcribed from the 24
  sidebar links and 33 routes. Preserve the `Assigned Requests` =
  RegularStaff-only asymmetry rather than tidying it.
  **Verify:** every route in `App.jsx` maps to exactly one page, and every
  current sidebar link is reproduced.
  *Done and verified on MySQL: 18 modules, 37 pages, 104 role-access rows.
  Faculty's seeded sidebar renders the same 9 links `show: isFaculty` produces
  today and Fellow's the same 4 — checked by query, not by inspection.
  `Assigned Requests` stays RegularStaff-only (RegularStaff 15 pages vs Dean 14).
  HOD gets 2, the universal pages only. Suite 333.*

## 8c — Access resolution

- [x] **Task 5 — `IPageAccessService`.** Deny beats grant beats role, cached
  per request. Scope resolves to the **widest** the user holds.
  *TDD: role union, explicit grant, explicit deny overriding a role, a user with
  no roles seeing only public pages, and a user holding two roles getting the
  wider scope rather than the narrower.*
  *Done: 11 tests. Deny precedence and widest-scope verified by mutation —
  breaking each made three tests fail. `IUserRoleProvider` reads Identity's
  tables rather than the JWT's role claims, so a permission change takes effect
  without re-signing in.*
- [ ] **Task 5b — Scope enforcement.** `IScopedQuery` applies a resolved scope to
  a query. Applied to the faculty-facing lists first, where the seed says `Own`
  and today's queries already filter by owner — so the bar is that **no query
  changes behaviour**.
  **Verify by calling the API as a scoped user**, not by reading the screen: a
  hidden row is not a protected row.
- [x] **Task 6 — `GET /api/my/pages`.** Grouped by module, `IsNavigable` marked.
  *Verified live: faculty1 returns the same 9 sidebar links `show: isFaculty`
  produces today, clerk1 12 including the RegularStaff-only Assigned Requests,
  superadmin 3. Scopes carried (Faculty all Own; clerk1 Institute for office
  pages). Non-navigable pages present for the guard, excluded from the sidebar.
  Suite 344.*

## 8d — Enforcement

- [x] **Task 7 — `[PageAccess("key")]` policy**, replacing the
  `[Authorize(Roles = "Faculty")]` attributes on Projects, the three Indent
  controllers, and Travel.
  **Verify live:** a Fellow is refused `/api/projects` with 403; a Faculty user
  is not. Sequenced *after* Task 6 so a failure in the policy is
  distinguishable from a failure in resolution.
  *Done and verified live: faculty1 200 / clerk1 403 / anonymous 401 on
  `/api/projects`, and the same split on the procurement route. 7 tests on the
  decision. Policies are built on demand from a `page:{key}` name, so adding a
  page needs no `Program.cs` change.*
  **Architecture note:** the handler was first written into `API.Application`,
  which carries no ASP.NET reference — adding one would have eroded the layer
  boundary. Split instead: `PageAccessDecision` (Application, testable) and a
  thin ASP.NET adapter in the web project.
- [x] **Task 8 — Route guards.** `ProtectedRoute` redirects a user away from a
  route outside their pages, with an explanation rather than a broken shell.
  Detail routes match by pattern, so `/projects/42/edit` resolves to
  `projects.edit`.
  *Done: `matchRoute` prefers the most literal match, so `/projects/new`
  resolves to `projects.new` rather than `projects.detail` — otherwise the
  new-project page would be gated on the detail page's permission. A location no
  page claims (`/login`, a typo) is left to the router rather than treated as
  forbidden.*

## 8e — Surfaces

- [x] **Task 9 — Sidebar from the API.** The 23 hardcoded gates go.
  **This is the task most likely to change behaviour accidentally** — the Phase
  4–7 browser suites are the check.
  *Done and verified: `p8-ui-test.mjs` 13/13. Faculty keeps all 9 links and
  clerk all 12 — the same sets the hardcoded gates produced. The URL hole is
  closed: faculty typing `/update-payment` or `/admin/roles` lands on
  `/dashboard`, where before it rendered a broken shell.*
- [x] **Task 9b — Role management.** Create, rename and delete custom roles, and
  create `HOD` with no page access (nothing is HOD-gated today; granting it
  pages would invent behaviour).
  *Done and verified live. Seeded roles refuse rename and delete with the reason
  stated; a custom role can be created, renamed and deleted, and a duplicate is
  409. `RoleDeletionGuard` counts stages granting a role by whole name, so `Dean`
  does not match inside `DeanOfStudents`. 6 tests.*
  **The phase's central claim, proven through the admin API rather than raw SQL:**
  *clerk1 `/api/projects` 403 → SuperAdmin grants `projects.list` → **200**, same
  running process, same token, no redeploy. Deny verified too: a page clerk1's
  role grants disappeared on deny and returned when the grant was removed. An
  empty reason is rejected 400.*
  *Every test grant was removed afterwards; the database is back to 10 roles,
  0 grants, 104 access rows.*
  Seeded roles are editable but locked against rename and delete; deleting a
  role any workflow stage references is refused with the count.
- [x] **Task 10 — Admin UI** at `/admin/roles`: pick a role, then a module/page
  permission tree — module checkbox ticks all its pages and shows indeterminate
  when partial. Plus a per-user grant panel requiring a reason, listing existing
  grants with who set them and when.
  *Done and verified: `p8-admin-test.mjs` 16/16. The module checkbox shows a
  dash when only some of its pages are on (`indeterminate` is a DOM property
  with no HTML attribute, so it is set imperatively). Non-navigable pages are
  marked "no menu link" rather than hidden. The reason field is required and
  says why.*
  **The claim, end to end through the UI:** *a SuperAdmin granted `projects.list`
  to clerk1 in the browser; clerk1 went from 15 to 16 pages in the same running
  process, then back to 15 when the exception was removed. Database confirmed
  unchanged afterwards: 10 roles, 0 grants, 104 access rows.*

## 8f — Verification

- [x] **Task 11 — Full suite** + Phase 4–7 browser suites unmodified. *358 unit tests; browser suites 20/20, 14/14, 13/13, 16/16.*
- [x] **Task 12 — Live walkthrough.** Sign in as Faculty, Fellow, office and
  SuperAdmin; confirm each sees exactly today's modules. Then grant one module
  to one user and confirm it appears **without a redeploy**.
  *Done mechanically rather than by eye: the pre-Phase-8 `Sidebar.jsx` was
  extracted from git, its gate expressions re-implemented, and every role's
  resolved links diffed against it. **This caught a real defect** — the Director
  had been granted ten office pages they never had. All seven roles now match
  exactly.*
- [x] **Task 13 — Commit** with an execution record: verified live vs not. *See [`2026-08-14-phase8-execution-record.md`](2026-08-14-phase8-execution-record.md).*

---

## Risks

- **Task 9 is the dangerous one.** Replacing 23 hardcoded gates with API-driven
  ones is where a user quietly loses a link. The browser suites assert sidebar
  contents per role, which is why they are the bar rather than the unit tests.
- **Two authorization systems.** Module access and Phase 7's workflow stage
  roles are separate on purpose. Removing someone's Procurement module must not
  change who can approve an indent.

## R&C institute-wide scoping (added after review)

Correcting a design error in the original phase: institute-wide access was
granted directly to office roles (16 seed rows), which made every Dean
institute-wide by role rank rather than by department. Per the user's
correction: everyone including Dean/Director/PI gets a `DepartmentId`; only
belonging to the R&C department widens Department scope to Institute.

- [x] `Department.IsInstituteWide`, migration `20260814120852`.
- [x] `IUserDepartmentProvider` + `PageAccessService` widening rule. 6 tests,
  verified by mutation (widening `Own` as well as `Department` fails a test).
- [x] Seed corrected: office pages now grant `Department`, not `Institute`
  directly. R&C added as a seeded department; office accounts
  (clerk1/osrc/dyregrc/deanrc/directorrc) assigned to it.
- [x] Migration applied to MySQL and live-verified. R&C seeded with
  `IsInstituteWide=true`; office accounts confirmed assigned to it, faculty1
  to CSE.
  *A fresh non-R&C Dean account could not be exercised (email confirmation with
  no SMTP access), so the rule was proven with the identical code path instead:
  a Department-scoped grant to faculty1 read as `Department` while in CSE, then
  **`Institute`** after moving faculty1 into R&C with no other change — the
  same grant, same token, only the department differed. A parallel `Own`-scoped
  grant stayed `Own` in R&C both times, matching the mutation-tested guard.
  Everything restored afterwards: faculty1 back to CSE, 0 grants, test account
  removed.*

## Deferred (spec §7)

Field-level permissions · data scoping (PI-owner / department / institute-wide)
· `CanEdit` enforcement.
