# Phase 6: Fellowship & Leave Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Tick a box only
> after running the stated command and seeing the expected output.

**Goal:** Implement the slice specified in
`notes/specs/2026-08-12-fellowship-leave-slice-design.md` — monthly fellowship
claims with an overridable HRA, and leave requests with entitlement tracking,
both gated on the ID card Phase 5 issues.

**Architecture:** Two groups, each independently verifiable:

- **6a — Backend** (Tasks 1–6): entities, the fellow scoping helper, both
  services, the HRA override, documents and the API surface.
- **6b — Frontend** (Tasks 7–9): the fellow portal, PI/office approval queues,
  and end-to-end verification.

**Tech Stack:** .NET 8, EF Core 8 + Pomelo/MySQL, xUnit + FluentAssertions,
React 19 + Vite + Tailwind. No new dependencies.

## Global Constraints

- **The ID card gate is server-side** on every fellowship and leave endpoint
  (spec D4). Not merely hidden in the UI.
- **Fellow scoping must not reuse `LoadOwnedProjectAsync`** — that is a *PI owns
  project* test and a fellow owns no project (spec D5).
- **Leave is reported, never deducted from pay** (spec D2).
- **HRA override is Dean or Director only, always with a reason** (spec D1).
- `RequestType` and `DocumentKind` are **append-only** — both persist as ints.
- Do not change procurement, travel or recruitment behaviour. Adding the
  `Director` role must not alter any existing authorisation.

## Dependencies

All present on `main`:
- `ManpowerSelection` with `IdCardIssuedAt`, `JoinedOn`, `ValidTill`,
  `RecommendedStipend` (Phase 5)
- The `Fellow` role, `IWorkflowEngineService`, the document store,
  `IProjectYearCalculator`, `IHtmlPdfRenderer`

---

## 6a — Backend

### Task 1: Domain model

**Files:** new entities and enums, `DocumentKind.cs`, `RequestType.cs`,
`IApplicationDbContext.cs`, `ApplicationDbContext.cs`, the three test contexts,
migration.

- [ ] **Step 1: Enums**

`LeaveType` (`Annual`, `Special`). Append `FellowshipClaim` and `LeaveRequest`
to `RequestType`; append `HraSlip` to `DocumentKind`. **Append only** — inserting
would change the meaning of existing rows.

- [ ] **Step 2: Entities**

`FellowshipClaim`, `LeaveRequest`, `LeaveEntitlement`, exactly as the spec's Data
Model. The claim carries the four override columns.

- [ ] **Step 3: Add the `Director` role** (spec D8)

Append to `DbSeeder.Roles` and seed a `directorrc` account. **Do not** grant it
any existing permission — this slice only lets it override HRA. Verify no
existing `[Authorize]` attribute changes meaning.

- [ ] **Step 4: Configure and migrate**

Unique index on `(FellowAppointmentId, ClaimYear, ClaimMonth)` and on
`(FellowAppointmentId, LeaveType, ProjectYear)`.

Run: `dotnet ef migrations add AddFellowshipAndLeave --project API/API.Infrastructure --startup-project API/API`
Then apply it: leaving a generated migration unapplied is what broke Phase 5's
first live run.

- [ ] **Step 5: Build**

Run: `dotnet build API/API.slnx`

### Task 2: Fellow scoping (spec D5)

**Files:** `IFellowContextService.cs`, `FellowContextService.cs`, tests.

This is the security foundation for everything else in the slice, so it lands
before either service.

- [ ] **Step 1: Resolve the caller's appointment**

Given a user id, return their `ManpowerSelection` or throw. **Do not reuse
`LoadOwnedProjectAsync`.**

- [ ] **Step 2: Enforce the ID card gate**

Throw `IdCardNotIssuedException` when `IdCardIssuedAt` is null. Every fellowship
and leave entry point calls this.

- [ ] **Step 3: Tests**

Run: `dotnet test API/API.Tests/API.Tests.csproj`
Cover: a fellow with no ID card is refused; **one fellow cannot resolve
another's appointment**; a user with no appointment is refused.

### Task 3: Fellowship claims

**Files:** `IFellowshipService.cs`, `FellowshipService.cs`, inputs, exceptions.

- [ ] **Step 1: `RaiseClaimAsync`**

Validates in order: ID card issued; claim month inside `[JoinedOn, ValidTill]`;
no existing claim for that `(appointment, year, month)`; HRA slip present when
`HraClaimed`.

Computes `FellowshipAmount` from the appointment, `HraAmount` as 20%, and
`TotalAmount`. Raises the workflow instance with
`RequestType.FellowshipClaim`.

- [ ] **Step 2: `OverrideHraAsync`** (spec D1)

Dean or Director only. Requires a non-empty reason and a non-negative amount.
**Refused once the claim is approved** — changing a settled amount should mean a
fresh claim. Records who, when and why, then recomputes `TotalAmount`.

- [ ] **Step 3: Leave figures on the claim** (spec D2)

`LeaveDaysTakenThisMonth` and `UnauthorisedAbsenceDays` are stored and shown.
**Nothing multiplies or subtracts them from any amount.** A test asserts the
total is unaffected by them.

- [ ] **Step 4: Queries**

`ListOwnClaimsAsync` (fellow), `ListForProjectAsync` (PI).

- [ ] **Step 5: Tests**

Cover every rule above, especially: HRA claimed without a slip is refused; a
second claim for the same month is refused; a non-Dean/Director override is
refused; an override without a reason is refused; an override after approval is
refused; **leave days do not change the total**.

