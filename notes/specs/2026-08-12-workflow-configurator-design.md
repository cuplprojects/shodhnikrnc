# Phase 7 — Workflow Configurator (Spec)

Derived from BRD Prompt 0 ("Platform Foundation") and the shipped engine at
`API.Application/Workflow/WorkflowEngineService.cs`. Written before any code,
so the decisions below can be argued with before they cost anything.

---

## 1. Why this phase exists

BRD Prompt 0 specifies the workflow engine as configuration-driven:

> **Workflow step**: role, sequence order, action (Approve / Reject / Return),
> remarks, actor, timestamp.

> **Resubmission behavior is configurable per workflow definition** — the
> engine must support a "resubmit re-entry point" per workflow, not always
> restart at step 1.

What shipped in Phase 1, and what every phase since has ridden on, is a single
hardcoded chain serving all seven `RequestType` values:

```
Raised → SignedCopyUploaded → Assigned → Forwarded → ForwardedOSRC → ForwardedDR → Approved
```

Two consequences, both load-bearing:

**1. The stage chain is identical for every request type.** It lives in a
`static readonly IReadOnlyDictionary<WorkflowStage, WorkflowStage> ForwardChain`
plus `RequireStage` guards. Nothing keys off `RequestType` or `WorkflowPhase`,
even though `WorkflowInstance` stores both.

**2. Stage authorization is not in the engine at all.** It lives in
`[Authorize(Roles = "...")]` attributes on `WorkflowController` — compile-time
constants, identical for every request type. This is the important one: a
configurator keyed on `(RequestType, Phase)` changes nothing at runtime while
"who may approve" is a string baked into an attribute. **Making the route data
without moving authorization into the engine produces a configurator that
edits rows nobody reads.**

### Divergence from the BRD today

| Module | BRD chain | Shipped chain |
|---|---|---|
| Fellowship / Leave / NOC | `PI → HOD → Dean` | office escalation (5 stages) |
| ID card | `Library → PI → HOD → Dean` | office escalation |
| Proposal | `PI → HOD → RnC Office → Dealing Assistant → Superintendent → DR → Dean` | office escalation |
| Procurement | amount-banded (≤₹1L Dean, ₹1–2L Director) | office escalation, no bands |
| Consultancy | amount-based authority | not yet built |

`HOD` and `PI` are not seeded roles. `WorkflowAction` has no `Return`.

This phase does **not** correct those chains. It makes correcting them a data
change instead of a code change. See §7.

---

## 2. Scope decision

Per the user: *"it should be configurable on the SuperAdmin's end so the
workflow should store the approval route."*

**In scope**
- `WorkflowDefinition` / `WorkflowStageDefinition` tables — the stored route.
- Engine reads the route from the database instead of the static dictionary.
- Stage-level role authorization moves out of `[Authorize]` into the engine.
- A `SuperAdmin` role, and admin endpoints + UI to edit definitions.
- Seed the **current** chain for all seven request types, so behaviour on day
  one is byte-identical.

**Explicitly out of scope** (deliberate, to keep the blast radius honest)
- Correcting any module's chain to the BRD. That is a per-slice data change
  once this lands, and each deserves its own verification.
- Amount-banded routing. Needs a condition model on stage rows; noted in §8.
- `Return` / resubmit re-entry. Needs a new `WorkflowAction` value and re-entry
  column; noted in §8.
- Data scoping (PI-owner / department / institute-wide). Separate BRD concern.

---

## 3. Domain model

```
WorkflowDefinition
  Id                Guid
  RequestType       RequestType     ┐ unique together
  Phase             WorkflowPhase   ┘
  Name              string          e.g. "Consumable indent (office escalation)"
  IsActive          bool
  CreatedAt         DateTimeOffset
  UpdatedAt         DateTimeOffset?

WorkflowStageDefinition
  Id                    Guid
  WorkflowDefinitionId  Guid
  Sequence              int             1-based, contiguous, unique per definition
  Stage                 WorkflowStage
  AllowedRoles          string          comma-separated; the roles that may act here
  IsInitial             bool            exactly one per definition
  IsTerminal            bool
  CanApprove            bool            may conclude from this stage
  CanReject             bool
```

### Why `(RequestType, Phase)` is the key

`WorkflowInstance` already carries both, and Travel already raises two
instances for one request (`Indent` and `Bill` phases,
`TravelRequestService.cs:106` and `:210`). Keying on `RequestType` alone would
force a travel bill and a travel indent to share a route, which they should not.

