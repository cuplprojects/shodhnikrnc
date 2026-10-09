# Design: MNIT R&C Portal — Research Track Clone (Sub-Project 1)

## Status
Draft for review. This is the first of two sub-projects:
1. **Research Track Clone** (this document) — replicate `Old/Source_Code`'s Research
   Track workflow application in .NET 8 + React.
2. **Consultancy Track** (future, separate spec) — build fresh from the BRD
   (`PROMPTS/07`–`14`), no legacy code to reference. Lower priority than (1).

The legacy PHP public CMS (news, announcements, static marketing pages) keeps
running on its current server unchanged. It is out of scope for this
sub-project, but routes/branding in the new app should not preclude absorbing
CMS pages in a later phase.

## Context

`Old/Source_Code` is a ~130-file PHP application (MySQL, IIS/FastCGI hosting)
implementing only the BRD's Research Track: project/proposal management,
procurement (consumable/contingency/equipment indents), travel reimbursement,
manpower/recruitment/fellowship lifecycle, and a 5-stage office approval
chain. No Consultancy Track exists in the code. Full inventory is captured in
the analysis that produced this spec (roles, DB schema, workflow states, PDF
generation, upload conventions) — see conversation history / commit context
for the raw findings if needed later.

This spec targets a faithful **behavioral** clone — same roles, same
approval chain semantics, same documents produced — while fixing specific
implementation weaknesses that were clearly incidental rather than
intentional business rules (flat status enums with no audit trail, hardcoded
SQL-interpolated queries, ad hoc per-feature upload folders, plaintext DB
credentials in source).

## Decisions Locked In
- **Stack**: .NET 8 Web API + EF Core (Pomelo/MySQL) + React (existing Vite
  scaffold). Clean Architecture: `API.Domain`, `API.Application`,
  `API.Infrastructure`, `API` (presentation), each a separate `.csproj`
  referenced from `API.slnx`.
- **Auth**: JWT bearer tokens; accounts are seed/admin-created only (no
  self-registration), matching the legacy app (Dean creates faculty users).
- **Roles**: real RBAC roles — `Faculty`, `RegularStaff`, `Superintendent`,
  `DeputyRegistrar`, `Dean` — replacing the legacy's hardcoded
  username/designation-string checks. **Single-user-per-tier is preserved as
  a business rule**: exactly one active user holds `Superintendent`, one
  holds `DeputyRegistrar`, one holds `Dean` at a time (enforced at the
  application layer, not hardcoded usernames). `RegularStaff` can have many
  users. There is no `Director` login — `Director` remains a terminal
  workflow status only, matching legacy behavior (physical/manual sign-off
  outside the system).
- **Document storage**: local disk, path recorded in DB, behind
  `IDocumentStorageService` — one unified `Document` entity (GUID key,
  version, status `Uploaded → Sealed → Reuploaded`) replacing the legacy's
  dozen ad hoc upload folders and timestamp-in-filename "versioning."
- **PDF generation**: reproducing Annexures 6–11, offer letters,
  screening/selection/minutes proformas, stipend forms, and travel forms.
  **AMENDED 2026-08-08 (during Phase 3 planning): pixel-accurate
  reproduction via an HTML-to-PDF renderer (not QuestPDF), retaining the
  legacy Kruti Dev glyph-substitution font.** The original QuestPDF choice
  assumed visually-equivalent output was acceptable; once pixel-accuracy
  became the requirement, porting the legacy HTML/CSS templates
  near-verbatim through an HTML-to-PDF renderer became the far lower-risk
  path than hand-translating ~3,600 lines of layout into a fluent API.
  This spec originally called for modernizing Hindi text to real Unicode
  Devanagari, accepting visually-equivalent-but-not-identical output. That
  was reversed once the Annexures' role as printed, signed compliance
  artifacts became clear: the office needs the generated form to look
  exactly like what it already handles, and Unicode Devanagari's differing
  glyph shapes/metrics make that impossible. Generated PDFs therefore embed
  the original `K010.TTF`/`K010_Bold.ttf` and reuse legacy's glyph-mapped
  Hindi strings verbatim. Trade-off accepted: Hindi text in generated PDFs
  is non-searchable and inaccessible to screen readers, since the
  underlying characters are Latin. See
  `2026-08-08-procurement-indent-slice-design.md` for the full rationale.
- **Email**: SMTP via MailKit, real sending (not log-only).
- **Workflow engine**: generic, not per-request-type duplicated tables.

## Architecture

### Domain model (Application-layer request types, all sharing one workflow)

