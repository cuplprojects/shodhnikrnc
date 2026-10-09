# Maintaining RNC alongside its own upstream development

RNC (`MNNITRNC/`) is developed independently in its own upstream repository.
This combined repo (`shodhnikrnc`) carries a full copy of RNC's source plus a
small, deliberately narrow layer of integration-specific changes on top (the
Shodhanik↔RNC identity federation). Upstream RNC development continues on its
own schedule and must keep flowing into this repo without silently reverting
the integration layer, and without the integration layer silently drifting
out of sync with upstream.

This file is the map: what's integration-specific, why each item exists, and
the exact mechanism for pulling upstream's changes in going forward.

## What's integration-specific (and nothing else)

Per the Shodhanik-x-RNC integration plan, the *only* thing that legitimately
crosses the Shodhanik/RNC boundary is a person's identity (Shodhanik SSO →
RNC's own HOD-approval-gated Faculty onboarding). Confirmed directly with the
project owner: **upstream RNC's own repo has no changes to the user/identity
module** — everything integration-specific is additive and scoped to exactly
these files. Every other file under `MNNITRNC/` is unmodified upstream RNC
code; any future change to the *identity* model is also assumed
integration-only, but a change anywhere else in RNC (procurement, recruitment,
workflow, projects, etc.) is ordinary upstream development, not something this
doc needs to track.

### RNC backend (`MNNITRNC/API`)

| File | What was added | Why |
|---|---|---|
| `API.Domain/Entities/ApplicationUser.cs` | `ExternalSourceSystem`, `ExternalUserId` properties | Marks an account as federated from Shodhanik (vs. RNC-native) and carries the external person's id. |
| `API.Infrastructure/Persistence/ApplicationDbContext.cs` | EF config for the two new columns + a non-unique index on `(ExternalSourceSystem, ExternalUserId)` | Backs the federated-account lookup; the `ApplicationUser` entity block is the only touched section. |
| `API.Infrastructure/Persistence/Migrations/20261007101747_AddApplicationUserExternalIdentity.{cs,Designer.cs}` | New migration | Adds the two columns above. Purely additive — never touches a column upstream owns, so it can never conflict with an upstream migration. |
| `API.Application/Recruitment/IFacultyRegistrationService.cs` | `FederatedFacultyRegistrationInput`, `FederatedFacultyStatus`, `FederatedFacultyStatusResult`, `RegisterFederatedAsync`, `GetFederatedStatusAsync` | The federated sibling of the existing password-based `RegisterAsync`/approval pipeline — reuses it rather than duplicating the HOD-approval logic. |
| `API.Infrastructure/Recruitment/FacultyRegistrationService.cs` | Implementations of the two methods above, plus `ShodhanikSourceSystem` constant | Same reasoning — creates/finds a federated `ApplicationUser`, defers entirely to the existing `ApproveAsync`/`RejectAsync`/`ListPendingFacultyRegistrationsAsync` for everything after provisioning. |
| `API/Program.cs` | Second accepted JWT issuer/audience (`Shodhanik:Jwt` config section) with an `IssuerSigningKeyResolver` picking the right signing key per issuer | Lets RNC trust Shodhanik-issued tokens alongside its own, without weakening validation of its own tokens. |
| `API/appsettings.Development.json`, `API/appsettings.example.json` | `Shodhanik:Jwt` config section | Config for the above — signing key must match Shodhanik's own `Jwt:Key` exactly. |
| `API/Controllers/AuthController.cs` | `POST /api/auth/faculty/federated`, `GET /api/auth/faculty/federated/status` | The entry point a Shodhanik-federated Supervisor's browser calls after SSO, and the status check backing the "Pending HOD Approval" screen. |
| `API/Contracts/Auth/FacultyRegistrationContracts.cs` | `FederatedFacultyRegisterResponse`, `FederatedFacultyStatusResponse` | DTOs for the two endpoints above. |

### RNC frontend (`MNNITRNC/UI`)