### Why `AllowedRoles` is a delimited string

A join table is the textbook answer. It is not worth it here: the list is
short, always read whole, never queried by role, and the rest of the codebase
already carries role sets this way (`FellowshipService.HraOverrideRoles`).
Revisit if role-based queries ever appear.

### `RequestType` remains append-only

Persisted as ints on `WorkflowInstance`. Definitions key off the same enum, so
the existing constraint holds unchanged and must be restated in the entity's
doc comment.

---

## 4. Engine changes

`WorkflowEngineService` gains a definition lookup, cached per
`(RequestType, Phase)` for the request's lifetime.

```
ForwardAsync(instanceId, actorUserId, actorRoles, remarks)
  1. load instance
  2. load definition for (instance.RequestType, instance.Phase)
  3. find the stage row matching instance.CurrentStage
  4. assert actorRoles intersects that row's AllowedRoles   ← new
  5. next = the row at Sequence + 1                          ← replaces ForwardChain
  6. move, append step, save
```

`ApproveAsync` / `RejectAsync` check `CanApprove` / `CanReject` on the current
stage row rather than the hardcoded `DecisionStages` set added in `77985fe`.

**Interface change.** Every engine method that acts on an instance takes the
actor's roles:

```csharp
Task ForwardAsync(Guid id, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
                  string? remarks, CancellationToken ct = default);
```

This is the breaking change. It touches `IWorkflowEngineService`, the engine,
`WorkflowController`, and every caller in Fellowship, Leave, Travel,
Recruitment and Procurement.

**Failure mode to design for:** an instance whose `CurrentStage` has no row in
its definition — possible if a SuperAdmin removes a stage while instances sit
on it. The engine must throw a clear `WorkflowConfigurationException` naming
the definition and stage, never silently stall. §6 covers prevention.

### Authorization: engine, not attributes

Controller attributes become a coarse gate (`[Authorize]`, authenticated only);
the engine makes the real decision from the stage row. Two reasons rather than
one: the check must be data-driven to be configurable at all, and centralising
it means a new caller cannot forget it — today a service calling the engine
directly bypasses the controller's attribute entirely.

`WorkflowAuthorizationException` → **403**, wired into the existing middleware
alongside the ~25 types already mapped.

---

## 5. Seeding: behaviour must not change on day one

Seven definitions × `Indent`, plus Travel `Bill`, each reproducing the current
chain exactly:

| Seq | Stage | AllowedRoles | CanApprove | CanReject |
|---|---|---|---|---|
| 1 | Raised | *(raiser)* | ✗ | ✗ |
| 2 | SignedCopyUploaded | Dean | ✗ | ✗ |
| 3 | Assigned | RegularStaff, Superintendent, DeputyRegistrar | ✗ | ✗ |
| 4 | Forwarded | RegularStaff, Superintendent, DeputyRegistrar | ✗ | ✗ |
| 5 | ForwardedOSRC | RegularStaff, Superintendent, DeputyRegistrar | ✗ | ✗ |
| 6 | ForwardedDR | Dean, Director | ✓ | ✓ |
| 7 | Director | Director | ✓ | ✓ |

Roles are transcribed from the current `[Authorize]` attributes, not invented:
Assign is `Dean`, Forward is `RegularStaff,Superintendent,DeputyRegistrar`,
Approve is `Dean,Director` and Reject is `Dean,Director,Superintendent,DeputyRegistrar`
(both after `77985fe`).

**Correction to an earlier draft of this table.** It listed one role per
forwarding stage — Superintendent at `Forwarded`, DeputyRegistrar at
`ForwardedOSRC`. That is not what ships. `Forward` is one action guarded by one
attribute, and it cannot distinguish which stage it is forwarding *from*, so all
three forwarding stages (`Assigned`, `Forwarded`, `ForwardedOSRC`) accept the
same three roles. Seeding the narrower table would have refused a `RegularStaff`
user forwarding from `Forwarded`, which works today — a behaviour change on day
one, which is exactly what this phase must not do. The tightening may well be
desirable, but it is a configuration change to make deliberately after the
engine reads from the table, not smuggled in with the seed.

