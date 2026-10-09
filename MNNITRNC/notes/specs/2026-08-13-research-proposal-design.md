# Phase 9 — Research Proposal & Approval Chain (Spec)

BRD Prompt 1 / §A1. Derived from the BRD and from what Phase 2 already shipped.

Scope confirmed with the user:
- **Proposal and its approval chain.** An approved proposal goes to the funding
  agency; **only if the agency sanctions money does it become a Project.**
- **`Return` and resubmit re-entry go into the Phase 7 configurator first**, not
  hardcoded for proposals.

---

## 1. This is not a gap in the BRD

The user described this as something "the BRD did not include, but the client
wants". It is Prompt 1, and the routing they described is close to verbatim:

> **Routing:** PI (prepares) → HOD (forwards) → RnC Office → received/assigned
> by Dean/DR(RNC) with date & time stamp → Dealing Assistant → Superintendent
> (checks & verifies) → DR → Dean (RNC) signs/approves.

It was skipped in the build order, not omitted from the spec. Phase 2 built
Projects and Grants — which is what a proposal *becomes* after sanction — so the
**post-sanction half of Prompt 1 already exists**.

| Prompt 1 deliverable | Status |
|---|---|
| `BudgetHead`, head-wise distribution | **built** (Phase 2) |
| Grant receipts / installments ledger | **built** as `GrantReceipt` (Phase 2) |
| Sanction data on the project | **built** — `SanctionNo`, `SanctionDate`, `Agency`, `TotalSanctioned` |
| `ResearchProposal` | missing |
| `ProposalDocument` | missing |
| The 8-step approval chain | missing |
| Resubmission bypassing the Dean | missing — deferred by Phase 7 |
| `BudgetRedistributionHistory` | missing, deferred here |

---

## 2. The lifecycle, corrected

The user's clarification changes the entity relationship, and it is the most
important thing in this spec:

```
PI drafts  →  internal approval chain  →  submitted to funding agency
                                                   │
                                   ┌───────────────┴───────────────┐
                              agency sanctions              agency declines
                                   │                               │
                          becomes a Project                 ends as Unfunded
```

**Internal approval does not create a Project.** Approval means the institute
endorses the proposal for submission; the money is not committed and may never
arrive. Some approved proposals will never become projects, and that is a normal
outcome rather than an error state.

The existing model already agrees: `Project` requires `SanctionNo` and
`TotalSanctioned`, neither of which exists until the agency responds. Creating a
Project at internal approval would mean inventing a sanction number.

### `ProposalStatus`

```
Draft            PI is still editing
UnderApproval    in the internal chain
Approved         endorsed internally, ready to submit externally
SubmittedToAgency  sent; awaiting the agency's decision
Sanctioned       agency funded it -> a Project exists
NotFunded        agency declined, or no response
Rejected         refused internally (Superintendent, DR or Dean)
Withdrawn        PI withdrew it
```

Appended-only if persisted as ints, as `RequestType` is.

---

## 3. Domain model

```
ResearchProposal
  Id, OwnerUserId (the PI), DepartmentId
  Title, Agency, AdvertisementReference
  ProposedAmount, OverheadAmount        -- overhead is mandatory per the BRD
  DurationMonths
  Status                ProposalStatus
  WorkflowInstanceId    Guid?           -- null while Draft
  SubmittedToAgencyOn   DateOnly?
  AgencyDecisionOn      DateOnly?
  ProjectId             Guid?           -- set only when Sanctioned
  CreatedAt, UpdatedAt

ProposalBudgetLine
  Id, ResearchProposalId
  HeadName, IsRecurring, Amount         -- mirrors BudgetHead's shape so the
                                        -- project can be created from it
ProposalDocument                        -- reuses the existing Document store
  handled via DocumentKind, not a new table
```

### Reuse rather than duplication

