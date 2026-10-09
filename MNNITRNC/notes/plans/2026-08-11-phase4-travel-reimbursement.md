# Phase 4: Travel Reimbursement Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Tick a
> box only after running the stated command and seeing the expected output.

**Goal:** Implement the travel reimbursement slice specified in
`notes/specs/2026-08-11-travel-reimbursement-slice-design.md` — raise a travel
request against a project's `RecurringTravel` head with N journey legs, generate
the request form, drive it through the existing workflow engine, and process its
bill with a cover letter.

**Architecture:** A standalone `TravelRequestService`, *not* a subclass of
`IndentServiceBase<T>`. That base is specialised to indents — it takes an
`IProcurementTierCalculator`, threads `GemAvailability` through every abstract
member, and persists committees. Travel has none of those. It reuses the same
*collaborators* (`IWorkflowEngineService`, `IIndentBudgetValidator`,
`IDocumentGenerationService`, `IDocumentStorageService`, `IFacultyProfileProvider`)
and mirrors `RaiseAsync`/`ProcessBillAsync`'s orchestration order, but as its own
class.

**Tech Stack:** .NET 8, EF Core 8 + Pomelo/MySQL, xUnit + FluentAssertions,
React 19 + Vite + Tailwind. No new dependencies.

## Global Constraints

- **Do not modify `IndentServiceBase` or the three indent services.** The single
  permitted change to Phase 3 code is `IndentBudgetValidator.SumCommittedAsync`
  (Task 4), which must additionally count travel requests.
- Server computes `ExpectedCost`; never accept a client-supplied total (spec D3).
- `TaxiReimbursementOptedIn` is set at raise and never written again (spec D1).
- Travel uses `WorkflowPhase.Indent` for the request phase and
  `WorkflowPhase.Bill` for reimbursement (spec D5). Do not add a phase value.
- Frontend is Tailwind with `dark:` variants, all API calls through `UI/src/api/`.
- Enum values cross the wire as PascalCase strings.

## Dependencies

Everything this plan needs already exists on `main`:
- `RequestType.Travel` (Phase 1)
- `IWorkflowEngineService`, `Document`/`DocumentKind`, checklist service (Phases 1, 3c)
- `IIndentBudgetValidator`, `IFacultyProfileProvider`, `IHtmlPdfRenderer` (Phase 3)

---

## File Structure

```
API/
  API.Domain/
    Entities/
      TravelRequest.cs                        (new)
      TravelJourneyLeg.cs                     (new)
    Enums/
      TravelerType.cs                         (new)
      TravelMode.cs                           (new)
      BookingPlatform.cs                      (new)
      DocumentKind.cs                         (modify: + TravelRequestForm, TravelBill)
  API.Application/
    Common/
      IApplicationDbContext.cs                (modify: 2 DbSets)
    Travel/
      ITravelRequestService.cs                (new)
      TravelRequestService.cs                 (new)
      TravelInputs.cs                         (new: Raise/ProcessBill inputs, summaries)
      TravelRequestNotFoundException.cs       (new)
      TaxiNotOptedInException.cs              (new)
      TravelDocumentModel.cs                  (new)
      TravelDocumentModelFactory.cs           (new)
    Documents/
      IDocumentGenerationService.cs           (modify: travel methods)
    Procurement/
      IndentBudgetValidator.cs                (modify: count travel — spec D4)
  API.Infrastructure/
    DocumentGeneration/
      DocumentGenerationService.cs            (modify: implement travel methods)
      Templates/
        TravelRequestFormTemplate.cs          (new)
        TravelCoverLetterTemplate.cs          (new)
    Persistence/
      ApplicationDbContext.cs                 (modify: DbSets + OnModelCreating)
      Migrations/                             (new migration)
  API/
    Contracts/Travel/
      RaiseTravelRequest.cs                   (new)
      ProcessTravelBillRequest.cs             (new)
      TravelRequestResponse.cs                (new)
      TravelListItemResponse.cs               (new)
    Controllers/
      TravelRequestsController.cs             (new)
    Seed/
      DbSeeder.cs                             (modify: travel checklist items)
    Program.cs                                (modify: DI)
  API.Tests/
    Travel/
      TravelRequestServiceTests.cs            (new)
      TravelBudgetInteractionTests.cs         (new)
      TestTravelDbContext.cs                  (new)
UI/src/
  api/travelApi.js                            (new)
  constants/travelEnums.js                    (new)
  pages/travel/
    TravelDetailPage.jsx                      (new)
    components/
      TravelRequestModal.jsx                  (new)
      JourneyLegsFieldArray.jsx               (new)
      TravelList.jsx                          (new)
      ProcessTravelBillForm.jsx               (new)
  pages/projects/ProjectDetailPage.jsx        (modify: travel section)
  App.jsx                                     (modify: travel route)
```