`CanApprove` and `CanReject` are true only at `ForwardedDR` and `Director`,
because `ApproveAsync` and `RejectAsync` both call `RequireDecisionStage`, whose
set is exactly those two. Note the consequence for the Reject attribute:
`Superintendent` and `DeputyRegistrar` appear in `[Authorize(Roles = ...)]` on
Reject but cannot reach any stage where the engine permits it, so those two role
entries are unreachable today. The seed captures the stage-level truth, not the
attribute's aspiration. Whether those roles *should* be able to reject earlier is
a real question for the BRD chains work — deliberately not answered here.

**The regression bar:** the existing 250 tests must pass **unmodified** against
the seeded definitions. Any test needing a change means the seed diverges from
shipped behaviour — that is a seed bug, not a test to update.

Seeding runs as an idempotent EF migration, matching the project's convention
of applying migrations manually via `dotnet ef database update`. The app never
calls `Database.Migrate()`.

---

## 6. SuperAdmin surface

New `SuperAdmin` role, seeded. Distinct from `Dean`/`Director`: this is
"configure the institute's processes", not "approve this request."

```
GET    /api/admin/workflow-definitions
GET    /api/admin/workflow-definitions/{id}
PUT    /api/admin/workflow-definitions/{id}      replaces the stage list wholesale
POST   /api/admin/workflow-definitions/{id}/validate
```

All `[Authorize(Roles = "SuperAdmin")]`.

`PUT` replaces the whole stage list in one transaction rather than exposing
per-stage CRUD — a route is only meaningful as a complete sequence, and partial
edits invite exactly the orphaned-stage failure §4 describes.

### Validation (rejected with 400, never persisted)

1. Sequences contiguous from 1, no gaps or duplicates.
2. Exactly one `IsInitial`.
3. At least one stage with `CanApprove`.
4. Every `AllowedRoles` entry is a real role.
5. No stage removed while a live instance sits on it — checked against
   `WorkflowInstances` in non-terminal stages, and the error names the count.

Rule 5 is the one that matters operationally: it is the difference between a
configurator and a foot-gun.

### UI

`/admin/workflows` — list of definitions, and an editor showing the stage
sequence with role pickers. Read-only preview of the resulting chain. Sidebar
entry gated on `isSuperAdmin`.

---

## 7. What this unlocks

Once merged, correcting leave to the BRD's `PI → HOD → Dean` is: seed the `HOD`
and `PI` roles, then edit one definition. No engine change, no redeploy of
business logic, and each module's correction can be verified on its own.

---

## 8. Deferred, with reasons

| Item | Why deferred |
|---|---|
| Amount-banded routing | Needs a condition model (`MinAmount`/`MaxAmount` on stage rows) and a way to read the request's amount generically. Real work, orthogonal to storing a route. |
| `Return` + resubmit re-entry | New `WorkflowAction` value (append-only) and a `ResubmitEntrySequence` column. BRD Prompt 1 needs it; nothing shipped does yet. |
| Per-module BRD chains | Data changes, once this lands. Each needs its own verification against its slice. |
| Parallel / committee approvals | Recruitment's selection committee is modelled in its own service today. Folding it in needs a quorum concept. |
| Countdown timers | `WorkflowInstance.ExpiresAt` exists and is unused. Separate concern. |

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Engine signature change touches every slice | Compiler finds all call sites; the 250-test suite is the safety net. Sequenced first, before any behaviour change. |
| Seeded route drifts from shipped behaviour | The 250 tests must pass unmodified. §5. |
| SuperAdmin misconfigures a live workflow | Validation rules, especially rule 5. §6. |
| Instance stranded on a deleted stage | Prevented by rule 5; if reached anyway, throws a named exception rather than stalling. §4. |
| Role strings drift between seed and Identity | Validation rule 4 checks against `RoleManager`. |

---

## 10. Task sequence

1. Entities + `IApplicationDbContext` DbSets + configuration.
2. Migration (schema + idempotent seed of the current chain).
3. `IWorkflowDefinitionService` — load, cache, validate.
4. Engine reads definitions; signature gains `actorRoles`. **All 250 tests pass unmodified.**
5. Update every caller (Fellowship, Leave, Travel, Recruitment, Procurement).
6. Move authorization out of `[Authorize]`; map the new exception to 403.
7. `SuperAdmin` role + seed.
8. Admin endpoints + validation.
9. Admin UI + sidebar gating.
10. Verification: full suite, then live CDP walkthrough of one workflow end to end.
