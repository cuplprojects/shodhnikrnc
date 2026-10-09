# Phase 8 — Module-Level RBAC (Spec)

Derived from the shipped code, not from the BRD alone: the module list below is
transcribed from `Sidebar.jsx` and `App.jsx` as they stand.

Scope confirmed with the user:
- **Permissions stored per page**; the module checkbox is a grouping control.
- **Per-role, plus per-user grants** (deny beats grant beats role).
- **Roles creatable**; the nine seeded roles protected from rename and delete.
- **Route guards included** — the URL hole is closed, not just the sidebar.
- **Department scoping included** (added after review). A permission carries a
  scope — Own / Department / Institute — so "HOD reviews proposals" means their
  own department's, while "Dean reviews proposals" means every department's.

---

## 1. What exists today

The application has role *checks*. It does not have RBAC in the sense of
assignable module permissions. Three separate, hardcoded places:

**Backend** — role names compiled into attributes:

| Controller | Gate |
|---|---|
| `ProjectsController` | `[Authorize(Roles = "Faculty")]` |
| `ConsumableIndentsController` | `[Authorize(Roles = "Faculty")]` |
| `ContingencyIndentsController` | `[Authorize(Roles = "Faculty")]` |
| `EquipmentIndentsController` | `[Authorize(Roles = "Faculty")]` |
| `TravelRequestsController` | `[Authorize(Roles = "Faculty")]` |
| `AnnouncementsController` | office roles |
| `WorkflowDefinitionsController` | `[Authorize(Roles = "SuperAdmin")]` |
| `Fellowship`, `Leave`, `Recruitment`, `Documents`, `Workflow` | `[Authorize]` only |

**Frontend** — 23 hardcoded gates in `Sidebar.jsx` (`show: isFaculty`,
`show: isOffice`, …), across 24 links and 6 distinct conditions.

**Routes** — not gated at all. `ProtectedRoute` checks `token` and nothing
else, so **any signed-in user can reach any page by typing its URL**. The API
still refuses the data, so this is not a data leak; it is a broken screen
instead of a clear refusal.

`RoleClaims` exists as a table (ASP.NET Identity creates it) and is **entirely
unused** — no code reads or writes it.

### Two defects found while surveying

1. **43 routes, 24 sidebar links.** `/procurement`, `/recruitment`, `/profile`
   and `/travel/:id` have no link at all. A module model must therefore key off
   routes, not sidebar entries, or those pages stay ungoverned.
2. **Three duplicate route registrations** — `/manage-announcements`,
   `/manage-news-events`, `/view-expenditure` each appear twice with different
   components. React Router takes the first; the second is dead code. Flagged
   during the PR #6 review and still open. Phase 8 must resolve them, since a
   module cannot cleanly map to a path that resolves to two different pages.

---

## 2. Domain model

Permissions are stored **per page**. The module is a grouping for the admin UI,
not a second kind of grant.

That is a deliberate choice over storing module-level grants alongside page
grants. With two grant types, "why can this user see X" has two possible
answers, and "all of Projects except the edit page" cannot be expressed at all.
With one, the module checkbox is a convenience that ticks its pages, shows
indeterminate when only some are on, and every effective permission has exactly
one source.

```
Module
  Id          Guid
  Key         string   stable identifier, e.g. "projects" — never renamed
  Name        string   display name
  Group       string   sidebar grouping: Faculty / Fellow / Office / Admin
  DisplayOrder int

Page
  Id          Guid
  ModuleId    Guid
  Key         string   stable identifier, e.g. "projects.edit"
  Name        string   display name, shown in the sidebar when IsNavigable
  Route       string   the React route pattern, e.g. "/projects/:id/edit"
  IsNavigable bool     false for detail pages that have no sidebar link
  DisplayOrder int

RolePageAccess
  RoleId      Guid
  PageId      Guid
  Scope       Own | Department | Institute

UserPageGrant
  UserId      Guid
  PageId      Guid
  Effect      Grant | Deny      -- an explicit exception either way
  Scope       Own | Department | Institute
  Reason      string            -- required; an unexplained exception is unauditable
  GrantedBy   Guid
  GrantedAt   DateTimeOffset
```

### Resolution order

```
effective(user, page) =
    if any UserPageGrant(user, page) with Effect=Deny  -> denied
    if any UserPageGrant(user, page) with Effect=Grant -> allowed
    else union of RolePageAccess over the user's roles
```