---

## Task 1: Domain enums and entities

**Files:** the three new enum files, `DocumentKind.cs`, `TravelRequest.cs`,
`TravelJourneyLeg.cs`.

- [x] **Step 1: Add the three enums**

```csharp
public enum TravelerType { Self, Manpower, CoPi }

// Values mirror legacy's travel_by enum (Dump20260806.sql:1061).
public enum TravelMode { Air, Rail, RoadPrivateTaxi, RoadPersonalCar, RoadCommonTransport }

// BRD-eligible platforms. 'Other' exists because the BRD lists eligible
// platforms without declaring bookings elsewhere void.
public enum BookingPlatform { IRCTC, AshokaTravel, BalmerLawrie, Other }
```

- [x] **Step 2: Extend `DocumentKind`**

Append `TravelRequestForm` and `TravelBill`. **Append only** — these are persisted
as ints; reordering rewrites the meaning of existing rows.

- [x] **Step 3: Write the two entities**

Exactly the shape in the spec's Data Model section. `TravelRequest` carries the
derived `JourneyTotalCost` and `ExpectedCost` as persisted columns;
`TravelJourneyLeg` has `SequenceOrder` so legs render in submission order.

- [x] **Step 4: Build**

Run: `dotnet build API/API.slnx`
Expected: succeeds.

---

## Task 2: Persistence wiring and migration

**Files:** `IApplicationDbContext.cs`, `ApplicationDbContext.cs`, migration.

- [x] **Step 1: Add both `DbSet`s to the interface and the context**

- [x] **Step 2: Configure in `OnModelCreating`**

Follow the procurement entities' existing conventions: decimal precision matching
the indent columns, required strings, and a cascade delete from `TravelRequest`
to its legs (legacy had `ON DELETE CASCADE`, `Dump20260806.sql:1040`).

- [x] **Step 3: Create the migration**

Run: `dotnet ef migrations add AddTravelRequests --project API/API.Infrastructure --startup-project API/API`
Expected: migration generated with both tables.

- [x] **Step 4: Build**

Run: `dotnet build API/API.slnx`

---

## Task 3: Application-layer inputs and the service

**Files:** everything under `API.Application/Travel/`.

- [x] **Step 1: Write the input/summary records**

```csharp
public record RaiseTravelInput(
    Guid ProjectId, Guid BudgetHeadId, TravelerType TravelerType,
    Guid? ManpowerId, string? CoPiName, string? CoPiDesignation,
    string Place, string Purpose, DateOnly OnwardDate, DateOnly ReturnDate,
    TravelMode PrimaryMode, bool TaxiReimbursementOptedIn,
    string? AccommodationDetails, decimal AccommodationCost,
    string? OtherExpensesDetails, decimal OtherExpensesCost,
    IReadOnlyList<JourneyLegInput> Journeys);

public record JourneyLegInput(
    string From, string To, DateOnly Date, TravelMode Mode,
    BookingPlatform Platform, decimal Amount, string? Remarks);

public record ProcessTravelBillInput(
    string OriginalBillReference, decimal? TaxiCost, decimal? ActualCost);

public record TravelSummary(
    Guid Id, Guid ProjectId, Guid BudgetHeadId, Guid WorkflowInstanceId,
    TravelerType TravelerType, string Place, string Purpose,
    DateOnly OnwardDate, DateOnly ReturnDate, decimal ExpectedCost,
    WorkflowStage CurrentStage, DateTimeOffset CreatedAt);
```

