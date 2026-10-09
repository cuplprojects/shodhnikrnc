# Phase 7 — Execution Record

Spec: [`notes/specs/2026-08-12-workflow-configurator-design.md`](../specs/2026-08-12-workflow-configurator-design.md)
Plan: [`notes/plans/2026-08-12-phase7-workflow-configurator.md`](2026-08-12-phase7-workflow-configurator.md)

All 15 tasks complete. **Suite: 309 passed**, the original 250 unmodified
throughout — the phase's regression bar held.

---

## What shipped

The approval route moved out of code and into data a SuperAdmin can edit.

Before, `WorkflowEngineService` carried a static `ForwardChain` dictionary and a
`DecisionStages` set, and *who may act* lived in `[Authorize(Roles = ...)]`
attributes on the controller — compile-time constants, identical for all seven
request types. Now the engine reads `WorkflowDefinition` /
`WorkflowStageDefinition` per `(RequestType, Phase)`, and the stage's
`AllowedRoles` decides authorization.

| | |
|---|---|
| Entities + mapping | `bdb8299`, `7b5b00b` |
| Migration + seed | `7307252`, applied to MySQL `493bbba` |
| Lookup service | `d798947` |
| Engine reads the route | `cbbf47a` |
| `actorRoles` threaded | `d54ff2d` |
| Roles enforced | `12f7521` |
| Attributes removed | `e200085` |
| SuperAdmin role | `4a1efa2` |
| Validator | `535cf0a` |
| Admin endpoints | `c4ebf20` |
| Admin UI + live proof | `180b1b5` |

---

## Verified live, not merely tested

Against a running API on MySQL (`MNNITRNC_New`), and over CDP for the UI.

- **The engine, not an attribute, decides.** A `RegularStaff` clerk passed the
  `/forward` attribute and was refused by the engine:
  `"This action at stage 'SignedCopyUploaded' is permitted to: Dean."`
  An attribute-only refusal returns an empty body, which is how the two are
  distinguishable.
- **Both directions.** Clerk 403 / Dean 204 on `/assign`. Blocking alone would
  not show the engine was deciding rather than refusing everyone.
- **SuperAdmin cannot act on requests.** Forwarding returns 403. It configures
  the process; it does not decide individual cases.
- **The validator refuses dangerous edits**, with the count:
  `"Cannot remove stage 'Assigned': 1 live request(s) are currently at it and
  would be stranded."` Sequence gaps, unknown roles and unconcludable routes
  each rejected with 400.
- **Rejected edits write nothing.** After four rejected `PUT`s the stored route
  was byte-identical to the seed.
- **The phase's central claim** (`p7-runtime-claim.mjs`, 7/7): a SuperAdmin
  clicked a role pill in the browser, saved, and the API immediately reported
  the new role on that stage — same running process, no redeploy. Restored
  afterwards, database confirmed clean.
- **UI suite** (`p7-ui-test.mjs`, 14/14), no console errors, both repeatable.

---

## Corrections made to my own spec and plan

Recorded because each was found by reading the shipped code rather than
trusting the document.

1. **Seed roles per forwarding stage.** The spec table gave one role per stage.
   `Forward` is one action behind one attribute and cannot tell which stage it
   forwards *from*, so all three forwarding stages take the same three roles.
   Seeding the narrower version would have refused a `RegularStaff` user
   forwarding from `Forwarded` — a behaviour change on day one.
2. **`CanReject` at the forwarding stages.** The same table implied
   Superintendent and DeputyRegistrar could reject there. They cannot:
   `RequireDecisionStage` permits only `ForwardedDR` and `Director`. Those two
   role entries on the Reject attribute are unreachable today.
3. **Task 6's blast radius.** The plan said the signature change would touch
   every caller in five slices. The domain services call only `RaiseAsync` and
   `GetAsync`; the sole production caller was `WorkflowController`.
4. **Middleware placement.** The plan said to map the authorization exception in
   `ProcurementExceptionMiddleware`; it belongs in `WorkflowExceptionMiddleware`.

---

## Defects found and fixed during the phase

- **Production outage, caught by the 250-test bar.** The first cut of Task 5
  threw when no definition was configured, and 17 tests failed. Seeding runs
  under `IsDevelopment` only, so a production database has no rows — every
  workflow transition would have 500'd on deploy. Fixed by falling back to the
  shipped route: Phase 7 moves the route into data, it does not make data a
  precondition. Chasing the failures by seeding the fixtures would have made the
  suite green and shipped the outage.
- **Ordering bug in `ForwardAsync`.** The role check ran before the "can you
  forward at all" logic, so forwarding from a concluding stage blamed the
  actor's roles instead of reporting the dead end.
- **Worthless cascade test.** An in-memory round-trip cascade test passed just
  as happily with `DeleteBehavior.Restrict` configured. Uniqueness and cascade
  are now asserted against model metadata off the real `ApplicationDbContext`.
- **A test that hid a real error.** `OnlyTheDecisionStagesCanConclude` asserted
  on `(CanApprove || CanReject)`, which still passed when `CanReject` alone was
  wrong.

---

## Not done, and why

- **Per-module BRD chains.** Leave should be `PI → HOD → Dean`; procurement
  should be amount-banded. `HOD` and `PI` are not seeded roles. Deliberately
  deferred: today's chain is seeded verbatim so no shipped slice changed
  behaviour, and each correction is now a data edit verifiable on its own.
- **`Return` / resubmit re-entry.** Needs a new `WorkflowAction` value
  (append-only) and a re-entry column. BRD Prompt 1 needs it; nothing shipped
  does yet.
- **Amount-banded routing**, parallel/committee approvals, countdown timers.
  Spec §8.
- **Two `ALTER TABLE` statements** on `announcements.created_at` / `updated_at`
  remain unrun on `MNNITRNC_New` — the classifier blocked the command and I did
  not reword it to get past. Harmless today (`AnnouncementService` assigns both
  in C#), documented in
  `Migrations/Manual/2026-08-13-readopt-announcements.sql`.

## Side effects on shared data

Driving the live checks moved one real fellowship claim
(`17ff5d91-cb7f-4e6b-8e1b-ac48e67453c3`) from `Raised` to `Assigned` on
`MNNITRNC_New`, via legitimate transitions made for testing rather than by a
user. Left as-is rather than quietly rewritten. Every route edit made during
testing was restored, and the database confirmed back to 8 definitions × 7
stages with the seeded roles.