**Deny beats Grant beats role.** An explicit deny must be the strongest signal,
or revoking one person's access means editing every role they hold.

### R&C membership, not role rank, confers institute-wide sight

Added after Phase 8 shipped, correcting an assumption in the original design.

Every user carries a `DepartmentId` -- faculty, PI, HOD, Dean, Director alike.
One department is the R&C office. **Belonging to R&C is what widens a scope to
institute-wide; the role does not.**

```
resolve(user, page):
    scope = widest the user's roles and grants give
    if scope == Department and user's department is institute-wide:
        scope = Institute
```

So a Dean of Civil Engineering sees Civil Engineering's data; the same Dean role
held by someone in R&C sees every department's. The office staff -- clerk,
Superintendent, Deputy Registrar, Dean R&C, Director -- belong to R&C, which is
why they see everything: their existing institute-wide behaviour falls out of
the rule rather than being an exception to it.

`Department.IsInstituteWide` carries this rather than matching on the code
`"RNC"`, so the rule is a property of the row an operator can see and change,
not a string comparison buried in the resolver.

**The original design had this backwards**: office roles were granted
`AccessScope.Institute` directly, in 16 places, which made a Dean
institute-wide by virtue of being a Dean. Under the corrected model those grants
become `Department`, and R&C membership does the widening.

### Scope: which rows, not which pages

Page access answers "can this user open the proposals page". Scope answers
"which proposals do they see once it is open". Both are needed and neither
substitutes for the other: granting `proposals.review` to HOD without a scope
means **every HOD sees every department's proposals**.

```
Own         rows the user owns (a PI's own proposals)
Department  rows belonging to the user's department (an HOD's)
Institute   all rows (Dean, Director, R&C office)
```

Resolved scope is the **widest** the user holds for that page, across roles and
grants — a user who is both HOD and Dean sees institute-wide, not the narrower
of the two.

Scope is enforced in query filters, not in the UI. A narrowed scope that only
hides rows in the sidebar is not a permission, it is a decoration.

### Each department has one HOD

`HOD` is a role, and every user in it belongs to a department like any other
user — but a department also has *its* HOD, and that is a relationship the role
tag alone cannot express. "Which proposals does this HOD forward" is answerable
from `DepartmentId` scoping; "who is the HOD of Civil Engineering" is not.

```
Department
  Id, Code, Name
  HeadUserId  Guid?   -- the current HOD; null while vacant
```

Deliberately a pointer on `Department` rather than a flag on the user: it makes
"one HOD per department" a property of the schema, and reassigning the role is a
single write. A user holding the HOD role without being any department's head is
possible and harmless -- they scope to their own department and head nothing.

`HeadUserId` is nullable because departments do go without a head, and a model
that cannot express a vacancy invites a fake one.

### Department lives on the user, not the profile

`FacultyProfile.Department` exists today as a nullable string on a table added
by a colleague, unreferenced by any authorization code. That is not usable as a
scoping key: it is free text, it covers only faculty, and nothing guarantees it
is set.

This phase adds a `Department` entity and `ApplicationUser.DepartmentId`.
`FacultyProfile.Department` is backfilled into it where it matches a known
department, and the free-text column is left in place rather than migrated
away — it is a colleague's, and other code may read it.

### Why `Key` and not the name

The sidebar label will change ("Manage News & Events" is already inconsistent
with its route). Access rows must not follow. `Key` is the identity; `Name` is
display.

### Roles are creatable, seeded ones are protected

A SuperAdmin can create, rename and delete **custom** roles. The nine seeded
roles — Faculty, RegularStaff, Superintendent, DeputyRegistrar, Dean, Director,
Fellow, Applicant, SuperAdmin — cannot be renamed or deleted.

Not caution for its own sake: Phase 7's workflow stages store `AllowedRoles` as
role *names*, and several controllers still name roles in attributes. Renaming
`Dean` would silently orphan every stage that grants it, and the engine would
refuse those stages with no visible cause. Deleting a role that any workflow
stage references is refused outright, with the count — the same shape as the
Phase 7 validator's rule 5.

### Why `Reason` is required on a user grant

Per-user exceptions are the part of any RBAC system that rots. Requiring a
reason makes an audit answerable a year later, and costs one text field.

---

## 3. Seeding: behaviour must not change on day one

