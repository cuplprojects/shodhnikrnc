# Phase 9 — Research Proposal & Approval Chain (Implementation Plan)

Spec: [`notes/specs/2026-08-13-research-proposal-design.md`](../specs/2026-08-13-research-proposal-design.md)

**Regression bar:** the existing 365 tests pass unmodified throughout. A test
needing to change means a shipped slice's behaviour changed, which this phase
must not do outside what it deliberately adds.

Sequencing note: the spec's §5 "sequencing consequence" is resolved — Phase 8
has since shipped. `IPageAccessService`, `IUserDepartmentProvider` and
`Department` all exist, so HOD scoping uses them directly rather than a
hand-rolled filter to replace later.

---

## 9a — Foundations that unblock everything else

These two are prerequisites for the approval chain (9b) and must land first,
each verified by the existing regression bars before proposal code depends on
them.

- [ ] **Task 1 — `WorkflowStage` and `WorkflowAction` extensions.**
  Append `Draft`, `WithHOD`, `WithRnCOffice`, `AssignedToDealingAssistant`,
  `WithSuperintendent`, `WithDeputyRegistrar`, `WithDean` to `WorkflowStage`.
  Append `Return` to `WorkflowAction`. Append-only — doc-comment why, matching
  the existing convention on both enums.
  **Verify:** the 365-test suite is unaffected (pure additions, no reordering).

- [ ] **Task 2 — `Return` in the workflow engine, and `ResubmitEntrySequence`.**
  Add `WorkflowDefinition.ResubmitEntrySequence` (`int?`, null = restart at
  step 1, matching every existing route). Add `IWorkflowEngineService.ReturnAsync`
  following the shape of `ForwardAsync`/`RejectAsync`: validates the actor's
  role against the current stage, moves the instance to the stage at
  `ResubmitEntrySequence` (or the initial stage if null), appends a `Return` step.
  *TDD: a route with `ResubmitEntrySequence = null` behaves exactly as today
  (regression); a route with it set re-enters at that sequence, not step 1;
  returning from a stage that does not permit it is refused, mirroring
  `RequireStageCanAsync`.*
  **This is the highest-risk task in the phase** — it changes the shared
  workflow engine every other slice depends on. Sequenced first and alone, so
  a break here is caught before any proposal code is written on top of it.
  **Verify live** (as Phase 7 did): the 365 tests unmodified, then drive one
  existing route (e.g. Consumable) through the API unaffected by the addition.

## 9b — The approval chain as configured data

- [ ] **Task 3 — Seed the 8-stage `ProposalApprovalRoute`.**
  A new `WorkflowDefinition` for `RequestType.???` (Task 3 also decides: does
  `ResearchProposal` need a new `RequestType`, or does it reuse an existing one
  with a new `WorkflowPhase`? The domain model in spec §3 suggests a new
  `RequestType.ResearchProposal`, appended per the existing convention).
  Stages per spec §4, `ResubmitEntrySequence = 4` (Dealing Assistant).
  *TDD: mirrors `WorkflowDefinitionSeederTests` — every stage reachable in
  sequence, `HOD` stage carries `Department` scope via `RolePageAccess`-style
  reasoning (see Task 7), the resubmit stage matches spec.*
  **Verify:** seeded route matches spec §4's table exactly, checked by test the
  same way Phase 7's seed was checked against the shipped chain.

## 9c — Domain and persistence

- [ ] **Task 4 — Entities.** `ResearchProposal`, `ProposalBudgetLine`,
  `ProposalStatus` enum (append-only, spec §2). `WorkflowInstanceId` nullable
  (null while `Draft`), `ProjectId` nullable (set only on `Sanctioned`).
- [ ] **Task 5 — DbContext + migration.** DbSets on the interface and all four
  contexts together — this has broken the build twice before when done
  separately. `Include`/cascade for `ProposalBudgetLine`.
- [ ] **Task 6 — `DocumentKind` extensions.** Append `EndorsementCertificate`,
  `BudgetCopy`, `SupportingDocument` (`CoverLetter` already exists). Checklist
  seed via `IDocumentChecklistService`, following Phase 3c's pattern exactly —
  no new enforcement mechanism.

## 9d — Services

