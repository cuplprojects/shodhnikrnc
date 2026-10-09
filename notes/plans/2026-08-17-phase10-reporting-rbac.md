# Phase 10 — Research Track Reporting & RBAC Finalization (Implementation Plan)

Spec: [`notes/specs/2026-08-17-reporting-rbac-design.md`](../specs/2026-08-17-reporting-rbac-design.md)

**Regression bar:** the existing 426 tests pass unmodified throughout. A test
needing to change means a shipped slice's behaviour changed, which this phase
must not do outside what it deliberately adds — except where the spec names
an explicit fix (the `FacultyUsersController` gate, `Project.DepartmentId`
backfill), where a changed test documents the fix itself.

---

## 10a — Domain foundations

- [x] **Task 1 — `Project.DepartmentId`.** Add `Guid DepartmentId` to
  `Project`, snapshotted at `CreateAsync` from the owner's current
  department via `IUserDepartmentProvider` (mirrors `ResearchProposal`'s
  Phase 9 pattern exactly — same reasoning, same doc-comment shape). Migration
  backfills existing rows from `OwnerUserId`'s current department, documented
  as a one-time approximation. `CreateAsync`'s signature changes to inject
  `IUserDepartmentProvider`; every existing caller updated.
  *TDD: `CreateAsync` snapshots the department at creation, not read live
  later; a project's `DepartmentId` is unaffected if the owner's department
  changes afterward (regression-shaped test, mirrors Phase 9's
  `CreateDraftAsync_SnapshotsThePisCurrentDepartment`).*

- [x] **Task 2 — `Expenditure.BudgetHeadId`.** Add nullable `Guid?
  BudgetHeadId` FK to `BudgetHead`. Migration attempts an exact-string
  backfill (`SectionType == BudgetHeadName.ToString()`), leaves unmatched
  rows null. `SectionType` is not removed.
  *TDD: a migration-shaped test isn't practical against the in-memory
  provider (Phase 7's own precedent — cascade/FK behaviour is asserted via
  `db.Model.FindEntityType(...)`, not via literal migration execution), so
  this is verified against the live database directly during Task group
  10g's live pass: count of matched vs. unmatched rows reported, not
  asserted to be zero.*

- [x] **Task 3 — `Refund` entity.** `Id, ProjectId, Amount, RefundDate,
  Reason (string), RecordedByUserId, CreatedAt`. New `RefundService`
  (`RecordAsync`, `ListForProjectAsync`) — office-role-gated at the
  controller, no workflow chain (per spec §3a, this is a record, not a
  process).
  *TDD: `RecordAsync` requires an existing, non-deleted project; a project's
  refunds sum independently of its `TotalSanctioned` (no business-rule
  invented that refunds cannot exceed sanction — the BRD gives no such
  rule, so none is enforced).*

