# Candidate login mode + recruitment review/stats

Small, self-contained addition on top of the existing Recruitment module
(BRD A2) and Reports module (Phase 10). Two independent gaps, bundled
because both were raised in the same request:

1. `LoginPage.jsx`'s Faculty/Office toggle doesn't mention applicants at all,
   even though `/register` sends them straight back to this same page.
2. The sidebar's "Recruitment" entry (`RecruitmentPage.jsx`) is a dead stub
   with no data behind it, and there is no stats rollup anywhere for
   screening/selection outcomes -- `RecruitmentDetailPage.jsx` (which does
   the real screening/selection work) is only reachable today by already
   knowing a recruitment's id.

No workflow/entity changes. Everything here is additive: one new backend
query (list a PI's own recruitments across projects), one new report
(recruitment funnel stats, following the Phase 10 `ReportingService`
pattern exactly), and frontend wiring.

## Task 1 -- `ListOwnAsync` on `IRecruitmentService`

`ListForProjectAsync` requires a `projectId`; there's no "all of a PI's
recruitments" query, which `RecruitmentPage.jsx` needs as its landing list.

- [x] `API.Application/Recruitment/IRecruitmentService.cs`: add
      `Task<IReadOnlyList<RecruitmentSummary>> ListOwnAsync(Guid piUserId, CancellationToken ct = default)`.
- [x] `RecruitmentService.cs`: implement by joining `RecruitmentRequests` to
      `Projects` owned by `piUserId` (mirror `LoadOwnedProjectAsync`'s
      ownership check), ordered newest first.
- [x] `API/Controllers/RecruitmentController.cs`: add
      `GET /api/my/recruitments`, `[Authorize(Roles = "Faculty")]`.
- [x] `UI/src/api/recruitmentApi.js`: add `listMyRecruitments()`.
- TDD: `API.Tests/Recruitment/RecruitmentServiceTests.cs` -- a PI with
  recruitments on two different projects gets both back; a recruitment
  belonging to another PI's project is excluded.

## Task 2 -- Recruitment funnel report (8th report)

Follows `IReportingService`'s existing shape and scope rules exactly
(Faculty/Fellow -> Own, HOD -> Department, Dean/office -> Institute-if-R&C
else Department), so it slots into the existing Reports page/tabs with no
new plumbing pattern.

- [x] `API.Application/Reporting/ReportDtos.cs`: add
      `RecruitmentFunnelRow(Guid ProjectId, string ProjectTitle, string DepartmentName, int Applied, int ScreenedEligible, int ScreenedIneligible, int Selected, int NotSelected, int Pending, RecruitmentStage LatestStage)`.
      One row per recruitment (not per project) -- a project can run more
      than one recruitment drive.
- [x] `IReportingService.cs` / `ReportingService.cs`: add
      `GetRecruitmentFunnelAsync(requestingUserId, requestingUserRoles, from, to, ct)`.
      Date filter is on `RecruitmentRequest.CreatedAt`, same convention as
      the Number-of-Projects report. Reuse the same `ResolveScopeAsync`
      private helper already in `ReportingService.cs` -- no new scope logic.
- [x] `ReportsController.cs`: add `GET /api/reports/recruitment-funnel`
      action, own `[PageAccess("reports.recruitment-funnel")]`, same
      `?format=excel|pdf&from=&to=` handling as the other 7.
- [x] `PageCatalogue.cs`: add the `reports.recruitment-funnel` page,
      `["Faculty", .. Office]` at `AccessScope.Own`, matching the other six
      dynamically-scoped report pages.
- [x] `PageAccessSeederTests.cs`: HOD-seeded-pages assertion gains this key
      (anticipated change, same reason the 7 existing report keys were
      added in Phase 10).
- TDD in `API.Tests/Reporting/ReportingServiceTests.cs`: reuse the existing
  seeded fixture; add a recruitment with candidates in mixed screening/
  outcome states; prove PI-Own scope, HOD-Department scope, and that the
  row's counts match (mutate one candidate's outcome, confirm the test
  catches it).
- [x] `UI/src/pages/reports/reportDefinitions.js`: add the 8th entry
      (`key: 'recruitment-funnel'`), `dateFilterable: true`.

## Task 3 -- Wire up `RecruitmentPage.jsx`

Replace the stub with a real landing list using the already-built,
currently-unused `RecruitmentList.jsx` component.

- [x] `RecruitmentPage.jsx`: load `listMyRecruitments()` on mount, render via
      `RecruitmentList`, row click navigates to `/recruitments/:id`. Loading/
      empty/error states match `ReportTable.jsx`'s shape (established
      convention across the app for these three states).
- [x] Positions: `RecruitmentList` takes a `positionsById` map for
      designation display -- check whether `RecruitmentSummary` already
      carries enough (it has `SanctionedManpowerPositionId` only) or whether
      the page needs a lightweight lookup; if no existing endpoint returns
      position designations in bulk, fall back to showing the position id's
      short form rather than adding new backend surface not asked for.
- [x] "New Recruitment" button: remove it (or point it at `/projects`,
      since recruitment is always started from a project's sanctioned
      position, per `ProjectDetailPage.jsx`'s existing "Start recruitment"
      flow) -- there is no standalone create-recruitment-without-a-project
      path and building one is out of scope.

