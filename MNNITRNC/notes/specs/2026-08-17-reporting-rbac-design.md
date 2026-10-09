# Phase 10 — Research Track Reporting & RBAC Finalization (Spec)

BRD: [`PROMPTS/06-research-track-reporting-module-user-roles-access.md`](../../PROMPTS/06-research-track-reporting-module-user-roles-access.md)
(Sections A10–A11).

Derived from the shipped code, not from the BRD alone — grounded by a full
survey of the existing data model, export infrastructure, and RBAC scoping
before any of this was written. Every claim about "what exists today" below
is transcribed from real files, not assumed.

---

## 1. What exists today

**Financial/project data** (Phase 2): `Project`, `BudgetHead`, `Expenditure`,
`GrantReceipt`, `SanctionedEquipment`, `SanctionedManpowerPosition`,
`Collaborator`. Two real gaps block clean reporting:

- **`Project` has no `DepartmentId`.** The only path to a department is
  `Project.OwnerUserId` → `ApplicationUser.DepartmentId`, which is the PI's
  *current* department — live, not snapshotted. A PI who transfers
  departments would retroactively move every past project's department in
  a report, which is wrong (`ResearchProposal.DepartmentId` was deliberately
  snapshotted at creation for exactly this reason in Phase 9 — see its own
  doc comment).
- **`Expenditure` has no `BudgetHeadId`.** It links to `Project` only, and
  correlates to a head via a free-text `SectionType` string. There's no
  stored "year" either — only `TransactionDate`. "Expenditure per budget
  head" cannot join cleanly; it would depend on `SectionType` matching
  `BudgetHeadName.ToString()` exactly, silently excluding any row where it
  doesn't.

Confirmed with the user: **both are fixed in this phase**, not worked
around. See §4.

**Export infrastructure**: `IHtmlPdfRenderer` (PuppeteerSharp, headless
Chromium, HTML → PDF) is the shipped pattern, used today for indent/bill
documents. **No Excel library exists anywhere in the solution** — zero
references to ClosedXML/EPPlus/NPOI/OpenXml. This phase adds one from
scratch.

**RBAC scoping**: `IUserDepartmentProvider` (thin wrapper over
`ApplicationUser.DepartmentId`) and the "institute-wide via R&C department
membership" widening check are the shipped primitives — but the widening
check itself (`departmentId is not null && db.Departments.Any(d => d.Id ==
id && d.IsInstituteWide)`) is **copy-pasted** in `PageAccessService` and
`ResearchProposalService.ListForRnCOfficeAsync` rather than shared. One
real precedent exists for a cross-department aggregate query
(`ListForRnCOfficeAsync`), but it's a flat list, not a rollup — this phase
is the first real SUM/GROUP BY reporting work in the codebase.

**Department master**: 7 rows seeded (`CSE, IT, EE, ME, CE, ECE, RNC`),
explicitly a stopgap transcribed from one frontend dropdown, not MNNIT's
real department list. **Confirmed with the user: replaced by the BRD's 14
named departments** (ELED, HSS, SMS, CSED, BTD, EED, CED, ChED, Chemistry,
Physics, Mathematics, GIS Cell, AMD, MED). `RNC` (institute-wide) stays —
the BRD's list is academic departments only and doesn't mention removing
the office department. Existing seeded users backfilled where a name
plausibly matches (see §6); unmatched left with no department rather than
guessed at.

**AuditLog**: confirmed absent — no entity, service, or logging call
anywhere. `WorkflowStep` is audit-trail-*shaped* (actor, action, timestamp,
remarks) but scoped exclusively to workflow instances; it does not cover
direct financial mutations (`Expenditure`, `GrantReceipt` inserts carry no
workflow linkage) or admin/RBAC mutations (`AdminAccessController`'s role
and grant edits write no trail at all beside a bare `GrantedAt` stamp).
Prompt 0 named `AuditService` as platform foundation but it was never
built in Phases 1–9. Built here, generically, per the original brief —
not bolted onto reporting as a one-off.

**`FacultyUsersController`** (who may create faculty logins) currently has
**no `[Authorize]` at all** — `GetAll`/`GetByUserId` leak every faculty
profile unauthenticated, `Create` is open to anyone. A `faculty-admin.create`
page grant already exists in `PageCatalogue` (Office roles, seeded) but the
controller never checks it. Confirmed with the user: **gated in this
phase**, not flagged-and-deferred — it's the literal prerequisite for the
BRD's "user-creation permission must itself be an assignable permission,"
which is meaningless while the endpoint checks nothing at all.

**Frontend**: `DashboardPage.jsx` is fully static — three cards, each a
hardcoded literal `0`, no API call. No reports/analytics page exists
anywhere. A real file-download precedent exists
(`fellowshipApi.js downloadStipendForm` — blob fetch, object URL, synthetic
anchor click) and is MIME-agnostic, reusable unchanged for Excel exports.

---

## 2. Reuse rather than duplication

