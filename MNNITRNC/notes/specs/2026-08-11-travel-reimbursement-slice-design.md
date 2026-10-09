# Design: Travel Reimbursement Vertical Slice (Phase 4)

## Status

Draft for review. Fourth of the phased Research Track build:

1. Platform Foundation — complete, merged to `main`.
2. Projects/Grants — complete, merged to `main`.
3. Procurement / Indent Management — complete, merged to `main`.
4. **Travel Reimbursement** (this document).
5. Manpower/Recruitment/Fellowship — future.

## Sources

Two, and they disagree in places. Where they do, this document says which one wins and why.

- **BRD**: `PROMPTS/04-research-track-procurement-indent-management.md`, the
  "Travel Reimbursement" section. Travel is specified in the *same* BRD prompt as
  procurement (A7), not in Prompt 3 — Prompt 3 covers Fellowship/ID Card/NOC/Leave
  and says nothing about travel.
- **Legacy**: `Old/Source_Code/save_travel_request.php`,
  `process_travel_bill.php`, `get_travel_details.php`,
  `generate_travel_request_pdf.php`, and the `travel_requests` /
  `travel_journey_details` tables in `Dump20260806.sql`.

## Context

Travel is the second consumer of Phase 1's generic workflow engine and the first
outside procurement. `RequestType.Travel` **already exists** in
`API/API.Domain/Enums/RequestType.cs` — Phase 1 anticipated this slice. The
engine, its 5-stage escalation, the document store, and the checklist service all
work unchanged; this slice adds the travel-specific entities, validation, and
document generation on top, exactly as Phase 3 did for indents.

The strong prior is: **travel is procurement-shaped**. Legacy confirms it —
`process_travel_bill.php` gates on approval, generates a cover letter, and moves
to `bill_processed`, which is what `process_consumable_bill.php` does. Divergence
from the Phase 3 pattern needs a reason.

### What legacy actually does

`travel_requests` is one header row plus N rows in `travel_journey_details`. The
header carries traveller identity, place/purpose, onward/return dates, three cost
buckets, and a `status` enum. Journey legs carry from/to/date/mode/amount/remarks.

Cost is `journey_total_cost + accommodation_cost + other_expenses_cost`, summed
in PHP at `save_travel_request.php:26` and stored denormalised as `expected_cost`.

Three traveller types, an enum on the header: `self`, `manpower`, `co_pi`.
`manpower` FKs to `manpower_selections`; `co_pi` stores a free-text name and
designation on the header (`save_travel_request.php:44-51`).

The legacy `status` enum has **thirteen** values including `forwarded1`,
`forwarded2`, `director`, and both `*_uploaded` variants. This is the same
hand-rolled state machine Phase 1 replaced with `WorkflowInstance`. It is not
carried over.

### Where the BRD adds rules legacy never implemented

1. **Taxi reimbursement is opt-in at submission**, and "if not selected at
   submission, taxi reimbursement is not considered later — enforce this as a hard
   rule, not just a UI hint." Legacy has no such flag; it only offers
   `Road: Private Taxi` as one value of the `travel_by` mode enum.
2. **Eligible booking platforms** are IRCTC, Ashoka Travel, Balmer Lawrie, with a
   disclaimer displayed at claim time. Legacy records no platform at all.

Both are new. This is the same situation as Phase 3's budget rule, which the BRD
required (A7.4) and legacy never implemented — that precedent says implement the
BRD rule server-side.

## Decisions

### D1 — Taxi opt-in is a separate immutable flag

`TaxiReimbursementOptedIn`, a bool set at raise and never editable afterward.
Bill processing rejects any taxi cost when it is false.

Rejected: deriving it from whether a journey leg used `RoadPrivateTaxi`. That
conflates *mode of travel* with *intent to claim taxi reimbursement*, and makes
the BRD's hard rule an emergent property of leg data rather than a stated fact
the server can enforce directly. A traveller can take a taxi to the station
without claiming it.

### D2 — Booking platform is recorded per journey leg