## Task 4 -- Candidate login mode

Frontend-only. `login()` already ignores `loginType` entirely -- confirmed
in `useAuth`/`AuthContext.jsx`/`authApi.js` -- so no backend change and no
functional change to authentication, only to the login page's own affordance
and copy.

- [x] `LoginPage.jsx`: add a third segmented option, "Candidate", alongside
      Faculty/Office (icon: e.g. `GraduationCap` from lucide-react, matching
      the existing `Users`/`Briefcase` pattern).
- [x] Selecting Candidate changes: the field label ("Candidate Email" instead
      of "...Username" -- applicants register with an email, not a username),
      the button label/gradient (reuse a third color, e.g. emerald, distinct
      from blue/purple), and adds a "New here? Register to apply" link to
      `/register` under the form (mirroring `RegisterApplicantPage.jsx`'s
      existing "Already registered? Sign in" link back).
  - `loginType` remains cosmetic, as it already is for Faculty/Office --
    this task does not add branching auth logic, only a truthful UI for an
    audience that already authenticates through this exact form.
- [x] No test framework covers this file today (no existing `LoginPage`
      test); match that -- verify by live CDP walkthrough in Task 5 instead
      of introducing the file's first unit test unprompted.

## Task 5 -- Live verification

- [x] Start the stack; run full backend test suite (regression bar: all
      pre-existing tests pass unmodified except the one anticipated
      `PageAccessSeederTests` change).
- [x] Via `dbq`/curl: create a throwaway recruitment on a live project as a
      real PI, add candidates in mixed screening states, hit
      `/api/my/recruitments` and `/api/reports/recruitment-funnel` (Own and,
      temporarily, HOD/Dean scope), confirm counts, confirm Excel/PDF export
      both produce valid files.
- [x] Via CDP: log in as Faculty, visit `/recruitment`, confirm the list
      renders and a row navigates to the right detail page; visit
      `/reports/recruitment-funnel`, confirm the tab and table render;
      visit `/login`, click through Faculty/Office/Candidate modes, confirm
      the Candidate mode's copy and the link to `/register` work.
- [x] Clean up every throwaway recruitment/candidate/role-grant created
      during verification; confirm via `dbq` that nothing live was left
      behind.

## Task 6 -- Commit

- [x] One commit once all tasks above are checked off and verified live.

## Execution record

489 backend tests pass (482 carried in + 6 new: 2 `ListOwnAsync`, 4
`GetRecruitmentFunnelAsync` + 1 anticipated `PageAccessSeederTests` update
+ 1 new `PageAccessSeeder` regression test). No new migration was needed --
every DbSet the funnel report and `ListOwnAsync` touch already existed.

Two real, pre-existing bugs were found and fixed during live verification,
neither anticipated by the plan:

1. **`PageAccessSeeder.SeedAsync` never adds a page to a module that
   already exists.** The module loop's `if (moduleKeys.Contains(...)) continue;`
   guard, added to keep the seed idempotent, also silently skipped
   reconciling that module's *pages* -- so the new `reports.recruitment-funnel`
   page (added to the already-live `reports` module) never got created or
   granted on the live database, even after restarting the API. Any future
   page added to an existing module would have hit the same silent gap.
   Fixed by reconciling missing pages within existing modules on every
   startup (still additive/idempotent -- proven by a new test,
   `ANewPageAddedToAnAlreadySeededModuleIsStillSeeded`, plus the existing
   `TheSeedIsIdempotent` test staying green). Caught only by live
   verification: the in-memory test fixtures always start from an empty
   database, so this path never executed under the original unit tests.
2. **`UI/src/api/reportsApi.js`'s `REPORT_PATHS` map was missed** when
   adding the 8th report -- `reportDefinitions.js` (the tab list/columns)
   was updated, but the sibling map that resolves a report key to its API
   path was not, so the new tab rendered but its data fetch threw "Unknown
   report: recruitment-funnel". Fixed by adding the missing entry. Caught
   only by the CDP walkthrough, not by lint or build (a plain object
   lookup has no type checking to catch a missing key).

Live verification performed: full backend suite; `dbq` confirmed the new
`Pages`/`RolePageAccess` rows exist with the correct Faculty/HOD/Office
grants after a clean API restart; curl as `faculty1` against
`/api/my/recruitments` (4 real recruitments, newest first, all own) and
`/api/reports/recruitment-funnel` (JSON, matching real screening/outcome
data) and its `?format=excel`/`?format=pdf` variants (valid `.xlsx`/`.pdf`
files, confirmed via `file`). CDP walkthrough against a real Chrome/Vite
dev server: `/login`'s new Candidate tab (field label, submit label,
accent colour, and the `/register` link all switch correctly and the other
two tabs are unaffected); full login as `faculty1`; `/recruitment` renders
the real 4-row list and a row click navigates to the correct
`/recruitments/:id` detail page; `/reports/recruitment-funnel` renders as
its own sidebar link and tab with the correct columns and real row data.
No throwaway data was written to the live database during this
verification (read-only against real pre-existing recruitments), so no
rollback was needed; only local dev processes (API, Vite, Chrome) were
started and stopped.