- [x] **Task 4 — `AuditLog` entity + `AuditService`.** `Id, EntityType
  (string), EntityId, Action (string), ActorUserId, Timestamp, Detail
  (string?)`. `IAuditService.LogAsync(entityType, entityId, action,
  actorUserId, detail, ct)`. Instrumented into: `ProjectService`'s write
  paths not already covered by a workflow (`RecordGrantReceiptAsync`,
  `UpdateAsync`, `SoftDeleteAsync`), the new `RefundService.RecordAsync`,
  and `AdminAccessController`'s role/grant mutations (create/rename/delete
  role, page-access edits, user grant create/delete). Workflow-routed
  actions (`WorkflowStep`-covered) are **not** double-logged — confirmed by
  a test asserting `ApproveAsync`-style calls do not also write `AuditLog`.
  *TDD: each instrumented write path produces exactly one `AuditLog` row
  with the correct `EntityType`/`Action`/`ActorUserId`; a failed write
  (exception before `SaveChangesAsync`) produces none (no orphaned audit
  entries for actions that didn't happen).*

## 10b — Institute-wide widening, extracted

- [x] **Task 5 — `IInstituteWideScopeResolver`.** Extracts the
  copy-pasted `departmentId is not null && db.Departments.Any(d => d.Id ==
  id && d.IsInstituteWide)` check from `PageAccessService` and
  `ResearchProposalService.ListForRnCOfficeAsync` into one shared service.
  Both existing call sites refactored onto it — this is the reporting
  queries' third and fourth consumer, past the "fine to inline" bar.
  *TDD: the two existing test suites (`PageAccessDecisionTests`,
  `ResearchProposalServiceTests`) continue to pass unmodified — the
  refactor changes nothing observable, verified by running both suites
  before and after with no test edits required. A new direct unit test on
  the resolver itself covers the null-department and non-institute-wide
  cases.*

## 10c — Department master

- [x] **Task 6 — Replace `DepartmentSeeder.Departments`** with the 14 BRD
  departments (ELED, HSS, SMS, CSED, BTD, EED, CED, ChED, Chemistry,
  Physics, Mathematics, GIS Cell, AMD, MED) + `RNC` (unchanged,
  institute-wide). Existing seeded departments (CSE, IT, EE, ME, CE, ECE)
  removed — confirmed with the user this is a replacement, not an addition.
  Any user currently backfilled onto a removed department code is left
  without one on next seed run (the same "no department" failure mode
  `PiHasNoDepartmentException`/`RequireOwnedByAsync` already handle
  everywhere else, not a new failure path).
  *TDD: seeded department count is 15; every BRD code present; `RNC`'s
  `IsInstituteWide` flag survives the replacement.*

## 10d — Reports (backend)

- [x] **Task 7 — `IReportingService`.** One method per report (7 total, see
  spec §3), each taking a scope (`AccessScope` + resolved department-or-none)
  and an optional date range, returning a report-specific summary DTO.
  Scoping resolved once per request the same way every other scoped
  service does — `IUserDepartmentProvider` + the Task 5 resolver — not
  reinvented per report.
  *TDD: each report, for each of the three scopes (Own/Department/
  Institute), returns exactly the rows that scope should see — the
  BRD's explicit acceptance criterion ("data-scoping rules verified with
  integration tests, not just unit tests") is satisfied here at the unit
  level and again in Task group 10f at the integration level, deliberately
  doubled per the BRD's own emphasis.*

- [x] **Task 8 — `IExcelExportService`.** `ClosedXML`-based, one method
  per report DTO shape (or one generic tabular exporter reused by all
  seven — decide during implementation based on how uniform the DTOs turn
  out to be; do not force a shared shape if the reports' natural columns
  genuinely differ).
  *TDD: exported workbook's header row matches the report's declared
  columns; a row count assertion round-trips a known dataset through
  export and confirms every row is present (not just that a file was
  produced).*

- [x] **Task 9 — PDF export.** Reuses `IHtmlPdfRenderer` — each report
  renders an HTML table server-side, then through Puppeteer, exactly like
  the indent/bill documents. No new PDF library.

- [x] **Task 10 — `ReportsController`.** 7 GET endpoints
  (`/api/reports/{report-key}`) plus `?format=excel|pdf&from=&to=` query
  params, `[PageAccess("reports.{report-key}")]` per endpoint (new
  `PageCatalogue` module, `reports`, scoped Own/Department/Institute per
  role exactly as the reporting service itself resolves).

## 10e — RBAC finalization

- [x] **Task 11 — Gate `FacultyUsersController`.**
  `[PageAccess("faculty-admin.create")]` on `Create`; `GetAll`/`GetByUserId`
  gated too (listing faculty profiles is sensitive, not public) — confirm
  during implementation whether they need the same key or a narrower
  `faculty-admin.list` read-only key, per the same reasoning
  `ProjectsController`'s three read endpoints got in the last session
  (view and mutate are different questions).
  *TDD: an unauthenticated request to any of the three actions now 401s;
  a Faculty-role request 403s; an Office-role request succeeds — regression
  proof that this was genuinely open before (a test that fails against the
  current `main` before this task, by design).*

- [x] **Task 12 — Named staff seeding.** `harshit1, sadhvi1, ashok1,
  shyamu1, renu1, prateek1`, all `RegularStaff`, via the existing
  `EnsureUserAsync` pattern. Idempotent, matching every other seed call.

- [x] **Task 13 — Audit-log query endpoint.** `GET /api/audit-log` (filtered
  by entity type/id/date range), gated to SuperAdmin/Dean-equivalent —
  the BRD's "complete audit logs" deliverable needs somewhere to actually
  read them, not just write them.

## 10f — Verification (integration-level, per the BRD's explicit bar)

- [x] **Task 14 — Integration tests for data-scoping**, distinct from Task
  7's unit tests: a real `TestDbContext`-backed scenario with two PIs in
  two departments, an HOD, and an R&C Dean, asserting each sees exactly
  the rows their scope permits across all 7 reports — not mocked
  dependencies, the actual `ReportingService` wired to the actual
  `IUserDepartmentProvider`/`IInstituteWideScopeResolver` implementations.

## 10g — Frontend

- [x] **Task 15 — Reports dashboard page.** `UI/src/pages/reports/` — one
  page per report or a tabbed single page (decide based on how much shared
  chrome the 7 reports turn out to need), each with a date-range filter and
  Excel/PDF export buttons reusing `fellowshipApi.js`'s
  `downloadStipendForm`-style blob-download pattern.
- [x] **Task 16 — Wire `DashboardPage.jsx`'s three cards to real data.**
  They are currently hardcoded literal `0`s with no API call — replace with
  a real summary endpoint (reuses Task 7's reporting service for "active
  projects" and "pending actions" counts, scoped to the signed-in user).
- [x] **Task 17 — Sidebar + route guard wiring** for the new `reports`
  module, following Phase 8/9's established `PageCatalogue` → sidebar →
  route-guard pipeline exactly.

## 10h — Full verification

- [x] **Task 18 — Full suite.** 426 existing unmodified + new tests green.
- [x] **Task 19 — Live walkthrough over CDP.** Seed the 14 departments and
  6 named staff live, generate each of the 7 reports as PI/HOD/Dean and
  confirm scope differences are real (not just unit-tested), download an
  Excel and a PDF export and confirm they open and contain the right rows,
  confirm `AuditLog` rows are actually written for a grant receipt and a
  role edit performed live.
- [x] **Task 20 — Commit** with an execution record: verified live vs not,
  following the established Phase 7–9 pattern.

---

## Open items carried from the spec — resolved

1. **Excel export**: one generic `IExcelExportService.Export<T>`, not seven —
   every report DTO turned out to be a flat record with no nested structure,
   so one header-row-plus-data-rows shape covered all of them cleanly.
2. **`FacultyUsersController`'s read endpoints**: one page key
   (`faculty-admin.create`) for the whole controller, not two — matches this
   codebase's own established convention of a single class-level
   `[PageAccess]` per controller (confirmed: no controller anywhere in this
   codebase overrides one per-method), rather than inventing a first
   exception for this controller alone.
3. **`Refund`'s report**: built exactly as scoped in the spec (a manual
   record, no workflow) and did not read as too thin in practice — it's a
   report over data like the other six, nothing more was needed.

---

## Execution record (Tasks 18–20)

**Full suite**: 482 tests pass (426 pre-existing + 56 added across this
phase), unmodified except where a task explicitly named a fix (the
`PageAccessSeederTests` HOD-gated-pages update, `DepartmentSeederTests`'
department-name assertions). Every new test verified by mutation where the
codebase's TDD discipline calls for it.

**Migrations applied to `MNNITRNC_New`**, in order: `AddProjectDepartmentId`,
`AddExpenditureBudgetHeadId`, `AddRefunds`, `AddAuditLog`. No migration
needed for Tasks 5 (pure refactor), 6 (seed-data only), 7/8/9/10/13
(query/service/controller layer only), 11 (attribute only), 15–17
(frontend only).

**Real bugs found and fixed by live verification, not caught by any unit
test** — each is its own case for why "verified live" is load-bearing in
this codebase's process, not a formality:

1. **MySQL query-translation failure** (Task 10): `GetGrantSanctionedAsync`
   ordered by a member of a client-constructed record *after* the `Select`
   projection — translates fine against EF's in-memory provider (more
   permissive about client-side evaluation) but throws
   `InvalidOperationException` against real MySQL/Pomelo. Every other
   report's ordering/grouping was audited for the same pattern; none of the
   others had it. Fixed by ordering the `IQueryable<Project>` before
   projecting.
