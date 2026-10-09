# Design: Recruitment & Fellow Onboarding Vertical Slice (Phase 5)

## Status

Draft for review. Fifth of the phased Research Track build:

1. Platform Foundation — complete, merged to `main`.
2. Projects/Grants — complete, merged to `main`.
3. Procurement / Indent Management — complete, merged to `main`.
4. Travel Reimbursement — complete, merged to `main`.
5. **Recruitment & Fellow Onboarding** (this document).
6. Fellowship Claims / Leave Management — future.

## Scope decision

The roadmap's fifth entry reads "Manpower/Recruitment/Fellowship", spanning two
BRD prompts and ~15 entities. This slice covers **BRD A2 (recruitment) plus the
applicant/fellow identity layer and ID card issuance**, ending at the point where
a joined fellow holds an issued ID card.

That boundary is deliberate: fellowship claims and leave (Phase 6) are raised *by
the fellow about themselves*, so they cannot exist without a fellow identity.
Phase 5's job is to produce that identity; Phase 6 consumes it.

**NOC (BRD A5) stays out of both phases** until stakeholders clarify it —
`PROMPTS/00-README.md` explicitly flags it as under-specified and warns against
guessing at build time.

## Sources

- **BRD**: `PROMPTS/02-research-track-recruitment-workflow.md` (A2); ID card
  rules from `PROMPTS/03-...` (A4).
- **Legacy**: `generate_advertisement.php`, `generate_screening_proforma.php`,
  `generate_minutes_proforma.php`, `generate_manpower_offer_letter.php`,
  `office_generate_offer_letter.php`, `create_faculty_user.php`, and the
  `manpower`, `manpower_process`, `manpower_selections`, `manpower_activities`,
  `offer_letters`, `dean_approvals_manpower` tables in `Dump20260806.sql`.
- **Stakeholder direction (2026-08-11)**, which supersedes both where they
  conflict — see "Applicant identity" below.
- **Existing scaffolds**: `GenerateAdvertisementModal`,
  `GenerateScreeningProformaModal`, `GenerateOfferLetterModal`,
  `RecommendStipendModal`, `UpdateCandidateStatusModal` — all built against no
  backend.

## Context

`SanctionedManpowerPosition` exists from Phase 2 and is the anchor: recruitment
fills sanctioned positions. `RequestType.ManpowerDocument` exists from Phase 1.
ASP.NET Identity is configured with five roles — `Faculty`, `RegularStaff`,
`Superintendent`, `DeputyRegistrar`, `Dean` — and `ApplicationUser` carries only
`FullName`.

### Applicant identity (stakeholder direction)

This is the part neither source describes, and it reframes the slice:

> People apply through a recruitment portal and therefore need login credentials
> from the point of registration. Applicants who are not selected are soft
> deleted; if they later apply to a different project they are reactivated and go
> through that project's cycle again. Selected applicants get an offer letter,
> then an ID card is issued, and then they gain access to the leave module.

Two consequences:

1. **Credentials precede screening**, they do not follow selection. An earlier
   draft of this spec scoped the candidate portal *out* on the grounds that no
   candidate authentication existed. That was backwards — self-registration is
   the entry point to the entire flow.
2. **Applicant identity is project-independent.** Only the *application* is
   project-scoped. One person, many applications over time.

### What legacy actually does

Legacy is **document-driven, not state-driven**. `manpower_process` carries a
ten-value `document_type` enum (`advertisement`, `screening_proforma`,
`shortlisted_candidates`, `selection_nomination`, `joining_letter`,
`id_card_form`, `resignation_termination`, `waiting_list`, `stipend_form`,
`minutes_of_selection`) plus the `assigned_to` / `*_remarks` routing columns that
Phase 1's workflow engine replaced everywhere else.

`manpower_selections` holds the *hired* person — personal, bank and tenure
details — and is what travel's `ManpowerId` conceptually points at.
`offer_letters` is a separate snapshot table with its own field set.

Legacy has **no applicant accounts at all**: `create_faculty_user.php` provisions
faculty only, and applicants exist purely as rows someone typed in.

### Where the BRD adds rules legacy never implemented

1. **Committee composition.** Screening = PI (Chairman) + Co-PI + one
   Dean-nominated faculty. Selection = HOD (Chairman) + PI + two nominees, one
   internal to the PI's department, one external at Associate Professor or above.
