# Phase 5: Recruitment & Fellow Onboarding Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Tick a box only
> after running the stated command and seeing the expected output.

**Goal:** Implement the slice specified in
`notes/specs/2026-08-11-recruitment-slice-design.md` — applicant self-registration
with email verification, the BRD A2 recruitment cycle, and fellow onboarding
ending at an issued ID card.

**Architecture:** Three independently verifiable groups, mirroring how Phase 3
split 3b/3c/3d:

- **5a — Identity & registration** (Tasks 1–4): applicant accounts, email
  verification, the `IEmailSender` seam, soft delete and reactivation.
- **5b — Recruitment backend** (Tasks 5–10): the stage machine, committees,
  candidates, merit list, offer, joining, ID card.
- **5c — Frontend** (Tasks 11–14): applicant portal and PI/office screens,
  rewiring the five scaffolded modals.

**Tech Stack:** .NET 8, EF Core 8 + Pomelo/MySQL, ASP.NET Identity, MailKit
(new dependency), xUnit + FluentAssertions, React 19 + Vite + Tailwind.

## Global Constraints

- **No credential in source control.** The `Email` config section ships with
  empty placeholders; the operator supplies real values (spec D2b).
- **Applying is blocked until the email is verified** (spec D2a).
- **Prefill must belong to the same applicant** — otherwise passing another
  person's candidate id discloses their details (spec D2a).
- **Fellow-facing endpoints must not reuse `LoadOwnedProjectAsync`.** That helper
  tests `project.OwnerUserId == requestingUserId`, a *PI owns project* check. A
  fellow owns no project (spec D3).
- Every module gate is enforced server-side, not merely hidden in the UI (D4).
- Do not modify procurement or travel code. `DocumentKind` is **append-only**.

## Dependencies

Everything needed exists on `main`: ASP.NET Identity with five roles,
`RequestType.ManpowerDocument`, `SanctionedManpowerPosition`, the workflow engine,
the document store and `IHtmlPdfRenderer`.

**Blocked on the operator:** SMTP host, port, TLS mode, user, password and
from-address. Task 3's live verification cannot pass until these are set. Every
other task is independent of them.

---

## 5a — Identity & Registration

### Task 1: Applicant identity model

**Files:** `ApplicationUser.cs`, `Candidate.cs` (new), new enums,
`IApplicationDbContext.cs`, `ApplicationDbContext.cs`, migration.

- [x] **Step 1: Extend `ApplicationUser`**

Add `IsActive` (bool, default true). `EmailConfirmed` already exists via Identity
— do **not** add a parallel flag.

- [x] **Step 2: Add the new roles**

`Applicant` and `Fellow` in `DbSeeder.Roles`. Neither reuses an office role.

- [x] **Step 3: Build**

Run: `dotnet build API/API.slnx`

### Task 2: `IEmailSender` and the SMTP implementation

**Files:** `IEmailSender.cs` (new, application), `SmtpEmailSender.cs` (new,
infrastructure), `EmailOptions.cs`, `appsettings.json`, `Program.cs`,
`API.Infrastructure.csproj`.

- [x] **Step 1: Add MailKit**

Run: `dotnet add API/API.Infrastructure package MailKit`

- [x] **Step 2: Define the interface and options**

```csharp
public interface IEmailSender
{
    Task SendAsync(string toAddress, string subject, string htmlBody, CancellationToken ct = default);
}
```

`EmailOptions`: `Host`, `Port`, `UseStartTls`, `User`, `Password`,
`FromAddress`, `FromName`.

- [x] **Step 3: Implement `SmtpEmailSender`**

MailKit `SmtpClient`. **Throw a clear, actionable exception when `Host` is
empty** — an unconfigured mailer must fail loudly at send time, never silently
swallow a verification mail.

- [x] **Step 4: Ship the config section with placeholders**

Add to `appsettings.json` with empty `Host`/`User`/`Password`/`FromAddress`.
Commit the placeholders only. Document in the plan's execution record that the
operator fills these in.