| File | What was added | Why |
|---|---|---|
| `vite.config.js` | `base: '/rnc/'` | RNC is served under `/rnc/*` behind the gateway; without this, RNC's own root-relative asset paths resolve against the gateway's origin root and get routed to Shodhanik's UI instead (a real bug this caused and fixed during setup — see commit history). |
| `src/api/apiClient.js` | `bearerToken` override option on `request()` | The federated register call must authenticate with the Shodhanik token the user arrived on, not RNC's own stored session token. |
| `src/api/authApi.js` | `registerFacultyFederated(shodhanikToken)` | Calls the new federated endpoint. |
| `src/auth/AuthContext.jsx` | `loginFederated(shodhanikToken)`, token-claim decoding helpers | Mirrors the existing password `login()`, sourced from the federated exchange instead. |
| `src/auth/ShodhanikSsoLandingPage.jsx` | New file | Where the gateway sends a Shodhanik Supervisor after SSO; exchanges the token and lands in the app (`ProtectedRoute`'s existing Pending-role redirect handles the rest unmodified). |
| `src/App.jsx` | New public route `/sso/shodhanik` | Wires the landing page in. |
| `src/layout/Sidebar.jsx`, `src/auth/LoginPage.jsx`, `src/pages/IdCardRequestPage.jsx` | `/images/...` → `` `${import.meta.env.BASE_URL}images/...` `` | Fallout of the `base: '/rnc/'` change above — these were the only hand-written root-relative asset references in the whole UI. |

### Not RNC at all

`Gateway/` and `start-dev.ps1` at the repo root are new, RNC-independent
infrastructure — a subtree pull never touches them.

### Shodhanik side

The JWT claim additions and issuer/audience fix in Shodhanik's own
`LoginController.cs`/`Program.cs`/`appsettings.json` are Shodhanik's files, not
RNC's, so they're entirely outside this doc's scope — no upstream-RNC-sync
question ever touches them.

## The sync mechanism: git subtree

Chosen over a submodule because RNC's full source needs to be physically
present in this repo for the build/gateway/deploy to work as one checked-out
tree — a submodule would need an explicit init/update step every clone and
CI run, and would leave `MNNITRNC/` as a separate nested repo rather than
ordinary tracked files.

### One-time setup (not yet done)

The current `MNNITRNC/` folder exists only as part of this repo's single
flat "first commit" — it has no subtree lineage back to upstream RNC's own
commit history yet. Establishing that link cleanly means:

1. Add the upstream remote and fetch its history:
   ```bash
   git remote add rnc-upstream <url-of-the-separate-RNC-repo>
   git fetch rnc-upstream
   ```
2. Temporarily set aside today's `MNNITRNC/` (it will conflict with a fresh
   `subtree add`, since that command expects the prefix path not to exist
   yet).
3. Run `git subtree add --prefix=MNNITRNC --squash rnc-upstream main` to
   establish the link against upstream's current state.
4. Re-apply just the integration-specific diffs from the table above on top
   (the full diffs are recoverable from this repo's own history before the
   subtree add, since nothing is being thrown away — only re-sequenced).

This needs to happen once, deliberately, reviewed step by step rather than as
a single automated command, since it changes how `MNNITRNC/` relates to the
rest of the repo's history.

### Ongoing sync (after setup)

```bash
git fetch rnc-upstream
git subtree pull --prefix=MNNITRNC --squash rnc-upstream main
```

Because upstream never touches the identity/user module, the overwhelming
majority of pulls merge with zero conflicts. A conflict is only possible in
the handful of files listed in the tables above — and git will flag exactly
those files explicitly rather than silently overwriting integration-specific
changes or silently discarding upstream's.

**When a conflict does land in one of those files:** re-read this doc's
"why" column for that file before resolving — it says what the integration
layer needs to keep working, so the merge can keep both upstream's new code
and the integration's addition rather than picking one side blind.

**When RNC's own identity/user module genuinely changes upstream** (contrary
to today's assumption that it never does): that's the one case this doc
can't pre-empt. Treat it as a signal to re-open the Shodhanik-x-RNC
integration plan's §2/§7 sections and re-verify the federation columns and
`FacultyRegistrationService` extensions still make sense against the new
upstream shape, rather than merging blind.
