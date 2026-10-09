# MNNIT Research & Consultancy Portal — User Manual

**Audience:** developers and testers exercising the application end-to-end.
**Scope:** every module built so far, organized by role. This document
describes what exists and works today — see [§12 Known Gaps](#12-known-gaps-and-stubs)
for pages that are still stubs, so you don't spend time testing something
that was never wired up.

If you find this document out of date with the code, the code wins — file
a note against whichever is stale.

---

## Contents

1. [Getting started](#1-getting-started)
2. [Test accounts](#2-test-accounts)
3. [Roles at a glance](#3-roles-at-a-glance)
4. [Research Proposals](#4-research-proposals)
5. [Projects](#5-projects)
6. [Recruitment](#6-recruitment-brd-a2)
7. [Procurement & Travel](#7-procurement--travel)
8. [Fellowship & Leave](#8-fellowship--leave)
9. [Reports](#9-reports)
10. [Applicant registration & login](#10-applicant-registration--login)
11. [Admin: RBAC & workflow configuration](#11-admin-rbac--workflow-configuration)
12. [Known gaps and stubs](#12-known-gaps-and-stubs)
13. [Full route reference](#13-full-route-reference)

---

## 1. Getting started

- **Backend:** `d:\Projects\MNNITRNC\API` — .NET 8, EF Core, MySQL. Run via
  `dotnet run --launch-profile https` from `API/API`. Default:
  `https://localhost:7054`.
- **Frontend:** `d:\Projects\MNNITRNC\UI` — React 19 + Vite. Run via
  `npm run dev`. Default: `http://localhost:5173`.
- On first run against a fresh database, `DbSeeder` creates all accounts in
  [§2](#2-test-accounts), 15 departments, document checklists, workflow
  definitions, and one sample research proposal (see below).
- The login page (`/login`) has three tabs — **Faculty / Office /
  Candidate**. These are **cosmetic only**: they change the field label and
  accent color, nothing else. `loginType` is never sent to the backend. Any
  account can log in from any tab — pick whichever fits the account you're
  using.

---

## 2. Test accounts

Every seeded account's email is `{username}@mnnit.ac.in`, pre-confirmed.

| Username | Password | Role | Department |
|---|---|---|---|
| `faculty1` | `Faculty@12345` | Faculty | CSED (Computer Science) |
| `hod1` | `Hod@12345` | HOD | CSED |
| `deanrc` | `Dean@12345` | Dean | RNC |
| `dyregrc` | `DyReg@12345` | DeputyRegistrar | RNC |
| `osrc` | `Osrc@12345` | Superintendent | RNC |
| `clerk1` | `Clerk@12345` | RegularStaff | RNC |
| `directorrc` | `Director@12345` | Director | RNC |
| `superadmin` | `SuperAdmin@12345` | SuperAdmin | *(none)* |
| `harshit1` | `Harshit@12345` | RegularStaff | RNC |
| `sadhvi1` | `Sadhvi@12345` | RegularStaff | RNC |
| `ashok1` | `Ashok@12345` | RegularStaff | RNC |
| `shyamu1` | `Shyamu@12345` | RegularStaff | RNC |
| `renu1` | `Renu@12345` | RegularStaff | RNC |
| `prateek1` | `Prateek@12345` | RegularStaff | RNC |

**No seeded Applicant or Fellow account.** Applicant: self-register at
`/register`. Fellow: an Applicant becomes a Fellow automatically when
`RecordJoiningAsync` runs on a recruitment (see [§6](#6-recruitment-brd-a2)).

**Department matters more than role rank.** All eleven office accounts
above live in department **RNC**, the only department flagged
institute-wide. That membership — not seniority — is what widens their
Department-scoped access to Institute-wide. `faculty1` and `hod1` are in
CSED and only ever see CSED data. If you need to test a report or queue at
Institute scope, use an RNC account; to test genuine Department scope, use
`hod1` or temporarily move a test account to a non-RNC department.

**Seeded sample data:** one research proposal exists on a fresh database —
*"AI-Based Smart Grid Optimization & Energy Management"*, owned by
`faculty1`, already submitted and sitting at stage **WithHOD**. Log in as
`hod1` and open the Department Proposal Queue to see it immediately.

---

## 3. Roles at a glance

| Role | Can reach | Cannot reach |
|---|---|---|
| **Faculty** (PI) | Own projects, own proposals (create/submit), procurement & travel on own projects, recruitment on own projects, all 8 reports (Own scope) | Office queues, admin |
| **HOD** | Department Proposal Queue, own department's projects/reports (Department scope), procurement/travel/recruitment detail | Cannot create their own proposal (no `proposals.new`); no office queues |
| **Dean** | R&C Office Proposals queue, approve stage on proposals, all office queues *except* Assigned Requests, manual project creation, offer letters, reports (Institute scope via RNC) | Admin config |
| **DeputyRegistrar / Superintendent** | Same office surface as Dean, minus final proposal approval | Assigned Requests (RegularStaff-only), admin |
| **RegularStaff** | Everything Dean has, **plus** Assigned Requests | Final proposal approval (Dean-only), admin |
| **Director** | Dashboard, profile, projects list **only** — but has real approval authority at the `Director`/`ForwardedDR` workflow stages and can override fellowship HRA | Almost the entire UI — exercises power mostly through other users' screens or direct API calls |
| **Applicant** | Register, verify email, browse open recruitments, apply, track own applications | Everything else |
| **Fellow** | Fellowship claims, leave requests, own applications | Projects, proposals, reports |
| **SuperAdmin** | `/admin/workflows`, `/admin/roles` **only** | No projects, proposals, or reports — configuring the process is deliberately separated from deciding individual requests |

**The single biggest surprise for new testers:** Director has almost no
UI. If you're testing Director-stage approvals, expect to drive them via
API or via whichever downstream page surfaces that action, not a Director
dashboard.

Full page-by-page grants are in [§13](#13-full-route-reference).

---

## 4. Research Proposals

**The core rule this portal enforces: a Project is not created by hand — it
is the outcome of a sanctioned Research Proposal.** (Manual project
creation still exists as an office-only fallback — see [§5](#5-projects).)

### Lifecycle

```
Draft --(PI submits)--> WithHOD --(HOD fwd)--> WithRnCOffice
  --(office fwd)--> AssignedToDealingAssistant --(fwd)--> WithSuperintendent
  --(fwd/reject)--> WithDeputyRegistrar --(fwd/reject)--> WithDean
  --(approve/reject)--> Approved
```

Status field tracks the wider lifecycle: **Draft → UnderApproval → Approved
→ SubmittedToAgency → Sanctioned** (or **NotFunded**, **Rejected**, or
**Withdrawn** at various points).

| Step | Who | Action | Result |
|---|---|---|---|
| 1 | Faculty (PI) | `/proposals/new` — title, agency, proposed/overhead amount, duration, budget lines | Draft |
| 2 | Faculty | Submit | Raises a workflow instance, jumps straight to **WithHOD** |
| 3 | HOD | Forward (Department Proposal Queue) | → WithRnCOffice |
| 4 | Office (any) | Forward | → AssignedToDealingAssistant → WithSuperintendent |
| 5 | Superintendent | Forward or **Return** | → WithDeputyRegistrar, or back to PI |
| 6 | DeputyRegistrar | Forward or Return | → WithDean, or back to PI |
| 7 | Dean | **Approve** or Return | → Approved (internal endorsement — no funding yet), or back to PI |
| 8 | Office (any) | Record agency submission | → SubmittedToAgency |
| 9 | Office (any) | **Record sanction** | → Sanctioned, **Project created and linked** |

A returned proposal lands at `ReturnedToPI`, and only the PI can act on it;
resubmitting sends it straight to `AssignedToDealingAssistant` (seq 4) — it
never re-enters at the Dean.

**Approved ≠ funded.** Approval means the institute endorses submitting the
proposal to the agency. Nothing is created yet. Only recording the
sanction creates a Project.

### Where to test this

- **Create/submit:** `/proposals/new` as `faculty1`.
- **HOD queue:** `/proposals/hod-queue` as `hod1`.
- **Office queue:** `/proposals/rnc-queue` as any RNC office account.
- **Detail/actions:** `/proposals/:id` — the same page renders whichever
  actions the signed-in role/stage combination allows (forward, reject,
  return, approve, record agency submission, record sanction).
- Once sanctioned, the proposal detail page shows an **"Open project →"**
  link straight to the new Project.

---

## 5. Projects

### Two ways a Project comes to exist

1. **Normal path:** a sanctioned Research Proposal (see [§4](#4-research-proposals)).
   Always created as `TypeIResearch`.
2. **Manual fallback, office-only:** `/projects/new`. Restricted to Dean /
   DeputyRegistrar / Superintendent / RegularStaff — Faculty does **not**
   have this page. Exists for legacy or offline-sanctioned projects with no
   proposal on file. The office user filling in the form must pick the
   actual PI from a dropdown (backed by the faculty directory) — the
   project is **not** owned by whoever submits the form.

### Visibility rules

- **Owner (PI):** always sees their own project.
- **HOD:** sees any project in their own department, read-only.
- **Dean / DeputyRegistrar / Superintendent / RegularStaff:** can open
  *any* project by id, read-only (they administer sanctioned grants
  institute-wide). **Edit, delete, and grant receipts stay owner-only.**
- One consequence worth knowing: an office user's own `/projects` list
  page renders **empty** — they only reach a project by id, e.g. via a
  link from a proposal. This is expected, not a bug.

### What lives on a project

- **Budget heads** — one row per head (e.g. Recurring: Manpower), with
  Year 1/2/3 amounts.
- **Collaborators, sanctioned equipment, sanctioned manpower positions** —
  captured at creation.
- **Grant receipts** (owner only) — `/projects/:id/grant-receipts/new`.
  Optional overhead split (Idf/Pdf/Ddf), optional transaction
  reference/payment mode. **The transaction reference matters**:
  recruitment's offer-letter step requires a receipt with one recorded.
- **Refunds** — office staff only, explicitly not the PI's business.

---

## 6. Recruitment (BRD A2)

Only the **merit-list approval** step runs through the formal workflow
engine — everything before it is the recruitment's own stage machine, since
the earlier steps have no office escalation chain.

### Stages

```
Draft → Advertised → ScreeningInProgress → SelectionScheduled
  → MeritListPrepared → Approved → OfferIssued → Joined
```

### Walkthrough

| Step | Who | Notes |
|---|---|---|
| Create | Faculty (PI) | Against one of the project's sanctioned manpower positions — there's no create-without-a-project path |
| Advertise | Faculty | Round 1; **Readvertise** if too few applicants close the round (increments the round, records the closing count) |
| Apply | Applicant | Requires stage = Advertised **and** a confirmed email; can prefill from their own earlier application |
| Screening committee | Faculty | PI as Chairman + ≥1 Co-PI + ≥1 Dean-nominated faculty. Submitting it moves the stage to ScreeningInProgress |
| Record screening result | Faculty | Eligible / Ineligible. Ineligible deactivates the applicant's account unless they have another live application |
| Selection committee | Faculty | HOD as Chairman + ≥1 PI + exactly 2 nominees (one must be external) |
| Schedule interview | Faculty | Sets date/venue → SelectionScheduled |
| Interview mode | Faculty | Offline by default; **Online requires prior Dean approval** |
| Submit merit list | Faculty | Only Eligible candidates can be ranked → MeritListPrepared |
| Sign merit list | Any committee member | Every selection-committee member must sign before... |
| Approve merit list | **Dean only** | Requires every signature. This raises the one real workflow instance in the whole recruitment flow → Approved |
| Issue offer | Faculty | **Requires a grant receipt with a transaction reference on the project** → OfferIssued. All other pending candidates are auto-marked Not Selected |
| Record joining | Faculty | Creates the fellow record, **promotes the applicant's role to Fellow** → Joined |
| Issue ID card | Faculty, RegularStaff, Superintendent, DeputyRegistrar | **This is the gate the entire Fellowship & Leave module depends on** — nothing there works until this is done |

### Where to test this

- Faculty side: `/recruitment` (list) → `/recruitments/:id` (detail/actions).
- Applicant side: `/my-applications` — browse open recruitments and apply.
- Documents (advertisement, screening proforma, merit list, offer/joining
  letters) generate on demand from the detail page. Offer and joining
  letters are cached to disk after first generation — if you change data
  and expect a letter's content to change, you may see a stale cached copy.

---

## 7. Procurement & Travel

Three indent types — **Consumable**, **Contingency**, **Equipment** — share
one lifecycle shape, plus a separate **Travel** flow.

### Indent lifecycle

1. **Raise** (Faculty, project owner only). Server computes the
   procurement tier itself from GeM availability + estimated cost — never
   trusts a client-sent value. Budget sufficiency is checked against the
   named budget head. If GeM is unavailable, a non-availability certificate
   number and a still-valid date are mandatory.
2. A committee (Annexure 11) is required **only** for the
   non-GeM ₹2L–₹25L tier — submitted for any other tier, it's discarded.
3. Raising generates the indent PDF and starts the generic office
   escalation chain: **Raised → SignedCopyUploaded (Dean assigns) →
   Assigned → Forwarded → ForwardedOSRC → ForwardedDR (Dean/Director
   approve or reject) → Director (approve or reject)**.
4. **Process bill** (after Approved): E-way bill number is mandatory above
   ₹50,000. Starts a **second**, separate workflow instance in the Bill
   phase.

### Travel

Same shape, with its own Indent-phase and Bill-phase workflows. The portal
does not compute per-diem — it collects the completed TA/DA form as a
document. Private-taxi legs require an explicit opt-in.

### Where to test this

- `/procurement` (Faculty/HOD) → `/procurement/:indentType/:indentId`.
- Travel requests are reached from inside a project's detail page (there is
  no standalone travel list route today — see [§12](#12-known-gaps-and-stubs)).

---

## 8. Fellowship & Leave

Both modules are **Fellow-only**, and both are gated on the recruitment ID
card step ([§6](#6-recruitment-brd-a2)) — nothing here works for a fellow
who hasn't had their ID card issued.

### Fellowship claims (`/fellowships`)

- Raised by the fellow. If HRA is claimed, an HRA slip becomes required.
- **HRA override** — Dean or Director only, requires a reason, refused
  once the claim is already approved.
- **Recommended amount** is entered by the PI, never auto-computed from
  leave — the portal reports absence; a human decides what to pay.
- The stipend form is generated on demand, so it always reflects the
  latest override/recommended amount.

### Leave (`/leaves`)

- Balance = entitled − consumed − pending, computed per the fellow's
  current project year.
- Consumed days only increment when a leave request is **approved** — a
  rejected request never reduces the balance.

---

## 9. Reports

Eight reports, one shared page (`/reports/:reportKey`), all following the
identical role-based scoping rule:

| Role | Scope |
|---|---|
| Faculty / Fellow | **Own** — their own projects only |
| HOD | **Department** — their own department |
| Dean / DeputyRegistrar / Superintendent / RegularStaff | **Institute** if their department is R&C (i.e. RNC), **Department** otherwise |

| Report | Route | Notes |
|---|---|---|
| Number of Projects | `/reports/number-of-projects` | |
| Grant Sanctioned | `/reports/grant-sanctioned` | |
| Project-wise Expenditure | `/reports/project-expenditure` | |
| Project-wise Overhead | `/reports/project-overhead` | |
| Refund Reports | `/reports/refunds` | |
| Staff Count | `/reports/staff-count` | Not date-filtered (headcount snapshot). Faculty/Fellow get an empty list, not an error — a PI has no institute-wide staff view |
| Project-wise Equipment List | `/reports/project-equipment` | |
| Recruitment Funnel | `/reports/recruitment-funnel` | Applied/screened/selected counts per recruitment drive |

Every report exports to Excel and PDF, and supports date-range filtering
where applicable.

**Testing tip:** to see the Institute-vs-Department distinction actually
change results, compare `hod1` (always Department, CSED) against `clerk1`
or `deanrc` (Institute, because RNC). Comparing two RNC accounts won't show
you anything new.

---

## 10. Applicant registration & login

1. **Register** — `/register`, or the inline form on the login page's
   Candidate tab. Same response either way, whether or not the email is
   already registered — this is deliberate, to avoid disclosing which
   addresses exist.
2. **Confirm email** — link sent to the registered address, lands on
   `/verify-email`.
3. **Log in** — verification gates *applying*, not signing in. An
   unverified applicant can log in but will be refused when they try to
   apply to a recruitment.
4. **Browse & apply** — `/my-applications` lists open recruitments and the
   applicant's own past applications (the only legitimate source for
   prefilling a new one).
5. **Outcome** — Ineligible at screening, or Not Selected once someone else
   is offered the position, soft-deletes the account (unless another
   application is still live) — login then returns the same "invalid
   credentials" response as a wrong password. Applying to a fresh
   recruitment reactivates the account.
6. **Joining** — promotes the account's role from Applicant to Fellow. A
   Fellow can no longer apply to new recruitments through this same
   endpoint.

---

## 11. Admin: RBAC & workflow configuration

**SuperAdmin only** (`superadmin` account). Two pages, both reached from
`/admin/…`:

### Roles & Access (`/admin/roles`)

- **Roles tab** — create/rename/delete custom roles. Built-in roles can't
  be renamed or deleted; a role can't be deleted while any workflow stage
  names it or any user holds it.
- **Access tab** — a full module/page tree per role, each page toggleable
  with its own scope (Own/Department/Institute). Saves replace the role's
  entire grant set in one transaction, so a failed save can't leave a role
  half-configured. Changes take effect on the very next request — there is
  no deployment step.
- **Per-user exceptions tab** — grant or deny an individual page to a
  specific person, overriding their role. Every exception requires a
  written reason.

### Approval Routes (`/admin/workflows`)

Every request type's stage chain — sequence, stage name, allowed roles,
approve/reject flags — editable per (request type, phase). Changes apply
**immediately, including to requests already in flight.** An unconfigured
request type falls back to the built-in generic office-escalation route.

**Why SuperAdmin is not also Dean or Director:** someone who may approve an
individual claim should not thereby be able to rewrite who is allowed to
approve claims. Since the engine reads allowed roles from the database live,
that second power is the larger one — deliberately kept separate.

---

## 12. Known gaps and stubs

Don't spend testing time on these — they're not wired up yet.

**Fully non-functional (hardcoded empty lists):**
- `/assigned-requests`, `/processed-requests`, `/approved-requests`,
  `/forwarded-for-action`, `/update-payment` — all five render a working
  search/filter UI around a permanently empty list. No API call happens.

**Fully non-functional (static mockups, HOD-gated):** a newer "HOD
Department Portal" block of seven pages — `/hod-dashboard`,
`/consultancy-requests`, `/fellowship-claims`, `/leave-approvals`,
`/indent-approvals`, `/joining-reports`, `/overhead-funds` — all render
against hardcoded fake data, no API call happens. **Note the route name
collision:** `/fellowship-claims` here is a different, unrelated page from
the real, working `/fellowships` in [§8](#8-fellowship--leave) — don't
confuse the two when testing. Gated to HOD only (Department scope), same
as the Department Proposal Queue.

**"Under construction" placeholders:**
- `/generate-offer-letter` and `/view-offer-letters` — literal placeholder
  text. **Careful:** these are *not* the same as the working pages
  `/generate-manpower-offer-letter` and `/view-generated-offer-letters`,
  which are fully implemented. The names are easy to confuse.

**Partially wired:**
- Dashboard's "Pending Actions" and "Notifications" cards are hardcoded
  `0` — no backing endpoint exists anywhere yet. "Active Projects" is real.
- Two project-detail modals (`RecommendStipendModal`,
  `UploadManpowerDocumentModal`) have components with `// TODO: Wire to
  backend API`.

**Structural gaps:**
- `/travel/:travelRequestId` has no route registered in the frontend
  despite being a valid backend page key — reached today only from inside
  a project's detail page.
- The transaction-details report exists in the backend with no frontend
  page or route — API-only.
- `SignMeritListAsync`'s endpoint has no role restriction — any signed-in
  user holding a valid committee-member id can sign on their behalf.

---

## 13. Full route reference

### Public (no login required)

| Route | Page |
|---|---|
| `/login` | Login (Faculty/Office/Candidate tabs) |
| `/register` | Applicant registration |
| `/verify-email` | Email confirmation |

### Protected — by module

**Dashboard** — `/dashboard`, `/profile` (everyone, once signed in)

**Projects** — `/projects`, `/projects/new` (office-only), `/projects/:id`,
`/projects/:id/edit`, `/projects/:id/grant-receipts/new`

**Proposals** — `/proposals`, `/proposals/new`, `/proposals/:id`,
`/proposals/hod-queue` (HOD only), `/proposals/rnc-queue` (office)

**Recruitment** — `/recruitment`, `/recruitments/:recruitmentId`

**Procurement / Travel** — `/procurement`,
`/procurement/:indentType/:indentId`, `/travel/:travelRequestId` *(see
§12 — currently unreachable)*

**Fellowship / Leave / Applications** — `/fellowships` (Fellow),
`/leaves` (Fellow), `/my-applications` (Applicant, Fellow)

**Reports** — `/reports/:reportKey` (one shared page, 8 keys — see §9)

**Filtered project lists** — `/type-1` through `/type-5`

**Office pages** — `/assigned-requests`, `/processed-requests`,
`/approved-requests`, `/forwarded-for-action`, `/update-payment`,
`/create-faculty-user`, `/manage-news-events`, `/manage-announcements`,
`/generate-manpower-offer-letter`, `/view-generated-offer-letters`,
`/view-expenditure`, `/expenditure-details`, `/add-grant`

**Admin (SuperAdmin only)** — `/admin/workflows`, `/admin/roles`

For the exact role grant on every page, see [§3](#3-roles-at-a-glance)
above, or `API.Application/Access/PageCatalogue.cs` directly — that file
is the single source of truth; this manual is a human-readable mirror of
it, not a replacement.
