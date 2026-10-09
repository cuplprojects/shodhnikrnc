# Design: Projects/Grants Vertical Slice (Phase 2)

## Status
Draft for review. Second of the phased Research Track build (per
`notes/specs/2026-08-06-research-track-clone-design.md`):
1. Platform Foundation — complete, merged to `main`.
2. **Projects/Grants** (this document).
3. Procurement (consumable/contingency/equipment indents) — future.
4. Travel — future.
5. Manpower/Recruitment/Fellowship — future.

## Context

Cloning `Old/Source_Code`'s project/grant management area:
`faculty_dashboard.php`, `project_details.php`, `project_save.php`,
`project_edit.php`/`project_update.php`, `view_project.php`,
`delete_project.php`, `add_grant_received.php`/`save_grant_received.php`,
plus read access to `expenditure` (owned by future Procurement/Travel
slices) for budget reporting. Full code-level findings are in the
conversation history that produced this spec.

The legacy code has several genuine bugs, not business rules, which this
slice deliberately fixes rather than clones:
- **Destructive-replace edits**: `project_update.php` deletes and
  re-inserts all budget heads/collaborators/equipment/manpower on every
  edit, silently orphaning `grant_receipts.budget_head_id` (`ON DELETE SET
  NULL`) each time.
- **Silent-failure delete**: `delete_project.php` reports success even
  when the DELETE is blocked by FK constraints from `expenditure`/
  `travel_requests` (no cascade, no error handling), leaving a stale
  project row while telling the user it was deleted.
- **Client-only overhead split validation**: the 40/40/20 IDF/PDF/DDF split
  (note: code computes 40/40/20, not the BRD's stated 40/20/40 — code is
  authoritative) is JS-only; the server persists whatever numbers are
  submitted with no validation.
- **Inconsistent year semantics**: `grant_receipts.year` is manually
  picked by the faculty; `expenditure`'s year-index is auto-derived from
  `transaction_date` vs. `project.start_date`. Two mechanisms for the same
  concept.
- **Polymorphic `expenditure.item_id`** with no FK — resolved only via
  `section_type` string switch in application code. Out of scope to fix
  here (expenditure is owned by future slices) but this slice's read
  access must account for it.
- Three inconsistent "edit project" surfaces exist in legacy
  (`project_edit.php`+`project_update.php` is the real pair;
  `edit_project.php` is dead/broken code that would create duplicate
  projects). Only the real pair's behavior is a reference.
- `view_project.php` (not `view_project_1.php`, a stale prototype with
  hardcoded dummy data) is the authoritative detail-page reference.

`sponsored_projects.php`/`projects.php` are static public CMS pages with
no DB interaction — out of scope entirely (belongs to a future public-site
slice, if ever built).

