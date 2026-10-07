using API.Domain.Enums;

namespace API.Application.Access;

/// <summary>
/// The application's modules and pages, and which roles reach them today.
/// </summary>
/// <remarks>
/// Transcribed from <c>Sidebar.jsx</c>'s 24 links and <c>App.jsx</c>'s 40
/// routes, not designed afresh. The bar for this phase is that no user's
/// visibility changes on the day it ships, so any difference between this table
/// and the hardcoded gates it replaces is a bug in this table.
///
/// Scope reproduces what the shipped queries already do: faculty-facing pages
/// are <see cref="AccessScope.Own"/> because a PI sees their own work. Office
/// pages are seeded at <see cref="AccessScope.Department"/>, not Institute --
/// office staff are seeded into the R&amp;C department, which
/// <c>PageAccessService</c> widens to institute-wide because R&amp;C is
/// institute-wide, not because the role is senior. The two admin pages are the
/// one place Institute is granted directly: configuring access is not
/// department-scoped work. No query changes behaviour as a result of this seed.
/// </remarks>
public static class PageCatalogue
{
    /// <summary>
    /// Roles that <c>isOffice</c> resolved to in the pre-Phase-8 sidebar:
    /// <c>isDean || isDeputyRegistrar || isSuperintendent || isRegularStaff</c>.
    /// </summary>
    /// <remarks>
    /// Director is deliberately absent. The first version of this list included
    /// it, which would have handed the Director ten office pages they never had
    /// -- caught by diffing every role's resolved links against the old sidebar
    /// extracted from git, rather than by reading the code.
    ///
    /// Whether the Director should hold these pages is a real question, but it
    /// is a configuration change for an operator to make deliberately, not one
    /// to smuggle in through a seed.
    /// </remarks>
    public static readonly string[] Office =
        ["Dean", "DeputyRegistrar", "Superintendent", "RegularStaff"];

    /// <summary>
    /// The scope office roles are seeded at: Department, not Institute.
    /// </summary>
    /// <remarks>
    /// Institute-wide sight comes from belonging to the R&amp;C department, not
    /// from role rank -- see PageAccessService.IsInstituteWideAsync. Seeding
    /// these grants at Institute directly would make every Dean institute-wide
    /// regardless of where they work, which is the bug the R&amp;C model exists to
    /// fix. Office staff (clerk1, osrc, dyregrc, deanrc, directorrc) are seeded
    /// into the R&amp;C department, which is what widens Department to Institute
    /// for them and reproduces today's shipped behaviour.
    /// </remarks>
    private const AccessScope OfficeScope = AccessScope.Department;

    private static readonly string[] Faculty = ["Faculty"];
    private static readonly string[] Fellow = ["Fellow"];
    private static readonly string[] SuperAdmin = ["SuperAdmin"];

    /// <summary>Everyone signed in, regardless of role.</summary>
    public static readonly string[] Everyone = [];

    public record PageSeed(
        string Key,
        string Name,
        string Route,
        bool IsNavigable,
        string[] Roles,
        AccessScope Scope);

    public record ModuleSeed(
        string Key,
        string Name,
        string Group,
        PageSeed[] Pages);