Five request types go through the **same 5-stage escalation chain**:
`Consumable`, `Contingency`, `Equipment`, `Travel`, `Manpower` (manpower
documents — advertisement, screening proforma, selection proforma, minutes,
offer letter, etc. — share the chain but have no Bill/Payment phase).

Rather than the legacy's near-duplicate tables (`consumables`,
`contingencies`, `equipment_requisitions`, `travel_requests`,
`manpower_process`, each with copy-pasted status/remark columns), the
workflow is factored out:

- **`WorkflowInstance`** — one row per request going through approval.
  Columns: `Id`, `RequestType` (enum: Consumable/Contingency/Equipment/
  Travel/ManpowerDocument), `RequestId` (FK to the actual domain entity,
  polymorphic by convention), `Phase` (Indent/Bill — Bill phase only
  applies to the four procurement/travel types), `CurrentStage` (see state
  list below), `AssignedToUserId` (nullable), `CreatedAt`, `ExpiresAt`
  (nullable countdown, e.g. 7-working-day timer where applicable).
- **`WorkflowStep`** (append-only audit log — the legacy's biggest gap) —
  `Id`, `WorkflowInstanceId` FK, `Stage`, `Action`
  (Raise/UploadSignedCopy/Assign/Forward/Approve/Reject/ForwardToDirector/
  Cancel), `ActorUserId`, `Remarks`, `Timestamp`. Every legacy remark column
  (`forward_remarks`, `osrc_remarks`, `dyregrc_remarks`, `deanrc_remarks`,
  `dean_dr_remarks`) becomes a `WorkflowStep` row instead of a flat column —
  this directly fixes the "last remark per stage only" limitation the
  legacy code works around with duplicated helper functions.

**Stage enum** (`CurrentStage`), matching legacy semantics exactly:
`Raised → SignedCopyUploaded → Assigned → Forwarded → ForwardedOSRC →
ForwardedDR → Approved | Rejected | Director` — where `Approved` on the
Indent phase auto-transitions the instance to a new Bill-phase
`WorkflowInstance` once the faculty raises a bill, and `Approved` on Bill
phase is terminal (`BillApproved` maps to `expenditure` recording).
`Cancelled` is a valid terminal transition from most non-terminal stages
(legacy `cancel_indent.php` behavior), logged to the same audit-log
mechanism rather than a separate `cancellation_logs` table.

Legacy's "Assignable vs Non-Assignable" gating (Dean can't assign until
faculty uploads the signed physical copy) is preserved as a hard
precondition: `Assign` action is only valid when `CurrentStage =
SignedCopyUploaded`.

The Bill-vs-Indent branch detection in legacy (implicit, via querying
`signed_copies` for an existing `cover_letter` row) becomes an explicit
`Phase` column set at creation time — removing the fragile implicit lookup.

### Domain entities (business data, one per request type — NOT duplicating workflow columns)

- `Project` (+ `Collaborator`, `BudgetHead`, `GrantReceipt` with
  `OverheadSplit` sub-heads IDF/PDF/DDF, `Expenditure`)
- `ConsumableIndent`, `ContingencyIndent`, `EquipmentIndent` (each purely
  business fields: item description, technical specs, quantity, cost,
  GeM/non-GeM certificate fields — no status/remarks columns, those live on
  `WorkflowInstance`/`WorkflowStep`)
- `Equipment` (BOM/catalog line items) kept separate from
  `EquipmentIndent` (the requisition instance), matching legacy's
  `equipment` vs `equipment_requisitions` split, since it's a genuine
  data-model distinction (catalog vs purchase event).
- `TravelRequest` (+ `TravelJourneyDetail` for multi-leg itineraries)
- `ManpowerPosition` (sanctioned positions per project), `ManpowerSelection`
  (candidate, Aadhaar/PAN/bank/IFSC validated), `ManpowerStatusHistory`
  (resignation/termination events), `ManpowerDocument` (the 10 document
  types: advertisement, screening_proforma, shortlisted_candidates,
  selection_nomination, joining_letter, id_card_form,
  resignation_termination, waiting_list, stipend_form,
  minutes_of_selection), `OfferLetter`, `StipendRecommendation`
  (`FinalAmount` = `RecommendedStipend + Hra`, computed).
- `Document` (generic, replaces `signed_copies`/`gem_quotations` and all
  ad hoc upload folders) — `Id` (GUID), `OwnerType`/`OwnerId` (polymorphic,
  e.g. points at a `WorkflowInstance` or domain entity), `DocumentKind`
  (Indent/CoverLetter/SignedCopy/GemQuotation/OfferLetter/Proforma/
  StipendForm/Advertisement), `Version`, `Status`
  (Uploaded/Sealed/Reuploaded), `StoragePath`, `UploadedByUserId`,
  `UploadedAt`.

