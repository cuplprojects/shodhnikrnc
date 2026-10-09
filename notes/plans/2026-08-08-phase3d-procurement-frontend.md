# Phase 3d: Procurement Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the procurement UI — raise consumable/contingency/equipment indents from within a project, view them with live budget availability and a computed tier preview, browse all indents across projects from `/procurement`, and process bills — plus fix the two scaffolded components that currently target a non-existent API.

**Architecture:** Tailwind utility classes throughout, matching the newer pages (`ProcurementPage`, `Sidebar`) rather than the MUI still used by Phase 2's older field-array components. A single shared `IndentForm` drives all three indent types, parameterised by type, since the fields are identical apart from equipment's sanctioned-equipment picker. Indent raising lives inside the project detail page (where budget-head and sanctioned-equipment context exists); `/procurement` becomes a cross-project list with type and status filters.

**Tech Stack:** React 19, Vite, React Router 7, Tailwind, `lucide-react` icons (already used by `DocumentUploader`). No new dependencies.

## Global Constraints

- **Tailwind, not MUI**, for everything this plan creates. Match the class conventions in `UI/src/pages/ProcurementPage.jsx` and `UI/src/components/ApprovalTimeline.jsx`, including their `dark:` variants — the app has a `ThemeContext` and new UI must work in both themes.
- All API calls go through `UI/src/api/` modules — no `fetch` in components. `apiClient.js` already handles `FormData` bodies (it omits the JSON content-type when the body is a `FormData`), so multipart uploads need no client changes.
- Enum values sent to the API are the exact PascalCase strings the backend serializes (`Consumable`, `GemUpTo50k`, `Yes`/`No`), matching how `projectEnums.js` already stores them.
- Money is displayed via the existing `formatCurrency` helper in `UI/src/pages/projects/utils/currency.js`.
- **The tier preview is advisory only.** The server independently recomputes the tier on every raise (Phase 3b's `IProcurementTierCalculator`); the client preview exists to inform the user, never to determine what is submitted. Do not send a tier value to the API.
- Do not modify Phase 2's project pages beyond adding the indent section to `ProjectDetailPage`.

## Dependencies

This plan consumes APIs built in earlier Phase 3 plans. Execute those first:
- **3b** provides the indent endpoints and `GET /api/budget-heads/{id}/indent-budget`.
- **3c** provides `GET /api/documents/checklist` and the `stepName`/`sequenceOrder` fields `ApprovalTimeline` reads.

If either is unbuilt when this plan runs, its dependent tasks will fail at the live-verification step — stop and report rather than stubbing the API.

---

## File Structure

```
UI/src/
  api/
    procurementApi.js                          (new)
  constants/
    procurementEnums.js                        (new)
  components/
    ApprovalTimeline.jsx                       (modify: real API field names)
    DocumentUploader.jsx                       (modify: real API contract)
  pages/
    ProcurementPage.jsx                        (modify: replace placeholder)
    procurement/
      IndentDetailPage.jsx                     (new)
      components/
        IndentForm.jsx                         (new — shared by all 3 types)
        IndentTierPreview.jsx                  (new)
        BudgetAvailabilityBadge.jsx            (new)
        CommitteeMembersFieldArray.jsx         (new)
        IndentList.jsx                         (new — shared list table)
        ProcessBillForm.jsx                    (new)
    projects/
      ProjectDetailPage.jsx                    (modify: add indents section)
  App.jsx                                      (modify: add procurement routes)
```

---

## Task 1: Fix the two scaffolded components to match the real API

**Files:**
- Modify: `UI/src/components/ApprovalTimeline.jsx`
- Modify: `UI/src/components/DocumentUploader.jsx`
- Modify: `UI/src/constants/projectEnums.js`

**Interfaces:**
- Consumes: Phase 3c's extended `WorkflowStepResponse` and `GET /api/documents/checklist`.
- Produces: both components working against the actual backend.

Both components were scaffolded against an imagined API. `ApprovalTimeline` reads `step.stepName`/`step.sequenceOrder`/`step.actedAt`; the real response (after 3c) provides `stepName`/`sequenceOrder`/`timestamp` — only `actedAt` is wrong. `DocumentUploader` is further off: it calls `/api/documents/checklist?workflowDefinitionId=...` and posts `subjectType`/`subjectId`/`uploadedByUserId`/`checklistItemId`; the real API takes `?requestType=&phase=&requestId=&ownerType=` and `POST /api/documents/upload` with `ownerType`/`ownerId`/`kind`/`file`.

- [x] **Step 1: Fix `ApprovalTimeline`'s timestamp field**

In `UI/src/components/ApprovalTimeline.jsx`, change `step.actedAt` to `step.timestamp` (two references: the conditional and the `new Date(...)` call). Leave `stepName` and `sequenceOrder` as-is — 3c adds those.

- [x] **Step 2: Extend the action label/colour maps**

`projectEnums.js`'s `ACTION_LABELS`/`ACTION_COLORS` cover `Approve`/`Reject`/`Return`/`Submit`/`Resubmit`, but the real `WorkflowAction` enum is `Raise`, `UploadSignedCopy`, `Assign`, `Forward`, `Approve`, `Reject`, `ForwardToDirector`, `Cancel`. Replace both maps with entries for the real values:
```javascript
export const ACTION_LABELS = {
  Raise: "Raised",
  UploadSignedCopy: "Signed Copy Uploaded",
  Assign: "Assigned",
  Forward: "Forwarded",
  Approve: "Approved",
  Reject: "Rejected",
  ForwardToDirector: "Sent to Director",
  Cancel: "Cancelled",
};

export const ACTION_COLORS = {
  Raise: "bg-blue-600 dark:bg-blue-500",
  UploadSignedCopy: "bg-sky-600 dark:bg-sky-500",
  Assign: "bg-indigo-600 dark:bg-indigo-500",
  Forward: "bg-violet-600 dark:bg-violet-500",
  Approve: "bg-emerald-600 dark:bg-emerald-500",
  Reject: "bg-rose-600 dark:bg-rose-500",
  ForwardToDirector: "bg-amber-500 dark:bg-amber-400",
  Cancel: "bg-slate-500 dark:bg-slate-400",
};
```

- [x] **Step 3: Rewire `DocumentUploader` to the real API**

Change its props from `{ subjectType, subjectId, uploadedByUserId, workflowDefinitionId, onUploaded }` to `{ ownerType, ownerId, requestType, phase, documentKind, onUploaded }`, then:
- Checklist fetch → `apiGet(\`/api/documents/checklist?requestType=${requestType}&phase=${phase}&requestId=${ownerId}&ownerType=${ownerType}\`)`.
- Upload → `FormData` with `ownerType`, `ownerId`, `kind` (the selected checklist item's `documentKind`, falling back to the `documentKind` prop), and `file`. Drop `uploadedByUserId` entirely — the server takes the user from the JWT.
- Replace `pendingChecklistItemId` state with `pendingDocumentKind`, since the API keys uploads by kind rather than by checklist-item id. The "Upload this" button sets the kind from the item.
- Keep the existing drag-and-drop UI, checklist rendering, and Tailwind classes unchanged.

- [x] **Step 4: Build and lint**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build && npm run lint`
Expected: both succeed with no errors.

- [x] **Step 5: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/components/ApprovalTimeline.jsx UI/src/components/DocumentUploader.jsx UI/src/constants/projectEnums.js
git commit -m "Rewire scaffolded timeline and uploader components to the real API"
```

---

## Task 2: Procurement API module and enum constants

**Files:**
- Create: `UI/src/api/procurementApi.js`
- Create: `UI/src/constants/procurementEnums.js`

**Interfaces:**
- Consumes: `apiGet`/`apiPost` from `apiClient.js`.
- Produces (consumed by every later task):
  ```javascript
  // procurementApi.js
  export const listIndentsForProject = (indentType, projectId)
  export const getIndent = (indentType, indentId)
  export const raiseIndent = (indentType, projectId, formData)   // FormData, multipart
  export const processBill = (indentType, indentId, payload)
  export const getIndentBudget = (budgetHeadId)

  // procurementEnums.js
  export const INDENT_TYPES          // [{ value, label, apiSegment, requestType }]
  export const GEM_AVAILABILITY      // [{ value: 'Yes'|'No', label }]
  export const COMMITTEE_ROLES       // [{ value, label }]
  export const PROCUREMENT_TIERS     // { [tierValue]: { label, annexure } }
  export const WORKFLOW_STAGE_LABELS // stage value -> display label
  export const COMMITTEE_TIER        // 'NonGem2LakhTo25Lakh'
  export function computeTierPreview(gemAvailability, estimatedCost)
  ```

- [x] **Step 1: Write `procurementEnums.js`**

```javascript
export const INDENT_TYPES = [
  { value: 'Consumable', label: 'Consumable', apiSegment: 'consumable-indents', requestType: 'Consumable' },
  { value: 'Contingency', label: 'Contingency', apiSegment: 'contingency-indents', requestType: 'Contingency' },
  { value: 'Equipment', label: 'Equipment', apiSegment: 'equipment-indents', requestType: 'Equipment' },
];

export const GEM_AVAILABILITY = [
  { value: 'Yes', label: 'Available on GeM' },
  { value: 'No', label: 'Not available on GeM' },
];

export const COMMITTEE_ROLES = [
  { value: 'Chairperson', label: 'Chairperson (HoD)' },
  { value: 'FacultyMember', label: 'Faculty Member' },
  { value: 'Indenter', label: 'Indenter' },
  { value: 'RnCRepresentative', label: 'AR (R&C) / Dy. Registrar' },
  { value: 'AdminRepresentative', label: 'AR (Admin-III)' },
  { value: 'FinanceRepresentative', label: 'FIP' },
];

export const PROCUREMENT_TIERS = {
  GemUpTo50k: { label: 'GeM — up to ₹50,000', annexure: 'Annexure 6' },
  Gem50kTo1Lakh: { label: 'GeM — ₹50,001 to ₹1,00,000', annexure: 'Annexure 7' },
  GemAbove1Lakh: { label: 'GeM — above ₹1,00,000', annexure: 'Annexure 8' },
  NonGemUpTo1Lakh: { label: 'Non-GeM — up to ₹1,00,000', annexure: 'Annexure 9' },
  NonGem1LakhTo2Lakh: { label: 'Non-GeM — ₹1,00,001 to ₹2,00,000', annexure: 'Annexure 10' },
  NonGem2LakhTo25Lakh: { label: 'Non-GeM — ₹2,00,001 to ₹25,00,000', annexure: 'Annexure 11' },
};

export const COMMITTEE_TIER = 'NonGem2LakhTo25Lakh';

export const WORKFLOW_STAGE_LABELS = {
  Raised: 'Raised',
  SignedCopyUploaded: 'Signed Copy Uploaded',
  Assigned: 'Assigned',
  Forwarded: 'Forwarded',
  ForwardedOSRC: 'With Superintendent',
  ForwardedDR: 'With Deputy Registrar',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Director: 'With Director',
  Cancelled: 'Cancelled',
};

const BIDDING_THRESHOLD = 2_500_000;

/**
 * Mirrors the server's tier rules for display only. The server recomputes the
 * tier on every raise; this never determines what is submitted.
 * Returns null when the cost is not yet a usable number, or the bidding sentinel
 * when non-GeM cost exceeds the supported ceiling.
 */
export function computeTierPreview(gemAvailability, estimatedCost) {
  const cost = Number(estimatedCost);
  if (!Number.isFinite(cost) || cost <= 0) return null;

  if (gemAvailability === 'Yes') {
    if (cost <= 50_000) return 'GemUpTo50k';
    if (cost <= 100_000) return 'Gem50kTo1Lakh';
    return 'GemAbove1Lakh';
  }

  if (cost > BIDDING_THRESHOLD) return 'BiddingRequired';
  if (cost <= 100_000) return 'NonGemUpTo1Lakh';
  if (cost <= 200_000) return 'NonGem1LakhTo2Lakh';
  return 'NonGem2LakhTo25Lakh';
}
```

- [x] **Step 2: Write `procurementApi.js`**

```javascript
import { apiGet, apiPost } from './apiClient';
import { INDENT_TYPES } from '../constants/procurementEnums';

function segmentFor(indentType) {
  const match = INDENT_TYPES.find((t) => t.value === indentType);
  if (!match) throw new Error(`Unknown indent type: ${indentType}`);
  return match.apiSegment;
}

export const listIndentsForProject = (indentType, projectId) =>
  apiGet(`/api/projects/${projectId}/${segmentFor(indentType)}`);

export const getIndent = (indentType, indentId) =>
  apiGet(`/api/${segmentFor(indentType)}/${indentId}`);

export const raiseIndent = (indentType, projectId, formData) =>
  apiPost(`/api/projects/${projectId}/${segmentFor(indentType)}`, formData);

export const processBill = (indentType, indentId, payload) =>
  apiPost(`/api/${segmentFor(indentType)}/${indentId}/process-bill`, payload);

export const getIndentBudget = (budgetHeadId) =>
  apiGet(`/api/budget-heads/${budgetHeadId}/indent-budget`);
```

- [x] **Step 3: Build**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build`
Expected: build succeeds.

- [x] **Step 4: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/api/procurementApi.js UI/src/constants/procurementEnums.js
git commit -m "Add procurement API module and enum constants"
```

---

## Task 3: Tier preview, budget badge, and committee field array

**Files:**
- Create: `UI/src/pages/procurement/components/IndentTierPreview.jsx`
- Create: `UI/src/pages/procurement/components/BudgetAvailabilityBadge.jsx`
- Create: `UI/src/pages/procurement/components/CommitteeMembersFieldArray.jsx`

**Interfaces:**
- Consumes: `computeTierPreview`, `PROCUREMENT_TIERS`, `COMMITTEE_ROLES` (Task 2), `getIndentBudget` (Task 2), `formatCurrency`.
- Produces:
  ```javascript
  <IndentTierPreview gemAvailability={...} estimatedCost={...} />
  <BudgetAvailabilityBadge budgetHeadId={...} estimatedCost={...} />
  <CommitteeMembersFieldArray items={...} onChange={...} />
  ```

- [x] **Step 1: Write `IndentTierPreview`**

Renders the computed tier's label and annexure number as an informational panel. When `computeTierPreview` returns `'BiddingRequired'`, render a warning panel explaining that non-GeM purchases above ₹25,00,000 must go through the bidding process and cannot be raised here. When it returns `null`, render nothing. Include a short note that the tier is determined by the server on submission. Tailwind, with `dark:` variants.

- [x] **Step 2: Write `BudgetAvailabilityBadge`**

Fetches `getIndentBudget(budgetHeadId)` whenever `budgetHeadId` changes, showing sanctioned / committed / paid / available via `formatCurrency`. When `estimatedCost` exceeds `available`, show it in a warning style with a message that the request will be rejected. Renders nothing when `budgetHeadId` is falsy. Guard the fetch against races — track the in-flight budget head id and ignore a response whose id no longer matches, so rapid dropdown changes cannot render stale figures.

- [x] **Step 3: Write `CommitteeMembersFieldArray`**

Follows the `{ items, onChange }` contract Phase 2's field arrays use (parent owns all state), but built with Tailwind rather than MUI. Each row: a name text input and a role `<select>` populated from `COMMITTEE_ROLES`, plus a remove button; an "Add Member" button appends `{ name: '', role: 'Chairperson' }`.

- [x] **Step 4: Build and lint**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build && npm run lint`
Expected: both succeed.

- [x] **Step 5: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/pages/procurement/components/IndentTierPreview.jsx UI/src/pages/procurement/components/BudgetAvailabilityBadge.jsx UI/src/pages/procurement/components/CommitteeMembersFieldArray.jsx
git commit -m "Add indent tier preview, budget availability badge, and committee field array"
```

---

## Task 4: Shared `IndentForm`

**Files:**
- Create: `UI/src/pages/procurement/components/IndentForm.jsx`

**Interfaces:**
- Consumes: everything from Tasks 2 and 3, plus `getProject` from `projectsApi.js` (for budget heads and sanctioned equipment).
- Produces:
  ```javascript
  <IndentForm
    indentType={'Consumable'|'Contingency'|'Equipment'}
    project={projectDetailResponse}
    onSubmitted={(indentId) => {}}
    onCancel={() => {}}
  />
  ```

Fields: Name, Technical Specs (textarea), Unit of Measurement, Quantity, Purpose (textarea), GeM Availability (radio/select), Estimated Cost, Budget Head (select from `project.budgetHeads`), plus:
- Non-GeM only: Non-Availability Certificate Number, Issue Date, Validity Date.
- Equipment only: Sanctioned Equipment (select from `project.sanctionedEquipment`).
- Committee tier only (`computeTierPreview(...) === COMMITTEE_TIER`): `CommitteeMembersFieldArray`.
- Optional GeM quotation PDF file input (shown when GeM availability is `Yes`).

Submission builds a `FormData` — scalar fields plus committee members as indexed keys (`committeeMembers[0].name`, `committeeMembers[0].role`, …, matching ASP.NET Core's default form-collection binding for lists) and the optional `gemQuotation` file — and calls `raiseIndent`. It must not send any tier value.

- [x] **Step 1: Write the component**

Local state per field, Tailwind styling with `dark:` variants. Show `IndentTierPreview` and `BudgetAvailabilityBadge` live as the user types. Disable submit while in flight, when the tier preview is `'BiddingRequired'`, or when required fields are empty. Surface API errors from `err.problemDetails?.detail` (Phase 2's `ApiError` shape) in an error panel — the backend's budget and tier rejections arrive this way and their messages are already user-readable.

- [x] **Step 2: Build and lint**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build && npm run lint`
Expected: both succeed.

- [x] **Step 3: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/pages/procurement/components/IndentForm.jsx
git commit -m "Add shared indent form driving all three indent types"
```

---

## Task 5: Indent list component and project detail integration

**Files:**
- Create: `UI/src/pages/procurement/components/IndentList.jsx`
- Modify: `UI/src/pages/projects/ProjectDetailPage.jsx`

**Interfaces:**
- Consumes: `listIndentsForProject` (Task 2), `IndentForm` (Task 4), `WORKFLOW_STAGE_LABELS`/`PROCUREMENT_TIERS` (Task 2).
- Produces: `<IndentList indents={...} onSelect={...} />` plus a new "Indents" section on the project detail page.

- [x] **Step 1: Write `IndentList`**

A Tailwind table: Name, Type, Estimated Cost (`formatCurrency`), Tier (label from `PROCUREMENT_TIERS`), Stage (label from `WORKFLOW_STAGE_LABELS`, rendered as a coloured pill), Raised date. Row click calls `onSelect(indent)`. Renders an empty-state message when the list is empty. Accepts an optional `showType` prop so the project-scoped usage can hide the redundant Type column while `/procurement` shows it.

- [x] **Step 2: Add the Indents section to `ProjectDetailPage`**

Read the current file first and follow its existing section structure. Add a section that:
- Fetches all three indent types for the project on mount (`Promise.all` over `INDENT_TYPES`), tagging each result with its type, and renders them in one `IndentList`.
- Has a "Raise Indent" control that opens `IndentForm` with an indent-type selector, passing the already-loaded project.
- Refreshes the list after a successful raise.

- [x] **Step 3: Build and lint**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build && npm run lint`
Expected: both succeed.

- [x] **Step 4: Live verification**

With backend and frontend running and logged in as `faculty1`, open a project with a budget head, raise a consumable indent for a GeM item under ₹50,000, and confirm: the tier preview shows "Annexure 6", the budget badge shows availability decreasing after the raise, and the indent appears in the list. Then attempt an indent exceeding the head's available budget and confirm the API's rejection message renders in the error panel. Record findings in your report.

- [x] **Step 5: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/pages/procurement/components/IndentList.jsx UI/src/pages/projects/ProjectDetailPage.jsx
git commit -m "Add indent list and raise-indent section to project detail page"
```

---

## Task 6: Indent detail page with timeline, documents, and bill processing

**Files:**
- Create: `UI/src/pages/procurement/components/ProcessBillForm.jsx`
- Create: `UI/src/pages/procurement/IndentDetailPage.jsx`
- Modify: `UI/src/App.jsx`

**Interfaces:**
- Consumes: `getIndent`/`processBill` (Task 2), `ApprovalTimeline`/`DocumentUploader` (Task 1), Phase 1's workflow endpoint for the instance detail.
- Produces: route `/procurement/:indentType/:indentId` rendering the full indent view.

- [x] **Step 1: Write `ProcessBillForm`**

Fields: Original Bill Reference, Stock Entry Confirmed (checkbox), E-Way Bill Number, Measurement Book Number (equipment only), and the stock register fields (Stock Book Page, Description, Quantity, Actual Cost, Condition). Show E-Way Bill as required when the indent's `estimatedCost > 50000`, mirroring the server rule, and disable submit until it is filled in that case. Submits via `processBill`. Surface API errors the same way `IndentForm` does.

- [x] **Step 2: Write `IndentDetailPage`**

Reads `indentType`/`indentId` from the route. Loads the indent, then its workflow instance (`GET /api/workflow/{workflowInstanceId}`). Renders:
- A header with name, type, tier label, current stage pill, and estimated cost.
- Item details and, when non-GeM, the Non-Availability Certificate block.
- `ApprovalTimeline` fed from the workflow instance's `steps`.
- `DocumentUploader` with `ownerType={`${indentType}Indent`}`, `ownerId={indentId}`, `requestType={indentType}`, and the phase from the workflow instance.
- `ProcessBillForm`, shown only when the instance is `Phase === 'Indent' && CurrentStage === 'Approved'` (the server enforces the same gate).

- [x] **Step 3: Add the route**

In `App.jsx`, inside the existing protected/layout route group, next to the other module routes:
```jsx
<Route path="/procurement/:indentType/:indentId" element={<IndentDetailPage />} />
```

- [x] **Step 4: Build and lint**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build && npm run lint`
Expected: both succeed.

- [x] **Step 5: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/pages/procurement/components/ProcessBillForm.jsx UI/src/pages/procurement/IndentDetailPage.jsx UI/src/App.jsx
git commit -m "Add indent detail page with timeline, document checklist, and bill processing"
```

---

## Task 7: Cross-project procurement page

**Files:**
- Modify: `UI/src/pages/ProcurementPage.jsx`

**Interfaces:**
- Consumes: `listProjects` (`projectsApi.js`), `listIndentsForProject` (Task 2), `IndentList` (Task 5).

- [x] **Step 1: Replace the placeholder**

Keep the existing header markup (title, subtitle, and the "New Indent" button styling). Then:
- Load the user's projects, then all three indent types for each, flattening into one list tagged with project title and indent type.
- Render via `IndentList` with `showType`, adding a project column.
- Add filter controls: indent type (All / Consumable / Contingency / Equipment) and stage (All plus the `WORKFLOW_STAGE_LABELS` values), applied client-side.
- Point "New Indent" at the project list (`/projects`) with helper text explaining indents are raised from within a project, since a budget head must be chosen. Keep it simple — do not build a project-picker modal.
- Row click navigates to `/procurement/{indentType}/{indentId}`.
- Show a loading state while fetching and an empty state when the user has no indents.

- [x] **Step 2: Build and lint**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build && npm run lint`
Expected: both succeed.

- [x] **Step 3: Live verification**

Log in as `faculty1`, open `/procurement`, and confirm previously raised indents appear with correct project, type, tier, and stage. Exercise both filters. Click a row and confirm it opens the detail page. Record findings.

- [x] **Step 4: Commit**

```bash
cd D:/Projects/MNNITRNC
git add UI/src/pages/ProcurementPage.jsx
git commit -m "Implement cross-project procurement list with type and stage filters"
```

---

## Task 8: Full end-to-end verification

**Files:** none (verification only).

- [x] **Step 1: Production build and lint**

Run: `cd D:/Projects/MNNITRNC/UI && npm run build && npm run lint`
Expected: both clean, no new warnings.

- [x] **Step 2: Full procurement walkthrough**

With backend and frontend running, logged in as `faculty1`:
1. Create a project with a `RecurringConsumable` budget head funded for year 1.
2. Raise a GeM consumable indent under ₹50,000 — confirm the Annexure 6 preview, successful raise, and that the generated indent PDF is downloadable.
3. Confirm the budget badge reflects the new committed amount.
4. Raise a non-GeM indent between ₹2L and ₹25L — confirm the committee section appears and members save.
5. Attempt a non-GeM indent above ₹25L — confirm the bidding warning blocks submission client-side.
6. Attempt an indent exceeding available budget — confirm the server's rejection renders.
7. Open an indent's detail page — confirm the timeline renders real steps and the document checklist shows satisfied/unsatisfied items.
8. Drive an indent to Approved (via the workflow endpoints or an office-role login), then process its bill — confirm E-Way Bill is required above ₹50,000 and the bill-phase workflow instance is created.
9. Visit `/procurement` — confirm all indents appear and filters work.
Record the outcome of each step in your report; investigate and fix anything that fails rather than noting it as expected.

- [x] **Step 3: Confirm no plan step was skipped**

Check off unchecked boxes above only after re-running the corresponding command and confirming expected output.

---

## Execution Record (2026-08-11)

Two deliberate deviations from this plan, both verified correct against the
running backend:

1. **`IndentForm.jsx` was built as `RequisitionModalShell.jsx`.** Same role —
   one shared form parameterised by indent type — wired into the three existing
   project modals rather than introduced as a fourth component.
2. **Committee members are sent as a `CommitteeMembersJson` string**, not the
   indexed form keys this plan specified. `RaiseIndentRequest.CommitteeMembersJson`
   is a `string?` by design: a nested collection does not bind reliably from
   multipart form data. Errors surface via `err.message`, which `ApiError` already
   populates from `problemDetails.detail`.

One defect found and fixed during the closing audit: the requisition form
collected five stock-register fields and appended them to the raise request.
They belong to `ProcessBillInput`, so model binding discarded them silently.
Section removed; `ProcessBillForm` collects them at bill time.

**Live walkthrough results** (backend on `:5199` against `MNNITRNC_New`,
`faculty1` plus office roles):

| Step | Result |
|------|--------|
| Project + funded head | sanctioned 500000, available 500000 |
| GeM ₹45,000 raise | server tier `GemUpTo50k` (Annexure 6), matches client preview |
| Budget after raise | committed 45000, available 455000 |
| Committee tier ₹3,00,000 | server tier `NonGem2LakhTo25Lakh`, `CommitteeMembersJson` bound |
| Non-GeM ₹30,00,000 | rejected: "must go through the bidding process" |
| Over-budget ₹6,00,000 | rejected: "exceeds available budget 455000.00" |
| Workflow steps | returns `timestamp`/`stepName`/`sequenceOrder`, no `actedAt` |
| Document checklist | flips `isSatisfied` after upload with `ownerType=ConsumableIndent` |
| Full escalation | Raised → SignedCopyUploaded → Assigned → Forwarded → OSRC → DR → Approved |
| Bill ≤ ₹50,000 | succeeds without an e-way bill |
| Bill > ₹50,000 | rejected without e-way bill; succeeds with one |

`paid` stays 0 after bill processing — correct: it reads from `Expenditure`,
and an Approved indent keeps holding its commitment so the same rupees cannot
be committed twice (see `IndentBudgetValidator.TerminalStages`).

Not exercised: the browser UI itself. Every check above drove the HTTP API that
the components call, confirming contracts rather than rendering.

---

## Self-Review Notes (for the plan author, not a task)

- **Spec coverage check**: three indent forms ✅ (Task 4, one shared component parameterised by type — the spec says "three indent-raising forms", satisfied by one component rendering three variants rather than three files, which avoids triplicating identical markup), live tier preview ✅ (Task 3), sanctioned-equipment picker ✅ (Task 4), committee section for the 2L-25L tier ✅ (Tasks 3, 4), indent list/detail on the project page ✅ (Task 5), `ApprovalTimeline` reuse ✅ (Tasks 1, 6), bill-processing form ✅ (Task 6). The cross-project `/procurement` page (Task 7) goes beyond the spec's frontend section — it was added by the UI-structure decision recorded during planning, since the sidebar already routes there.
- **Type consistency**: `INDENT_TYPES[].apiSegment` (Task 2) is the single source of URL segments, used by every `procurementApi.js` function; components pass the `value` (`'Consumable'`), never a raw segment. `computeTierPreview`'s return values are keys of `PROCUREMENT_TIERS` plus the `'BiddingRequired'` sentinel, which both `IndentTierPreview` (Task 3) and `IndentForm`'s submit guard (Task 4) branch on.
- **Deliberate scope limit**: Task 7's "New Indent" button links to the project list rather than opening a project-picker modal. A picker would duplicate the budget-head/sanctioned-equipment context the project page already provides, for marginal benefit.
- **Task 1 is a prerequisite for Task 6**, not merely cleanup: `IndentDetailPage` renders both fixed components, so leaving them broken would fail that task's verification.