Same bar as Phase 7. The seed is transcribed from the 24 sidebar links and the
controller attributes, so every user sees exactly what they see today.

Every page below is transcribed from the 24 sidebar links and 40 routes. Scope
reproduces today's behaviour, which is `Own` for faculty-facing pages (a PI sees
their own projects) and `Institute` for office pages (the office sees
everything) — because that is what the shipped queries already do.

| Module | Page (Key) | Route | Nav | Roles → Scope |
|---|---|---|---|---|
| `dashboard` | `dashboard.home` | `/dashboard` | ✓ | *(all)* → Own |
| `projects` | `projects.list` | `/projects` | ✓ | Faculty → Own |
| | `projects.detail` | `/projects/:id` | ✗ | Faculty → Own |
| | `projects.new` | `/projects/new` | ✗ | Faculty → Own |
| | `projects.edit` | `/projects/:id/edit` | ✗ | Faculty → Own |
| | `projects.grant-receipt` | `/projects/:id/grant-receipts/new` | ✗ | Faculty → Own |
| `expenditure` | `expenditure.details` | `/expenditure-details` | ✓ | Faculty → Own |
| | `expenditure.add-grant` | `/add-grant` | ✓ | Faculty → Own |
| `project-types` | `project-types.type1` … `type5` | `/type-1` … `/type-5` | ✓ | Faculty → Own |
| `procurement` | `procurement.list` | `/procurement` | ✗ | Faculty → Own |
| | `procurement.detail` | `/procurement/:indentType/:indentId` | ✗ | Faculty → Own |
| `travel` | `travel.detail` | `/travel/:travelRequestId` | ✗ | Faculty → Own |
| `recruitment` | `recruitment.list` | `/recruitment` | ✗ | Faculty → Own |
| | `recruitment.detail` | `/recruitments/:recruitmentId` | ✗ | Faculty → Own |
| `fellowship` | `fellowship.claims` | `/fellowships` | ✓ | Fellow → Own |
| `leave` | `leave.requests` | `/leaves` | ✓ | Fellow → Own |
| `applications` | `applications.mine` | `/my-applications` | ✓ | Applicant, Fellow → Own |
| `office-queues` | `queues.assigned` | `/assigned-requests` | ✓ | **RegularStaff only** → Institute |
| | `queues.processed` | `/processed-requests` | ✓ | office → Institute |
| | `queues.approved` | `/approved-requests` | ✓ | office → Institute |
| | `queues.forwarded` | `/forwarded-for-action` | ✓ | office → Institute |
| `payments` | `payments.update` | `/update-payment` | ✓ | office → Institute |
| `faculty-admin` | `faculty-admin.create` | `/create-faculty-user` | ✓ | office → Institute |
| `content` | `content.news` | `/manage-news-events` | ✓ | office → Institute |
| | `content.announcements` | `/manage-announcements` | ✓ | office → Institute |
| `offer-letters` | `offer-letters.manpower` | `/generate-manpower-offer-letter` | ✓ | office → Institute |
| | `offer-letters.generate` | `/generate-offer-letter` | ✗ | office → Institute |
| | `offer-letters.view` | `/view-generated-offer-letters` | ✓ | office → Institute |
| | `offer-letters.view-all` | `/view-offer-letters` | ✗ | office → Institute |
| `office-expenditure` | `office-expenditure.view` | `/view-expenditure` | ✓ | office → Institute |
| `profile` | `profile.mine` | `/profile` | ✗ | *(all)* → Own |
| `workflow-config` | `workflow-config.routes` | `/admin/workflows` | ✓ | SuperAdmin → Institute |
| `access-config` | `access-config.roles` | `/admin/roles` | ✓ | SuperAdmin → Institute |

"office" = Dean, DeputyRegistrar, Superintendent, RegularStaff — exactly what
`isOffice` resolved to. **Director is not an office role** for these pages: the
pre-Phase-8 sidebar's `isOffice` did not include it, and adding it would grant
the Director ten pages they never had.

### The HOD role, and what it does not get yet

`HOD` is created by this phase (it does not exist, though the BRD names it in
six workflows) but is **seeded with no module access** — only the universal
pages, dashboard and profile. Nothing in the shipped application is HOD-gated
today, so granting it a module here would invent behaviour rather than preserve
it.

