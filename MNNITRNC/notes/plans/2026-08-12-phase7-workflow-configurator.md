# Phase 7 — Workflow Configurator (Implementation Plan)

Spec: [`notes/specs/2026-08-12-workflow-configurator-design.md`](../specs/2026-08-12-workflow-configurator-design.md)

Scope confirmed with the user:
- Stage-role authorization **moves into the engine** (not left in `[Authorize]`).
- Phase 7 ships the configurator only. Today's chain is seeded verbatim; no
  shipped slice changes behaviour. Correcting chains to the BRD is later, per slice.

Prerequisite already landed: `77985fe` — Director stage dead end fixed.

**The regression bar for the whole phase:** the existing 250 tests pass
**unmodified**. A test that needs changing means the seed diverges from shipped
behaviour — fix the seed, not the test.

---

## 7a — Domain and persistence

- [x] **Task 1 — Entities.**
  `API.Domain/Entities/WorkflowDefinition.cs`, `WorkflowStageDefinition.cs`
  per spec §3. Doc-comment `RequestType` as append-only on the definition entity.
  *Done: 5 tests on `AllowedRoleList()` parsing (trimming, stray commas, empty).
  Suite 255 — the 250 unmodified.*
- [x] **Task 2 — DbContext.**
  DbSets on `IApplicationDbContext` and `ApplicationDbContext`. Unique index on
  `(RequestType, Phase)`; unique `(WorkflowDefinitionId, Sequence)`; cascade
  delete stages with their definition. Add to the three test contexts.
  *Done: 7 tests. The uniqueness and cascade assertions read model metadata off
  the real `ApplicationDbContext` — the in-memory provider enforces neither, so
  a round-trip test passes even with the mapping broken, and `TestDbContext`
  declares its own minimal model with no indexes at all. Suite 262, the 250
  unmodified.*
- [x] **Task 3 — Migration + seed.**
  Schema, then an idempotent seed of the current chain (spec §5 table) for all
  seven `RequestType` values × `Indent`, plus Travel × `Bill`.
  Roles transcribed from the current `[Authorize]` attributes — not invented.
  Applied manually via `dotnet ef database update`; the app never calls
  `Database.Migrate()`.
  **Verify:** row counts per definition; re-running the seed is a no-op.
  *Done: `20260813080714_AddWorkflowDefinitions` (EF-generated, Designer +
  snapshot, `has-pending-model-changes` clean). Seed lives in
  `API.Application/Workflow/WorkflowDefinitionSeeder.cs`, not `DbSeeder` — the
  test project references Application but not the web host. 8 tests, verified by
  mutation. Suite 270, the 250 unmodified.*
  *__Applied to MySQL 2026-08-13__ (`MNNITRNC_New` on 192.168.1.27). Verified on
  the real database: both tables created; `(RequestType, Phase)` and
  `(WorkflowDefinitionId, Sequence)` both report `NON_UNIQUE 0`; the FK reports
  `DELETE_RULE = CASCADE`. Seeding via a Development startup produced exactly
  8 definitions x 7 stages = 56 rows, and a second startup left both counts
  unchanged, so the seed is idempotent against MySQL and not only in memory.
  The stored route matches the shipped chain including both spec corrections.*
  **Correction made here:** the spec's seed table listed one role per forwarding
  stage. That is not what ships — `Forward` is one action behind one attribute
  and cannot tell which stage it forwards from, so all three forwarding stages
  take the same three roles. Spec §5 updated.

## 7b — Engine reads the route

- [x] **Task 4 — `IWorkflowDefinitionService`.**
  Load by `(RequestType, Phase)`, cached per request. Throws
  `WorkflowConfigurationException` naming definition and stage when a stage row
  is missing for an instance's `CurrentStage`.
  *TDD: tests for lookup, cache hit, and the missing-stage throw first.*
  *Done: tests written first and confirmed failing on the absent type. 9 tests;
  the cache test verified by deleting the cache lookup, since EF's identity map
  could otherwise have made it pass on its own. `WorkflowConfigurationException`
  maps to 500 — a misconfigured route is an operator error, not a caller error.
  Suite 279, the 250 unmodified.*