## Decisions Locked In
- **Edit semantics**: stable-ID upsert. Budget heads matched by `HeadName`
  (the legacy app's fixed 7-name list is preserved as the allowed set),
  collaborators/equipment/manpower positions matched by their own primary
  key when present in the edit payload (absent = deleted, new = inserted,
  present = updated). Grant receipts remain correctly linked to their
  budget head across edits — no more silent orphaning.
- **Delete semantics**: soft delete. `Project.IsDeleted` (bool) +
  `DeletedAt`/`DeletedByUserId`. Soft-deleted projects are excluded from
  default list/detail queries but the row and all history remain intact.
  No FK-block scenario to handle since nothing is ever hard-deleted.
- **Overhead split**: user enters IDF/PDF/DDF amounts (matching legacy
  UX), but the API validates server-side that they sum to the overhead
  receipt amount and match the 40%/40%/20% ratio (tolerance: exact after
  rounding to paise/2 decimal places), rejecting the save with a clear
  validation error otherwise. This corrects both legacy gaps (no server
  validation at all, and the BRD's typo'd ratio) without removing user
  visibility into the calculation.
- **Equipment/Manpower catalog**: `SanctionedEquipment` and
  `SanctionedManpowerPosition` are simple child entities of `Project` in
  this slice (BOM line items / sanctioned position counts + stipend/HRA
  figures, entered at project-creation time) — matching legacy's
  `equipment`/`manpower` tables. They are NOT the procurement requisition
  or recruitment workflow entities; those are distinct, richer entities
  owned by the future Procurement and Manpower slices, which will
  reference these sanctioned entries as their starting point.
- **Year semantics**: unified. Project-year index (1/2/3, etc., relative
  to the project's sanctioned duration) is always computed server-side
  from a date (grant receipt's `ReceivedDate`, expenditure's
  `TransactionDate`) relative to `Project.StartDate`'s financial year,
  via one shared `IProjectYearCalculator` service. No manual year picker
  anywhere in this slice's UI.

## Architecture

### Domain entities

- **`Project`**: `Id`, `OwnerUserId`, `ProjectType` (constrained to the 5
  legacy labels: Type-I Research / Type-II Industry-sponsored / Type-III
  Consultancy / Type-IV Testing / Type-V Other — stored as a string enum,
  not free text, closing a legacy gap), `SanctionNo`, `SanctionDate`,
  `ProjectTitle`, `StartDate`, `Agency`, `DurationMonths`,
  `TotalSanctioned`, `IsDeleted`, `DeletedAt`, `DeletedByUserId`,
  `CreatedAt`.
- **`Collaborator`**: `Id`, `ProjectId`, `Institute`, `Faculty`.
- **`BudgetHead`**: `Id`, `ProjectId`, `HeadName` (constrained to the 7
  legacy names: Equipment/Non-recurring, Recurring: Consumable, Recurring:
  Contingency, Recurring: Travel, Recurring: Overhead, Recurring: Field
  charges, Recurring: Manpower), `Year1Amount`, `Year2Amount`,
  `Year3Amount`, `Total` (server-computed, not client-trusted).
- **`SanctionedEquipment`**: `Id`, `ProjectId`, `Name`, `Unit`, `Amount`.
- **`SanctionedManpowerPosition`**: `Id`, `ProjectId`, `Designation`,
  `Positions` (int count), `Stipend`, `Hra`.
- **`GrantReceipt`**: `Id`, `ProjectId`, `BudgetHeadId`, `ReceivedDate`
  (drives the auto-derived year index — replaces the manual `year` enum),
  `Amount`, `Type` (Head | OverheadSplit), `ParentReceiptId` (nullable,
  FK-enforced this time — legacy left it unconstrained), `SubHead`
  (nullable: IDF | PDF | DDF, only set when `Type = OverheadSplit`).

### Services

- **`IProjectYearCalculator`**: `int GetProjectYear(DateOnly projectStartDate, DateOnly transactionDate)` — single shared implementation of the financial-year-relative ordinal-year logic, consumed by both this slice's grant-receipt handling and (via a shared Application-layer service) the future Procurement/Travel slices' expenditure recording.
- **`IOverheadSplitValidator`**: validates a proposed IDF/PDF/DDF split against an overhead amount, returning a validation result rather than throwing, so the controller can return a clean 400 with field-level errors.
- **Project edit upsert logic**: lives in an Application-layer `ProjectService` (or MediatR-style command handler, matching whatever pattern Phase 1 established) that diffs incoming budget-head/collaborator/equipment/manpower payloads against existing rows by identity (head name for budget heads, primary key for the others) and performs targeted insert/update/delete — never a blanket delete-all.

### Budget/Grant reporting (read side)

A `GET /api/projects/{id}/budget-summary` endpoint, per budget head per
project-year, returning: `Sanctioned` (from `BudgetHead.YearNAmount`),
`GrantReceived` (sum of `GrantReceipt` where `Type=Head`), `Spent` (sum of
`expenditure` rows for that project, joined by the shared year-index
calculation — read-only cross-slice query against the `Expenditure` table
Phase 1's `IApplicationDbContext` already exposes, owned by future
Procurement/Travel slices), `Available` (`GrantReceived - Spent`). This
replicates `view_project.php`'s "Budget & Grant Details" table.

### Authorization scoping

Reuses Phase 1's scoping pattern: a PI sees only their own projects
(`OwnerUserId` filter). HOD/Dean/institute-wide roles get broader scope
per the platform's `IAuthorizationScopeService` once that's built out
further — for this slice, only owner-scoping is exercised end-to-end,
since HOD/Dean project-approval workflows belong to the Research Proposal
& Grant Sanction Workflow area (BRD A1), not this CRUD/reporting slice.

### API surface

- `GET /api/projects` — list, owner-scoped, excludes soft-deleted.
- `POST /api/projects` — create (project + collaborators + budget heads +
  sanctioned equipment + sanctioned manpower, one transaction).
- `GET /api/projects/{id}` — detail (all child collections + budget
  summary).
- `PUT /api/projects/{id}` — update via stable-ID upsert.
- `DELETE /api/projects/{id}` — soft delete.
- `GET /api/projects/{id}/budget-summary` — per-head-per-year reporting.
- `GET /api/projects/{id}/grant-receipts` — list.
- `POST /api/projects/{id}/grant-receipts` — record a receipt (validates
  overhead split server-side when the head is "Recurring: Overhead").

### Frontend (React)

- Faculty dashboard project list (replaces the legacy's dead Type I-V tab
  links with real filtering, since those were confirmed non-functional in
  legacy) with List/View/Edit/soft-Delete actions.
- Project create/edit form: single page, dynamic collaborator/budget-head/
  equipment/manpower sections (client-side add/remove rows, matching
  legacy UX), submitting a single structured payload rather than legacy's
  parallel-array form-encoding.
- Project detail/view page: basic info, collaborators, Budget & Grant
  Details table (sanctioned/received/spent/available), sanctioned
  equipment/manpower tables (read-only in this slice — procurement/
  recruitment workflows attach to these later).
- Add Grant Received screen: per-head amount entry, IDF/PDF/DDF
  split shown/editable only for the Overhead head, with live client-side
  total validation mirroring the server-side check.

## Out of Scope for This Slice
- Procurement/indent requisition workflow (consumable/contingency/
  equipment) — future slice, will reference `SanctionedEquipment`.
- Travel requests — future slice.
- Manpower recruitment/selection/offer-letter workflow — future slice,
  will reference `SanctionedManpowerPosition`.
- Writing to `Expenditure` — owned by Procurement/Travel slices; this
  slice only reads it for budget-summary reporting.
- HOD/Dean approval workflow for the underlying research proposal (BRD
  A1) — this slice is the already-approved/sanctioned project's ongoing
  management, not the sanction workflow itself.
- Public CMS pages (`projects.php`, `sponsored_projects.php`).

## Testing
- Unit tests: `IProjectYearCalculator` (financial-year boundary cases),
  `IOverheadSplitValidator` (exact match, rounding tolerance, mismatch
  rejection), stable-ID upsert diffing logic (add/update/remove
  correctly identified, existing `GrantReceipt.BudgetHeadId` links
  survive an edit that keeps the same head name).
- Integration tests: full project create → edit → grant-receipt-record →
  budget-summary lifecycle; soft-delete excludes from list but preserves
  data; owner-scoping (one PI cannot see another's projects).

## Open Questions / Risks Flagged to Stakeholders
- The BRD states overhead split as 40%/20%/40% (PDF/DDF/IDF ordering
  ambiguous) while the legacy code implements IDF 40% / PDF 40% / DDF
  20%. This spec follows the code as ground truth per the locked
  decision, but this discrepancy should be confirmed with stakeholders
  before this reaches production, since it's a real financial-calculation
  difference, not just a documentation typo.