- **Documents** go through the existing `Document` entity and
  `IDocumentChecklistService`, with new `DocumentKind` values appended:
  `CoverLetter` (exists), `EndorsementCertificate`, `BudgetCopy`,
  `SupportingDocument`. The BRD's mandatory-document rule is then a checklist
  seed, exactly as Phase 3c does it — no new enforcement mechanism.
- **The approval chain** is a Phase 7 `WorkflowDefinition`, seeded as data. This
  is the first real use of the configurator for a chain that is not the office
  escalation.
- **On sanction**, `ProposalBudgetLine` rows become `BudgetHead` rows on the new
  Project, and the proposal's `ProjectId` is set. The proposal is retained, not
  migrated away — the approval history is the audit trail.

---

## 4. The approval chain, as configured data

Eight stages, per the BRD. Requires the `HOD` role (Phase 8 creates it) and
`WorkflowStage` values that do not exist yet.

| Seq | Stage | Roles | Notes |
|---|---|---|---|
| 1 | `Draft` | *(the PI)* | |
| 2 | `WithHOD` | HOD | forwards; department-scoped |
| 3 | `WithRnCOffice` | RegularStaff, Superintendent, DeputyRegistrar | received, timestamped |
| 4 | `AssignedToDealingAssistant` | RegularStaff | **resubmit re-entry point** |
| 5 | `WithSuperintendent` | Superintendent | checks & verifies; may reject |
| 6 | `WithDeputyRegistrar` | DeputyRegistrar | may reject |
| 7 | `WithDean` | Dean | signs/approves; may reject |
| 8 | `Approved` | — | terminal |

`WorkflowStage` gains `Draft`, `WithHOD`, `WithRnCOffice`,
`AssignedToDealingAssistant`, `WithSuperintendent`, `WithDeputyRegistrar`,
`WithDean` — **appended, never inserted**, since the enum persists as ints and
reordering would repoint every existing workflow row.

### Resubmission

BRD: *"a resubmitted proposal goes directly to the Dealing Assistant — it must
NOT re-enter at the Dean step."*

Phase 7 deferred this. Per the user, it goes into the **configurator**, not into
the proposal service:

```
WorkflowAction.Return                    (appended)
WorkflowDefinition.ResubmitEntrySequence int?   -- null = restart at step 1
```

The proposal route sets it to 4. Every other route leaves it null and is
unaffected. This is what BRD Prompt 0 asked for — *"resubmission behavior is
configurable per workflow definition"* — and it benefits every later workflow
rather than only this one.

---

## 5. Department scoping

The HOD stage is department-scoped: an HOD forwards **their own department's**
proposals. That depends on Phase 8's `Department` entity and
`ApplicationUser.DepartmentId`.

**Sequencing consequence:** either Phase 8 lands first, or this phase carries
`ResearchProposal.DepartmentId` and the HOD queue filters on it directly, with
the general scoping model arriving later. The second is workable but means one
hand-rolled filter to replace afterwards.

---

## 6. Out of scope

- **`GrantSanctionOrder` / `PaymentInstallment` as new entities.** Phase 2's
  `GrantReceipt` already models installments against a project; adding parallel
  entities would need reconciling rather than adding. Revisit only if
  `GrantReceipt` proves insufficient.
- **`BudgetRedistributionHistory`.** Real BRD requirement, but it is about
  editing a *project's* budget after sanction — adjacent to this phase, not part
  of it.
- **Expiry countdown.** `WorkflowInstance.ExpiresAt` exists and is unused;
  wiring it is its own change and applies to every workflow.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Approval mistaken for funding | `Status` distinguishes `Approved` from `Sanctioned`; `ProjectId` stays null until the agency funds it |
| `WorkflowStage` reordered | Appended only; stated on the enum and in the seed |
| Return added to the engine breaks shipped routes | `ResubmitEntrySequence` null = today's behaviour; the 309-test bar applies |
| The 8-step chain diverges from the office escalation | It is a separate `WorkflowDefinition`; nothing shared changes |
| HOD scoping without Phase 8 | Either sequence Phase 8 first or carry `DepartmentId` locally and replace the filter later — decided before Task 1 |