- [x] **Task 5 — Engine consumes definitions.**
  Replace `ForwardChain` with `Sequence + 1`; replace the `DecisionStages` set
  with the stage row's `CanApprove` / `CanReject`.
  **Bar: all 250 tests pass unmodified.** This task changes no behaviour.
  *Done: both static tables removed. 5 new tests drive routes that differ from
  the shipped one, so they would fail against the old hardcoded chain. Suite 284,
  the 250 unmodified.*
  **Production defect found by the bar, not by inspection:** the first cut threw
  when no definition was configured, and 17 tests failed. Seeding runs in
  Development only (`Program.cs`), so a production database has no rows — every
  transition would have 500'd on deploy. The service now falls back to the
  shipped route, built from the same `ShippedRoute` the seeder uses. The route
  is moving into data; data is not a precondition for the engine working.
- [x] **Task 6 — Signature change.**
  Every instance-acting method gains `IReadOnlyCollection<string> actorRoles`.
  Update `IWorkflowEngineService`, the engine, and every caller: Fellowship,
  Leave, Travel, Recruitment, Procurement. Compiler finds them all.
  *Done. **The plan overstated the blast radius:** the domain services call only
  `RaiseAsync` and `GetAsync`, neither of which is stage-gated, so the sole
  production caller is `WorkflowController`. 64 test call sites updated, each
  passing the roles its stage actually requires (`TestRoles`), so they stay
  correct once Task 7 enforces them. Roles come from `ClaimTypes.Role`, the same
  claim `[Authorize(Roles=...)]` reads — the check cannot silently widen when it
  moves. Suite 284, unchanged from Task 5. Parameter threaded but not yet
  enforced; that is Task 7, kept separate so a refactor failure stays
  distinguishable from an authorization failure.*

## 7c — Authorization moves into the engine

- [x] **Task 7 — Enforce `AllowedRoles`.**
  Engine asserts the actor's roles intersect the stage row's `AllowedRoles`;
  throws `WorkflowAuthorizationException`.
  *TDD: permitted role passes, non-permitted role throws, empty roles throws.*
  *Done: 10 tests written first and confirmed failing on the absent type.
  Empty `AllowedRoles` means "not role-restricted", not "nobody" — the initial
  stage has none because it belongs to the raiser. Matching is case-insensitive
  (Identity is) and an intersection, not a superset test. `CancelAsync` is
  deliberately ungated. Mapped to 403. Suite 294.*
  **Ordering bug found by a failing test:** the role check initially ran before
  the "can you forward at all" logic, so forwarding from a concluding stage
  blamed the actor's roles instead of reporting the dead end. "Is this possible
  here" now precedes "may this actor do it".
  **Verified live:** a `RegularStaff` clerk passed the `/forward` attribute and
  was refused by the engine — `{"title":"Not permitted at this stage","detail":
  "This action at stage 'SignedCopyUploaded' is permitted to: Dean."}`. That is
  the stored route deciding, not an attribute.
