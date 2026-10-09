# Design: Fellowship & Leave Vertical Slice (Phase 6)

## Status

Draft for review. Sixth of the phased Research Track build:

1. Platform Foundation — complete, merged to `main`.
2. Projects/Grants — complete, merged to `main`.
3. Procurement / Indent Management — complete, merged to `main`.
4. Travel Reimbursement — complete, merged to `main`.
5. Recruitment & Fellow Onboarding — complete, merged to `main`.
6. **Fellowship Claims & Leave Management** (this document).

## Scope decision

Covers **BRD A3 (fellowship) and A6 (leave)**. These belong together: leave taken
is reported on the fellowship claim, so building either alone would leave a
dangling reference.

**A4 (ID card) is already done.** Phase 5 issues ID card numbers as the gate this
slice consumes; nothing further is needed.

**A5 (NOC) stays out.** `PROMPTS/00-README.md` flags it as under-specified and
warns against guessing at build time, and nothing here depends on it.

## Sources

- **BRD**: `PROMPTS/03-research-track-fellowship-leave-id-card-noc.md`, sections
  A3 and A6.
- **Legacy**: `Old/Source_Code/generate_stipend_form.php`,
  `get_stipend_history.php`, `get_latest_stipend_form.php`, and the
  `stipend_recommendations` table in `Dump20260806.sql`.
- **Stakeholder direction (2026-08-12)** on the three points where the BRD is
  ambiguous — see D1, D2 and D3.

## Context

Phase 5 produced exactly what this slice needs:

- `ManpowerSelection` (table `FellowAppointments`) links `ApplicationUserId` to a
  `SanctionedManpowerPositionId`, and through it to a project.
- It carries `JoinedOn` / `ValidTill` (the tenure a claim must fall inside) and
  `RecommendedStipend` (the fellowship base).
- `IdCardIssuedAt` is the gate: **the leave module is blocked until the ID card
  has been issued** (Phase 5 spec D4).
- The `Fellow` role exists and is assigned on joining.

### What legacy actually does

`stipend_recommendations` is legacy's monthly claim: one row per fellow per
period, carrying `recommended_stipend`, `hra`, a generated `final_amount`, a
free-text remark, and a `file_path` to the generated stipend form.

It also carries three leave columns — `yearly_leaves`, `total_leaves_taken`,
`leaves_beyond_sanctioned` — and `generate_stipend_form.php` prints all three,
including "No. of days unauthorized absence from duty during the month".

**Nothing in legacy reduces the amount from those figures.** They are reported on
the form; the deduction, if any, is a human decision made offline. That is a
finding, not an omission: the BRD states no deduction rule either.

Legacy has **no leave request table at all**. Leave counts are typed onto the
stipend form by whoever prepares it. So A6 is built from the BRD alone.

## Decisions

### D1 — HRA is 20% by default, overridable by the Dean or Director

`HraAmount = FellowshipAmount * 0.20` is the default, derived server-side.

The BRD's "₹37,000 fellowship amount + 20% HRA" reads as a worked example, but
the percentage is the part that generalises, so it becomes the rule.

**The 20% is a default, not a constraint.** A **Dean or Director** may override
the HRA on a claim, supplying a reason. The override is recorded on the claim
with who set it and why, so a figure that differs from the computed default is
always explained and attributable.

This resolves what would otherwise be a silent disagreement between the computed
20% and `SanctionedManpowerPosition.Hra`. Rather than picking one source and
hoping it is right everywhere, the divergence becomes an explicit, authorised act:

```
HraAmount        = HraOverrideAmount ?? (FellowshipAmount * 0.20)
HraIsOverridden  = HraOverrideAmount is not null
```

`SanctionedManpowerPosition.Hra` is still not read automatically — it is shown
alongside the computed default on the claim so the approver can see when the two
disagree and override deliberately.

**This requires a `Director` role, which does not exist.** The workflow engine
already has a `ForwardToDirector` action and a `Director` stage, and the Dean can
forward to it, but no role was ever created — so nobody can currently act as
Director on anything. This slice adds it (see D8).

### D2 — Leave is reported on the claim, never deducted automatically

The claim surfaces entitlement used, remaining balance, and any unauthorised
absence. The PI enters the recommended amount.