It does get the universal pages, because "everyone signed in" includes an HOD
and a role that can authenticate but reach nothing at all is a broken account
rather than a narrow one. An earlier draft of this section said "no page
access", which a test caught as contradicting the everyone-reaches-the-dashboard
rule.

The department dashboard and proposal review the user described are pages that
do not exist — there is no `Proposal` entity, controller or page anywhere in the
codebase; that is BRD Prompt 1, unbuilt. When those pages are built they get
`HOD → Department` and `Dean, Director → Institute`, which is exactly what this
model is for. Creating the role now means that is a data change then.

`PI` and `Dealing Assistant` are not created: they are the BRD's names for the
existing `Faculty` and `RegularStaff` roles. Renaming those would orphan the
Phase 7 workflow stages that store role names.

**The regression bar:** the existing 309 tests pass unmodified, and the browser
suites from Phases 4–7 still pass, because they drive the sidebar for Faculty,
Fellow, office and SuperAdmin users.

`Assigned Requests` is RegularStaff-only today while the other three queues are
`isOffice` — the seed must preserve that asymmetry rather than tidy it.

---

## 4. Backend

- `IPageAccessService` — `GetPagesForUserAsync(userId)`,
  `CanAccessAsync(userId, pageKey)`, and `GetScopeAsync(userId, pageKey)`
  returning the widest scope the user holds.
- `IScopedQuery` — applies a resolved scope to a query, so scoping is enforced
  once rather than reimplemented per controller.
- `GET /api/my/pages` — the pages the signed-in user may open, grouped by
  module. The sidebar's and the route guard's source of truth. Only
  `IsNavigable` pages become links; the rest govern direct navigation.
- A `PageAccessRequirement` authorization policy replacing
  `[Authorize(Roles = "Faculty")]` with `[PageAccess("projects.list")]`.
- Admin: `GET /api/admin/modules` (the full tree), `GET/PUT
  /api/admin/roles/{id}/pages`, `POST/DELETE /api/admin/users/{id}/page-grants`,
  and `GET/POST/PUT/DELETE /api/admin/roles` for role management.

Cached per request, as `IWorkflowDefinitionService` is: long enough to avoid
re-querying per check, short enough that a permission change takes effect on the
next request rather than at recycle.

**Workflow stage roles stay separate.** Phase 7 governs *who approves at a
stage*; this governs *who may open a module*. Conflating them would mean
removing someone's Procurement access silently changed who can approve indents.

---

## 5. Frontend

- Sidebar renders from `GET /api/my/pages` — the 23 hardcoded gates go.
- `ProtectedRoute` gains page awareness: a user reaching a route outside their
  pages is redirected to the dashboard with an explanation, rather than loading
  a shell that then errors. Detail routes are matched by pattern, so
  `/projects/42/edit` resolves to the `projects.edit` page.
- `/admin/roles` — create and edit roles, and set their permissions as a tree:
  a module checkbox that ticks all its pages and shows indeterminate when only
  some are on, with each page individually checkable beneath it. Seeded roles
  are editable but not renameable or deletable.
- A per-user grant panel requiring a reason, listing existing grants with who
  set them and when.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| A renamed or deleted role orphans workflow stages | Seeded roles locked; deleting a role any stage references is refused with the count |
| Seed drifts from today's visibility | 309 tests unmodified + Phase 4–7 browser suites, which already assert sidebar contents per role |
| A user locked out of their own work | Deny is explicit and reasoned; `dashboard` is never removable |
| Duplicate routes make module mapping ambiguous | Resolved first, as Task 1 |
| Two authorization systems confused | Module access and workflow stage roles are deliberately separate models, documented at both |
| Scope enforced in the UI only | Scope must filter queries; a hidden row is not a protected row. Verified by calling the API directly as a scoped user, not by reading the screen |
| Existing queries already filter by owner | The seed sets faculty pages to `Own` precisely because that is what they do today; the bar is that no query changes behaviour |
| Per-user grants accumulate unaudited | `Reason` required, and the admin UI lists all grants with who set them and when |

---

## 7. Deferred

- **Field-level permissions** (who may see the IDF figure — BRD Prompt 5).
- ~~Data scoping~~ — **moved into this phase** after review. See §2.
- **Edit-level permissions.** This phase governs whether a page can be opened.
  Distinguishing view from edit *within* a page is a separate pass, and belongs
  with the field-level work rather than bolted on here.
