using API.Application.Access;
using API.Application.Common;
using API.Application.Notifications;
using API.Application.Proposals;
using API.Application.Recruitment;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Seed;

public static class DbSeeder
{
    // Applicant and Fellow are deliberately their own roles rather than reusing
    // RegularStaff: a fellow must not inherit office permissions.
    //
    // Director is new in Phase 6. Phase 1 built a Director workflow stage and a
    // Dean-only ForwardToDirector action but never seeded the role, so anything
    // forwarded to the Director could not be acted on by anyone. This adds the
    // role because the HRA override needs it; giving it approve/reject rights at
    // the Director stage would change behaviour across four shipped slices and
    // belongs in its own change.
    //
    // HOD is seeded with department-scoped proposal queue and report access.
    //
    // SuperAdmin is Phase 7's, and is deliberately not Dean or Director. Those
    // roles decide individual requests; SuperAdmin configures the process those
    // requests follow. Someone who may approve a claim should not thereby be
    // able to rewrite who approves claims -- and because the engine now reads
    // AllowedRoles from the database, that second power is the larger one.
    //
    // Library is the ID Card request workflow's first stage
    // (IdCardRequestsController: Library -> PI -> HOD -> Dean). Without a
    // real account holding it, every request shipped permanently stuck at
    // "Pending Library Approval" -- reachable only via SuperAdmin's
    // fallback, not by anyone actually doing the job.
    //
    // Pending is a third placeholder role alongside Applicant/Fellow: a
    // self-registered PI must not inherit Faculty permissions before an HOD
    // or Office reviewer has approved them (see FacultyRegistrationService).
    private static readonly string[] Roles =
        ["Faculty", "RegularStaff", "Superintendent", "DeputyRegistrar", "Dean", "Applicant", "Fellow", "Director", "SuperAdmin", "HOD", "Library", "ComputerCentre", "Pending"];

    public static async Task SeedAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