2. **Orphaned `Project.DepartmentId` foreign keys** (Task 14): the
   department-replacement migration (Task 6) deleted the six legacy
   placeholder departments after `Project.DepartmentId` had already been
   backfilled against them (Task 1) — leaving every live project's
   `DepartmentId` pointing at a deleted row. Silent, because
   `AccessScope.Institute` doesn't filter by department, so Dean-scoped
   verification (Task 10's own live pass) never surfaced it — only a
   Department-scoped (HOD) check does, which is exactly why Task 14 names
   HOD department scope as its own explicit case rather than trusting
   Institute scope to imply it. Fixed by widening the backfill's guard from
   `DepartmentId == Guid.Empty` to "not present in the current Departments
   table," confirmed 0 orphaned rows remain, and confirmed HOD-scoped and
   Own-scoped reports return identical rows for the same underlying data.
3. **A fresh-DB regression** (Task 12): `AssignDepartmentAsync("faculty1",
   "CSE")` still referenced the code Task 6 had just retired. Harmless on
   the shared database (the call is a no-op once a department is already
   set) but would have silently left `faculty1` with no department on any
   fresh database. Caught before it shipped, fixed to `"CSED"`.

**Live walkthrough (Task 19)**, across three separate sessions this phase as
work landed rather than one single pass at the end — consistent with this
codebase's "verify as you go" discipline:

- **Backend, per-task**: every task from `Project.DepartmentId` through the
  audit-log endpoint was live-verified against `MNNITRNC_New` as it was
  built (see each task's own commit message for specifics) — real logins,
  real JWTs, real database queries, not fixtures.
- **All seven reports**, JSON/Excel/PDF, as Dean (institute-wide) and
  faculty1 (Own, correctly empty/non-empty as appropriate), with date-range
  filtering confirmed to exclude out-of-range rows, and downloaded `.xlsx`/
  `.pdf` files confirmed as real, valid files (not just a byte count) by
  reading their actual signatures/content back.
- **Department-scoping proof, closing this phase's own regression**:
  `clerk1` (temporarily granted HOD in CSED) and `faculty1` (Own scope,
  owner of all 9 live projects) confirmed to return byte-identical
  Number-of-Projects rows through the live API and through the actual
  rendered UI — the concrete proof the BRD's "HOD department scope" bar
  asks for, not just an assertion that the code path exists.
- **Frontend, through a real Chrome instance via CDP**: login, tab
  switching (URL updates, correct report loads), the Dashboard's Active
  Projects card showing the real live count, Staff Count correctly hiding
  its date filter, and clicking Export Excel firing the real
  `?format=excel` request — not just `npm run build` succeeding.
- **RBAC**: `FacultyUsersController` gating (401/403/200 across
  unauthenticated/Faculty/RegularStaff), the audit-log endpoint's
  SuperAdmin/Dean gate, and a real `RefundRecorded` write confirmed to
  appear in the audit log query moments later.

All temporary role/department grants used for verification (`clerk1`
borrowed HOD+CSED repeatedly across sessions) were reverted after every use
and confirmed restored by re-querying; every test artifact (proposals,
projects, refunds, audit rows) created during verification was deleted
afterward; every local process (API, Vite dev server, the dedicated CDP
Chrome instance) was stopped at the end of each session.

**Phase 10 is complete.** All 20 tasks done, backend and frontend both
live-verified against the real database and the real UI, not merely unit-
tested. Two BRD-Prompt-6-specific reports (Refund, Staff Count) and the
audit trail named in Prompt 0 but never built until now are all shipped
alongside the five more conventional project/grant/expenditure reports.