- [x] **Step 2: Write `TravelRequestService.RaiseAsync`**

Mirror `IndentServiceBase.RaiseAsync`'s order (`IndentServiceBase.cs:72-113`):
load owned project → validate → resolve and check budget head belongs to project
→ **compute cost server-side** → `EnsureSufficientAsync` → persist entity + legs →
generate form PDF → store document → `workflowEngine.RaiseAsync(RequestType.Travel,
id, WorkflowPhase.Indent, ...)` → save instance id.

Validation, all throwing `ArgumentException` with a user-readable message (they
surface through `problemDetails.detail`):
- ≥1 journey leg
- `ReturnDate >= OnwardDate`
- every leg date within `[OnwardDate, ReturnDate]`
- all costs `>= 0`
- traveller-type combination per spec D6

- [x] **Step 3: Write `ListForProjectAsync` / `GetAsync`**

Both enforce project ownership exactly as the indent services do. `GetAsync`
returns the request with its legs ordered by `SequenceOrder`.

- [x] **Step 4: Write `ProcessBillAsync`**

Gate on `Phase == Indent && CurrentStage == Approved` (legacy
`process_travel_bill.php:24`). Then **the BRD's hard rule**: if
`input.TaxiCost > 0` and `!request.TaxiReimbursementOptedIn`, throw
`TaxiNotOptedInException`. Apply bill fields, generate the cover letter, store as
`DocumentKind.CoverLetter`, raise the `Bill`-phase instance.

- [x] **Step 5: Build**

Run: `dotnet build API/API.slnx`

---

## Task 4: Budget validator counts travel (spec D4 — highest risk)

**Files:** `API.Application/Procurement/IndentBudgetValidator.cs`

This is the only Phase 3 file this plan touches. Travel and indents draw on the
same heads; if travel is not counted, both see money the other has committed.

- [x] **Step 1: Add travel to `SumCommittedAsync`**

Add a fourth query alongside the three indent queries, projecting
`WorkflowInstanceId` and `ExpectedCost`, filtered to the budget head, and include
it in the same active-workflow filter and sum.

- [x] **Step 2: Phase 3 regression gate**

Run: `dotnet test API/API.Tests/API.Tests.csproj`
Expected: **all 139 pre-existing tests still pass.** If any budget test fails,
stop — the change has altered procurement behaviour and must be reworked, not
have its test updated.

---

## Task 5: Document generation

**Files:** `IDocumentGenerationService.cs`, `DocumentGenerationService.cs`, two
templates, `TravelDocumentModel`/`Factory`.

- [x] **Step 1: Write `TravelDocumentModel` and its factory**

Follows `IndentDocumentModel`'s shape: a flat record the template renders,
assembled from project + head + faculty + request + legs.

- [x] **Step 2: Write `TravelRequestFormTemplate`**

Reproduces legacy's request form (`generate_travel_request_pdf.php`): institute
header, traveller/place/purpose/period block, the journey-legs table with mode,
platform and amount, then accommodation / other expenses / total. Reuse
`IndentHtmlShell` for the header and font setup.

- [x] **Step 3: Write `TravelCoverLetterTemplate`**

Reproduces `process_travel_bill.php:74-185` — the "Dean [R&C] / Through: Head of
the Department" letter with the single-row visit table and the signature block.
Department and designation will render blank (spec Risks); that is expected and
matches procurement's annexures.

- [x] **Step 4: Add both methods to the generation service and implement them**

- [x] **Step 5: Build**

Run: `dotnet build API/API.slnx`

---

## Task 6: API surface

**Files:** the four contracts, `TravelRequestsController.cs`, `Program.cs`,
`DbSeeder.cs`.

- [x] **Step 1: Write the request/response contracts**

`RaiseTravelRequest` is bound `[FromBody]` as JSON — unlike indents there is no
file upload at raise, so no multipart wrapper is needed and journey legs bind as
a normal nested collection.