### Authorization scoping

- **Faculty (PI) scope**: can only see their own projects/requests — one PI
  cannot view another's data (hard requirement from both BRD and legacy
  code's per-`user_id` filtering).
- **Office staff scope**: `RegularStaff` sees only requests
  `AssignedToUserId = self`; `Superintendent`/`DeputyRegistrar`/`Dean` see
  requests at their respective `CurrentStage`; `Dean` additionally sees the
  assignment queue (`SignedCopyUploaded` stage) and `Director`-forwarded
  requests (read-only, matching legacy — no in-app Director action).
- Implemented as an `IAuthorizationScopeService` producing an `IQueryable`
  filter, not per-entity ad hoc `WHERE` clauses (fixes the legacy's
  copy-pasted session checks).

### PDF Generation Service

`IDocumentGenerationService` with one method per document type (Annexure
6–11 indent forms, offer letter, screening/selection/minutes proformas,
stipend form, travel request form, bill cover letters), each returning a
byte stream saved via `IDocumentStorageService`. Legacy HTML/CSS templates
are ported near-verbatim and rendered by an HTML-to-PDF engine, embedding
the legacy Kruti Dev fonts and reusing its glyph-mapped Hindi strings (see
the amended PDF generation decision above).
GeM quotation PDF merging (legacy used FPDI) is handled by
a lightweight PDF-merge library (e.g. PdfSharpCore) — implementation detail
resolved during the build, not blocking this spec.

### API surface (high-level, REST)

- `/api/auth/login`, `/api/auth/change-password`
- `/api/projects` (CRUD, scoped to owner), `/api/projects/{id}/budget-heads`,
  `/api/projects/{id}/grant-receipts`, `/api/projects/{id}/expenditure`
- `/api/consumables`, `/api/contingencies`, `/api/equipment-indents`,
  `/api/travel-requests`, `/api/manpower/*` — each: create (raise),
  upload-signed-copy, and read endpoints
- `/api/workflow/{instanceId}/assign`, `/forward`, `/approve`, `/reject`,
  `/forward-to-director`, `/cancel` — generic engine endpoints shared by
  all request types
- `/api/documents/{id}/download`, `/api/documents/upload`
- `/api/manpower/selections`, `/api/manpower/offer-letters`,
  `/api/manpower/stipend-recommendations`
- Reporting/dashboard endpoints (project count, expenditure by head,
  pending approvals by stage) — deferred to implementation detail, not
  itemized here since BRD reporting requirements section (A10) is thin.

### Frontend (React)

Two portals sharing the same app shell: **Faculty** (dashboard, project
CRUD, raise indent/travel/manpower requests, upload signed copies, view
approval status/history) and **Office** (approvals queue split by stage,
assign/forward/approve/reject/forward-to-director actions, document
generation triggers, Director-forwarded read-only view). Shared components:
`ApprovalTimeline` (renders `WorkflowStep` history), `DocumentUploader`,
`CountdownTimer`.

## Out of Scope for This Sub-Project
- Consultancy Track (separate future spec, BRD Prompts 7–14).
- Public CMS (news, announcements, static marketing pages) — stays on the
  legacy server, unchanged, for now.
- Bug-for-bug fidelity where the legacy behavior was clearly a technical
  workaround rather than a business rule (hardcoded usernames, flat remark
  columns, ad hoc upload folder naming, plaintext DB credentials in
  source). **The Kruti Dev glyph font is a deliberate exception** — it is
  retained for pixel-accurate printed forms, per the amended PDF
  generation decision above.

## Testing
- Unit tests: workflow engine stage transitions (including illegal
  transition rejection, e.g. Assign before SignedCopyUploaded), financial
  calculations (overhead split, stipend `FinalAmount`), authorization
  scoping.
- Integration tests: full request lifecycle per request type (raise →
  upload → assign → forward → OSRC → DR → Dean approve/reject/director),
  document generation producing valid PDFs, file upload/download round
  trip.

## Open Questions / Risks Flagged to Stakeholders
- BRD's reporting module (A10) is thin; legacy code has no dedicated
  reporting pages beyond dashboards — reporting scope will need
  confirmation during implementation planning, not guessed here.
- GeM quotation PDF merge approach is an implementation detail resolved
  in the Phase 3 PDF engine plan (a merge library such as PdfSharpCore,
  separate from the HTML-to-PDF renderer), not a design blocker.
- The HTML-to-PDF renderer needs a browser binary (or equivalent engine)
  present on the deployment host. Confirm this is acceptable for the
  target on-prem environment before the PDF engine plan is executed.