        foreach (var role in Roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole<Guid>(role));
            }
        }

        await EnsureUserAsync(userManager, "deanrc", "Dean@12345", "Dean R&C", "Dean");
        await EnsureUserAsync(userManager, "dyregrc", "DyReg@12345", "Deputy Registrar", "DeputyRegistrar");
        await EnsureUserAsync(userManager, "osrc", "Osrc@12345", "Superintendent R&C", "Superintendent");
        await EnsureUserAsync(userManager, "clerk1", "Clerk@12345", "Office Clerk One", "RegularStaff");
        await EnsureUserAsync(userManager, "faculty1", "Faculty@12345", "Faculty Member One", "Faculty");
        await EnsureUserAsync(userManager, "directorrc", "Director@12345", "Director", "Director");
        await EnsureUserAsync(userManager, "superadmin", "SuperAdmin@12345", "Workflow Administrator", "SuperAdmin");
        await EnsureUserAsync(userManager, "hod1", "Hod@12345", "HOD Computer Science", "HOD");
        await EnsureUserAsync(userManager, "library1", "Library@12345", "Library Desk One", "Library");
        await EnsureUserAsync(userManager, "computercentre1", "ComputerCentre@12345", "Computer Centre Admin", "ComputerCentre");

        // Named staff (BRD Prompt 6 / A11). Usernames are {firstname}1,
        // matching faculty1's own convention -- chosen to avoid collision
        // with any future same-named account. All RegularStaff: the BRD
        // separately names Dean/DR/Superintendent as distinct administrative
        // roles above, so these six read as the general office staff tier
        // below that (confirmed with the user, not assumed).
        await EnsureUserAsync(userManager, "harshit1", "Harshit@12345", "Harshit", "RegularStaff");
        await EnsureUserAsync(userManager, "sadhvi1", "Sadhvi@12345", "Sadhvi", "RegularStaff");
        await EnsureUserAsync(userManager, "ashok1", "Ashok@12345", "Ashok", "RegularStaff");
        await EnsureUserAsync(userManager, "shyamu1", "Shyamu@12345", "Shyamu", "RegularStaff");
        await EnsureUserAsync(userManager, "renu1", "Renu@12345", "Renu", "RegularStaff");
        await EnsureUserAsync(userManager, "prateek1", "Prateek@12345", "Prateek", "RegularStaff");

        var db = services.GetRequiredService<IApplicationDbContext>();
        
        // Ensure missing bill columns are added to indents table
        await EnsureIndentBillColumnsAsync(db);
        await EnsureIdCardRequestsColumnsAsync(db);
        await EnsureExperienceCertificateRequestsPageSeededAsync(db, roleManager);
        await EnsureMedicalFacilityRequestsPageSeededAsync(db, roleManager);

        try
        {
            await db.Database.ExecuteSqlRawAsync("UPDATE LeaveRequests SET Dates = '[]' WHERE Dates = '' OR Dates IS NULL;");
        }
        catch { }
        // Clean up old indent workflow data before reseeding
        //await ClearOldIndentWorkflowDataAsync(db);
        

        try { await SeedDocumentChecklistAsync(db); } catch { }
        try { await WorkflowDefinitionSeeder.SeedAsync(db); } catch { }
        try { await ResearchProposalWorkflowSeeder.SeedAsync(db); } catch { }
        try { await ProcessBillWorkflowSeeder.SeedAsync(db); } catch { }
        try { await AdvertisementWorkflowSeeder.SeedAsync(db); } catch { }
        try { await GrantReceiptWorkflowSeeder.SeedAsync(db); } catch { }
        try { await FellowshipWorkflowSeeder.SeedAsync(db); } catch { }
        try { await IndentWorkflowSeeder.SeedAsync(db); } catch { }
        try { await ScreeningCommitteeWorkflowSeeder.SeedAsync(db); } catch { }
        try { await SelectionCommitteeWorkflowSeeder.SeedAsync(db); } catch { }
        try { await ProjectWorkflowSeeder.SeedAsync(db); } catch { }
        try { await ReappropriationWorkflowSeeder.SeedAsync(db); } catch { }
        try { await DepartmentSeeder.SeedAsync(db); } catch { }
        try { await FundingAgencySeeder.SeedAsync(db); } catch { }
        try { await AdvertisementTemplateSeeder.SeedAsync(db); } catch { }
        try { await EmailTemplateSeeder.SeedAsync(db); } catch { }
        try { await MigrateAwayFromLegacyDepartmentsAsync(db, userManager); } catch { }
        try { await BackfillUserDepartmentsAsync(db, userManager); } catch { }
        try { await BackfillFacultyProfileApplicationUserIdsAsync(db, userManager); } catch { }
        try { await BackfillProjectDepartmentsAsync(db, userManager); } catch { }

        // The seeded faculty and HOD accounts need a department for Department-scoped
        // permissions to be exercisable at all.
        try { await AssignDepartmentAsync(db, userManager, "faculty1", "CSED"); } catch { }
        try { await AssignDepartmentAsync(db, userManager, "hod1", "CSED"); } catch { }

        // Office staff belong to the R&C department, which is what widens their
        // Department-scoped page access to institute-wide -- see
        // DepartmentSeeder.RncCode. This reproduces today's shipped behaviour
        // for clerk1/osrc/dyregrc/deanrc/directorrc, and extends the same
        // reasoning to the six named staff (BRD Prompt 6 / A11): they see
        // every department's requests because they work in R&C, not because
        // their role is senior.
        foreach (var officeUser in new[]
        {
            "clerk1", "osrc", "dyregrc", "deanrc", "directorrc",
            "harshit1", "sadhvi1", "ashok1", "shyamu1", "renu1", "prateek1",
            "library1", "computercentre1",
        })
        {
            try { await AssignDepartmentAsync(db, userManager, officeUser, DepartmentSeeder.RncCode); } catch { }
        }

        // Page access last: it needs the roles to exist so it can resolve their ids.
        var roleIds = await roleManager.Roles
            .Where(r => r.Name != null)
            .ToDictionaryAsync(r => r.Name!, r => r.Id, CancellationToken.None);
        try { await PageAccessSeeder.SeedAsync(db, roleIds); } catch (Exception ex) { Console.WriteLine("PAGE ACCESS SEEDER FAILED: " + ex.ToString()); }
        try { await RevokeFacultyManualProjectCreationAsync(db, roleIds); } catch { }
        try { await EnsurePaymentVoucherAndNotingPageDefaultRolesAsync(db, roleIds); } catch { }
        try { await SeedSampleHodProposalAsync(services, userManager); } catch { }
    }

    /// <summary>
    /// The BRD A7.4 document expectations for procurement, plus the indent-phase
    /// signed copy. Idempotent: an item is inserted only when no row already exists
    /// for the same (RequestType, Phase, DocumentKind, Name).
    /// </summary>
    /// <remarks>
    /// Several Bill-phase items share <see cref="DocumentKind.SignedCopy"/> because
    /// the enum has no finer-grained values for them, and satisfaction is evaluated
    /// per DocumentKind — so uploading one signed copy marks all of them satisfied.
    /// The Name still distinguishes them for display. Extending DocumentKind would
    /// ripple into Phase 1 and 3b code, so it is deliberately left for a later slice.
    ///
    /// E-Way Bill is non-mandatory here because its real enforcement is conditional
    /// (above Rs. 50,000) and lives in ProcessBillAsync; marking it mandatory would
    /// misrepresent it as always required.
    /// </remarks>
    private static async Task SeedDocumentChecklistAsync(IApplicationDbContext db)
    {
        RequestType[] procurementTypes =
            [RequestType.Consumable, RequestType.Contingency, RequestType.Equipment];

        RequestType[] travelTypes = [RequestType.Travel];
        RequestType[] recruitmentTypes = [RequestType.ManpowerDocument];
        RequestType[] fellowshipTypes = [RequestType.FellowshipClaim];
        RequestType[] leaveTypes = [RequestType.LeaveRequest];
        RequestType[] proposalTypes = [RequestType.ResearchProposal];

        var definitions = new List<(WorkflowPhase Phase, DocumentKind Kind, string Name, bool Mandatory, int Order, RequestType[] AppliesTo)>
        {
            (WorkflowPhase.Indent, DocumentKind.Indent, "Generated Indent Form", true, 1, procurementTypes),
            (WorkflowPhase.Indent, DocumentKind.SignedCopy, "Signed Indent Copy", true, 2, procurementTypes),
            (WorkflowPhase.Indent, DocumentKind.GemQuotation, "GeM Quotation / Estimate", false, 3, procurementTypes),
            (WorkflowPhase.Bill, DocumentKind.CoverLetter, "Bill Cover Letter", true, 1, procurementTypes),
            (WorkflowPhase.Bill, DocumentKind.BillDocument, "Original Bill", true, 2, procurementTypes),
            (WorkflowPhase.Bill, DocumentKind.SatisfactoryCertificate, "Stock Entry Proof", false, 3, procurementTypes),
            (WorkflowPhase.Bill, DocumentKind.SignedCopy, "Measurement Book", true, 4, [RequestType.Equipment]),
            (WorkflowPhase.Bill, DocumentKind.EWayBill, "E-Way Bill", false, 5, procurementTypes),

            // Travel (Phase 4). The TA/DA form is the BRD's named attachment at
            // reimbursement time -- the portal does not compute per-diem, it
            // collects the filled form.
            (WorkflowPhase.Indent, DocumentKind.TravelRequestForm, "Generated Travel Request Form", true, 1, travelTypes),
            (WorkflowPhase.Indent, DocumentKind.SignedCopy, "Signed Travel Request", true, 2, travelTypes),
            (WorkflowPhase.Bill, DocumentKind.CoverLetter, "Travel Cover Letter", true, 1, travelTypes),
            (WorkflowPhase.Bill, DocumentKind.TravelBill, "TA/DA Form with Bills and Receipts", true, 2, travelTypes),

            // Recruitment (Phase 5). Only the merit-list approval runs through the
            // workflow engine, so everything lands in the Indent phase -- there is
            // no bill phase for a recruitment.
            (WorkflowPhase.Indent, DocumentKind.Advertisement, "Advertisement", true, 1, recruitmentTypes),
            (WorkflowPhase.Indent, DocumentKind.Proforma, "Screening Proforma", true, 2, recruitmentTypes),
            (WorkflowPhase.Indent, DocumentKind.MeritList, "Merit List", true, 3, recruitmentTypes),
            (WorkflowPhase.Indent, DocumentKind.MinutesOfSelection, "Minutes of Selection Committee", true, 4, recruitmentTypes),
            (WorkflowPhase.Indent, DocumentKind.SignedCopy, "Signed Merit List", true, 5, recruitmentTypes),
            (WorkflowPhase.Indent, DocumentKind.OfferLetter, "Offer Letter", false, 6, recruitmentTypes),
            (WorkflowPhase.Indent, DocumentKind.JoiningLetter, "Joining Letter", false, 7, recruitmentTypes),

            // Fellowship and leave (Phase 6). Both approve through the same
            // chain, so everything sits in the Indent phase -- neither has a
            // bill phase.
            //
            // The HRA slip is non-mandatory here because it is only required
            // when the HRA component is actually claimed, which RaiseClaimAsync
            // enforces conditionally. Marking it mandatory would misrepresent a
            // fellowship-only claim as incomplete.
            (WorkflowPhase.Indent, DocumentKind.StipendForm, "Generated Stipend Form", true, 1, fellowshipTypes),
            (WorkflowPhase.Indent, DocumentKind.HraSlip, "HRA Slip", false, 2, fellowshipTypes),
            (WorkflowPhase.Indent, DocumentKind.SignedCopy, "Signed Claim Form", true, 3, fellowshipTypes),


            // Research proposal (BRD Prompt 1). Only the signed copy of the
            // proposal and the endorsement certificate are mandatory at
            // submission -- confirmed by the client directly ("Signed Copy of
            // Proposal and Endorsement Certificate are mandatory rest are
            // optional"), superseding the earlier "all four mandatory" reading
            // of the BRD. SignedCopy is reused from its other phases (see the
            // procurement/travel/recruitment/fellowship/leave rows above),
            // newly wired to proposals here.
            (WorkflowPhase.Indent, DocumentKind.SignedCopy, "Signed Copy of Proposal", true, 1, proposalTypes),
            (WorkflowPhase.Indent, DocumentKind.EndorsementCertificate, "Endorsement Certificate", true, 2, proposalTypes),
            (WorkflowPhase.Indent, DocumentKind.CoverLetter, "Cover Letter", false, 3, proposalTypes),
            (WorkflowPhase.Indent, DocumentKind.BudgetCopy, "Budget Copy (with overhead column)", false, 4, proposalTypes),
            (WorkflowPhase.Indent, DocumentKind.SupportingDocument, "Supporting Documents", false, 5, proposalTypes),
            (WorkflowPhase.Indent, DocumentKind.CoPiConsent, "Co-PI Signed Consent", false, 6, proposalTypes),
            (WorkflowPhase.Indent, DocumentKind.SanctionLetter, "Sanction Letter", false, 7, proposalTypes),
        };

        var existingItems = await db.DocumentChecklistItems
            .Where(i => i.Phase == WorkflowPhase.Bill)
            .ToListAsync(CancellationToken.None);

        bool updatedAny = false;
        foreach (var item in existingItems)
        {
            if (item.Name == "Original Bill" && item.DocumentKind != DocumentKind.BillDocument)
            {
                item.DocumentKind = DocumentKind.BillDocument;
                updatedAny = true;
            }
            else if (item.Name == "Stock Entry Proof" && item.DocumentKind != DocumentKind.SatisfactoryCertificate)
            {
                item.DocumentKind = DocumentKind.SatisfactoryCertificate;
                updatedAny = true;
            }
            else if (item.Name == "E-Way Bill" && item.DocumentKind != DocumentKind.EWayBill)
            {
                item.DocumentKind = DocumentKind.EWayBill;
                updatedAny = true;
            }
        }
        if (updatedAny)
        {
            await db.SaveChangesAsync(CancellationToken.None);
        }

        var existing = await db.DocumentChecklistItems
            .Select(i => new { i.RequestType, i.Phase, i.DocumentKind, i.Name })
            .ToListAsync(CancellationToken.None);

        var seen = existing
            .Select(i => (i.RequestType, i.Phase, i.DocumentKind, i.Name))
            .ToHashSet();

        var toAdd = new List<DocumentChecklistItem>();
        foreach (var (phase, kind, name, mandatory, order, appliesTo) in definitions)
        {
            foreach (var requestType in appliesTo)
            {
                if (!seen.Add((requestType, phase, kind, name)))
                {
                    continue;
                }

                toAdd.Add(new DocumentChecklistItem
                {
                    Id = Guid.NewGuid(),
                    RequestType = requestType,
                    Phase = phase,
                    DocumentKind = kind,
                    Name = name,
                    IsMandatory = mandatory,
                    DisplayOrder = order,
                });
            }
        }

        if (toAdd.Count > 0)
        {
            db.DocumentChecklistItems.AddRange(toAdd);
            await db.SaveChangesAsync(CancellationToken.None);
        }
    }

    /// <summary>
    /// Points users at a <see cref="Department"/> using the free-text
    /// <c>FacultyProfile.Department</c> they already carry.
    /// </summary>
    /// <remarks>
    /// Matches on the exact name, because that column is populated by a fixed
    /// six-option dropdown in CreateFacultyUser.jsx and the seeded names are
    /// transcribed from it. A profile whose text matches nothing is left with no
    /// department rather than guessed at: such a user never matches a
    /// Department-scoped permission, which is the safe failure.
    ///
    /// Only fills a null. A department set deliberately is never overwritten by
    /// the free text, which is the older and less trustworthy source.
    /// </remarks>
    private static async Task BackfillUserDepartmentsAsync(
        IApplicationDbContext db, UserManager<ApplicationUser> userManager)
    {
        var departments = await db.Departments
            .Select(d => new { d.Id, d.Name })
            .ToListAsync(CancellationToken.None);

        if (departments.Count == 0)
        {
            return;
        }

        var byName = departments.ToDictionary(d => d.Name, d => d.Id, StringComparer.OrdinalIgnoreCase);

        var profiles = await db.FacultyProfiles
            .Where(p => p.Department != null)
            .Select(p => new { p.UserId, p.Department })
            .ToListAsync(CancellationToken.None);

        if (profiles.Count == 0)
        {
            return;
        }

        foreach (var profile in profiles)
        {
            if (!Guid.TryParse(profile.UserId, out var userId) ||
                !byName.TryGetValue(profile.Department!.Trim(), out var departmentId))
            {
                continue;
            }

            var user = await userManager.FindByIdAsync(userId.ToString());
            if (user is null || user.DepartmentId is not null)
            {
                continue;
            }

            user.DepartmentId = departmentId;

            // UpdateAsync persists per user, so there is no SaveChanges at the
            // end -- and no partial-write window either.
            await userManager.UpdateAsync(user);
        }
    }

    /// <summary>
    /// One-time backfill: any FacultyProfile whose free-text UserId
    /// (an admin-typed "Employee ID") happens to already parse as a real
    /// ApplicationUser's id gets ApplicationUserId set to match, so an
    /// already-onboarded real faculty member is not forced through the
    /// self-service profile-completion gate again for data that already
    /// exists. Rows that don't match anything are left null -- their owner
    /// completes the self-service form like any other never-provisioned
    /// account. Only fills a null; never overwrites an ApplicationUserId
    /// already set (e.g. by a user's own prior self-service save).
    /// </summary>
    private static async Task BackfillFacultyProfileApplicationUserIdsAsync(
        IApplicationDbContext db, UserManager<ApplicationUser> userManager)
    {
        var unlinkedProfiles = await db.FacultyProfiles
            .Where(p => p.ApplicationUserId == null)
            .ToListAsync(CancellationToken.None);

        if (unlinkedProfiles.Count == 0)
        {
            return;
        }

        var changed = false;

        // Tracks GUIDs assigned earlier in this same loop. SaveChangesAsync is
        // deferred until after the loop, so the AnyAsync check below cannot see
        // an assignment made by a previous iteration -- without this set, two
        // unlinked profiles whose free-text UserId coincidentally parses to the
        // same real account id would both pass the DB-only check, both get
        // assigned in memory, and the final SaveChangesAsync would throw a
        // unique-constraint violation instead of skipping the second row.
        var assignedThisRun = new HashSet<Guid>();

        foreach (var profile in unlinkedProfiles)
        {
            if (!Guid.TryParse(profile.UserId, out var candidateUserId))
            {
                continue;
            }

            if (assignedThisRun.Contains(candidateUserId))
            {
                continue;
            }

            var user = await userManager.FindByIdAsync(candidateUserId.ToString());
            if (user is null)
            {
                continue;
            }

            // The unique index means only one profile can ever link to a given
            // account -- if a different profile already claimed this id (data
            // predating this feature, extremely unlikely but not impossible),
            // skip rather than throw a migration-time constraint violation.
            var alreadyLinked = await db.FacultyProfiles
                .AnyAsync(p => p.ApplicationUserId == candidateUserId, CancellationToken.None);
            if (alreadyLinked)
            {
                continue;
            }

            profile.ApplicationUserId = candidateUserId;
            assignedThisRun.Add(candidateUserId);
            changed = true;
        }

        if (changed)
        {
            await db.SaveChangesAsync(CancellationToken.None);
        }
    }

    /// <summary>
    /// Backfills <see cref="Project.DepartmentId"/> for rows that predate the
    /// column (added Phase 10) or whose department has since been retired,
    /// using the owner's <em>current</em> department.
    /// </summary>
    /// <remarks>
    /// A one-time approximation, not a perfect reconstruction: which
    /// department actually owned a project when it was created was never
    /// recorded, so this is the closest available truth, exactly like
    /// <see cref="BackfillUserDepartmentsAsync"/> above it.
    ///
    /// Targets any row whose <c>DepartmentId</c> does not match a row in the
    /// current <c>Departments</c> table -- not only <see cref="Guid.Empty"/>.
    /// The narrower <c>== Guid.Empty</c> check this shipped with originally
    /// missed a real case: this backfill ran once (Task 1) against the
    /// six-department placeholder list, writing real department ids into
    /// live Project rows: When Task 6 later replaced that list, those ids
    /// became orphaned foreign keys pointing at deleted rows -- silently
    /// breaking every Department-scoped report for those projects, since
    /// nothing would ever match a deleted department's id. Runs after
    /// <see cref="MigrateAwayFromLegacyDepartmentsAsync"/>, so the "current"
    /// department set it checks against is already the final one for this run.
    ///
    /// Idempotent regardless: a row already pointing at a real department is
    /// never touched, whether this backfill set it or
    /// <see cref="Projects.ProjectService.CreateAsync"/> snapshotted it
    /// correctly at creation time. A project whose owner has no department is
    /// left unmatched rather than guessed at -- it will never match a
    /// Department-scoped report, the same safe failure
    /// <see cref="BackfillUserDepartmentsAsync"/> chose.
    /// </remarks>
    private static async Task BackfillProjectDepartmentsAsync(
        IApplicationDbContext db, UserManager<ApplicationUser> userManager)
    {
        var validDepartmentIds = await db.Departments.Select(d => d.Id).ToListAsync(CancellationToken.None);
        var projects = await db.Projects
            .Where(p => !validDepartmentIds.Contains(p.DepartmentId))
            .ToListAsync(CancellationToken.None);

        if (projects.Count == 0)
        {
            return;
        }

        foreach (var project in projects)
        {
            var owner = await userManager.FindByIdAsync(project.OwnerUserId.ToString());
            if (owner?.DepartmentId is { } departmentId)
            {
                project.DepartmentId = departmentId;
            }
        }

        await db.SaveChangesAsync(CancellationToken.None);
    }

    /// <summary>
    /// Revokes Faculty's grant to <c>projects.new</c> -- a one-time fix, not
    /// a general pattern. <see cref="PageAccessSeeder"/> is deliberately
    /// additive-only (never revokes an admin's own customization), so the
    /// original Faculty grant this page shipped with survives on any
    /// database seeded before the role changed to office-only: a project
    /// should now come from a sanctioned research proposal
    /// (<c>ResearchProposalService.RecordSanctionAsync</c>), not this manual
    /// form. Idempotent: a database that never held the grant, or one
    /// already revoked by a prior run, simply finds nothing to delete.
    /// </summary>
    private static async Task RevokeFacultyManualProjectCreationAsync(
        IApplicationDbContext db, IReadOnlyDictionary<string, Guid> roleIdsByName)
    {
        if (!roleIdsByName.TryGetValue("Faculty", out var facultyRoleId))
        {
            return;
        }

        var page = await db.Pages.FirstOrDefaultAsync(p => p.Key == "projects.new", CancellationToken.None);
        if (page is null)
        {
            return;
        }

        var staleGrant = await db.RolePageAccess
            .FirstOrDefaultAsync(a => a.RoleId == facultyRoleId && a.PageId == page.Id, CancellationToken.None);
        if (staleGrant is null)
        {
            return;
        }

        db.RolePageAccess.Remove(staleGrant);
        await db.SaveChangesAsync(CancellationToken.None);
    }

    /// <summary>
    /// Ensures payment.voucher and noting.page are restricted to RegularStaff by default,
    /// removing legacy default access for Faculty, HOD, Dean, Superintendent, etc., on existing databases.
    /// </summary>
    private static async Task EnsurePaymentVoucherAndNotingPageDefaultRolesAsync(
        IApplicationDbContext db, IReadOnlyDictionary<string, Guid> roleIdsByName)
    {
        if (!roleIdsByName.TryGetValue("RegularStaff", out var regularStaffRoleId))
        {
            return;
        }

        var targetKeys = new[] { "payment.voucher", "noting.page" };
        var pages = await db.Pages.Where(p => targetKeys.Contains(p.Key)).ToListAsync(CancellationToken.None);
        if (pages.Count == 0) return;

        var pageIds = pages.Select(p => p.Id).ToList();

        // 1. Ensure RegularStaff has access
        foreach (var page in pages)
        {
            var hasAccess = await db.RolePageAccess
                .AnyAsync(a => a.RoleId == regularStaffRoleId && a.PageId == page.Id, CancellationToken.None);
            if (!hasAccess)
            {
                db.RolePageAccess.Add(new RolePageAccess
                {
                    RoleId = regularStaffRoleId,
                    PageId = page.Id,
                    Scope = AccessScope.Department,
                });
            }
        }

        // 2. Remove default grants for other roles if they were previously seeded by default
        var staleGrants = await db.RolePageAccess
            .Where(a => pageIds.Contains(a.PageId) && a.RoleId != regularStaffRoleId)
            .ToListAsync(CancellationToken.None);

        if (staleGrants.Count > 0)
        {
            db.RolePageAccess.RemoveRange(staleGrants);
        }

        await db.SaveChangesAsync(CancellationToken.None);
    }

    /// <summary>
    /// Retires the six-department placeholder list Phase 10 replaces with
    /// the BRD's 14 named departments -- remapping any user still pointing
    /// at a retired code onto its nearest BRD equivalent
    /// (<see cref="DepartmentSeeder.LegacyCodeRemap"/>) before deleting the
    /// row, so no foreign key is ever left orphaned.
    /// </summary>
    /// <remarks>
    /// Idempotent by construction: a legacy department already remapped and
    /// deleted on a prior run simply is not found on this one, so there is
    /// nothing left to do. Runs after <see cref="DepartmentSeeder.SeedAsync"/>
    /// (the new departments must exist first) and before
    /// <see cref="BackfillUserDepartmentsAsync"/> (which only fills a null
    /// department, so it must not race a remap that is about to set one).
    /// </remarks>
    private static async Task MigrateAwayFromLegacyDepartmentsAsync(
        IApplicationDbContext db, UserManager<ApplicationUser> userManager)
    {
        var oldCodes = DepartmentSeeder.LegacyCodeRemap.Select(r => r.OldCode).ToList();
        var legacyDepartments = await db.Departments
            .Where(d => oldCodes.Contains(d.Code))
            .ToListAsync(CancellationToken.None);

        if (legacyDepartments.Count == 0)
        {
            return;
        }

        var newDepartmentIdByCode = await db.Departments
            .Where(d => DepartmentSeeder.Departments.Select(x => x.Code).Contains(d.Code))
            .ToDictionaryAsync(d => d.Code, d => d.Id, CancellationToken.None);

        foreach (var legacy in legacyDepartments)
        {
            var newCode = DepartmentSeeder.LegacyCodeRemap.Single(r => r.OldCode == legacy.Code).NewCode;
            if (!newDepartmentIdByCode.TryGetValue(newCode, out var newDepartmentId))
            {
                continue;
            }

            var affectedUsers = userManager.Users.Where(u => u.DepartmentId == legacy.Id).ToList();
            foreach (var user in affectedUsers)
            {
                user.DepartmentId = newDepartmentId;
                await userManager.UpdateAsync(user);
            }
        }

        db.Departments.RemoveRange(legacyDepartments);
        await db.SaveChangesAsync(CancellationToken.None);
    }

    /// <summary>Puts a seeded account in a department, if it is not already in one.</summary>
    private static async Task AssignDepartmentAsync(
        IApplicationDbContext db, UserManager<ApplicationUser> userManager,
        string userName, string departmentCode)
    {
        var user = await userManager.FindByNameAsync(userName);
        if (user is null || user.DepartmentId is not null)
        {
            return;
        }

        var department = await db.Departments
            .FirstOrDefaultAsync(d => d.Code == departmentCode, CancellationToken.None);

        if (department is null)
        {
            return;
        }

        user.DepartmentId = department.Id;
        await userManager.UpdateAsync(user);
    }

    private static async Task EnsureUserAsync(UserManager<ApplicationUser> userManager, string userName, string password, string fullName, string role)
    {
        var existing = await userManager.FindByNameAsync(userName) ?? await userManager.FindByEmailAsync($"{userName}@mnnit.ac.in");
        if (existing is not null)
        {
            if (string.IsNullOrWhiteSpace(existing.Email))
            {
                existing.Email = $"{userName}@mnnit.ac.in";
                existing.EmailConfirmed = true;
                await userManager.UpdateAsync(existing);
            }

            var resetToken = await userManager.GeneratePasswordResetTokenAsync(existing);
            await userManager.ResetPasswordAsync(existing, resetToken, password);

            if (!existing.IsActive)
            {
                existing.IsActive = true;
                await userManager.UpdateAsync(existing);
            }

            return;
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = userName,
            // RequireUniqueEmail is on for applicant registration, and Identity
            // rejects a null address on create -- so seeded staff need one too.
            // Confirmed, because these accounts are provisioned rather than
            // self-registered and must not need a verification click.
            Email = $"{userName}@mnnit.ac.in",
            EmailConfirmed = true,
            FullName = fullName,
        };

        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            return;
        }

        await userManager.AddToRoleAsync(user, role);
    }

    private static async Task SeedSampleHodProposalAsync(
        IServiceProvider services, UserManager<ApplicationUser> userManager)
    {
        var db = services.GetRequiredService<IApplicationDbContext>();

        // Backfill fix: any proposal in UnderApproval status that was left at Draft stage
        // is moved to WithHOD so the HOD can act on it.
        var stuckProposals = await db.ResearchProposals
            .Where(p => p.Status == ProposalStatus.UnderApproval && p.WorkflowInstanceId != null)
            .ToListAsync(CancellationToken.None);

        var changed = false;
        foreach (var proposal in stuckProposals)
        {
            var instance = await db.WorkflowInstances.FirstOrDefaultAsync(w => w.Id == proposal.WorkflowInstanceId, CancellationToken.None);
            if (instance is not null && instance.CurrentStage == WorkflowStage.Draft)
            {
                instance.CurrentStage = WorkflowStage.WithHOD;
                changed = true;
            }
        }

        if (changed)
        {
            await db.SaveChangesAsync(CancellationToken.None);
        }

        if (await db.ResearchProposals.AnyAsync())
        {
            return;
        }

        var faculty = await userManager.FindByNameAsync("faculty1");
        if (faculty is null)
        {
            return;
        }

        var proposalService = services.GetRequiredService<IResearchProposalService>();
        // DurationMonths: 36 -> 3 year columns. Each line's original single total is
        // spread evenly across the 3 years so the seeded totals are unchanged; overhead
        // is now one proposal-level percentage applied to the manpower line only (the
        // other two are excluded from the overhead base) to stand in for the old flat
        // OverheadAmount.
        var proposalId = await proposalService.CreateDraftAsync(new CreateProposalDraftInput(
            Title: "AI-Based Smart Grid Optimization & Energy Management",
            ProposalType: ProposalType.ResearchProject,
            Agency: "DST (Department of Science & Technology)",
            AdvertisementReference: "DST/RNC/2026/01",
            DurationMonths: 36,
            OverheadPercent: 20m,
            BudgetLines:
            [
                new ProposalBudgetLineInput(BudgetHeadName.RecurringManpower, [400000m, 400000m, 400000m], IncludeInOverhead: true),
                new ProposalBudgetLineInput(BudgetHeadName.EquipmentNonRecurring, [800000m, 0m, 0m], IncludeInOverhead: false),
                new ProposalBudgetLineInput(BudgetHeadName.RecurringConsumable, [200000m, 150000m, 150000m], IncludeInOverhead: false),
            ]
        ), faculty.Id);

        await proposalService.SubmitForApprovalAsync(proposalId, faculty.Id, "Submitting for HOD approval");
    }

    /// <summary>
    /// Clears old indent workflow data to force a clean reseed with the new workflow stages.
    /// This ensures old legacy stages (Assigned, Forwarded, etc.) are removed and replaced
    /// with the new intent-specific stages (IndentWithHOD, IndentWithRnCOffice, etc.).
    /// </summary>
    private static async Task ClearOldIndentWorkflowDataAsync(IApplicationDbContext db)
    {
        var indentRequestTypes = new[] 
        { 
            RequestType.Consumable,
            RequestType.Equipment,
            RequestType.Contingency,
            RequestType.DynamicIndent,  // NEW: The unified indent type
        };

        // Delete old workflow instances that are at old stages
        var oldInstances = await db.WorkflowInstances
            .Where(i => indentRequestTypes.Contains(i.RequestType) && 
                       i.Phase == WorkflowPhase.Indent &&
                       (i.CurrentStage == WorkflowStage.Assigned ||
                        i.CurrentStage == WorkflowStage.Forwarded ||
                        i.CurrentStage == WorkflowStage.ForwardedOSRC ||
                        i.CurrentStage == WorkflowStage.ForwardedDR))
            .ToListAsync(CancellationToken.None);
        
        if (oldInstances.Count > 0)
        {
            // Delete associated steps first
            foreach (var instance in oldInstances)
            {
                var steps = await db.WorkflowSteps
                    .Where(s => s.WorkflowInstanceId == instance.Id)
                    .ToListAsync(CancellationToken.None);
                db.WorkflowSteps.RemoveRange(steps);
            }
            
            db.WorkflowInstances.RemoveRange(oldInstances);
            await db.SaveChangesAsync(CancellationToken.None);
        }

        // Find and delete old workflow definitions for indent request types
        var oldDefinitions = await db.WorkflowDefinitions
            .Where(d => indentRequestTypes.Contains(d.RequestType) && d.Phase == WorkflowPhase.Indent)
            .ToListAsync(CancellationToken.None);

        if (oldDefinitions.Count > 0)
        {
            foreach (var def in oldDefinitions)
            {
                // Delete associated stages first
                var stages = await db.WorkflowStageDefinitions
                    .Where(s => s.WorkflowDefinitionId == def.Id)
                    .ToListAsync(CancellationToken.None);
                
                db.WorkflowStageDefinitions.RemoveRange(stages);
            }

            db.WorkflowDefinitions.RemoveRange(oldDefinitions);
            await db.SaveChangesAsync(CancellationToken.None);
        }
    }

    private static async Task EnsureIndentBillColumnsAsync(IApplicationDbContext db)
    {
        try
        {
            var existingColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var connection = db.Database.GetDbConnection();
            var wasOpen = connection.State == System.Data.ConnectionState.Open;
            if (!wasOpen) await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'indents' AND TABLE_SCHEMA = DATABASE();";
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    if (!reader.IsDBNull(0))
                    {
                        existingColumns.Add(reader.GetString(0));
                    }
                }
            }
            finally
            {
                if (!wasOpen) await connection.CloseAsync();
            }

            var columnsToAdd = new (string Name, string Def)[]
            {
                ("BillNo", "VARCHAR(255) NULL"),
                ("BillAmount", "DECIMAL(18,2) NULL"),
                ("GenerationDate", "DATE NULL"),
                ("ItemReceivingDate", "DATE NULL"),
                ("BillProcessStatus", "VARCHAR(255) NULL"),
                ("BillFileUrl", "VARCHAR(1000) NULL"),
                ("EWayBillFileUrl", "VARCHAR(1000) NULL"),
                ("SatisfactoryCertificateFileUrl", "VARCHAR(1000) NULL")
            };

            foreach (var (colName, colDef) in columnsToAdd)
            {
                if (!existingColumns.Contains(colName))
                {
                    try
                    {
                        await db.Database.ExecuteSqlRawAsync($"ALTER TABLE indents ADD COLUMN {colName} {colDef};");
                    }
                    catch
                    {
                        // Ignore if column was concurrently added
                    }
                }
            }
        }
        catch
        {
            // Ignore schema check errors
        }
    }

    private static async Task EnsureIdCardRequestsColumnsAsync(IApplicationDbContext db)
    {
        try
        {
            var existingColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var connection = db.Database.GetDbConnection();
            var wasOpen = connection.State == System.Data.ConnectionState.Open;
            if (!wasOpen) await connection.OpenAsync();

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'idcardrequests' AND TABLE_SCHEMA = DATABASE();";
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    if (!reader.IsDBNull(0))
                    {
                        existingColumns.Add(reader.GetString(0));
                    }
                }
            }
            finally
            {
                if (!wasOpen) await connection.CloseAsync();
            }

            var columnsToAdd = new (string Name, string Def)[]
            {
                ("IdentityCode", "LONGTEXT NULL"),
                ("LocalAddress", "LONGTEXT NULL"),
                ("EmergencyPhone", "LONGTEXT NULL"),
                ("MobilePhone", "LONGTEXT NULL"),
                ("Email", "LONGTEXT NULL"),
                ("PermanentAddress", "LONGTEXT NULL"),
                ("PermanentDistrict", "LONGTEXT NULL"),
                ("PermanentPin", "LONGTEXT NULL"),
                ("Category", "LONGTEXT NULL"),
                ("AdditionalCategory", "LONGTEXT NULL"),
                ("PiName", "LONGTEXT NULL"),
                ("BloodGroup", "LONGTEXT NULL"),
                ("DateOfBirth", "LONGTEXT NULL"),
                ("DateOfJoining", "LONGTEXT NULL"),
                ("PeriodFrom", "LONGTEXT NULL"),
                ("PeriodTo", "LONGTEXT NULL"),
                ("Gender", "LONGTEXT NULL"),
                ("AadharNumber", "LONGTEXT NULL"),
                ("AppointmentLetterNo", "LONGTEXT NULL"),
                ("PhotoUrl", "LONGTEXT NULL"),
                ("SignatureUrl", "LONGTEXT NULL"),
                ("DocumentName", "LONGTEXT NULL")
            };

            foreach (var (colName, colDef) in columnsToAdd)
            {
                if (!existingColumns.Contains(colName))
                {
                    try
                    {
                        await db.Database.ExecuteSqlRawAsync($"ALTER TABLE idcardrequests ADD COLUMN {colName} {colDef};");
                    }
                    catch
                    {
                        // Ignore if column was concurrently added
                    }
                }
            }
        }
        catch
        {
            // Ignore schema check errors
        }
    }

    private static async Task EnsureExperienceCertificateRequestsTableAsync(IApplicationDbContext db)
    {
        try
        {
            var sql = @"
CREATE TABLE IF NOT EXISTS `fellow_experience_certificates` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StudentUserId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StudentName` longtext CHARACTER SET utf8mb4 NOT NULL,
  `EnrollmentNumber` longtext CHARACTER SET utf8mb4 NOT NULL,
  `DepartmentId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `DepartmentName` longtext CHARACTER SET utf8mb4 NOT NULL,
  `ProjectTitle` longtext CHARACTER SET utf8mb4 NOT NULL,
  `ProjectNo` longtext CHARACTER SET utf8mb4 NOT NULL,
  `Purpose` longtext CHARACTER SET utf8mb4 NOT NULL,
  `TargetOrganization` longtext CHARACTER SET utf8mb4 NOT NULL,
  `WorkflowInstanceId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  `Status` longtext CHARACTER SET utf8mb4 NOT NULL,
  `CertificateNumber` longtext CHARACTER SET utf8mb4 NULL,
  `CertificateBody` longtext CHARACTER SET utf8mb4 NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `ApprovedAt` datetime(6) NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_fellow_experience_certificates_DepartmentId` (`DepartmentId`),
  KEY `IX_fellow_experience_certificates_StudentUserId` (`StudentUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";
            await db.Database.ExecuteSqlRawAsync(sql);
        }
        catch
        {
            // Ignore schema check errors
        }
    }

    private static async Task EnsureExperienceCertificateRequestsPageSeededAsync(IApplicationDbContext db, RoleManager<IdentityRole<Guid>> roleManager)
    {
        try
        {
            await EnsureExperienceCertificateRequestsTableAsync(db);

            // 1. Ensure Leave module exists
            var leaveModule = await db.Modules.FirstOrDefaultAsync(m => m.Key == "leave");
            if (leaveModule is null)
            {
                leaveModule = new Module
                {
                    Id = Guid.NewGuid(),
                    Key = "leave",
                    Name = "Leave",
                    Group = "Fellow",
                    DisplayOrder = 9
                };
                db.Modules.Add(leaveModule);
                await db.SaveChangesAsync(CancellationToken.None);
            }

            // 2. Ensure experience-certificate.requests page exists
            var page = await db.Pages.FirstOrDefaultAsync(p => p.Key == "experience-certificate.requests");
            if (page is null)
            {
                page = new Page
                {
                    Id = Guid.NewGuid(),
                    ModuleId = leaveModule.Id,
                    Key = "experience-certificate.requests",
                    Name = "Request for Experience Certificate",
                    Route = "/experience-certificate-requests",
                    IsNavigable = true,
                    DisplayOrder = 3
                };
                db.Pages.Add(page);
                await db.SaveChangesAsync(CancellationToken.None);
            }
            else
            {
                page.IsNavigable = true;
                page.Route = "/experience-certificate-requests";
                page.Name = "Request for Experience Certificate";
                await db.SaveChangesAsync(CancellationToken.None);
            }

            // 3. Ensure role access grants exist for all candidate/fellow/staff roles
            var rolesToGrant = new[] { "Applicant", "Candidate", "Fellow", "Faculty", "HOD", "Dean", "DeputyRegistrar", "Superintendent", "RegularStaff", "SuperAdmin" };
            var existingAccess = await db.RolePageAccess.Where(a => a.PageId == page.Id).ToListAsync(CancellationToken.None);
            var existingRoleIds = existingAccess.Select(a => a.RoleId).ToHashSet();

            foreach (var roleName in rolesToGrant)
            {
                var identityRole = await roleManager.FindByNameAsync(roleName);
                if (identityRole != null && !existingRoleIds.Contains(identityRole.Id))
                {
                    db.RolePageAccess.Add(new RolePageAccess
                    {
                        RoleId = identityRole.Id,
                        PageId = page.Id,
                        Scope = AccessScope.Own
                    });
                }
            }
            await db.SaveChangesAsync(CancellationToken.None);
        }
        catch
        {
            // Ignore schema/seed errors
        }
    }

    private static async Task EnsureMedicalFacilityRequestsTableAsync(IApplicationDbContext db)
    {
        try
        {
            var sql = @"
CREATE TABLE IF NOT EXISTS `medicalfacilityrequests` (
  `Id` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StudentUserId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `StudentName` longtext CHARACTER SET utf8mb4 NOT NULL,
  `EnrollmentNumber` longtext CHARACTER SET utf8mb4 NOT NULL,
  `DepartmentId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `DepartmentName` longtext CHARACTER SET utf8mb4 NOT NULL,
  `ProjectTitle` longtext CHARACTER SET utf8mb4 NOT NULL,
  `ProjectNo` longtext CHARACTER SET utf8mb4 NOT NULL,
  `Purpose` longtext CHARACTER SET utf8mb4 NOT NULL,
  `TargetOrganization` longtext CHARACTER SET utf8mb4 NOT NULL,
  `WorkflowInstanceId` char(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  `Status` longtext CHARACTER SET utf8mb4 NOT NULL,
  `CertificateNumber` longtext CHARACTER SET utf8mb4 NULL,
  `CertificateBody` longtext CHARACTER SET utf8mb4 NOT NULL,
  `CreatedAt` datetime(6) NOT NULL,
  `ApprovedAt` datetime(6) NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_medicalfacilityrequests_DepartmentId` (`DepartmentId`),
  KEY `IX_medicalfacilityrequests_StudentUserId` (`StudentUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";
            await db.Database.ExecuteSqlRawAsync(sql);
        }
        catch
        {
            // Ignore schema check errors
        }
    }

    private static async Task EnsureMedicalFacilityRequestsPageSeededAsync(IApplicationDbContext db, RoleManager<IdentityRole<Guid>> roleManager)
    {
        try
        {
            await EnsureMedicalFacilityRequestsTableAsync(db);

            // 1. Ensure Leave module exists
            var leaveModule = await db.Modules.FirstOrDefaultAsync(m => m.Key == "leave");
            if (leaveModule is null)
            {
                leaveModule = new Module
                {
                    Id = Guid.NewGuid(),
                    Key = "leave",
                    Name = "Leave",
                    Group = "Fellow",
                    DisplayOrder = 9
                };
                db.Modules.Add(leaveModule);
                await db.SaveChangesAsync(CancellationToken.None);
            }

            // 2. Ensure medical-facility.requests page exists
            var page = await db.Pages.FirstOrDefaultAsync(p => p.Key == "medical-facility.requests");
            if (page is null)
            {
                page = new Page
                {
                    Id = Guid.NewGuid(),
                    ModuleId = leaveModule.Id,
                    Key = "medical-facility.requests",
                    Name = "Request for Medical Facility",
                    Route = "/medical-facility-requests",
                    IsNavigable = true,
                    DisplayOrder = 4
                };
                db.Pages.Add(page);
                await db.SaveChangesAsync(CancellationToken.None);
            }
            else
            {
                page.IsNavigable = true;
                page.Route = "/medical-facility-requests";
                page.Name = "Request for Medical Facility";
                await db.SaveChangesAsync(CancellationToken.None);
            }

            // 3. Ensure role access grants exist for all candidate/fellow/staff roles
            var rolesToGrant = new[] { "Applicant", "Candidate", "Fellow", "Faculty", "HOD", "Dean", "DeputyRegistrar", "Superintendent", "RegularStaff", "SuperAdmin" };
            var existingAccess = await db.RolePageAccess.Where(a => a.PageId == page.Id).ToListAsync(CancellationToken.None);
            var existingRoleIds = existingAccess.Select(a => a.RoleId).ToHashSet();

            foreach (var roleName in rolesToGrant)
            {
                var identityRole = await roleManager.FindByNameAsync(roleName);
                if (identityRole != null && !existingRoleIds.Contains(identityRole.Id))
                {
                    db.RolePageAccess.Add(new RolePageAccess
                    {
                        RoleId = identityRole.Id,
                        PageId = page.Id,
                        Scope = AccessScope.Own
                    });
                }
            }
            await db.SaveChangesAsync(CancellationToken.None);
        }
        catch
        {
            // Ignore schema/seed errors
        }
    }
}