- **PDF export** reuses `IHtmlPdfRenderer` exactly as indent/bill documents
  do — a report renders to an HTML table, then through the same Puppeteer
  path. No new PDF library.
- **Excel export** is new (`ClosedXML` — MIT-licensed, no native
  dependencies, the most common .NET choice for this and simplest to unit
  test against, unlike EPPlus's commercial licensing concerns for a
  from-scratch enterprise tool). One `IExcelExportService`, reused by every
  report, not one per report.
- **Institute-wide widening** is extracted into a single reusable
  application-layer helper this phase, and the two existing copy-pasted
  call sites (`PageAccessService`, `ResearchProposalService`) are refactored
  onto it — the reporting queries are the third and fourth consumers; three
  or more copies of the same check crosses the line from "fine to inline"
  to "extract it," which the codebase's own stated bar elsewhere agrees with.
- **Audit logging** follows `WorkflowStep`'s shape (actor, action, entity,
  timestamp, remarks/detail) generalized to any entity, not just workflow
  instances — same fields, wider applicability. `AuditService.LogAsync` is
  called from the write paths that need it (financial mutations, admin/RBAC
  mutations, workflow actions already logged via `WorkflowStep` are *not*
  double-logged — `WorkflowStep` already is that record for those actions).
- **Data scoping** (PI-owner / department / institute) for reports reuses
  `IUserDepartmentProvider` and the newly-extracted widening helper, the
  same primitives every other module's queries already use — no new
  scoping mechanism invented.

---

## 3. Reports (BRD A10)

Seven reports, each supporting Excel export, PDF export, and date-range
filtering (on `Project.CreatedAt`/`Expenditure.TransactionDate`/
`GrantReceipt.ReceivedDate` as appropriate per report — a "number of
projects" report filters projects by creation date; a "project-wise
expenditure" report filters *expenditure rows* by transaction date within a
project's lifetime, not the project's own creation date).

| # | Report | Primary source | Scope-sensitive? |
|---|---|---|---|
| 1 | Number of Projects | `Project` count, grouped by `ProjectType`/department | Yes |
| 2 | Project-wise Grant Sanctioned | `Project.TotalSanctioned`, `BudgetHead` breakdown | Yes |
| 3 | Project-wise Expenditure | `Expenditure` (now joined via `BudgetHeadId`) per project | Yes |
| 4 | Project-wise Overhead | `GrantReceipt` where `SubHead` is set (Idf/Pdf/Ddf split) | Yes |
| 5 | Refund Reports | **No existing entity models a refund.** See §3a. | Yes |
| 6 | Staff Count Reports | `ApplicationUser` count by role/department | Yes |
| 7 | Project-wise Equipment List | `SanctionedEquipment` per project | Yes |

All seven are scope-sensitive: a PI sees only their own projects/staff-count
context does not apply to them at all (Faculty has no "staff count" report,
per BRD A11's data rules — see §5), an HOD sees their department's, Dean/R&C
office sees institute-wide.

### 3a. Refund Reports — the one report the BRD names with nothing behind it

No entity anywhere models a refund (money returned to a funding agency, or
unspent grant balance clawed back). This is not a report over existing
data — it needs a minimal new entity first. Scoped narrowly per the "no
business rules invented" instruction: a `Refund` record (`ProjectId`,
`Amount`, `RefundDate`, `Reason` free text, `RecordedByUserId`) recorded
manually by RnC office staff against a project, not derived from any
workflow (no refund-initiation chain exists in the BRD text this phase
covers — that would be new business process invention, out of scope). The
report is then "list of `Refund` rows, scoped the same as every other
report." If this reads as too thin, flag before Task group 10c — it is the
one piece of this spec closest to guessing.

---

## 4. Domain changes

- **`Project.DepartmentId`** (`Guid`, non-nullable after backfill) — added
  the same way `ResearchProposal.DepartmentId` was: snapshotted at
  `CreateAsync` time from the owning PI's current department via
  `IUserDepartmentProvider`, not live-resolved. Existing rows backfilled
  from `OwnerUserId`'s *current* department at migration time (the closest
  available truth for data that predates the snapshot — documented as a
  one-time approximation, not retroactively perfect).
- **`Expenditure.BudgetHeadId`** (`Guid`, nullable FK to `BudgetHead`) —
  nullable because existing rows' free-text `SectionType` may not match any
  `BudgetHeadName` exactly; a migration script attempts an exact-string
  backfill match and leaves genuinely unmatched rows null rather than
  guessing. `SectionType` itself is *not* removed — it stays as the
  original free-text record, `BudgetHeadId` is additive.
- **`Refund`** (new entity) — per §3a.
- **`AuditLog`** (new entity) — `Id, EntityType (string), EntityId (Guid),
  Action (string), ActorUserId, Timestamp, Detail (string?, e.g. a JSON
  diff or free-text description)`. Deliberately loose-typed (`EntityType`/
  `Action` as strings, not enums) because this is meant to log across every
  module in the application, including ones added after this phase — an
  enum here would need appending for every future feature, the exact
  friction `WorkflowStage`/`WorkflowAction`'s append-only comments already
  warn about for a narrower case.