2. **Re-advertisement** when too few candidates apply — "a repeatable sub-state,
   not a one-time flag."
3. **Interview mode** offline by default, online only with prior Dean approval,
   per candidate.
4. **Merit list multi-signature** — all committee members sign before Dean
   approval.
5. **Offer letter blocked until payment received.**

Legacy implements none of these — the same pattern as Phase 3's budget rule and
Phase 4's taxi opt-in, where the BRD is the authority.

## Decisions

### D1 — Recruitment is a state machine, not a document pile

One `RecruitmentRequest` per sanctioned position with an explicit
`RecruitmentStage` (`Draft`, `Advertised`, `ScreeningInProgress`,
`SelectionScheduled`, `MeritListPrepared`, `Approved`, `OfferIssued`, `Joined`,
`Closed`). Generated documents hang off it in the existing `Document` store under
`ownerType = "RecruitmentRequest"`.

Rejected: porting `manpower_process.document_type` as the primary model. It makes
"what stage is this at" a query over document rows and re-implements routing the
workflow engine already provides.

### D2 — One account, many applications

`ApplicationUser` is created once at self-registration with role `Applicant` and
persists indefinitely. Each application is a separate `Candidate` row pointing at
both the user and a `RecruitmentRequest`.

Rejection sets `Candidate.Outcome = NotSelected` and deactivates the *account*
(`IsActive = false`) if the person holds no other live application. Applying
again reactivates it. The account is never hard-deleted, so cross-project history
is queryable — "has this person applied before, and what happened" is answerable.

Rejected: deactivate-and-revive without retaining application history. It answers
the reactivation question but loses the record of prior attempts, which is
exactly what a selection committee would want to see.

### D2a — Registration requires email verification; reapplication is prefill, not merge

Registration creates the account immediately with `EmailConfirmed = false`
(the column already exists on `ApplicationUser` via Identity). **Applying is
blocked until the address is confirmed** — the account exists, but
`ApplyAsync` throws `EmailNotVerifiedException` until then. Nothing is lost by
an abandoned verification; the applicant simply resolves it and applies.

Rejected: verifying before creating the account. Cleaner data, but it needs a
separate pending-registration store, and Identity already models the
unverified state.

**Reapplication flow.** When someone registers with an address that already
exists, the API does not error and does not create a second account. It reports
that the address is known and offers to seed the new application from the most
recent one:

```
POST /api/recruitment/applications
  { recruitmentRequestId, prefillFromCandidateId? }
```

- `prefillFromCandidateId` omitted → a blank application.
- supplied → personal details are **copied** from that candidate into the new row.

Either way the result is a **fresh `Candidate` row** against the new
`RecruitmentRequest`; the previous application is never mutated and remains as
history. Prefill is a convenience, not a link — this is why D2 keeps one account
with many applications rather than one mutable application record.

Reapplying also sets `ApplicationUser.IsActive = true`, reactivating an account
soft-deleted after an earlier rejection.

### D2b — Mail is a real SMTP sender behind an interface

`IEmailSender` in the application layer; `SmtpEmailSender` in infrastructure
using MailKit, reading an `Email` configuration section.

`appsettings.json` carries the section with **empty placeholder values** and is
committed; real host, credentials and from-address are supplied by the operator
in `appsettings.Development.json` or environment variables. No credential enters
source control.

Until that section is filled the verification mail cannot send, so registration
is the one flow that is not end-to-end verifiable in this slice. Everything
downstream of a confirmed address is unaffected.

### D3 — Role progresses: Applicant → Fellow

On joining, the user's role changes from `Applicant` to `Fellow` and a
`ManpowerSelection` row is created linking `ApplicationUser` ↔ position. Both
roles are new; neither reuses an existing office role, because a fellow must not
inherit `RegularStaff` permissions.

Scoping for every fellow-facing feature goes through `ManpowerSelection`, which
already carries `SanctionedManpowerPositionId` (→ `ProjectId`), `JoinedOn` /
`ValidTill` (tenure) and `RecommendedStipend` (the fellowship base). Putting
`ProjectId` directly on `ApplicationUser` was rejected as a second source of
truth that can drift.

Note this differs from every existing service, which scopes via
`project.OwnerUserId == requestingUserId` — a *PI owns project* check. A fellow
owns no project, so fellow-facing endpoints need their own scoping helper rather
than reusing `LoadOwnedProjectAsync`.

### D4 — Module access is staged and server-enforced

