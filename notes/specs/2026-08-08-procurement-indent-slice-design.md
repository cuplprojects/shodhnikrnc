# Design: Procurement / Indent Management Vertical Slice (Phase 3)

## Status
Draft for review. Third of the phased Research Track build:
1. Platform Foundation — complete, merged to `main`.
2. Projects/Grants — complete, merged to `main`.
3. **Procurement / Indent Management** (this document).
4. Travel — future.
5. Manpower/Recruitment/Fellowship — future.

## Context

Cloning `Old/Source_Code`'s procurement/indent area: `save_consumable.php`,
`save_contingency.php`, `save_equipment_requisition.php`,
`process_consumable_bill.php`/`process_contingency_bill.php`/
`process_equipment_bill.php`, `cancel_indent.php`, `upload_signed_copy.php`.
Reuses Phase 1's generic 5-stage escalation workflow engine
(`IWorkflowEngineService`, `RequestType.Consumable/Contingency/Equipment`,
`WorkflowPhase.Indent/Bill`) exactly as designed — this slice's job is the
procurement-specific entities, validation, and document generation that sit
on top of that engine, following the same pattern Phase 2 used for
`Project`/`GrantReceipt`.

Full code-level findings are in the conversation history that produced this
spec. Key legacy facts:
- Three procurement tables (`consumables`, `contingencies`,
  `equipment_requisitions`) share ~90% identical schema and logic.
- `equipment_requisitions.equipment_id` has **no FK constraint** in legacy
  — only UI convention ties a requisition to a sanctioned equipment row.
- **Zero server-side validation** that `estimated_cost` matches the
  client-chosen GeM tier (`mode_of_purchase`) — the client picks the
  Annexure template, server trusts it blindly.
- **Zero budget validation** at indent-raise time — legacy's procurement
  tables have no `budget_head_id` FK at all, so "Available Budget" checks
  (BRD A7.4) were never implementable, let alone implemented.
- `cancel_indent.php` performs a **hard DELETE** of the parent row
  (only a `cancellation_logs` audit entry survives).
- GeM quotation PDFs are merged synchronously into the generated Annexure
  PDF via FPDI page-append at raise-time.
- The non-GeM ₹2L-25L "market committee" process (BRD A7.1) is **entirely
  unimplemented** as a workflow — just static print-template text with one
  free-text `suggested_faculty` field for hand-signing.
- Bill/payment phase (BRD A7.4: Original Bills, Cover Letter, Stock
  Entries, Measurement Book, E-Way Bill mandatory >₹50,000) is **entirely
  unimplemented** — legacy's bill endpoints take no new input at all beyond
  the record ID; they just flip status and generate a static certify-letter.
- `generate_indent_pdf.php`, `get_gem_quotation.php`, `get_consumable_path.php`,
  and the `gem_quotations`/`equipment_indents` tables are **dead code** from
  an abandoned earlier prototype — not referenced by any live flow. Not a
  behavioral reference for this rewrite.

## Decisions Locked In
- **Entity modeling**: three separate entities —
  `ConsumableIndent`, `ContingencyIndent`, `EquipmentIndent` — mirroring
  legacy's table structure rather than a shared discriminated type. Each
  gets its own service/controller, accepting the ~90% duplication as the
  cost of a closer, simpler 1:1 mapping to the legacy schema (matches how
  the legacy system itself is organized, easing future BRD cross-checks).
  `EquipmentIndent` adds a **proper required FK to `SanctionedEquipment`**
  (Phase 2 entity) — fixing legacy's missing constraint, not an unenforced
  convention.
- **Server-computed cost tier**: `GemAvailability` (Yes/No — see below) +
  `EstimatedCost` are the only inputs; the API derives which Annexure
  (6-11) applies via a shared `IProcurementTierCalculator`, server-side,
  every time. No client-submitted "which annexure/tier" value is ever
  trusted for template selection or approval routing.
- **`GemAvailability` enum**: `Yes` | `No` only — legacy's third value
  `'na'` was dead/unhandled in every code path that mattered (item 1 of
  the analysis: never explicitly branched on, silently fell into the
  non-GeM path everywhere it was checked). Dropping it removes an
  undefined state rather than preserving a legacy bug.