`BookingPlatform` enum on each leg: `IRCTC`, `AshokaTravel`, `BalmerLawrie`,
`Other`. Stored, printed on the form, disclaimer shown in the UI.

The BRD only strictly requires the disclaimer. Recording the platform is a small
addition that makes the eligibility rule auditable after the fact rather than
advisory — consistent with how Phase 3 made the server the authority on tier
rather than trusting a client-submitted `mode_of_purchase`.

`Other` exists because the BRD lists eligible platforms without saying bookings
through anything else are void; forcing one of three values would invent a
rejection rule the BRD does not state.

### D3 — Cost is computed server-side, never accepted from the client

`ExpectedCost = sum(journey legs) + AccommodationCost + OtherExpensesCost`,
recomputed on the server at raise. Legacy summed in PHP and stored the result;
that part is fine. What is *not* carried over is trusting a client-supplied
total.

Same reasoning as Phase 3's tier: anything the printed form and the budget check
depend on must be derived server-side.

### D4 — Budget validation reuses `IIndentBudgetValidator` unchanged

Travel draws against `BudgetHeadName.RecurringTravel`. The BRD's
`Available Budget < Requested Amount` rule is written in the procurement section
and reads as a general rule about requisitions against a head.

`IndentBudgetValidator.SumCommittedAsync` currently sums the three indent tables.
Travel requests must be added to that sum, or travel and procurement will each
see budget the other has already committed. **This is the one place this slice
must modify Phase 3 code.**

### D5 — No separate travel workflow; reuse the engine as-is

`RequestType.Travel` with `WorkflowPhase.Indent` for the request and
`WorkflowPhase.Bill` for reimbursement — the same two-phase shape procurement
uses. "Indent" reads oddly for travel, but the phase enum is
workflow-engine vocabulary, and adding a `Travel` phase value would fork the
engine's state machine for no behavioural gain.

### D6 — Traveller identity is a discriminated triple, not three nullable columns

Legacy spreads traveller identity across `traveler_type` + `manpower_id` +
`co_pi_name` + `co_pi_designation`, with nothing stopping a `self` row from
carrying a co-PI name. The entity keeps the same three columns (they are the
minimum to represent it) but the *service* validates the combination on raise:
`Self` requires all three extras null; `Manpower` requires `ManpowerId` set and
co-PI fields null; `CoPi` requires both co-PI fields non-empty and `ManpowerId`
null.

## Scope

### In

- Raise a travel request against a project's `RecurringTravel` budget head, with
  N journey legs, accommodation, and other expenses.
- Server-computed expected cost; budget availability enforced against the head.
- Taxi opt-in recorded immutably at raise; enforced at bill time.
- Booking platform per leg, with the eligibility disclaimer surfaced in the UI.
- Generated travel request form PDF (legacy Annexure-style), stored via the
  existing document pipeline as `DocumentKind.TravelRequestForm`.
- Full workflow: raise → signed copy → assign → forward chain → approve.
- Bill processing gated on `Phase == Indent && CurrentStage == Approved`,
  generating a cover letter (`DocumentKind.CoverLetter`, reusing Phase 3a's
  renderer).
- Document checklist entries seeded for `RequestType.Travel`, both phases.
- Frontend: raise modal from the project page, travel list, detail page with
  timeline + checklist + bill form, and travel rows on `/procurement`.

### Out

- **Per-diem / DA rate tables.** The BRD says "Duly filled TA/DA form along with
  bills/receipts are also submitted" — the TA/DA form is an *attachment*, not
  something the portal computes. No entitlement maths.
- **Advance against travel.** Not in the BRD, not in legacy.
- **Editing an approved request.** Legacy has no edit path; the workflow engine
  has no amend transition.
- **Multi-traveller on one request.** Legacy is strictly one traveller per row;
  the cover letter table has a single data row hardcoded
  (`process_travel_bill.php:158-167`).

## Data Model