### Task 4: Leave requests and entitlement

**Files:** `ILeaveService.cs`, `LeaveService.cs`, inputs, exceptions.

- [ ] **Step 1: `RaiseLeaveAsync`**

Validates: ID card issued; `ToDate >= FromDate`; dates inside the tenure; purpose
present for `Special`; **requested days do not exceed remaining entitlement**.

Remaining is `Entitled - (Consumed + PendingDays)` — counting pending as well as
approved, so two requests that each fit individually cannot together exceed the
allowance (spec Risks).

- [ ] **Step 2: Entitlement per project year** (spec D6)

`LeaveEntitlement` rows are created on first use, not seeded at joining. The year
comes from `IProjectYearCalculator.GetProjectYear(appointment.JoinedOn, fromDate)`
— **project year, not calendar year**.

Annual 30 days, Special 15 days.

- [ ] **Step 3: Consume on approval only**

`ConsumedDays` advances when the workflow reaches `Approved`, never at raise. A
rejected request must leave the balance untouched.

- [ ] **Step 4: `GetBalanceAsync`**

Entitled, consumed, pending and remaining per type for the current project year.

- [ ] **Step 5: Tests**

Cover: over-entitlement refused; **two pending requests that together exceed the
allowance are refused**; a rejected request does not consume; Special without a
purpose is refused; the project-year boundary rolls the allowance rather than the
calendar year.

### Task 5: Documents

**Files:** `IFellowshipDocumentGenerationService.cs`, the implementation, the
stipend form template.

- [ ] **Step 1: Stipend form template**

Ported from legacy `generate_stipend_form.php`, reusing `IndentHtmlShell`.
Prints the leave figures the way legacy does — yearly leaves, total taken, days
of unauthorised absence — **next to** the recommended amount, not deducted from
it.

Where an HRA override is present, the form shows the overridden figure and notes
that it was overridden, so the printed document does not disagree silently with
the 20% default.

- [ ] **Step 2: Generate on demand**

`GET /api/fellowship-claims/{id}/stipend-form`, rendered per request like the
recruitment documents rather than stored.

- [ ] **Step 3: Build and tests**

### Task 6: API surface and seed

**Files:** contracts, `FellowshipController.cs`, `LeaveController.cs`,
`DbSeeder.cs`, `Program.cs`, exception middleware.

- [ ] **Step 1: Contracts and controllers**

Fellow-facing endpoints are `[Authorize(Roles = "Fellow")]`; the override is
`[Authorize(Roles = "Dean,Director")]`; PI queues are `Faculty`.

- [ ] **Step 2: Map the new exceptions**

`IdCardNotIssuedException` → 403 (authenticated, not yet permitted).
`InsufficientLeaveBalanceException` → 400.
`HraOverrideNotPermittedException` → 403.

- [ ] **Step 3: Checklist seed**

`FellowshipClaim`: generated stipend form, HRA slip (non-mandatory — only
required when HRA is claimed, which the service enforces conditionally).
`LeaveRequest`: signed leave application.

- [ ] **Step 4: Full suite**

Run: `dotnet test API/API.Tests/API.Tests.csproj`
Expected: all pass, **including the 203 pre-existing**.

---

## 6b — Frontend

### Task 7: Fellow portal

- [ ] **Step 1: `fellowshipApi.js`, `fellowshipEnums.js`**
- [ ] **Step 2: Claim form**

Shows the computed HRA and, beside it, the sanctioned `Hra` from the position so
a mismatch is visible. Requires an HRA slip upload when HRA is claimed.

- [ ] **Step 3: Leave request form with a live balance**
- [ ] **Step 4: Fellow dashboard** — claims, leave, remaining balance
- [ ] **Step 5: Build and lint**

### Task 8: PI and Dean/Director screens

- [ ] **Step 1: PI approval queue for claims and leave**
- [ ] **Step 2: HRA override control**

Visible only to Dean and Director. Requires a reason before it can be submitted,
and states plainly that it changes the amount paid.

- [ ] **Step 3: Build and lint**

### Task 9: End-to-end verification

- [ ] **Step 1: Full build, lint, test suite**

- [ ] **Step 2: API walkthrough**

As a fellow **without** an ID card: claim and leave both refused. Then issue the
card and: raise a claim; confirm HRA is 20%; attempt HRA without a slip
(refused); attempt a duplicate month (refused); override HRA as Dean (accepted,
recorded) and as Faculty (refused); override without a reason (refused); raise
leave within entitlement; raise leave exceeding it (refused); raise two pending
requests that together exceed it (refused); confirm a rejected request leaves the
balance untouched; download the stipend form and confirm the leave figures print
without changing the amount.

- [ ] **Step 3: Browser verification** over CDP, as Phases 4 and 5 were.

- [ ] **Step 4: Record results and commit**

State explicitly what was verified live and what was not.

---

## Self-Review Notes

- **Task 2 lands first deliberately.** Fellow scoping is the first place a non-PI
  role reads project-linked data; every later task depends on it being right, and
  a mistake leaks one fellow's financial records to another.
- **The two highest-risk rules get dedicated tests**: that leave figures never
  alter a claim total (D2), and that pending leave counts toward the entitlement
  check (otherwise two requests each fit but together overrun).
- **The `Director` role is added but not empowered elsewhere.** Verifying that no
  existing authorisation changes is part of Task 1 Step 3.
- **D1's override is a pay-affecting privilege**, so the role check, the required
  reason, and the post-approval refusal are all tested rather than assumed.