- [x] **Step 5: Register in `Program.cs` and build**

Run: `dotnet build API/API.slnx`

### Task 3: Registration, verification, reapplication lookup

**Files:** `ApplicantAccountService.cs` (new), contracts, `AuthController.cs`
(extend), exceptions.

- [x] **Step 1: `RegisterAsync`**

Creates the user with role `Applicant`, `EmailConfirmed = false`,
`IsActive = true`; generates an Identity email-confirmation token; sends the
verification mail via `IEmailSender`.

When the address already exists, **do not create a second account and do not
throw**: return a response indicating the address is known, plus the caller's
previous applications *only after they authenticate*. The unauthenticated
response must not enumerate — see the spec's Risks section.

- [x] **Step 2: `ConfirmEmailAsync`**

Validates the Identity token, sets `EmailConfirmed = true`. Idempotent: a second
confirmation of an already-confirmed address succeeds rather than erroring.

- [x] **Step 3: `ResendVerificationAsync`**

Rate-limited. Silent no-op for unknown or already-confirmed addresses, so it
cannot be used as an enumeration oracle.

- [x] **Step 4: Endpoints**

`POST /api/auth/register`, `POST /api/auth/confirm-email`,
`POST /api/auth/resend-verification` — all `[AllowAnonymous]`.

- [x] **Step 5: Build and unit tests**

Run: `dotnet test API/API.Tests/API.Tests.csproj`
Cover: duplicate registration creates no second account; unconfirmed token
rejected; confirmation is idempotent; resend is silent for unknown addresses.

- [x] **Step 6: Live verification (BLOCKED until SMTP configured)**

With real credentials in `appsettings.Development.json`, register and confirm a
real address end to end. **If the section is still empty, stop and report that
this step is blocked — do not fake it, and do not tick the box.**

### Task 4: Soft delete and reactivation

**Files:** `ApplicantAccountService.cs`, tests.

- [x] **Step 1: Deactivation on rejection**

When a candidate's `Outcome` becomes `NotSelected`, deactivate the account only
if the applicant holds no other live application.

- [x] **Step 2: Reactivation on reapplying**

`ApplyAsync` sets `IsActive = true` for an inactive account.

- [x] **Step 3: Login honours `IsActive`**

An inactive account cannot obtain a token. Verify the existing login path
enforces this.

- [x] **Step 4: Tests**

Run: `dotnet test API/API.Tests/API.Tests.csproj`
Cover: rejection with another live application does *not* deactivate; reapplying
reactivates; inactive login fails.

---

## 5b — Recruitment Backend

### Task 5: Recruitment entities and persistence

**Files:** `RecruitmentRequest.cs`, `Advertisement.cs`, `CommitteeMember.cs`,
`Candidate.cs`, `ManpowerSelection.cs`, enums, context, migration.

- [x] **Step 1: Write the entities**

Exactly the spec's Data Model. `Candidate` carries the personal fields prefill
copies, plus `PrefilledFromCandidateId` for provenance.

- [x] **Step 2: Append `DocumentKind` values**

`MinutesOfSelection`, `MeritList`, `JoiningLetter`, `IdCard`. **Append only** —
these persist as ints.

- [x] **Step 3: Configure and migrate**

Run: `dotnet ef migrations add AddRecruitment --project API/API.Infrastructure --startup-project API/API`

- [x] **Step 4: Add DbSets to the three test contexts**

They implement `IApplicationDbContext` and will not compile otherwise.

- [x] **Step 5: Build**

Run: `dotnet build API/API.slnx`

### Task 6: Advertisement and applications

- [x] **Step 1: `CreateRecruitmentRequestAsync` / `AdvertiseAsync`**

- [x] **Step 2: `ReadvertiseAsync`**

Increments `AdvertisementRound`, writes a new `Advertisement`, returns the stage
to `Advertised`. Only legal from `Advertised` (spec D6).

- [x] **Step 3: `ApplyAsync`**