The portal does **not** silently reduce anyone's pay. Neither the BRD nor legacy
specifies a deduction formula, so computing one would be invented policy with a
direct financial effect on a person. Legacy's own form prints the figures next to
a human-entered amount; this preserves that division of labour.

### D3 — One claim per fellow per month, no filing-date lock

Uniqueness is enforced on `(FellowAppointmentId, ClaimYear, ClaimMonth)`. A claim
may be raised at any time.

The BRD's "on the 31st of every month" is read as describing the monthly cycle
rather than a filing deadline — taken literally it is unsatisfiable in February
and in 30-day months. The claim still *covers* a whole calendar month, which is
the substantive part.

### D4 — The ID card gate is enforced server-side, on both modules

Phase 5 set `IdCardIssuedAt`. Every fellowship and leave endpoint checks it and
throws `IdCardNotIssuedException` when unset. Not merely hidden in the UI —
Phase 5's D4 promised the gate and this is where it binds.

### D5 — Fellow scoping gets its own helper, not `LoadOwnedProjectAsync`

Every existing service scopes by `project.OwnerUserId == requestingUserId`, which
is a *PI owns project* test. **A fellow owns no project.** Fellow-facing
endpoints resolve the caller's `ManpowerSelection` and scope to that.

Phase 5's spec flagged this; Phase 6 is where it is actually needed, since this is
the first slice where a fellow calls anything. Getting it wrong would let one
fellow read another's claims, so it gets direct negative tests.

### D6 — Leave entitlement is per fellow, per type, per project year

`LeaveEntitlement` rows are created on first use rather than seeded at joining:
a fellow who never takes leave needs no row. Annual = 30 days, Special = 15 days
(conference participation), from the BRD's table.

"Year" means **project year** computed from `JoinedOn`, not the calendar year —
a fellow joining in October should not have their annual entitlement reset in
January. `IProjectYearCalculator` already exists for the equivalent budget
question.

### D8 — The `Director` role is created here

Phase 1 built a `Director` workflow stage and a `ForwardToDirector` action
restricted to the Dean, but never seeded a `Director` role. The consequence is
live today: a request forwarded to the Director cannot be acted on, because no
account can hold that role.

This slice adds `Director` to the seeded roles, since D1's override needs it. The
role is deliberately *not* given the Dean's other permissions — it exists to act
at the Director stage and to authorise an HRA override.

Fixing the wider gap (letting the Director approve or reject at their stage
across procurement, travel and recruitment) is **out of scope here**: it changes
behaviour in four earlier slices and deserves its own change. Recorded so the
remaining gap is known rather than assumed closed.

### D7 — Both use the workflow engine with the same PI → HOD → Dean chain

The BRD gives both A3 and A6 the same approval flow. Phase 1's engine already
implements a 5-stage escalation, so both raise a `WorkflowInstance` exactly as
procurement, travel and recruitment do.

New `RequestType` values: `FellowshipClaim`, `LeaveRequest`.

## Data Model

```
FellowshipClaim
  Id, FellowAppointmentId, WorkflowInstanceId
  ClaimYear, ClaimMonth              -- unique together with the appointment
  FellowshipAmount                   -- from the appointment's RecommendedStipend
  HraAmount                          -- 20% default, or the override (D1)
  HraClaimed              bool       -- HRA slip is mandatory when true
  -- D1 override: set only by a Dean or Director, always with a reason
  HraOverrideAmount       decimal?
  HraOverrideReason       string?
  HraOverriddenByUserId   Guid?
  HraOverriddenAt         DateTimeOffset?
  TotalAmount                        -- derived, persisted
  -- reported, never used to reduce the amount (D2)
  LeaveDaysTakenThisMonth int
  UnauthorisedAbsenceDays int
  Remarks?
  RecommendedAmount?      decimal?   -- the PI's figure, entered not computed
  CreatedAt

LeaveRequest
  Id, FellowAppointmentId, WorkflowInstanceId
  LeaveType               (Annual | Special)
  FromDate, ToDate
  DayCount                           -- derived, inclusive
  Purpose                            -- required for Special (conference)
  CreatedAt

LeaveEntitlement
  Id, FellowAppointmentId
  LeaveType, ProjectYear
  EntitledDays                       -- 30 annual, 15 special
  ConsumedDays                       -- advanced only on approval
```