- [x] **Task 8 — Controller + middleware.**
  `WorkflowController` attributes become coarse `[Authorize]`. Map
  `WorkflowAuthorizationException` → 403 and `WorkflowConfigurationException`
  → 500 in `ProcurementExceptionMiddleware` (already maps ~25 types).
  **Verify live:** a `RegularStaff` user is refused at a Dean-only stage with
  403, and a Dean succeeds — proving the engine, not an attribute, decided.
  *Done: five method-level role attributes removed; the class-level `[Authorize]`
  stays, so authentication is still required. `WorkflowAuthorizationException` was
  already mapped to 403 in Task 7 (in `WorkflowExceptionMiddleware`, not
  `ProcurementExceptionMiddleware` as the plan said). Suite 294.*
  *Verified live on `/assign`, the endpoint that previously short-circuited: a
  clerk now gets the engine's `{"title":"Not permitted at this stage","detail":
  "...permitted to: Dean."}` where it used to return an empty-bodied attribute
  403, and a Dean gets 204. Both directions, engine-decided.*

## 7d — SuperAdmin surface

- [x] **Task 9 — Role.** Seed `SuperAdmin` and a `superadmin` user.
  *Done and verified live: role created, user in it, JWT carries the SuperAdmin
  claim. Also confirmed SuperAdmin has NO workflow powers — forwarding a request
  returns 403 from the engine. It configures the process; it does not decide
  individual cases.*
- [x] **Task 10 — Validation service.** Spec §6 rules 1–5.
  *TDD each rule, especially rule 5 (no stage removed while live instances sit
  on it) — that rule is the difference between a configurator and a foot-gun.*
  *Done: 15 tests, written first and confirmed failing on the absent types.
  Rule 5 verified by mutation — disabling the live-instance check fails its test.
  All rules are evaluated together rather than short-circuiting, so an operator
  sees every problem in one round trip. Terminal-stage instances do not block an
  edit (they are finished, not stranded), and instances of another
  `(RequestType, Phase)` are correctly out of scope. `IWorkflowRoleCatalogue`
  follows the existing `IApplicantRoleService` seam so Application stays free of
  Identity. Suite 309.*
- [x] **Task 11 — Admin endpoints.** `GET` list, `GET` one, `PUT` (whole stage
  list, one transaction), `POST` validate. All `[Authorize(Roles="SuperAdmin")]`.
  *Done and verified live against MySQL: clerk 403 / superadmin 200 on the list;
  rule 5 blocked removing a stage holding a live instance with the count in the
  message; rules 1, 3 and 4 each rejected with 400; validate-only returns 200
  with the verdict in the body. After four rejected `PUT`s the stored route was
  byte-identical to the seed — no partial write. Suite 309.*
  *No transaction plumbing was needed: EF sends one `SaveChangesAsync` as a
  single transaction, so the remove-then-add is already atomic. Widening
  `IApplicationDbContext` would have broken all four test contexts for nothing.*
- [x] **Task 12 — Admin UI.** `/admin/workflows` — definition list, full stage
  editor (reorder, add, remove, role pickers), chain preview. Sidebar gated on
  `isSuperAdmin`. *Full editor per the user's choice, not the roles-only option.*
  *Sequence numbers are assigned from list order on save rather than typed, so
  reordering and removal cannot produce the gaps the validator would reject.
  Reordering uses explicit up/down buttons, not drag and drop: the sequence is
  the route, so a mis-drop would silently change how requests travel.*

## 7e — Verification

- [x] **Task 13 — Full suite.** 250 existing pass unmodified + new tests green. *309 passed.*
- [x] **Task 14 — Live walkthrough.** Run the stack; drive one workflow end to
  end over CDP as in Phases 4–6. Confirm: seeded route behaves identically to
  pre-phase; a SuperAdmin edit changes who may act at a stage **at runtime,
  with no redeploy** — the claim this whole phase rests on.
  *Done. `p7-ui-test.mjs` 14/14 and `p7-runtime-claim.mjs` 7/7, both repeatable,
  no console errors. The claim is proven end to end: a SuperAdmin clicked a role
  pill in the browser, saved, and the API immediately reported the new role on
  that stage — same process, no redeploy — then it was restored and the database
  confirmed clean.*
- [x] **Task 15 — Commit** with an execution record: what was verified live,
  and what was not. *See [`2026-08-13-phase7-execution-record.md`](2026-08-13-phase7-execution-record.md).*

---

## Risks

Carried from spec §9. The two worth restating:

- **Signature change touches every slice.** Sequenced before any behaviour
  change (Task 6 precedes Task 7), so a failure in the refactor is
  distinguishable from a failure in the new authorization.
- **Seeded route drifting from shipped behaviour** is caught by the unmodified
  250-test bar, not by inspection.

## Deferred (spec §8)

Amount-banded routing · `Return`/resubmit re-entry · per-module BRD chains ·
parallel/committee approvals · countdown timers.