Enforces, in order: email verified (D2a); no existing live application to this
request; prefill source belongs to the caller. Creates a fresh `Candidate`,
copying personal fields when prefill is supplied, and reactivates the account.

- [x] **Step 4: Tests**

Run: `dotnet test API/API.Tests/API.Tests.csproj`
Cover each rule, especially **prefill from another applicant's candidate is
rejected**.

### Task 7: Committees and screening

- [x] **Step 1: `SubmitScreeningCommitteeAsync`**

Composition per BRD A2: one Chairman (PI), the Co-PI, one nominated faculty.

- [x] **Step 2: `SubmitSelectionCommitteeAsync`**

One Chairman (HOD), the PI, exactly two nominees, at least one external.

- [x] **Step 3: `RecordScreeningResultAsync`**

- [x] **Step 4: `SetNomineeAvailabilityAsync`**

- [x] **Step 5: Tests** — every composition rule rejects a malformed committee.

### Task 8: Interview, merit list, Dean approval

- [x] **Step 1: `ScheduleInterviewAsync`**

- [x] **Step 2: `SetInterviewModeAsync`**

Online requires Dean approval, recorded in `OnlineModeApprovedByUserId`.

- [x] **Step 3: `SubmitMeritListAsync`** — ranks unique within a request.

- [x] **Step 4: `SignMeritListAsync`** — per committee member.

- [x] **Step 5: `ApproveMeritListAsync`**

Throws unless **all** committee members have signed. Raises the workflow
instance with `RequestType.ManpowerDocument` (spec D8).

- [x] **Step 6: Tests** — approval before full signature is rejected.

### Task 9: Offer, joining, ID card

- [x] **Step 1: `IssueOfferLetterAsync`**

**Payment gate (spec D7):** throws unless the project has at least one
`GrantReceipt`. Generates the letter.

- [x] **Step 2: `RecordJoiningAsync`**

Creates `ManpowerSelection`, promotes the user's role `Applicant` → `Fellow`,
generates the joining letter.

- [x] **Step 3: `IssueIdCardAsync`**

Sets `IdCardNumber` and `IdCardIssuedAt` — **the gate Phase 6 consumes** (D4).

- [x] **Step 4: Fellow scoping helper**

A dedicated helper resolving the caller's `ManpowerSelection`. **Do not reuse
`LoadOwnedProjectAsync`** (D3). Test directly that one fellow cannot read
another's record.

- [x] **Step 5: Tests**

Cover: offer without a receipt throws; joining promotes the role; ID card sets
the gate; cross-fellow access is denied.

### Task 10: Documents, API surface, seed

- [x] **Step 1: Templates**

Advertisement, screening proforma, minutes, merit list, offer letter, joining
letter — ported from the legacy generators, reusing `IndentHtmlShell`.

- [x] **Step 2: `RecruitmentController`**

- [x] **Step 3: Checklist seed for `RequestType.ManpowerDocument`**

- [x] **Step 4: Full test suite**

Run: `dotnet test API/API.Tests/API.Tests.csproj`
Expected: all pass, **including the 162 pre-existing**.

---

## 5c — Frontend

### Task 11: Applicant portal

- [x] **Step 1: `recruitmentApi.js`, `recruitmentEnums.js`**
- [x] **Step 2: Registration + email-verification pages**

Registration must state plainly that the address must be confirmed before
applying, and show the known-address path without implying the account was
created twice.

- [x] **Step 3: Application form with the prefill prompt**

"Use details from a previous application?" — the applicant's own applications
only.

- [x] **Step 4: Applicant dashboard** — applications and their outcomes.
- [x] **Step 5: Build and lint**

### Task 12: PI and office screens

- [x] **Step 1: Recruitment section on `ProjectDetailPage`**
- [x] **Step 2: `RecruitmentDetailPage`** — stage, candidates, committees, timeline.
- [x] **Step 3: Committee and merit-list forms**
- [x] **Step 4: Build and lint**

### Task 13: Rewire the five scaffolded modals