    public static readonly ModuleSeed[] Modules =
    [
        new("dashboard", "Dashboard", "General",
        [
            new("dashboard.home", "Dashboard", "/dashboard", true, Everyone, AccessScope.Own),
            new("dashboard.profile", "My Profile", "/profile", false, Everyone, AccessScope.Own),
        ]),

        new("faculty-registration", "Faculty Registration", "General",
        [
            // Pending is granted no other page in this catalogue -- this is the
            // only place a newly self-registered, not-yet-approved PI can land.
            new("registration.pending", "Registration Pending", "/registration-pending", true, ["Pending"], AccessScope.Own),

            // One PageSeed carries exactly one Scope shared by every role in
            // Roles -- there is no per-role scope. Seeding both HOD and Office at
            // Department reproduces the "Office effectively sees everything"
            // behaviour PageAccessService.IsInstituteWideAsync already gives every
            // other Office-group page (see OfficeScope's own doc comment above):
            // office staff are seeded into the R&C department, which is flagged
            // institute-wide, so Department widens to Institute for them
            // automatically. No special-casing needed here.
            //
            // SuperAdmin is included alongside HOD/Office, matching hod.indents/
            // hod.joining's own precedent -- FacultyRegistrationService's
            // ReviewerOfficeRoles already treats SuperAdmin as institute-wide for
            // this feature, so it must be seeded here too or that branch is dead.
            new("faculty-registrations.review", "Pending Faculty Registrations", "/faculty-registrations", true, ["HOD", .. Office, "SuperAdmin"], OfficeScope),
        ]),

        // ProjectsController carries one class-level [PageAccess("projects.list")]
        // gating every action (Get, GetBudgetSummary, ListGrantReceipts included)
        // -- unlike proposals.detail, there is no separate per-action page key to
        // widen instead, and no other controller in this codebase overrides a
        // class-level [PageAccess] per-method, so following that same
        // single-attribute convention is what makes office roles' read access to
        // GetAsync (widened below, see ProjectService.RnCOfficeRoles) reachable
        // at all. IResearchProposalService.RecordSanctionAsync links an office
        // user straight to the Project it creates; without this, "Open project"
        // would 403 on the controller before ProjectService's own (already
        // correctly widened) check is ever reached.
        //
        // The list itself stays owner-filtered (ListForOwnerAsync is unchanged),
        // so an office role granted this page sees their own /projects page as
        // empty -- an honest, harmless side effect of the shared attribute, not
        // a data leak (they still cannot list every project, only view one by
        // id once they already have a link to it, e.g. from a proposal).
        new("projects", "Projects", "Faculty",
        [
            new("projects.list", "Projects", "/projects", true, ["Faculty", "HOD", "Dean", "Director", "DeputyRegistrar", "Superintendent", "RegularStaff"], AccessScope.Institute),
            // A project should normally come from a sanctioned research
            // proposal (ResearchProposalService.RecordSanctionAsync creates
            // it), not this manual form. Restricted to the R&C office roles
            // as a fallback for legacy/offline-sanctioned projects with no
            // proposal on file -- Faculty create through /proposals/new
            // instead, which ends in the same place once the office records
            // the sanction.
            new("projects.new", "New Project", "/projects/new", false, Office, OfficeScope),
            new("projects.detail", "Project Detail", "/projects/:id", false, ["Faculty", "HOD", .. Office], AccessScope.Own),
            new("projects.edit", "Edit Project", "/projects/:id/edit", false, Faculty, AccessScope.Own),
            new("projects.grant-receipt", "Add Grant Receipt", "/projects/:id/grant-receipts/new", false, Faculty, AccessScope.Own),
            // ProjectsController.RecordRefund. Office only -- a refund is
            // recorded by the office against a project, not by the PI who
            // owns it (Phase 10 spec Sec3a). RnCOfficeRoles matched Office
            // exactly, so this reuses the same constant as every other
            // Office-group page rather than a redefinition.
            new("projects.record-refund", "Record Project Refund", "/projects/:id/refunds", false, Office, OfficeScope),
            // HistoricalEntriesController. Office only -- an RnC office
            // staff member backfills a pre-existing project's real-world
            // expenditure/grant-receipt history on the PI's behalf, so
            // Available tallies with their offline records before the
            // project goes live in the portal. Uses Office/OfficeScope,
            // the same constants projects.new and projects.record-refund
            // already use, not a redefinition.
            new("projects.historical-entries", "Historical Expenditure & Grants",
                "/projects/historical-entries", true, Office, OfficeScope),
            new("projects.reappropriations-queue", "Budget Reappropriations", "/projects/reappropriations/queue", true, ["HOD", "Dean", .. Office, "SuperAdmin"], AccessScope.Institute),
        ]),

        new("expenditure", "Expenditure", "Faculty",
        [
            new("expenditure.details", "Expenditure Details", "/expenditure-details", true, Faculty, AccessScope.Own),
            new("expenditure.add-grant", "Add Grant Received", "/add-grant", true, Faculty, AccessScope.Own),
        ]),

        new("project-types", "Project Types", "Faculty",
        [
            new("project-types.type1", "Type-I: Research Projects", "/type-1", true, Faculty, AccessScope.Own),
            new("project-types.type2", "Type-II: Industry Projects", "/type-2", true, Faculty, AccessScope.Own),
            new("project-types.type3", "Type-III: Consultancy", "/type-3", true, Faculty, AccessScope.Own),
            new("project-types.type4", "Type-IV: Testing", "/type-4", true, Faculty, AccessScope.Own),
            new("project-types.type5", "Type-V: Other Activities", "/type-5", true, Faculty, AccessScope.Own),
        ]),

        // No sidebar link today -- reached from a project. Still needs a
        // permission, which is why pages key off routes rather than links.
        new("procurement", "Procurement", "Faculty",
        [
            new("procurement.list", "Procurement", "/procurement", false, ["Faculty", "HOD", .. Office, "Director", "SuperAdmin"], AccessScope.Own),
            new("procurement.detail", "Indent Detail", "/procurement/:indentType/:indentId", false, ["Faculty", "HOD", .. Office, "Director", "SuperAdmin"], AccessScope.Own),
            new("process-bill.list", "Process Bill", "/process-bill", true, Everyone, AccessScope.Institute),
            new("process-bill.form", "Process Bill Form", "/process-bill/:indentType/:indentId", false, Everyone, AccessScope.Institute),
            new("process-bill.travel-form", "Travel Bill Form", "/travel-bill-form/:indentId", false, Everyone, AccessScope.Institute),
            new("process-bill.travel-form-alt", "Travel Bill Form Alt", "/process-bill/travel/:indentId", false, Everyone, AccessScope.Institute),
        ]),

        new("travel", "Travel", "Faculty",
        [
            new("travel.detail", "Travel Request", "/travel/:travelRequestId", false, ["Faculty", "HOD", .. Office, "Director", "SuperAdmin"], AccessScope.Own),
        ]),

        new("recruitment", "Recruitment", "Faculty",
        [
            // Widened institute-wide (Faculty, HOD, Dean, SuperAdmin, Office)
            // and made navigable so /recruitment gets a real sidebar entry --
            // superseding the earlier Faculty/HOD-only, non-navigable seed,
            // which was still relying on Sidebar.jsx's now-removed hardcoded
            // "grant to everyone" bypass to be reachable at all.
            new("recruitment.list", "Recruitment", "/recruitment", true, ["Faculty", "HOD", "Dean", "SuperAdmin", .. Office], AccessScope.Institute),
            // ComputerCentre holds this grant solely to reach the
            // advertisement approval chain's final-stage Approve action
            // (rendered by AdvertisementChainActions.jsx on this page) --
            // not for general recruitment visibility, which the role has no
            // other reason to need. Without it, the terminal Approve --
            // the entire point of AdvertisementWorkflowSeeder's route -- had
            // no reachable UI: ComputerCentreAdvertisementApprovalsPage.jsx
            // links here, and ProtectedRoute.jsx bounces any role lacking
            // this page grant back to /dashboard before the action is ever
            // rendered (final whole-branch review finding 1).
            new("recruitment.detail", "Recruitment Detail", "/recruitments/:recruitmentId", false, ["Faculty", "HOD", "Dean", "SuperAdmin", "ComputerCentre", .. Office], AccessScope.Institute),
    new("recruitment.applications", "Candidate Applications", "/recruitments/:recruitmentId/applications", false, ["Faculty", "HOD", "Dean", "SuperAdmin", "ComputerCentre", .. Office], AccessScope.Institute),
            // RecruitmentController's PI-only write/read surface: Create,
            // List, ListOwn, Advertise, Readvertise, the committee/interview/
            // merit-list/offer/joining actions, and the document endpoints.
            // Deliberately narrower than recruitment.list/.detail above --
            // those now reach HOD/Dean/SuperAdmin/Office too, not just the
            // PI-only actions like submitting a committee or issuing an
            // offer, and this key must not silently widen those.
            // Route uniqueness is enforced across every page regardless of
            // navigability, so this gets its own non-navigable route string
            // rather than colliding with recruitment.list/.detail's.
            new("recruitment.pi-manage", "Recruitment Management (PI)", "/recruitment/manage", false, Faculty, AccessScope.Own),
            // Get/ListCandidates/ListCommittee: PI plus Dean oversight read
            // access. GetAsync's own piUserId substitution (see
            // RecruitmentController.Get) is what actually scopes a Dean's
            // read to the right PI's data -- this key only gates entry.
            // Non-navigable: no /recruitment-approvals route is wired into
            // App.jsx yet, so marking this navigable would be a dead sidebar
            // link. Flip IsNavigable to true and give it a real route once
            // that page ships.
            new("recruitment.dean-review", "Recruitment Review (Dean)", "/recruitments/:recruitmentId/review", false, ["Faculty", "Dean"], AccessScope.Own),
            // ApproveMeritList: BRD gives final merit-list approval to the
            // Dean alone. Distinct route from recruitment.dean-review above --
            // route uniqueness is enforced catalogue-wide regardless of
            // navigability.
            new("recruitment.approve-merit-list", "Approve Merit List", "/recruitments/:recruitmentId/approve", false, ["Dean"], AccessScope.Institute),
            // IssueIdCard: PI plus the office roles who actually print/issue
            // the physical card.
            new("recruitment.issue-id-card", "Issue Fellow ID Card", "/fellow-appointments/:selectionId/id-card", false, ["Faculty", "RegularStaff", "Superintendent", "DeputyRegistrar"], AccessScope.Own),
            // Advertisement approval chain (AdvertisementWorkflowSeeder) queue
            // pages: discovery aids so a reviewer can find work awaiting their
            // action without already knowing the recruitment id. The RnC
            // office stage's AllowedRoles ("RegularStaff,Superintendent,
            // DeputyRegistrar,Dean") is exactly the Office group, so this
            // reuses Office/OfficeScope like every other Office-group page --
            // Department scope, widened to Institute for R&C department
            // members by PageAccessService, same as proposals-rnc.queue.
            new("recruitment.advertisement-rnc-queue", "R&C Office Advertisements", "/recruitment/advertisement-rnc-queue", true, Office, OfficeScope),
            // The Computer Centre stage's AllowedRoles is "ComputerCentre"
            // alone -- not an Office-group role, and there is no departmental
            // Computer Centre to scope against, so this is granted at
            // Institute directly (SuperAdmin included for oversight, matching
            // the ComputerCentre-plus-SuperAdmin shape used elsewhere for
            // single-role approval stages).
            new("recruitment.advertisement-cc-queue", "Computer Centre Advertisement Approvals", "/recruitment/advertisement-cc-queue", true, ["ComputerCentre", "SuperAdmin"], AccessScope.Institute),
        ]),

        // Research proposals (Phase 9, BRD Prompt 1). PI's own list/create are
        // Own -- ResearchProposalService.ListOwnAsync/CreateDraftAsync are
        // both owner-scoped. The HOD queue is Department, matching
        // ListForHodAsync's IUserDepartmentProvider scoping (widened to
        // Institute for R&C department members by PageAccessService, the same
        // mechanism that widens every other office page here -- not granted
        // at Institute directly). The RnC office/Dean queue is seeded the
        // same way: Department scope granted to the office roles, who reach
        // institute-wide only via R&C department membership, exactly like
        // every other Office-group page below.
        //
        // proposals.detail is reachable from all four surfaces -- a PI's own
        // list, the HOD queue, the R&C office queue and (via WithDean) the
        // Dean's decision -- so unlike procurement.detail/travel.detail
        // (Faculty-only because only the PI ever opens those), it is granted
        // to every role that can legitimately land on a proposal, each at the
        // scope that role's queue already uses. IResearchProposalService.
        // GetAsync enforces the real per-proposal check (ownership or
        // department) independently of this page grant, exactly as the other
        // detail pages rely on their own service for the actual data scope.
        new("proposals", "Research Proposals", "Faculty",
        [
            new("proposals.list", "Research Proposals", "/proposals", true, Faculty, AccessScope.Own),
            new("proposals.new", "New Proposal", "/proposals/new", false, Faculty, AccessScope.Own),
            new("proposals.detail", "Proposal Detail", "/proposals/:id", false,
                ["Faculty", "HOD", .. Office], AccessScope.Own),
        ]),

        new("proposals-hod", "Department Proposal Queue", "Office",
        [
            new("proposals-hod.queue", "Department Proposal Queue", "/proposals/hod-queue", true, ["HOD"], AccessScope.Department),
        ]),

        new("proposals-rnc", "R&C Office Proposals", "Office",
        [
            new("proposals-rnc.queue", "R&C Office Proposals", "/proposals/rnc-queue", true, Office, OfficeScope),
            // RecordAgencySubmission/RecordSanction/RecordNotFunded/
            // ExtendExpiry: the office's out-of-band actions on a proposal
            // after the internal chain concludes (see ProposalsController's
            // own doc comment). Rendered from ProposalAgencyActions.jsx
            // inside ProposalDetailPage -- not proposals.detail itself,
            // which is wider (Faculty, HOD, Office) and would silently let
            // HOD/Faculty record a sanction or extend a deadline.
            new("proposals-rnc.agency-actions", "Proposal Agency Actions", "/proposals/:id/agency-actions", false, Office, OfficeScope),
        ]),

        // Grant-receipt approval chain (GrantReceiptWorkflowSeeder) queue
        // pages -- discovery aids mirroring proposals-hod.queue/
        // proposals-rnc.queue exactly, same reasoning: an HOD/office reviewer
        // should not need to already know a project/receipt id to find work
        // waiting on them. The RnC-office stage's AllowedRoles
        // ("RegularStaff,Superintendent,DeputyRegistrar,Dean") is exactly the
        // Office group, so that queue reuses Office/OfficeScope like every
        // other Office-group page. ProjectService.ListForRnCOfficeGrantReceiptQueueAsync
        // (and the Dean queue below) additionally re-check
        // IInstituteWideScopeResolver itself -- this page grant is entry-gate
        // only, not the real department-scope enforcement.
        new("grant-receipts-hod", "Department Grant Receipt Queue", "Office",
        [
            new("grant-receipts-hod.queue", "Department Grant Receipt Queue", "/projects/grant-receipts/hod-queue", true, ["HOD"], AccessScope.Department),
        ]),

        new("grant-receipts-rnc", "R&C Office Grant Receipts", "Office",
        [
            new("grant-receipts-rnc.queue", "R&C Office Grant Receipts", "/projects/grant-receipts/rnc-queue", true, Office, OfficeScope),
        ]),

        // DA/Superintendent/DeputyRegistrar grant-receipt queues -- added
        // when the chain was expanded to split the old combined RnC-office
        // stage into three separate single-role stages, matching Research
        // Proposal's own depth. Each is single-role (not the Office group),
        // matching the new route's own single-role AllowedRoles per stage
        // (GrantReceiptWorkflowSeeder.Route), the same way grant-receipts-hod.queue
        // uses ["HOD"] alone rather than the Office group.
        new("grant-receipts-da", "DA Grant Receipt Queue", "Office",
        [
            new("grant-receipts-da.queue", "DA Grant Receipt Queue", "/projects/grant-receipts/da-queue", true, ["RegularStaff"], OfficeScope),
        ]),

        new("grant-receipts-superintendent", "Superintendent Grant Receipt Queue", "Office",
        [
            new("grant-receipts-superintendent.queue", "Superintendent Grant Receipt Queue", "/projects/grant-receipts/superintendent-queue", true, ["Superintendent"], OfficeScope),
        ]),

        new("grant-receipts-dr", "Deputy Registrar Grant Receipt Queue", "Office",
        [
            new("grant-receipts-dr.queue", "Deputy Registrar Grant Receipt Queue", "/projects/grant-receipts/dr-queue", true, ["DeputyRegistrar"], OfficeScope),
        ]),

        // Dean-scoped grant-receipt queue. No direct precedent in this
        // catalogue -- every existing Dean-reachable page today is either an
        // Office-group page (Dean is one of the four Office roles) or
        // proposals.detail's own wider Faculty/HOD/Office grant. This is the
        // first page keyed to a Dean-only, non-Office-group stage
        // (WithDeanGrantReceipt's AllowedRoles is "Dean,Director", not the
        // Office group's four roles). Deliberately seeded at
        // AccessScope.Department, matching every other queue page in this
        // catalogue (proposals-hod.queue, proposals-rnc.queue,
        // grant-receipts-hod.queue, grant-receipts-rnc.queue all use
        // Department, widened to Institute only via R&C department
        // membership) rather than granting Institute directly, which would
        // make every Dean institute-wide regardless of department -- the same
        // reasoning OfficeScope's own doc comment gives for office roles.
        // Director is included alongside Dean because the route's own
        // AllowedRoles string is "Dean,Director" (see
        // GrantReceiptWorkflowSeeder.Route, sequence 4) -- narrowing this
        // page to Dean alone would hide the queue from a Director who the
        // workflow engine already lets act at this stage.
        new("grant-receipts-dean", "Dean Grant Receipt Queue", "Office",
        [
            new("grant-receipts-dean.queue", "Dean Grant Receipt Queue", "/projects/grant-receipts/dean-queue", true, ["Dean", "Director"], AccessScope.Department),
        ]),

        // HOD department-oversight pages. Frontend-only mockups today (no
        // API wiring behind any of them yet), but registered here from the
        // start rather than left as the hardcoded "allow everyone" bypass
        // they shipped with in Sidebar.jsx/AccessProvider.jsx/App.jsx --
        // an Applicant or Fellow could otherwise reach a department
        // approval queue by typing the URL. HOD only, Department scope,
        // matching proposals-hod.queue's precedent exactly.
        new("hod", "HOD Department Portal", "Office",
        [
            new("hod.dashboard", "HOD Executive Portal", "/hod-dashboard", true, ["HOD"], AccessScope.Department),
            new("hod.consultancy", "Consultancy Assignment", "/consultancy-requests", true, ["HOD"], AccessScope.Department),
            new("hod.fellowships", "Fellowship Approvals", "/fellowship-claims", true, ["HOD", "RegularStaff", "Superintendent", "DeputyRegistrar", "Dean"], AccessScope.Department),
            // Widened past HOD-only to match LeaveController's real
            // authorized roles (ListAll/Consume: Faculty, HOD, RegularStaff,
            // Superintendent, DeputyRegistrar, Dean, Director, SuperAdmin) --
            // this page now calls real, backend-gated endpoints, unlike the
            // rest of the hod.* module, which is still frontend-only mockup
            // content. A narrower page grant than the API it calls would
            // just 403 the roles the API itself already lets act.
            new("hod.leaves", "Leave & NOC Approvals", "/leave-approvals", true,
                ["Faculty", "HOD", "RegularStaff", "Superintendent", "DeputyRegistrar", "Dean", "Director", "SuperAdmin"],
                AccessScope.Department),
            new("hod.indents", "Indent Approvals", "/indent-approvals", true, ["HOD", .. Office, "Director", "SuperAdmin"], AccessScope.Department),
            new("hod.travels", "Travel Approvals", "/travel-approvals", true, ["Faculty", "HOD", .. Office, "Director", "SuperAdmin"], AccessScope.Department),
            new("hod.joining", "Joining Report Approvals", "/joining-reports", true, ["HOD", .. Office, "Director", "SuperAdmin"], AccessScope.Department),
            new("hod.overhead", "Department Overhead Funds", "/overhead-funds", true, ["HOD"], AccessScope.Department),
        ]),

        new("fellowship", "Fellowship", "Fellow",
        [
            new("fellowship.claims", "Fellowship", "/fellowships", true, Fellow, AccessScope.Own),
            // FellowshipController's PI-facing actions (ListForProject,
            // Recommend). No dedicated route today -- ProjectClaimsSection.jsx
            // exists but is not wired into any page yet -- so this mirrors
            // procurement.detail/travel.detail: a real permission with no
            // sidebar entry, reachable once the frontend wires it up. Faculty
            // only, matching [Authorize(Roles = "Faculty")] exactly; not
            // projects.detail, which is wider (Faculty, HOD, Office) and would
            // silently grant HOD/office roles fellowship recommend rights.
            new("fellowship.pi-review", "Fellowship Claims (PI Review)", "/projects/:id/fellowship-claims", false, Faculty, AccessScope.Own),
            // OverrideHra. Dean,Director only -- a pay-affecting privilege
            // (see the controller's own doc comment), re-checked in
            // FellowshipService against the caller's actual roles regardless
            // of this page grant.
            new("fellowship.override-hra", "Override Fellowship HRA", "/fellowship-claims/:id/override-hra", false, ["Dean", "Director"], AccessScope.Institute),
        ]),

        new("leave", "Leave", "Fellow",
        [
            new("leave.requests", "Leave", "/leaves", true, Fellow, AccessScope.Own),
            new("travel.requests", "Travel Requests", "/travels", true, Fellow, AccessScope.Own),
            new("noc.requests", "PhD NOC Requests", "/noc-requests", true, ["Fellow", "Faculty", "HOD", .. Office], AccessScope.Own),
            new("experience-certificate.requests", "Request for Experience Certificate", "/experience-certificate-requests", true, ["Fellow", "Applicant", "Candidate", "Faculty", "HOD", .. Office], AccessScope.Own),
            new("medical-facility.requests", "Request for Medical Facility", "/medical-facility-requests", true, ["Fellow", "Applicant", "Candidate", "Faculty", "HOD", .. Office], AccessScope.Own),
            new("id-card.requests", "ID Card Requests", "/id-card-requests", true, ["Fellow", "Faculty", "HOD", "Library", "SuperAdmin", .. Office], AccessScope.Own),
        ]),

        // Applicants keep access after promotion to Fellow, which is why both
        // roles appear -- matching the sidebar's `isApplicant || isFellow`.
        new("applications", "Applications", "Fellow",
        [
            new("applications.mine", "My Applications", "/my-applications", true, ["Applicant", "Fellow"], AccessScope.Own),
            // RecruitmentController.Apply. Applicant only, deliberately
            // narrower than applications.mine -- a Fellow (already hired)
            // reading their past application is fine, submitting a new one
            // is not, so this must not widen to Fellow the way reusing
            // applications.mine here would.
            new("applications.apply", "Apply to Recruitment", "/recruitments/:id/apply", false, ["Applicant"], AccessScope.Own),
        ]),

        new("office-queues", "Request Queues", "Office",
        [
            // Assigned Requests is RegularStaff-only today while the other
            // three are isOffice. Preserved rather than tidied: changing it
            // here would be a visibility change disguised as a seed.
            new("queues.assigned", "Assigned Requests", "/assigned-requests", true, ["RegularStaff"], OfficeScope),
            new("queues.processed", "Processed Requests", "/processed-requests", true, Office, OfficeScope),
            new("queues.approved", "Approved Requests", "/approved-requests", true, Office, OfficeScope),
            new("queues.forwarded", "Forwarded for Action", "/forwarded-for-action", true, Office, OfficeScope),
        ]),

        new("payments", "Payments", "Office",
        [
            new("payments.update", "Update Payment", "/update-payment", true, Office, OfficeScope),
            new("payment.voucher", "Payment Voucher", "/payment-voucher", true, ["Faculty", "HOD", .. Office], AccessScope.Own),
            new("noting.page", "Noting Page", "/noting-page", true, ["Faculty", "HOD", .. Office], AccessScope.Own),
        ]),


        new("faculty-admin", "Faculty Accounts", "Office",
        [
            new("faculty-admin.create", "Create Faculty User", "/create-faculty-user", true, Office, OfficeScope),
        ]),

        new("content", "Content", "Office",
        [
            new("content.news", "Manage News & Events", "/manage-news-events", true, Office, OfficeScope),
            // Director appears here alongside Office, unlike every other
            // Office-group page: AnnouncementsController.ManageRoles already
            // granted Director this write API before this page was gated to
            // it, so seeding Office-only would have silently taken that
            // access away. See
            // PageAccessSeederTests.DirectorIsNotAnOfficeRoleForThesePages
            // for the general rule this is a deliberate, documented
            // exception to.
            new("content.announcements", "Manage Announcements", "/manage-announcements", true, [.. Office, "Director"], OfficeScope),
            new("content.funding-agencies", "Manage Funding Agencies", "/manage-funding-agencies", true, Office, OfficeScope),
            new("content.departments", "Manage Departments", "/manage-departments", true, Office, OfficeScope),
            // Approval email notifications feature. SuperAdmin added alongside
            // Office here -- unlike Office alone, which is [Dean,
            // DeputyRegistrar, Superintendent, RegularStaff] with no SuperAdmin
            // -- because the spec's stated intent is "SuperAdmin + R&C Office"
            // can edit templates, matching content.announcements' own
            // [.. Office, "Director"] precedent for widening a single page past
            // the plain Office group.
            new("content.email-templates", "Manage Email Templates", "/manage-email-templates", true, [.. Office, "SuperAdmin"], OfficeScope),
            new("content.email-log", "Email Log", "/email-log", true, [.. Office, "SuperAdmin"], OfficeScope),
        ]),

        new("offer-letters", "Offer Letters", "Office",
        [
            new("offer-letters.manpower", "Generate Manpower Offer Letter", "/generate-manpower-offer-letter", true, Office, OfficeScope),
            new("offer-letters.generate", "Generate Offer Letter", "/generate-offer-letter", false, Office, OfficeScope),
            new("offer-letters.view-generated", "View Generated Offer Letters", "/view-generated-offer-letters", true, Office, OfficeScope),
            new("offer-letters.view", "View Offer Letters", "/view-offer-letters", false, Office, OfficeScope),
        ]),

        new("office-expenditure", "Expenditure Reports", "Office",
        [
            new("office-expenditure.view", "View Expenditure", "/view-expenditure", true, Office, OfficeScope),
        ]),

        // Reporting dashboard (Phase 10, BRD Prompt 6 / A10). Granted to
        // Faculty, HOD and Office roles alike -- ReportingService itself
        // resolves the actual scope (Own/Department/Institute) from the
        // caller's roles, the same widening rule already governing page
        // access and the proposal/indent queues (see
        // IInstituteWideScopeResolver). The AccessScope value on each page
        // row here is informational for the sidebar, not what the report
        // query itself is bounded by -- proposals.detail set this same
        // precedent for a page reachable by more than one role's queue.
        new("reports", "Reports", "Faculty",
        [
            new("reports.number-of-projects", "Number of Projects", "/reports/number-of-projects", true,
                ["Faculty", "HOD", .. Office], AccessScope.Own),
            new("reports.grant-sanctioned", "Grant Sanctioned", "/reports/grant-sanctioned", true,
                ["Faculty", "HOD", .. Office], AccessScope.Own),
            new("reports.project-expenditure", "Project-wise Expenditure", "/reports/project-expenditure", true,
                ["Faculty", "HOD", .. Office], AccessScope.Own),
            new("reports.project-overhead", "Project-wise Overhead", "/reports/project-overhead", true,
                ["Faculty", "HOD", .. Office], AccessScope.Own),
            new("reports.refunds", "Refund Reports", "/reports/refunds", true,
                ["Faculty", "HOD", .. Office], AccessScope.Own),
            // Staff Count has no Own-scope meaning for Faculty (BRD A11: a PI
            // gets no institute-wide view of anything) -- ReportingService
            // itself returns an empty list for that case rather than the
            // page being hidden, matching how other reports handle "nothing
            // in scope" as an empty result, not an error.
            new("reports.staff-count", "Staff Count", "/reports/staff-count", true,
                ["Faculty", "HOD", .. Office], AccessScope.Own),
            new("reports.project-equipment", "Project-wise Equipment List", "/reports/project-equipment", true,
                ["Faculty", "HOD", .. Office], AccessScope.Own),
            new("reports.recruitment-funnel", "Recruitment Funnel", "/reports/recruitment-funnel", true,
                ["Faculty", "HOD", .. Office], AccessScope.Own),
        ]),

        new("workflow-config", "Approval Routes", "Admin",
        [
            new("workflow-config.routes", "Approval Routes", "/admin/workflows", true, SuperAdmin, AccessScope.Institute),
        ]),

        new("access-config", "Roles & Access", "Admin",
        [
            new("access-config.roles", "Roles & Access", "/admin/roles", true, SuperAdmin, AccessScope.Institute),
        ]),

        new("admin-users", "User Management", "Admin",
        [
            new("admin.users.manage", "Manage Users", "/admin/users", true, SuperAdmin, AccessScope.Institute),
        ]),
    ];
}