- [ ] **Task 7 — `IResearchProposalService`.**
  - `CreateDraftAsync` — PI only, `DepartmentId` from the PI's own
    (`IUserDepartmentProvider`), so the HOD stage scoping in Task 3 has
    something real to scope against.
  - `SubmitForApprovalAsync` — Draft → raises the workflow instance via
    `IWorkflowEngineService.RaiseAsync`, sets `Status = UnderApproval`.
  - Forward/reject/return at each internal stage — thin wrappers over the
    engine's existing methods plus a `Status` transition, mirroring how
    `TravelRequestService` wraps the engine today.
  - `RecordAgencySubmissionAsync` — `Approved → SubmittedToAgency`.
  - `RecordSanctionAsync` — `SubmittedToAgency → Sanctioned`, creates the
    `Project` from `ProposalBudgetLine` rows, sets `ProjectId`. **The
    lifecycle's central rule**: nothing else in this phase may create a
    `Project`.
  - `RecordNotFundedAsync`, `WithdrawAsync`.
  *TDD: every transition tested individually; specifically a test asserting
  `RecordSanctionAsync` is the only path that ever creates a `Project` —
  grep-style, or by asserting no `Project` exists after `Approved` alone.*

- [ ] **Task 8 — HOD department scoping.**
  The HOD's proposal queue filters by `ResearchProposal.DepartmentId ==
  IUserDepartmentProvider.GetDepartmentIdAsync(hodUserId)`. This is the first
  page in the application with a genuinely Department-scoped grant — build
  `IScopedQuery` here (spec's deferred item), rather than a one-off filter,
  since Phase 8's model was built anticipating exactly this.
  *TDD: an HOD in CSE sees only CSE proposals; the same HOD role held by an
  R&C user sees all (exercises Phase 8's widening rule for real, not by proxy
  as the Task 12 live-check had to).*

## 9e — API and documents

- [ ] **Task 9 — Controller + contracts.** `ProposalsController`: create draft,
  submit, list-mine (PI), list-for-hod (scoped), forward/reject/return at each
  stage, record-sanction (RnC office / Dean only — this is the one action a PI
  or HOD must never be able to trigger).
- [x] **Task 10 — Proposal document generation. Decided: upload-only.**
  The spec itself says so explicitly ("Documents go through the existing
  `Document` entity and `IDocumentChecklistService`... no new enforcement
  mechanism") — unlike the indent cover letter (a fixed MNNIT-produced form
  `IDocumentGenerationService` templates from stored fields),
  `CoverLetter`/`EndorsementCertificate`/`BudgetCopy`/`SupportingDocument` are
  all externally- or agency-produced documents with no fixed institutional
  layout to template. Already implemented by Task 6's checklist seed
  (`DbSeeder.cs`, `WorkflowPhase.Indent` + `proposalTypes`, all four mandatory)
  — no new code required.

## 9f — Frontend

- [x] **Task 11 — Proposal pages.** Built in `UI/src/pages/proposals/`:
  `ProposalCreatePage` (draft form with a repeatable budget-lines field
  array), `ProposalsPage` (PI's own list), `HodProposalsPage` (department
  queue), `RncOfficeProposalsPage` (institute-wide queue), `ProposalDetailPage`
  (the shared action surface every role lands on: chain actions, RnC-office
  post-approval actions, approval timeline, document checklist). Shared
  `ProposalStageBadge`/`ProposalStatusBadge` components and
  `constants/proposalEnums.js`, mirroring the `WORKFLOW_STAGE_LABELS` pattern.
  Every chain-action button is always offered by the frontend and the backend
  remains sole authority (a 403 surfaces as a normal error), matching
  `ProposalsController`'s own doc comment on why it carries no compile-time
  role attributes.
- [x] **Task 12 — Sidebar + route guard wiring.** Three new `PageCatalogue`
  modules (`proposals` at `Own`, `proposals-hod` at `Department` for `HOD`,
  `proposals-rnc` at `Department` for the office roles — widened to Institute
  via R&C department membership, the same mechanism every other office page
  uses, not granted directly). `proposals.detail` is granted to
  `Faculty, HOD, Office` since all of them legitimately land on it; the real
  per-proposal check stays in `IResearchProposalService.GetAsync`. Sidebar
  needed no code change (data-driven from `GET /api/my/pages`); `App.jsx`
  got five new routes. `PageAccessSeederTests` updated for HOD's now-real
  module access (Phase 9 is the first genuinely HOD-gated feature; previously
  the test asserted zero as a true statement about the shipped app, not a
  design constraint).

  **Gap found and closed, not left as a known limitation:** the queue built
  for RnC office roles initially had nowhere to read from --
  `ListForHodAsync` is HOD-only and department-scoped by ownership of that
  department, not by R&C membership, so an office account with no HOD grant
  (the normal case: `osrc`/`dyregrc`/`deanrc` hold no HOD role at all) had no
  endpoint returning institute-wide proposals. Added
  `IResearchProposalService.ListForRnCOfficeAsync` (institute-wide by
  checking the caller's own department's `IsInstituteWide` flag directly --
  the same fact `PageAccessService.IsInstituteWideAsync` checks, not
  duplicated logic reasoning about a different thing) and
  `GET /api/proposals/for-rnc-office` (`[Authorize(Roles = RnCOfficeRoles)]`).
  3 new tests, verified by mutation. Live-verified: an office account with no
  HOD grant, in the R&C department, correctly sees a CSE-department proposal
  sitting at `WithRnCOffice` -- proving the institute-wide scope, not just
  the unit-tested logic in isolation.

  Also caught and fixed while reviewing the built frontend:
  `ProposalChainActions.jsx`'s show/hide logic for Reject and Return had
  diverged (Return's exclusion list was missing two stages), which would have
  shown a "Return to PI" button at `WithRnCOffice`/`AssignedToDealingAssistant`
  that always 403s. Both now derive from the same single
  `canRejectOrReturnHere` check, matching the seeded route's `CanReject`
  stages exactly (`WithSuperintendent`, `WithDeputyRegistrar`, `WithDean`).

## 9g — Verification

- [x] **Task 13 — Full suite.** 409 tests total (365 pre-existing + 44 added
  across Tasks 1-9), all pass unmodified/green.
- [x] **Task 14 — Live walkthrough.** Driven directly over the REST API
  (curl), not CDP — Tasks 11/12 (the proposal frontend pages) are still
  unbuilt, so there is no UI yet to drive over the browser protocol. See the
  execution record below for the full run.
- [x] **Task 15 — Commit** with an execution record, following the Phase 7/8
  pattern.

---

## Execution record (Tasks 13-15)

**Full suite:** `dotnet test API.Tests` — 409 passed, 0 failed, 0 skipped.

**Live walkthrough (real MySQL `MNNITRNC_New`, API on :5471/:7054, Development
environment):**

Temporarily granted `clerk1` (seeded `RegularStaff`, originally no
department) the `HOD` role and `DepartmentId = CSE`, mirroring Phase 8's
precedent for borrowing an existing sign-in-able account rather than
fabricating one — restored exactly afterward (role revoked, `DepartmentId`
set back to `NULL`), confirmed by re-querying the account.

*Pass 1 — happy path, as `faculty1` (PI, CSE) / `clerk1` (HOD+RegularStaff,
CSE) / `osrc` (Superintendent) / `dyregrc` (DeputyRegistrar) / `deanrc`
(Dean):*
1. `POST /api/proposals` (faculty1) → `Draft`.
2. `POST /submit` (faculty1) → `Status=UnderApproval`, instance raised at
   `CurrentStage=Draft` (the route's `IsInitial` stage — confirmed this is by
   design, not a bug: `SubmitForApprovalAsync_RaisesTheWorkflowInstanceAtDraft`
   names it explicitly).
3. `POST /forward` (faculty1) → `WithHOD`.
4. `POST /forward` (clerk1/HOD) → `WithRnCOffice`. Proposal appeared in
   `GET /api/proposals/for-hod` for clerk1 (CSE-scoped) before this step,
   confirming department scoping is live, not just unit-tested.
5. `POST /forward` (clerk1/RegularStaff) → `AssignedToDealingAssistant`.
6. `POST /forward` (clerk1/RegularStaff) → `WithSuperintendent`.
7. `POST /forward` (osrc/Superintendent) → `WithDeputyRegistrar`.
8. `POST /forward` (dyregrc/DeputyRegistrar) → `WithDean`.
9. `POST /approve` (deanrc/Dean) → `Status=Approved`, `CurrentStage=Approved`,
   **`ProjectId` still null** — confirmed internal approval alone never
   creates a Project (also queried `Projects` table directly: empty for this
   proposal at this point).
10. `POST /record-agency-submission` (clerk1/RegularStaff) →
    `Status=SubmittedToAgency`, `submittedToAgencyOn` set.
11. `POST /record-sanction` (clerk1/RegularStaff) → `Status=Sanctioned`,
    `ProjectId` set. Queried the `Projects` table directly: row exists,
    `ProjectType=0` (`TypeIResearch`), `OwnerUserId` = faculty1's id, title /
    agency / sanction number / total sanctioned all match the sanction
    payload.

*Pass 2 — `Return`, as the same accounts:*
1. Second proposal created and forwarded PI → HOD → RnC office → Dealing
   Assistant → `WithSuperintendent`.
2. `POST /return` (osrc/Superintendent) → re-entered at
   `CurrentStage=AssignedToDealingAssistant` (`ResubmitEntrySequence = 4`),
   **not** `Draft` — proving the resubmit-entry-sequence mechanism works
   against real stored configuration, not just the in-memory test route.
3. `POST /forward` (clerk1/RegularStaff) from the resumed stage succeeded,
   landing back at `WithSuperintendent` — confirming the proposal isn't stuck
   after a return, it can be re-driven through the remainder of the chain.

**Cleanup:** both test proposals, their `ProposalBudgetLine` rows, both
`WorkflowInstance`/`WorkflowStep` rows, and the one `Project` row created by
sanction were deleted after verification. `clerk1`'s `HOD` role grant and
`DepartmentId` were reverted to their original values (`RegularStaff` only,
`DepartmentId = NULL`), confirmed by re-querying afterward. The API instance
was stopped; port 5471 confirmed free.

**Not yet built:** Task 10 (proposal document generation — decision on
templating vs. upload-only still open) and Tasks 11-12 (frontend pages,
sidebar/route-guard wiring). The backend and workflow chain are complete and
live-verified; the phase is not yet user-facing.

---

## Post-verification fix: Return stranded the PI, not just the office

Live-verifying Task 14 surfaced a real design bug, caught by re-reading what
`Return` actually did rather than trusting the passing tests: it re-entered at
`AssignedToDealingAssistant`, a stage whose `AllowedRoles` is `RegularStaff`
only. The PI -- the one person who could actually revise/re-upload what got
the proposal returned -- had no permission to act at the stage `Return` sent
it to. Office staff could forward it onward with nothing changed; the PI was
never in the loop.

**Fix:** added `WorkflowStage.ReturnedToPI`, a PI-only stage (empty
`AllowedRoles`, ownership enforced by the service, mirroring `Draft`) that
`Return` now targets instead. Since the workflow engine's `Forward` action
only ever moves to "next stage by sequence" -- there is no branching --
`ReturnedToPI` could not simply be spliced into the main sequence (that would
have put every proposal, returned or not, through an extra PI checkpoint on
its ordinary happy path). Added
`WorkflowStageDefinition.ForwardOverrideSequence` (nullable `int`, mirroring
`WorkflowDefinition.ResubmitEntrySequence`'s shape at the stage level): a
branch stage's own `Forward` consults it instead of "next by sequence".
`ReturnedToPI` sits at sequence 9 (off the main 1-8 line, so ordinary forwards
never reach it) with `ForwardOverrideSequence = 4`, rejoining exactly at
`AssignedToDealingAssistant` -- preserving the BRD's "must NOT re-enter at the
Dean step" exactly as before, just via an explicit PI step first.

Also added ownership enforcement to `ResearchProposalService.ForwardAsync`
for stages with no `AllowedRoles` (`Draft`, `ReturnedToPI`): the engine's role
gate alone lets anyone through a roleless stage, so without this, office
staff could still have forwarded the PI's `ReturnedToPI` stage on the PI's
behalf. This closes a pre-existing, previously-unexercised gap in `Draft`
forwarding too -- `Draft` had never actually been protected against a non-PI
caller before this fix.

**Migration:** `20260817070517_AddWorkflowStageForwardOverrideSequence`
(additive, nullable column) — applied to `MNNITRNC_New`. The proposal route
seeded before this fix was deleted (no live instances were on it at the time)
and reseeded by the app on next startup with the corrected shape.

**Regression:** 416 tests pass (409 + 7 new: two generic engine tests for
`ForwardOverrideSequence` in `WorkflowReturnTests`, plus proposal-specific
seeder/service tests for `ReturnedToPI`). Both the override mechanism and the
ownership gate were verified by mutation (temporarily disabled, confirmed the
relevant tests fail for the right reason, restored).

**Live re-verification:** re-ran the Return scenario end-to-end against
`MNNITRNC_New` after reseeding: Superintendent returns → proposal lands on
`ReturnedToPI` → office staff (`clerk1`) attempting to forward gets `403
Not the proposal owner` → the owning PI (`faculty1`) forwards successfully →
lands on `AssignedToDealingAssistant` → carried the rest of the way through
Superintendent, DR, and Dean's approval to confirm the chain isn't stuck.
Test data and the temporary `clerk1` HOD/CSE grant were cleaned up and
reverted afterward, confirmed by re-querying; the API instance was stopped.

---

## Frontend (Tasks 11-12) and the ListForRnCOfficeAsync addition

Full backend suite: **419 tests pass** (416 + 3 new `ListForRnCOfficeAsync`
tests, verified by mutation). Frontend: `npm run lint` and `npm run build`
both clean (two pre-existing, unrelated lint errors in
`ManageAnnouncements.jsx`/`ManageNewsEvents.jsx`, untouched by this work).
Live-verified the new `GET /api/proposals/for-rnc-office` endpoint against
`MNNITRNC_New`: correctly 403s a non-office role, returns `200 []` for R&C
office staff with nothing in the queue, and — after creating a proposal,
pushing it to `WithRnCOffice`, and querying as `osrc` (R&C department,
no HOD grant) — correctly returned it, proving the institute-wide scope
end-to-end rather than only in the unit tests. Test data and the temporary
`clerk1` grant were cleaned up and reverted afterward; the API instance was
stopped. Task 11/12 detail is recorded above under "9f — Frontend".

Remaining: no CDP/browser walkthrough of the frontend pages themselves has
been run yet (only the API surface they call). All 15 tasks are otherwise
complete.

---

## Task 14, closed: full CDP browser walkthrough of the frontend

Drove the actual rendered pages (not just the API) via a raw CDP driver
(Node 22's built-in `WebSocket`/`fetch`, no dependency) against a real
Chrome instance, the Vite dev server, and the live API/`MNNITRNC_New`.

**Bug found and fixed, caught only by clicking the real button:**
`ProposalChainActions.jsx`'s `showSubmit` required `currentStage === 'Draft'`
*and* `status === 'Draft'`. A freshly created draft has no workflow instance
yet -- `SubmitForApprovalAsync` is what raises one and sets the stage --
so `currentStage` is `null` until *after* Submit is clicked. The two
conditions could never be true together: "Submit for approval" was
permanently unreachable in the UI, for every proposal, from the moment
Task 11 shipped. Fixed to `showSubmit = isDraft` (status alone already means
"not yet submitted"); re-verified live afterward.

**Full lifecycle driven through the real UI**, faculty1 through deanrc,
each via an actual login form submission (not a stored token): create
draft → fill form → save → detail page shows Draft → Submit for approval →
PI Forward (Draft → With HOD) → clerk1 (HOD+RegularStaff, CSE) sees it in
the Department Proposal Queue, forwards through With HOD → With R&C Office →
With Dealing Assistant → With Superintendent → osrc sees Return/Reject
available and forwards → With Deputy Registrar → dyregrc forwards → With
Dean → deanrc sees Approve, clicks it → status Approved (internal), no
Project yet (confirmed on the actual rendered page, not just the database)
→ Record agency submission → Submitted to Agency → Record sanction →
**Sanctioned**, Project section with "Open project →" appears, approval
timeline shows every actor and timestamp correctly. 22/22 scripted checks
passed across the three walkthrough scripts.

Also live-verified the `RncOfficeProposalsPage` for `osrc` -- a genuinely
"pure" office account with no HOD grant -- confirming the `ListForRnCOfficeAsync`
gap-fix from the prior session works through the actual rendered queue page,
not only via curl.

**Gap found, deliberately left open (user's call, not mine):** clicking
"Open project" after sanction navigates Dean/DR/Superintendent/RegularStaff
to `/dashboard` instead of the project, because `ProjectService.GetAsync`
is a hard owner-only check (`OwnerUserId != requestingUserId` throws
`ProjectAccessDeniedException`) with no department/office widening, and
`projects.detail` is `Faculty`-only in `PageCatalogue`. This predates Phase
9 -- the Projects module was never built with a non-owner viewer in mind --
and Phase 9's sanction flow is simply the first place that links an RnC
office user to a project detail page, exposing it. Fixing it properly means
changing `ProjectService`'s access model (shared with procurement) and
`ProjectsController`'s `[PageAccess("projects.list")]` gate, which is bigger
than this phase and was explicitly deferred rather than fixed silently. The
sanction/Project-creation logic itself is fully correct and verified --
`Status=Sanctioned`, `ProjectId` set, the actual `Projects` row created with
the right owner/title/agency/sanction fields -- only the office user's
ability to *view* the resulting project page afterward is affected.

Test data (2 test proposals, 1 project, workflow instances/steps across all
three walkthrough scripts) and the temporary `clerk1` HOD/CSE grant were
cleaned up and reverted after each run, confirmed by re-querying. All
processes (API, Vite dev server, the dedicated CDP Chrome instance) were
stopped; the CDP driver script and inspection scratch files were removed
from `scratchpad/` after the run, leaving only this record.

**Phase 9 is complete.** All 15 tasks done, backend and frontend both live-
and browser-verified. One deliberately deferred, pre-existing gap remains
outside this phase's scope (project-detail access for non-owner roles).

---

## Follow-up, closed: project-detail access for RnC office roles

The deferred gap above was picked up as an explicit follow-up (the user's
choice, not automatic scope creep) rather than starting the next BRD prompt.

**Fix:** `IProjectService.GetAsync` gained an optional
`requestingUserRoles` parameter (default `null`, so every existing call site
keeps today's strict owner-only behaviour unchanged). When the caller holds
an R&C office role (`Dean`, `DeputyRegistrar`, `Superintendent`,
`RegularStaff` -- the same set as `ProposalsController.RnCOfficeRoles`),
`GetAsync` now permits read access to any project, not just their own.
`UpdateAsync`, `SoftDeleteAsync` and `RecordGrantReceiptAsync` are
deliberately untouched -- viewing and editing are different questions, and
office roles only gained the first. `ProjectsController`'s three read
endpoints (`Get`, `GetBudgetSummary`, `ListGrantReceipts`) now pass
`User.GetRoles()` through.

Widening the controller's own gate required accepting one real constraint:
`ProjectsController` carries a single class-level `[PageAccess("projects.list")]`
attribute covering every action, and no controller in this codebase overrides
a class-level `[PageAccess]` per-method (ASP.NET would AND-combine the
policies, not replace one with the other, if it did) -- so `projects.list`
and `projects.detail` were widened to the office roles in `PageCatalogue`,
at `AccessScope.Own` (the scope value itself is not consulted by the
controller gate or by `ListForOwnerAsync`, which stays hardcoded
owner-only, so this does not leak the project list -- an office role's own
`/projects` page renders empty, an honest side effect of sharing the
attribute, not a data leak).

**TDD:** 5 new tests in `ProjectServiceUpsertTests` (each of the four office
roles succeeding on a different owner's project; an unrelated role like
`Faculty` still denied; the owner unaffected either way; a `null`/empty role
collection reproducing today's exact behaviour). Verified by mutation
(temporarily forcing the office-role check false, confirmed the relevant
tests fail for the right reason, restored). 426 tests total (419 + 7: the 5
above, ProjectService is called from 3 controller sites now -- no other
tests needed changing).

**Live-verified** against `MNNITRNC_New` through the actual browser, not
curl: fast-tracked a fresh proposal to Sanctioned via the API, then as
`osrc` (Superintendent, R&C, not the project's owner) both navigated
directly to `/projects/:id` (previously bounced to `/dashboard`, now stays
and renders the project) and clicked "Open project →" from the proposal
detail page (previously silently failed, now lands on the real project
page showing the sanctioned amount and title). Test data and the temporary
`clerk1` grant cleaned up and reverted; all processes stopped.

Not blocking Task 1-2, but must be settled before the domain model is final:

1. **New `RequestType` or reuse?** Spec assumes new; confirm before Task 4.
2. **`ProposalBudgetLine` vs. reusing `BudgetHead` directly** (with a nullable
   `ProjectId` and a `ResearchProposalId` instead) — spec chose a parallel
   entity to avoid coupling `BudgetHead` to two different owners; revisit only
   if that proves awkward in Task 4.

## Deferred (spec §6)

`GrantSanctionOrder` / `PaymentInstallment` as new entities ·
`BudgetRedistributionHistory` · expiry countdown wiring.