Access unlocks in sequence, matching the stakeholder description literally:

| Reached | Unlocks |
|---------|---------|
| `Candidate.IsSelected` | view the offer letter |
| `ManpowerSelection` exists (joined) | fellow portal, ID card request |
| `ManpowerSelection.IdCardIssuedAt` set | **leave module (Phase 6)** |

Each gate is checked server-side, not merely hidden in the UI. A fellow whose ID
card has not been issued gets `IdCardNotIssuedException` from any leave endpoint.
Phase 6 consumes this gate; Phase 5 establishes it.

### D5 — Committee composition is validated, not merely stored

`CommitteeMember` rows carry `CommitteeKind` (`Screening` | `Selection`) and a
role. The service enforces the BRD's composition on submission: screening needs
one Chairman plus the Co-PI and a nominated faculty; selection needs one Chairman
(HOD), the PI, and exactly two nominees of which at least one is external.

Phase 3 set the storage precedent with `ProcurementCommitteeMember`, but there the
roster was print-only. Here the BRD states composition rules, so they bind.

### D6 — Re-advertisement is a counter plus history, not a flag

`RecruitmentRequest.AdvertisementRound` (starts at 1) with one `Advertisement`
row per round; re-advertising increments it and returns the stage to
`Advertised`. This satisfies "repeatable sub-state, not a one-time flag" — a
boolean could not answer how many rounds ran, or when.

### D7 — The payment gate uses `GrantReceipt`, with its semantics flagged

Offer-letter issuance throws unless the project has at least one recorded
`GrantReceipt`.

**This still needs confirmation.** The BRD ties offers to Prompt 1's
*payment-installment status*. Phase 2 built `GrantReceipt` as a per-budget-head
receipt with `Type`/`ParentReceiptId`, not an installment schedule with
expected-vs-received tracking. "Payment has been received" is interpreted here as
"any grant receipt exists for the project" — the closest available signal, but
possibly weaker than intended. Legacy enforced nothing
(`generate_manpower_offer_letter.php` generates unconditionally), so there is no
legacy behaviour to preserve either way.

### D8 — Reuse the workflow engine for approval only

Merit-list approval (all members sign → Dean approves) runs through
`IWorkflowEngineService` with `RequestType.ManpowerDocument`, as procurement and
travel do. The rest of the lifecycle — advertising, screening, scheduling — is
recruitment's own stage machine, because those transitions have no office
escalation chain.

## Data Model

```
ApplicationUser                    (modify: identity link + soft delete)
  + IsActive            bool, default true

RecruitmentRequest
  Id, ProjectId, SanctionedManpowerPositionId, WorkflowInstanceId?
  Stage                 (RecruitmentStage)
  AdvertisementRound    int, starts at 1
  InterviewDate?, InterviewVenue?
  CreatedAt

Advertisement
  Id, RecruitmentRequestId, Round
  PublishedOn, ClosingDate, Text
  CandidateCountAtClose?          -- drives the re-advertisement decision

Candidate                          -- one per application, not per person
  Id, RecruitmentRequestId, ApplicationUserId
  -- personal details, carried forward by prefill on reapplication (D2a)
  FullName, Mobile, Qualification?, Experience?
  ScreeningResult?      (Eligible | Ineligible)
  InterviewMode         (Offline default | Online)
  OnlineModeApprovedByUserId?
  MeritRank?
  Outcome               (Pending | NotSelected | Selected)
  PrefilledFromCandidateId?       -- provenance, not a dependency
  AppliedAt

CommitteeMember
  Id, RecruitmentRequestId
  Kind                  (Screening | Selection)
  Role                  (Chairman | PrincipalInvestigator | CoPrincipalInvestigator
                         | NominatedFaculty | InternalNominee | ExternalNominee)
  Name, Department, Position
  IsExternal            bool
  AvailabilityDate?
  SignedMeritListAt?              -- the multi-signature requirement

ManpowerSelection                  -- created on joining; the fellow record
  Id, CandidateId, ApplicationUserId, SanctionedManpowerPositionId
  AadharNo, PanNo, BankAccountNo, IfscCode, Dob, Gender
  JoinedOn, ValidTill, RecommendedStipend
  IdCardNumber?, IdCardIssuedAt?  -- D4's gate for Phase 6
  Status                (Active | Inactive)
```