```
TravelRequest
  Id, ProjectId, BudgetHeadId, WorkflowInstanceId
  TravelerType           (Self | Manpower | CoPi)
  ManpowerId?            -> SanctionedManpowerPosition
  CoPiName?, CoPiDesignation?
  Place, Purpose
  OnwardDate, ReturnDate
  PrimaryMode            (Air | Rail | RoadPrivateTaxi | RoadPersonalCar | RoadCommonTransport)
  TaxiReimbursementOptedIn   bool, immutable after raise
  AccommodationDetails?, AccommodationCost
  OtherExpensesDetails?, OtherExpensesCost
  JourneyTotalCost       derived, persisted
  ExpectedCost           derived, persisted
  -- bill phase, all null until ProcessBill --
  OriginalBillReference?, TaxiCost?, ActualCost?
  CreatedAt

TravelJourneyLeg
  Id, TravelRequestId
  JourneyFrom, JourneyTo, JourneyDate
  Mode                   (same enum as PrimaryMode)
  BookingPlatform        (IRCTC | AshokaTravel | BalmerLawrie | Other)
  Amount, Remarks?
  SequenceOrder
```

`ReturnDate >= OnwardDate`; every leg's `JourneyDate` must fall within
`[OnwardDate, ReturnDate]`. At least one journey leg is required — a request with
no legs has no journey to reimburse.

New `DocumentKind` values: `TravelRequestForm`, `TravelBill`. `CoverLetter`
already exists and is reused.

## Interfaces

```csharp
public interface ITravelRequestService
{
    Task<Guid> RaiseAsync(RaiseTravelInput input, Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<TravelSummary>> ListForProjectAsync(Guid projectId, Guid userId, CancellationToken ct = default);
    Task<TravelDetail> GetAsync(Guid id, Guid userId, CancellationToken ct = default);
    Task ProcessBillAsync(Guid id, ProcessTravelBillInput input, Guid userId, CancellationToken ct = default);
}
```

Endpoints mirror procurement's shape exactly, so `procurementApi.js`'s
`segmentFor` pattern extends naturally:

```
POST   /api/projects/{projectId}/travel-requests
GET    /api/projects/{projectId}/travel-requests
GET    /api/travel-requests/{id}
POST   /api/travel-requests/{id}/process-bill
```

## Validation Rules

| Rule | Where | Source |
|------|-------|--------|
| `Available < Requested` rejects the raise | `IIndentBudgetValidator` | BRD A7.4 |
| Taxi cost at bill time requires opt-in at raise | `ProcessBillAsync` | BRD (hard rule) |
| `ReturnDate >= OnwardDate` | `RaiseAsync` | derived |
| Leg dates within travel window | `RaiseAsync` | derived |
| ≥1 journey leg | `RaiseAsync` | derived |
| Traveller-type field combination | `RaiseAsync` | D6 |
| Bill only when `Indent`/`Approved` | `ProcessBillAsync` | legacy `process_travel_bill.php:24` |
| Costs non-negative | `RaiseAsync` | derived |

## Risks

- **D4 touches Phase 3.** Adding travel to `SumCommittedAsync` changes committed
  totals for existing indent flows. Phase 3's budget tests must still pass, and a
  new test must cover travel and indents competing for one head. This is the
  highest-risk item in the slice and the reason D4 is called out explicitly rather
  than left as an implementation detail.
- **`WorkflowPhase.Indent` for a travel request** is a vocabulary smell that will
  confuse a future reader. Mitigated by naming it in this document; the
  alternative (forking the phase enum) is worse.
- **Cover letter will print a blank department and designation.** The legacy
  letter embeds both from `faculty_profiles` (`process_travel_bill.php:130`,
  `177-179`). This rebuild has no profile store: `IFacultyProfileProvider`'s
  default returns the resolvable name and blanks the other two by design, so they
  render as empty ruled entries. Travel reuses that seam and inherits the same
  gap — the letter is structurally complete but not yet a faithful reproduction
  of the legacy output. Closing it means a profile store, which is its own slice
  and is out of scope here.

## Open Questions

None blocking. Both decisions the sources left ambiguous (D1, D2) were resolved
with the user before this document was written.