- [x] **Step 2: Write the controller**

Routes exactly as the spec lists, matching procurement's attribute-routing style
(`ConsumableIndentsController.cs`). Map service exceptions to problem details the
same way the indent controllers do.

- [x] **Step 3: Register the service in `Program.cs`**

- [x] **Step 4: Seed travel checklist items**

Extend `SeedDocumentChecklistAsync` with `RequestType.Travel` entries:
`Indent` phase — Generated Travel Request Form (`TravelRequestForm`, mandatory),
Signed Travel Request (`SignedCopy`, mandatory);
`Bill` phase — Travel Cover Letter (`CoverLetter`, mandatory), TA/DA Form with
bills (`TravelBill`, mandatory).

- [x] **Step 5: Build and run**

Run: `dotnet build API/API.slnx`
Expected: build succeeds and the app starts with the migration applied.

---

## Task 7: Backend tests

**Files:** `API.Tests/Travel/`.

- [x] **Step 1: `TestTravelDbContext`**

Follow `TestProcurementDbContext`'s pattern.

- [x] **Step 2: `TravelRequestServiceTests`**

Cover: cost computed server-side from legs + accommodation + other; each
validation rule rejects; over-budget raise throws `InsufficientBudgetException`;
bill before approval throws; **taxi cost without opt-in throws
`TaxiNotOptedInException`**; taxi cost *with* opt-in succeeds; a successful raise
generates and stores the form.

- [x] **Step 3: `TravelBudgetInteractionTests` (spec D4)**

The test that justifies Task 4: a travel request and an indent against the *same*
head, asserting committed is the sum of both and that the second raise is
rejected when the two together exceed the head.

- [x] **Step 4: Run the suite**

Run: `dotnet test API/API.Tests/API.Tests.csproj`
Expected: all pass, including the 139 pre-existing.

---

## Task 8: Frontend

**Files:** everything under `UI/src/` in the File Structure.

- [x] **Step 1: `travelEnums.js` and `travelApi.js`**

Enum constants mirroring the C# enums, the booking-platform disclaimer text, and
the four API functions.

- [x] **Step 2: `JourneyLegsFieldArray`**

`{ items, onChange }` contract like `CommitteeMembersFieldArray`. Each row:
from, to, date, mode, platform, amount, remarks, remove. "Add Leg" appends. Shows
a running journey total.

- [x] **Step 3: `TravelRequestModal`**

Tailwind, structured like `RequisitionModalShell`. Budget head select with
`BudgetAvailabilityBadge` reused as-is, traveller-type branching (manpower select
/ co-PI fields), dates, primary mode, **the taxi opt-in checkbox with wording that
makes the one-shot rule explicit**, the platform disclaimer, journey legs, and the
accommodation / other-expenses blocks. Shows a live computed total, clearly
labelled as recomputed by the server. Surfaces `err.message` in an error panel.

- [x] **Step 4: `TravelList` and `ProcessTravelBillForm`**

List: traveller, place, period, expected cost, stage pill, raised date. Bill form:
bill reference, actual cost, and a taxi cost field **rendered only when the
request opted in** — the client mirroring the server rule.

- [x] **Step 5: `TravelDetailPage` and route**

Mirrors `IndentDetailPage`: header, details, journey legs table,
`ApprovalTimeline`, `DocumentUploader` with `ownerType="TravelRequest"`, and the
bill form gated on `Indent`/`Approved`.

- [x] **Step 6: Travel section on `ProjectDetailPage` + `/travel/:id` route**

- [x] **Step 7: Build and lint**

Run: `npx --prefix UI vite build UI && npx --prefix UI eslint UI/src`
Expected: both clean.

---

## Task 9: End-to-end verification

- [x] **Step 1: Full backend + frontend build, full test suite**

- [x] **Step 2: Live walkthrough**

Against a running backend as `faculty1`, driving the HTTP API:
1. Create a project with a funded `RecurringTravel` head.
2. Raise a travel request with two journey legs — confirm `expectedCost` equals
   legs + accommodation + other, computed server-side.