- **Cost tiers** (matching legacy's actual thresholds, which are richer
  than the BRD's simplified description):
  - GeM: ≤₹50,000 → Annexure 6; ₹50,001–₹1,00,000 → Annexure 7;
    >₹1,00,000 → Annexure 8.
  - Non-GeM: ≤₹1,00,000 → Annexure 9; ₹1,00,001–₹2,00,000 → Annexure 10;
    ₹2,00,001–₹25,00,000 → Annexure 11 (committee tier, see below).
  - >₹25,00,000: bidding-only per BRD A7.2 — out of scope for this slice
    (flagged as an open question below, matching how Phase 2 flagged its
    one genuine open ratio-ambiguity question).
- **Cancellation**: soft — `WorkflowStage.Cancelled` (already exists in
  Phase 1's engine) is the terminal state; the indent row and its full
  `WorkflowStep` history persist. No hard delete, no separate
  `cancellation_logs` table — the workflow engine's own audit trail
  already captures who cancelled, when, and why (via `Remarks`).
- **Budget validation**: every indent entity gets a required
  `BudgetHeadId` FK (Phase 2's `BudgetHead`). Raising an indent computes,
  for that head and the indent's project-year (via Phase 2's
  `IProjectYearCalculator`):
  `Available = Sanctioned - Committed - Paid`, where `Committed` = sum of
  `EstimatedCost` across all non-terminal (`WorkflowStage` not in
  `{Approved, Rejected, Cancelled}` at Bill phase, or more precisely: not
  yet `BillApproved`/rejected/cancelled — see Architecture) indents
  against that head/year, and `Paid` = sum of `Expenditure` rows (Phase 2's
  minimal read-only entity) for that head/year. Raising is rejected with a
  clear validation error if `EstimatedCost > Available`. This is a genuine
  new capability — the BRD requirement legacy never built, not a legacy
  bug being fixed.
- **Minimal committee tracking** for the ₹2L-25L non-GeM tier (Annexure
  11 only): `ProcurementCommittee` (one per indent requiring it) +
  `ProcurementCommitteeMember` (name, role — matching legacy's static
  6-role roster: Chairperson/HoD, Faculty/Official Member, Indenter,
  AR[R&C]/Dy.Registrar, AR[Admin-III], FIP) — replacing legacy's single
  free-text `suggested_faculty` field with real structured data that
  renders onto the Annexure 11 PDF. No comparative-statement upload or
  notice-generation in this slice (still a manual/offline step) — only
  the committee-membership record itself.
- **GeM quotation merge**: synchronous, matching legacy. When an indent is
  raised with a GeM quotation PDF attached, the Annexure PDF is generated
  first, then merged with the quotation's pages into one `Document` via a
  .NET PDF-merge step (PdfSharpCore or equivalent — the HTML-to-PDF
  renderer produces the Annexure, a separate merge library appends the
  quotation pages; exact library confirmed in the PDF engine plan).
- **Bill/payment phase fields** (closing the BRD gap legacy left open):
  `OriginalBillReference` (string), `StockEntryConfirmed` (bool),
  `MeasurementBookNumber` (string, required only for `EquipmentIndent`),
  `EWayBillNumber` (string, required when `EstimatedCost > 50,000`,
  validated server-side). These are new fields with no legacy precedent —
  genuinely implementing the BRD requirement, not modernizing existing
  legacy behavior.
- **Document checklist** (ADDED 2026-08-08 during planning): a
  database-configurable list of expected documents per
  `(RequestType, WorkflowPhase)`, each with a configurable `IsMandatory`
  flag, tracked per request as satisfied/unsatisfied based on which
  `Document` rows exist for it. Seeded with the BRD A7.4 requirements
  (Original Bills, Cover Letter, Stock Entries, Measurement Book for
  equipment, E-Way Bill). **Advisory, not blocking**: the API reports
  satisfied/unsatisfied state and the UI surfaces it, but the checklist
  itself does not gate workflow transitions. The only hard document gates
  remain the two that already exist — the signed-copy upload before Dean
  can assign (Phase 1's workflow engine) and the E-Way Bill >₹50,000
  check at bill processing (this slice's `ProcessBillAsync`). The
  `IsMandatory` flag is stored and surfaced so enforcement can be turned
  on later without a schema change.

  This capability was not in the original draft of this spec. It was
  added after frontend scaffolding (`DocumentUploader.jsx`) was found to
  already assume a checklist API, and the decision was to build the
  backend to match rather than strip the component down. It has its own
  implementation plan (`2026-08-08-phase3c-document-checklist.md`)
  because it is cross-cutting — every future slice's documents flow
  through it, not just procurement.

## Architecture

### Domain entities

- **`ConsumableIndent`** / **`ContingencyIndent`** / **`EquipmentIndent`**
  (near-identical shape, kept as 3 separate classes per the locked
  decision): `Id`, `ProjectId`, `BudgetHeadId`, `WorkflowInstanceId`
  (Phase 1), `Name`, `TechnicalSpecs`, `UnitOfMeasurement`, `Quantity`,
  `Purpose`, `GemAvailability` (enum: Yes/No), `EstimatedCost`,
  `NonAvailabilityCertificateNumber` (nullable, required when
  `GemAvailability = No`), `NonAvailabilityCertificateIssueDate`
  (nullable `DateOnly`), `NonAvailabilityCertificateValidityDate`
  (nullable `DateOnly`, validated to be in the future when present —
  closing a legacy validation gap), `StockBookPage`, `StockDescription`,
  `StockQuantity`, `StockActualCost`, `StockCondition` (all nullable,
  filled at bill-processing time), bill-phase fields
  (`OriginalBillReference`, `StockEntryConfirmed`, `EWayBillNumber`, plus
  `MeasurementBookNumber` on `EquipmentIndent` only), `CreatedAt`.
  `EquipmentIndent` additionally has a required `SanctionedEquipmentId`
  FK to Phase 2's `SanctionedEquipment`.
- **`ProcurementCommittee`**: `Id`, owning indent's polymorphic
  `(IndentType, IndentId)` pair (mirroring Phase 1's `Document`
  `OwnerType`/`OwnerId` convention) — only created for Non-GeM indents in
  the ₹2L-25L tier.
- **`ProcurementCommitteeMember`**: `Id`, `ProcurementCommitteeId`,
  `Name`, `Role` (enum: Chairperson, FacultyMember, Indenter,
  RnCRepresentative, AdminRepresentative, FinanceRepresentative —
  matching legacy's 6-role static roster).

### Services

- **`IProcurementTierCalculator`**: `ProcurementTier
  DetermineTier(GemAvailability gemAvailability, decimal estimatedCost)`
  — returns an enum identifying which of the 6 Annexures applies (or
  throws/returns a "requires bidding" result for >₹25L, out of scope to
  actually handle beyond rejecting at this tier for now). Pure function,
  directly analogous to Phase 2's `IOverheadSplitValidator` in spirit
  (single-responsibility server-side business-rule enforcer replacing
  client-trusted legacy logic).
- **`IIndentBudgetValidator`**: computes Sanctioned/Committed/Paid/
  Available for a given `BudgetHeadId` + project-year, reusing Phase 2's
  `IProjectYearCalculator`. Consumed by all three indent services at
  raise-time.
- **`ConsumableIndentService`** / **`ContingencyIndentService`** /
  **`EquipmentIndentService`** (one per entity, matching the "3 separate
  entities" decision): `RaiseAsync` (validates budget, computes tier,
  generates + merges the Annexure PDF via `IDocumentGenerationService`,
  creates the `WorkflowInstance` via `IWorkflowEngineService`), plus
  read/list operations scoped by project ownership (reusing Phase 2's
  owner-scoping pattern). Workflow actions themselves (assign/forward/
  approve/reject/cancel/upload-signed-copy) go through Phase 1's existing
  generic `WorkflowController` endpoints — these services don't
  reimplement the approval chain, only the procurement-specific
  pre/post-workflow logic (raise validation, PDF generation, bill-field
  capture).
- **`ProcessBillAsync`** (on each indent service): requires
  `WorkflowStage = Approved` on the Indent-phase instance (matching
  legacy's gate), captures the new BRD bill fields, validates
  `EWayBillNumber` is present when `EstimatedCost > 50,000`, generates the
  bill-phase cover letter, and raises a new Bill-phase `WorkflowInstance`.

### PDF Generation

Extends Phase 1's `IDocumentGenerationService` (introduced in the Phase 1
spec, not yet built out with concrete templates until this slice needs
one) with 6 Annexure templates (6 through 11) plus one shared bill-phase
cover letter template, via an **HTML-to-PDF renderer** (see rendering
technology note below). Each Annexure reproduces legacy's
structural sections (Item Requisitioned, Stock Register, Purpose,
Procurement Method + GFR-2017 rule citation, Non-Availability Certificate
block when non-GeM, Office-Use Fund Availability block — now populated
with real Sanctioned/Committed/Paid/Available figures from
`IIndentBudgetValidator` instead of legacy's blank handwriting lines,
Committee roster block for Annexure 11 populated from
`ProcurementCommittee`/`ProcurementCommitteeMember` instead of legacy's
single free-text field, Approved/Returned decision block).

**Rendering technology — HTML-to-PDF, not QuestPDF.** The Research Track
clone spec originally assumed QuestPDF's fluent C# API. Once
pixel-accuracy became the requirement, that became the wrong tool: the
legacy Annexures are ~3,600 lines of styled HTML rendered by Dompdf, and
hand-translating that volume of layout into a fluent API pixel-accurately
is high-risk, high-effort, and best-effort at best. Instead this slice
uses a .NET HTML-to-PDF renderer and **ports the legacy HTML/CSS
templates near-verbatim**, replacing PHP interpolation with C#
equivalents. This preserves layout by construction rather than by
reproduction, and the Kruti Dev `@font-face` base64 embedding carries
over unchanged. Concrete library choice (PuppeteerSharp/headless
Chromium being the leading candidate) is resolved in the PDF engine
implementation plan, along with its deployment implications (the renderer
needs a browser binary available on the host).

**Hindi rendering — pixel-accuracy overrides the Research Track clone
spec's Unicode modernization decision for this slice.** These Annexures
are official forms the R&C office prints and signs; the printed artifact
must remain visually identical to what staff already handle. The legacy
PDFs render Hindi via a glyph-substitution Kruti Dev font (Hindi typed as
Latin characters that only *look* Devanagari in that specific font), and
real Unicode Devanagari has different glyph shapes and metrics — the two
cannot both be satisfied. This slice therefore **embeds the original
Kruti Dev TTFs (`assets/fonts/K010.TTF`, `K010_Bold.ttf`) and reuses
legacy's glyph-mapped Hindi strings verbatim**.

Accepted trade-off: Hindi text in generated PDFs remains
non-searchable, non-copyable, and inaccessible to screen readers, because
the underlying characters are Latin, not Devanagari. This is a
deliberate compliance-driven choice, not an oversight. If accessibility
or text-extraction of the Hindi content ever becomes a requirement, it
would need a separate migration that also re-approves changing the
printed form's appearance. The Research Track clone spec
(`2026-08-06-research-track-clone-design.md`) has been amended to record
this reversal.

### Authorization scoping

Reuses Phase 2's owner-scoping pattern: a Faculty user can raise/view
indents only against their own projects. Office-role actions (assign,
forward, approve, reject, forward-to-director) go through Phase 1's
existing `WorkflowController` with its established role gates
(`Dean`/`Superintendent`/`DeputyRegistrar`/`RegularStaff`) — no new
authorization logic needed for the approval chain itself, only for the
Faculty-facing raise/view/cancel/process-bill endpoints.

### API surface

Per indent type (×3: consumable, contingency, equipment), following
Phase 2's `ProjectsController` conventions:
- `POST /api/projects/{projectId}/consumable-indents` (+ contingency-
  indents, equipment-indents) — raise, multipart (form fields + optional
  GeM quotation file).
- `GET /api/projects/{projectId}/consumable-indents` — list, owner-scoped.
- `GET /api/consumable-indents/{id}` — detail.
- `POST /api/consumable-indents/{id}/process-bill` — bill-phase field
  capture + transition.
- Cancellation and all approval-chain actions reuse Phase 1's generic
  `POST /api/workflow/{instanceId}/{action}` endpoints — no new endpoints
  needed there.
- `GET /api/documents/checklist?requestType=&phase=&requestId=` — returns
  the configured checklist for that request type/phase with each item's
  satisfied state (see the document checklist decision above). Added by
  the Phase 3c plan, not this slice's controllers.

**Workflow step contract**: `WorkflowStepResponse` currently exposes
`Stage`/`Action`/`ActorUserId`/`Remarks`/`Timestamp`. The frontend's
`ApprovalTimeline` component expects a human-readable step name and an
ordering field alongside these. Phase 3c extends the response with
`StepName` (a display label derived from stage+action) and
`SequenceOrder` (the step's position within its instance) rather than
renaming the existing fields, so no existing consumer breaks.

### Frontend (React)

- Three indent-raising forms (Consumable/Contingency/Equipment), each
  reusing the field-array/form patterns established in Phase 2's
  `ProjectFormPage`, with a live client-side tier preview (mirroring
  Phase 2's `OverheadSplitInputs` read-only-computed-preview pattern)
  that the server independently re-derives and enforces.
  `EquipmentIndentFormPage` includes a sanctioned-equipment picker
  (dropdown of the project's `SanctionedEquipment` rows).
  Non-GeM ₹2L-25L submissions show a committee-member entry section.
- Indent list/detail views, added as new sections on the existing
  `ProjectDetailPage` (Phase 2) alongside Sanctioned Equipment/Manpower —
  consistent with how the legacy `view_project.php` surfaced these.
- Office-side approval queue screens reuse Phase 1's generic
  `ApprovalTimeline` component (per the Phase 1 spec) — no new workflow
  UI needed, only procurement-specific detail-view rendering plugged into
  the existing queue.
- Bill-processing form (Original Bill Reference, Stock Entry checkbox,
  Measurement Book Number for equipment, E-Way Bill Number with
  client-side >₹50,000 conditional-required hint mirroring the
  server-side rule).

## Out of Scope for This Slice
- Travel requests, Manpower/Recruitment — future slices.
- >₹25,00,000 bidding-only tier — flagged as an open question below, not
  designed here.
- Comparative-statement document generation/upload and formal notice
  issuance for the committee tier — committee *membership* is tracked,
  but the surrounding paperwork stays a manual/offline step, matching how
  much of this the legacy system left unbuilt.
- `generate_indent_pdf.php`'s approach, `gem_quotations` table,
  `equipment_indents` table, `get_gem_quotation.php`,
  `get_consumable_path.php` — confirmed dead/orphaned legacy code, not a
  behavioral reference.
- Writing to `Expenditure` — still owned by whichever future slice
  processes actual payment disbursement; this slice's bill-processing
  step transitions workflow state and captures BRD-required fields, but
  Phase 2's read-only `Expenditure` entity is only read here (for budget
  validation), not written to.

## Testing
- Unit tests: `IProcurementTierCalculator` (every GeM/non-GeM boundary
  value, especially off-by-one amounts at each threshold), budget
  validation math (sanctioned/committed/paid/available across multiple
  non-terminal indents and project-years), E-Way Bill conditional
  requirement (exactly at, just above, just below ₹50,000).
- Integration tests: full indent lifecycle per type (raise with budget
  check → upload signed copy → assign → forward through all 3 escalation
  tiers → approve → process bill with BRD fields → bill-phase workflow
  instance created), cancellation leaves the row queryable with
  `Cancelled` stage, GeM quotation PDF merge produces a valid multi-page
  document, committee members render correctly on a generated Annexure 11.

## Open Questions / Risks Flagged to Stakeholders
- The >₹25,00,000 bidding-only tier (BRD A7.2) has no legacy
  implementation to clone and is explicitly out of scope for this slice
  — confirm whether a future slice should build bidding-details entry, or
  whether this remains a fully offline process indefinitely.
- Legacy's Non-Availability Certificate fields (`certificate_no`,
  `issue_date`, `validity_date`) were captured but **never rendered** on
  any generated Annexure in the legacy system. This spec's Annexure
  templates now render them (since the NAC is meant to be evidenced on
  the printed form) — confirm this is the desired behavior and not an
  unintended scope addition beyond "faithful clone."