New `DocumentKind` values (append-only): `HraSlip`. `StipendForm` already exists
and covers the generated claim form.

New `RequestType` values (append-only): `FellowshipClaim`, `LeaveRequest`.

New role: `Director` (D8).

## Validation Rules

| Rule | Where | Source |
|------|-------|--------|
| **ID card must be issued** | both services | Phase 5 D4 |
| HRA slip required when HRA is claimed | `RaiseClaimAsync` | BRD A3 |
| One claim per fellow per month | `RaiseClaimAsync` | D3 |
| Claim month must fall inside the tenure | `RaiseClaimAsync` | derived |
| **Leave cannot exceed remaining entitlement** | `RaiseLeaveAsync` | BRD A6 |
| `ToDate >= FromDate` | `RaiseLeaveAsync` | derived |
| Leave must fall inside the tenure | `RaiseLeaveAsync` | derived |
| Purpose required for Special leave | `RaiseLeaveAsync` | BRD A6 |
| Entitlement consumed only on approval | workflow callback | derived |
| A fellow sees only their own records | fellow scoping helper (D5) | derived |
| **HRA override requires the Dean or Director role** | `OverrideHraAsync` | stakeholder (D1) |
| **An override requires a reason** | `OverrideHraAsync` | D1 — an unexplained figure is not auditable |
| Override rejected once the claim is approved | `OverrideHraAsync` | derived — changing a paid amount after approval needs a fresh claim |
| Override amount must be non-negative | `OverrideHraAsync` | derived |

## Scope

### In

Fellowship claims with the HRA slip requirement and the generated stipend form;
the Dean/Director HRA override with its reason and audit trail; the `Director`
role; leave requests with entitlement tracking and a balance view; both approved
through the existing PI → HOD → Dean workflow; the ID card gate; a fellow
dashboard showing claims, leave and remaining balance; and PI/office approval
queues.

### Out

- **NOC (A5)** — under-specified; needs stakeholder input.
- **Automatic pay deduction** (D2) — reported only.
- **Resignation / termination** — legacy's `manpower_status_history`. Ends a
  fellowship rather than being part of one, and the BRD gives no rules.
- **Notification emails.** `IEmailSender` exists from Phase 5, but the BRD's
  approval-notification messages are not wired here.
- **Letting the Director act at the `Director` workflow stage.** D8 creates the
  role but does not give it approve/reject rights across procurement, travel and
  recruitment. That changes behaviour in four shipped slices and belongs in its
  own change.

## Risks

- **D1's override is a pay-affecting privilege.** A Dean or Director can change
  the HRA on a claim, so the authorisation check and the recorded reason are the
  controls that keep it accountable. Both get direct tests. The 20% default no
  longer risks a *silent* disagreement with the sanction — the sanctioned figure
  is displayed next to the computed one so an approver can see a mismatch — but
  it does still mean the default is wrong for any project sanctioned at another
  rate, and someone must notice and override.
- **Fellow scoping is new ground.** This is the first slice where a non-PI role
  reads project-linked data. A mistake leaks one fellow's financial and leave
  records to another, so it warrants direct tests rather than trust in the
  surrounding pattern.
- **Entitlement consumption timing.** Advancing `ConsumedDays` at raise would let
  a rejected request permanently reduce a balance; advancing at approval means a
  fellow can raise overlapping requests that individually fit. This spec advances
  on approval and validates against *approved plus pending* — stated here because
  it is the kind of thing that silently goes wrong.
- **`RequestType` is persisted as an int.** The two new values must be appended,
  never inserted, or existing workflow rows change meaning.

## Open Questions

1. Should an HRA override apply only to the claim it was set on, or persist as
   the fellow's rate for subsequent months? This spec scopes it to the single
   claim, since that is the smaller commitment and a recurring rate looks more
   like a correction to the sanction than a claim-time decision.
2. Does an unapproved claim block the next month's claim, or can a fellow have
   several pending at once? This spec allows several; only same-month duplicates
   are refused.
3. Who records unauthorised absence — the fellow, or the PI at approval time?
   This spec has the fellow declare it and the PI adjust the recommended amount,
   mirroring how legacy's form was filled.