New `DocumentKind` values (appended, never reordered): `MinutesOfSelection`,
`MeritList`, `JoiningLetter`, `IdCard`. `Advertisement`, `OfferLetter`,
`StipendForm` and `Proforma` already exist — the last covers the screening
proforma.

New roles: `Applicant`, `Fellow`.

## Validation Rules

| Rule | Where | Source |
|------|-------|--------|
| Screening committee composition | `SubmitScreeningCommitteeAsync` | BRD A2 |
| Selection: 1 Chairman, PI, exactly 2 nominees, ≥1 external | `SubmitSelectionCommitteeAsync` | BRD A2 |
| Online interview mode requires Dean approval | `SetInterviewModeAsync` | BRD A2 |
| All committee members signed before Dean approval | `ApproveMeritListAsync` | BRD A2 |
| Offer letter blocked until a grant receipt exists | `IssueOfferLetterAsync` | BRD A2 (D7) |
| Leave module blocked until ID card issued | Phase 6 endpoints | stakeholder (D4) |
| Re-advertisement only from `Advertised` | `ReadvertiseAsync` | derived |
| One selected candidate per position | `SelectCandidateAsync` | derived |
| Merit rank unique within a request | `SubmitMeritListAsync` | derived |
| Applicant cannot hold two live applications to one request | `ApplyAsync` | derived |
| **Applying blocked until email is verified** | `ApplyAsync` | stakeholder (D2a) |
| Prefill source must belong to the same applicant | `ApplyAsync` | derived (D2a) |

## Scope

### In

Self-registration with email verification; applicant accounts; soft delete,
reactivation and prefilled reapplication;
advertisement and re-advertisement rounds; applications; screening committee and
results; selection committee with nominee availability; interview scheduling and
per-candidate mode; merit list with multi-signature; Dean approval via the
workflow engine; offer letter (payment-gated); joining, the `Fellow` role and
`ManpowerSelection`; ID card issuance; generated documents throughout; and
rewiring the five scaffolded modals to the real API.

### Out

- **Fellowship claims and leave management** — Phase 6, gated on D4's ID card.
- **NOC** — under-specified in the BRD; needs stakeholder input first.
- **BRD notification emails.** `IEmailSender` is built for verification (D2b),
  but the BRD's committee-invitation and interview-mode notification mails are
  not wired in this slice. The seam exists; the messages do not.
- **Resignation/termination** (`manpower_status_history`) — post-employment,
  belongs with Phase 6.
- **Waiting list** — a legacy `document_type` value with no BRD rules attached.

## Risks

- **D7's payment gate may be the wrong rule.** Still the highest-value thing to
  confirm before shipping.
- **Public self-registration is a new attack surface.** Every existing endpoint
  is authenticated and PI-scoped; registration is by definition anonymous.
  Verification (D2a) blunts throwaway signups but does not solve enumeration:
  telling a caller "this address already exists" — which the reapplication flow
  requires — discloses who has registered. Registration and resend-verification
  both need rate limiting, and the existing-address response should be worded so
  it aids a genuine reapplicant without confirming an address to a stranger.
  Called out here so it is designed rather than discovered.
- **Fellow scoping bypasses `LoadOwnedProjectAsync`.** Per D3, fellow-facing
  endpoints need a distinct helper. Getting this wrong would let a fellow read
  another project's data, so it warrants direct tests rather than relying on the
  existing ownership pattern.
- **Slice size.** Larger than Phase 4 even after deferring Phase 6. The plan
  should split identity, recruitment backend, and frontend into separately
  verified tasks, as Phase 3 split 3b/3c/3d.
- **Travel's `ManpowerId` becomes improvable.** Travel currently prints a
  position `Designation` as the traveller name because no person record existed.
  Once `ManpowerSelection` exists it could name the actual person — a follow-up,
  deliberately not bundled here.

## Open Questions

1. **D7** — does "payment has been received" mean any grant receipt, or
   installment-level tracking that does not yet exist?
2. **SMTP configuration** — the `Email` section ships with empty placeholders
   (D2b). Registration cannot send until an operator fills in host, credentials
   and from-address.
3. Is the ID card number assigned by the office manually, or generated? Legacy's
   `id_card_form` was a document, not a numbering scheme. This spec assumes
   office-assigned, since legacy offers no generation rule to port.

*(Resolved 2026-08-11: applicants self-register with email verification; applying
is blocked until confirmed; reapplication offers prefill from a previous
application and produces a fresh Candidate row — see D2a.)*