- **`DepartmentSeeder.Departments`** — replaced with the BRD's 14 named
  departments + `RNC`. Codes chosen to match the BRD's own abbreviations
  where given (ELED, HSS, SMS, CSED, BTD, EED, CED, ChED) and short
  transcribed codes for the rest (Chemistry → CHEM, Physics → PHY,
  Mathematics → MATH, GIS Cell → GIS, AMD → AMD, MED → MED) — flagged for
  confirmation before Task group 10a, since these are new abbreviations,
  not ones the BRD stated explicitly.

---

## 5. Roles & Access (BRD A11)

- **User-creation as an assignable permission**: `FacultyUsersController`
  gated with the existing `faculty-admin.create` page key
  (`[PageAccess("faculty-admin.create")]`, matching the shipped pattern
  every other controller uses — see `ProjectsController`,
  `ProposalsController`). This alone satisfies "an assignable permission,
  not a hardcoded role" — `PageCatalogue`'s existing seed already grants it
  to Office roles by default, and `AdminAccessController`'s existing
  per-role/per-user grant editing already lets a SuperAdmin extend or
  narrow that assignment without a redeploy. No new mechanism, just closing
  the gap where the controller never checked what already exists.
- **14 departments provisioned with login access**: per §4 — this is the
  department *master*, not a bulk user-creation exercise; MNNIT's real
  faculty accounts are not being fabricated here. `AssignDepartmentAsync`'s
  existing backfill-by-name pattern (`DbSeeder.cs`) is what a real faculty
  onboarding would use once actual accounts exist.
- **Office login with administrative roles**: Dean, DR, Superintendent
  already exist and are seeded (`deanrc`, `dyregrc`, `osrc`). No changes
  needed — confirmed against `DbSeeder.cs`.
- **Named staff seeding**: Harshit, Sadhvi, Ashok, Shyamu, Renu, Prateek,
  all seeded as `RegularStaff` (confirmed with the user), following the
  exact `EnsureUserAsync` pattern already used for `clerk1`. Usernames
  derived as `{firstname-lowercase}1` (harshit1, sadhvi1, …) to avoid
  collision with any future same-named account, matching `faculty1`'s own
  naming convention.
- **Data access rules** (PI isolation, HOD department scope, Dean/R&C
  institute-wide): already the shipped model from Phase 8/9 —
  `AccessScope.Own/Department/Institute` plus the R&C-membership widening.
  This phase's reports are the first consumers to *aggregate* under that
  model rather than list rows under it, but the model itself needs no
  change. Verified with integration tests per the BRD's explicit acceptance
  criterion (not just unit tests) — see Task group 10f.
- **Audit trail**: per §4, `AuditService` instrumented into financial
  mutation paths (`ProjectService.RecordGrantReceiptAsync`, a new
  `RefundService.RecordAsync`, `ExpenditureService` writes if one exists —
  confirm during Task group 10b) and `AdminAccessController`'s role/grant
  mutations. Approvals/rejections/modifications already routed through the
  workflow engine keep using `WorkflowStep` as their record — not
  duplicated into `AuditLog` as well.

---

## 6. Department name reconciliation (needs confirmation, not guessed)

The BRD's 14 codes are given as abbreviations without full names for most.
Full names inferred for the report/UI display label, cross-checked against
MNNIT Allahabad's actual department list where the abbreviation is
unambiguous:

| Code | Inferred name | Confidence |
|---|---|---|
| ELED | Electronics Engineering | Confirmed by user — distinct from EED |
| HSS | Humanities & Social Sciences | High |
| SMS | School of Management Studies | High |
| CSED | Computer Science & Engineering | High |
| BTD | Biotechnology | Medium |
| EED | Electrical Engineering | High |
| CED | Civil Engineering | High |
| ChED | Chemical Engineering | Medium |
| Chemistry | Chemistry | High (full name given) |
| Physics | Physics | High (full name given) |
| Mathematics | Mathematics | High (full name given) |
| GIS Cell | GIS Cell | High (full name given) |
| AMD | Applied Mechanics | Medium |
| MED | Mechanical Engineering | High |

Resolved: ELED and EED are distinct (Electronics vs. Electrical), confirmed
by the user before seeding. Remaining Medium-confidence entries (BTD,
ChED, AMD) are standard MNNIT Allahabad department abbreviations and are
seeded as-is; not blocking.

---

## 7. Deferred / explicitly out of scope

- Refund *workflow* (initiation, approval chain) — only the record and
  report, per §3a.
- Retroactive audit history for anything that happened before `AuditLog`
  exists — logging starts from this phase forward, not backfilled.
- Excel/PDF export for any *existing* module's data beyond these seven
  reports (e.g. an indent export) — out of this BRD prompt's scope.
- General "search & filter" (BRD Part C, Prompt 0) beyond what these
  reports' own date-filtering needs — a portal-wide search is not named in
  Prompt 6's business rules.