3. Confirm the budget snapshot's committed rose by exactly that amount.
4. Raise an indent on a *different* head of the same project and confirm the two
   do not interfere; then confirm a travel request exceeding the travel head's
   available budget is rejected.
5. Confirm the request form PDF was generated (checklist shows satisfied).
6. Drive the request to Approved through the escalation chain.
7. Process the bill **with a taxi cost on a request that did not opt in** —
   confirm rejection. Then process it correctly and confirm the cover letter.
8. Confirm the `Bill`-phase workflow instance exists.

Record each outcome. Investigate anything that fails rather than noting it as
expected.

- [x] **Step 3: Commit**

---

## Execution Record (2026-08-11)

**Live walkthrough** — backend on `:5199` against `MNNITRNC_New`, driving the
HTTP API as `faculty1` plus office roles. Every step passed:

| Step | Result |
|------|--------|
| Project with funded RecurringTravel + RecurringConsumable heads | travel sanctioned 200000 |
| Raise with 2 legs (4000 + 4500), accommodation 6000, other 2000 | server computed `journeyTotalCost` 8500, `expectedCost` 16500 |
| Legs persisted | both stored in submission order with IRCTC platform |
| Budget after raise | travel committed 16500, available 183500 |
| Head isolation | an indent on the consumable head left travel's committed unchanged, and vice versa |
| Travel over available (300000 > 183500) | rejected: "exceeds available budget 183500.00" |
| Leg outside travel window | rejected: "falls outside the travel period" |
| Request form PDF | generated, stored as `ownerType=TravelRequest`, checklist satisfied |
| Full escalation | Raised → SignedCopyUploaded → Assigned → Forwarded → OSRC → DR → Approved, with no workflow-engine changes |
| **Taxi cost without opt-in** | **rejected: "did not opt in to taxi reimbursement at submission"** |
| Same bill without taxi cost | succeeded |
| Taxi cost *with* opt-in | succeeded, persisted `taxiCost` 1500 |
| Cover letter | generated, Bill-phase checklist satisfied |
| Co-PI traveller | name and designation persisted and returned |

**One deployment fact discovered during the walkthrough.** The application never
calls `Database.Migrate()` — migrations are applied manually. The first live run
failed with "Table 'mnnitrnc_new.travelrequests' doesn't exist" until
`dotnet ef database update` was run. Note that
`ApplicationDbContextFactory` reads `MNNITRNC_CONNECTION_STRING` and otherwise
falls back to a local `root` default, so that variable must be set from
`appsettings` for the command to reach the real database. This is pre-existing
behaviour, not something this slice introduced, but it is a required step when
deploying Phase 4.

**A pre-existing syntax error was removed.** `ProjectDetailPage.jsx` carried a
bare `console` token on its own line, left over from earlier work. It is gone;
the scaffolded `TravelRequisitionModal` it accompanied has been superseded by
`TravelRequestModal` (the scaffold's `onSubmit` was a `console.log` and it sent
`travelerType: 'pi'`, which the API does not accept).

**Not exercised:** the browser UI. Every check above drove the HTTP API the
components call, which verifies contracts rather than rendering.

Final state: 162/162 backend tests pass (139 pre-existing + 23 travel),
`vite build` and `eslint` clean.

---

## Self-Review Notes

- **Why not extend `IndentServiceBase`?** Its abstract surface is indent-shaped:
  `GemAvailabilityOf`, `BuildDocumentModel(..., ProcurementTier)`, committee
  persistence. Travel would have to stub or throw on most of it. Reusing the
  collaborators while duplicating ~40 lines of orchestration is the cheaper trade
  than distorting a working base class.
- **Task 4 is the risk concentrate.** It is deliberately its own task with a
  regression gate rather than folded into Task 3, so a failure there is
  unambiguous about what caused it.
- **Costs are recomputed, not trusted** (D3), and taxi opt-in is enforced
  server-side (D1) with the client merely mirroring it — the same posture Phase 3
  took on procurement tier.