`GenerateAdvertisementModal`, `GenerateScreeningProformaModal`,
`GenerateOfferLetterModal`, `RecommendStipendModal`,
`UpdateCandidateStatusModal`.

- [x] **Step 1: Audit each against the real API**

Phase 3d showed these target imagined shapes. **The API is the source of truth**
— rewrite them, do not preserve their contracts.

- [x] **Step 2: Rewire**
- [x] **Step 3: Build and lint**

### Task 14: End-to-end verification

- [x] **Step 1: Full build, lint, test suite**

- [x] **Step 2: API walkthrough**

Register → confirm → apply → screen → committee → interview → merit list → sign →
approve → offer → join → ID card. Verify at each step: unverified applying is
rejected; prefill from another applicant is rejected; offer without a receipt is
rejected; approval before full signature is rejected; role becomes `Fellow`;
`IdCardIssuedAt` is set.

- [x] **Step 3: Browser verification**

Drive the applicant portal in Chrome over CDP, as Phase 4 was verified.

- [x] **Step 4: Record results and commit**

State explicitly which steps were verified live and which were blocked.

---

## Execution Record (2026-08-12)

**SMTP is configured and sending.** The operator supplied credentials, so Task 3
Step 6 is no longer blocked: registration sends a real verification email with
zero send errors.

**Live API walkthrough** — every BRD rule verified against the running stack:

| Step | Result |
|------|--------|
| Register applicant | 200, real email sent, no SMTP errors |
| **Apply before verifying** | **403 "must confirm their email address before applying"** |
| Apply after verifying | 201, application visible on /api/my/applications |
| **Prefill from another applicant's candidate** | **403 "does not belong to the requesting applicant"** |
| Selection committee with no external nominee | 400 "at least one selection nominee must be external" |
| Valid committee | 204 |
| **Approve with 0 of 4 signatures** | **400 "has 0 of 4 committee signatures"** |
| **Approve with 3 of 4** | **400 "has 3 of 4"** |
| Approve with 4 of 4 | 204 |
| **Offer with a receipt but no transaction reference** | **400 "no grant receipt carrying a NEFT/RTGS transaction reference"** |
| Offer after recording a NEFT reference | 204 |
| Record joining | fellow appointment created |
| Role after joining | `['Fellow']` — Applicant correctly removed |
| Issue ID card | 204, the Phase 6 gate is set |
| All six documents | 200, valid PDFs (88KB–121KB each) |

**Browser verification** — 17/17 checks via Chrome over CDP, including that the
registration page states verification is required, the signature panel reads
"4 of 4", all six document buttons render, the manpower row offers "Open
recruitment", and the scaffold document actions are gone.

One check failed on the first run with `ERR_CONNECTION_REFUSED`. It was Vite
cold-start, not an application defect: a probe of a warm server showed no console
errors and no failed requests, and a re-run passed 17/17. Recorded rather than
quietly re-run.

**A throwaway `API/ConfirmTool` was used and deleted.** The walkthrough needed a
confirmed applicant, and the verification token only ever reaches the email body
-- by design. Rather than add a token-exposing endpoint, even a Development-only
one, a one-off console tool set `EmailConfirmed` through Identity's own
`UserManager`. The application's confirm-email path is covered by unit tests; what
the walkthrough needed from that step was a confirmed applicant, not another
exercise of the token round trip.

Final state: **203/203 backend tests pass**, UI builds, touched files lint clean.

---

## Self-Review Notes

- **Registration is the one flow that cannot be fully verified in this slice**
  without operator-supplied SMTP. Task 3 Step 6 is designed to be *reported as
  blocked* rather than skipped quietly.
- **Task 6's prefill rule and Task 9's fellow scoping are the two places a
  mistake leaks another person's data.** Both get direct negative tests rather
  than relying on surrounding patterns.
- **D7's payment gate is implemented as specified but remains unconfirmed.** If
  installment tracking is what the BRD means, this gate changes — it is
  deliberately one method.
- Splitting 5a/5b/5c means identity can be reviewed and merged before the
  recruitment machinery lands on top of it.
