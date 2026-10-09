using API.Application.Access;
using API.Application.Audit;
using API.Application.Common;
using API.Application.Documents;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Proposals;

/// <inheritdoc cref="IResearchProposalService"/>
public class ResearchProposalService(
    IApplicationDbContext db,
    IWorkflowEngineService workflowEngine,
    IUserDepartmentProvider userDepartment,
    IProjectService projectService,
    IInstituteWideScopeResolver instituteWideScope,
    IDocumentChecklistService checklistService,
    IAuditService audit,
    IWorkflowPendingQueryService pendingQuery) : IResearchProposalService
{
    public async Task<Guid> CreateDraftAsync(
        CreateProposalDraftInput input, Guid piUserId, CancellationToken ct = default)
    {
        var expectedYears = RequireValidDuration(input.DurationMonths);
        RequireValidBudgetLines(input.BudgetLines, expectedYears);
        RequireValidManpower(input.Manpower, expectedYears);

        var departmentId = await userDepartment.GetDepartmentIdAsync(piUserId, ct)
            ?? throw new PiHasNoDepartmentException(piUserId);

        var proposal = new ResearchProposal
        {
            Id = Guid.NewGuid(),
            OwnerUserId = piUserId,
            DepartmentId = departmentId,
            Title = input.Title,
            Agency = input.Agency,
            ProposalType = input.ProposalType,
            AdvertisementReference = input.AdvertisementReference,
            DurationMonths = input.DurationMonths,
            OverheadPercent = input.OverheadPercent,
            Status = ProposalStatus.Draft,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var newLines = ApplyBudgetLines(proposal, input.BudgetLines);
        (proposal.ProposedAmount, proposal.OverheadAmount, proposal.TotalAmount) = ComputeAmounts(newLines, proposal.OverheadPercent);
        ApplyEquipmentAndManpower(proposal, input.Equipment, input.Manpower);
        ApplyCoPis(proposal, input.CoPis);

        db.ResearchProposals.Add(proposal);
        await db.SaveChangesAsync(ct);
        return proposal.Id;
    }

    /// <summary>
    /// Editable statuses per the client's own words: "proposal after approval
    /// also title and details can change also Budget can also change because
    /// Funding Agency can change the budgeting also but the budgetting locks
    /// when the proposal gets its sanctioned." Sanctioned, NotFunded, Rejected
    /// and Withdrawn are all terminal, so everything else stays open.
    /// </summary>
    private static readonly HashSet<ProposalStatus> EditableStatuses =
    [
        ProposalStatus.Draft, ProposalStatus.UnderApproval,
        ProposalStatus.Approved, ProposalStatus.SubmittedToAgency,
    ];

    public async Task UpdateAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        UpdateProposalInput input, CancellationToken ct = default)
    {
        var proposal = await RequireOfficeOrOwnerAsync(proposalId, actorUserId, actorRoles, ct);
        if (!EditableStatuses.Contains(proposal.Status))
        {
            throw new InvalidProposalStatusException(
                proposalId, nameof(UpdateAsync), "Draft, UnderApproval, Approved or SubmittedToAgency",
                proposal.Status.ToString());
        }

        var expectedYears = RequireValidDuration(input.DurationMonths);
        RequireValidBudgetLines(input.BudgetLines, expectedYears);
        RequireValidManpower(input.Manpower, expectedYears);

        proposal.Title = input.Title;
        proposal.Agency = input.Agency;
        proposal.ProposalType = input.ProposalType;
        proposal.AdvertisementReference = input.AdvertisementReference;
        proposal.DurationMonths = input.DurationMonths;
        proposal.OverheadPercent = input.OverheadPercent;

        // proposal.BudgetLines (with .Years) is already fully loaded and
        // tracked -- RequireOfficeOrOwnerAsync's RequireAsync included it on
        // the very first query above, so no separate reload is needed before
        // removal. See ApplyBudgetLines below for why the *new* lines added
        // just after this must go through db.ProposalBudgetLines.Add
        // explicitly, not just the navigation collection.
        db.ProposalBudgetLines.RemoveRange(proposal.BudgetLines);
        proposal.BudgetLines.Clear();

        var newLines = ApplyBudgetLines(proposal, input.BudgetLines);
        (proposal.ProposedAmount, proposal.OverheadAmount, proposal.TotalAmount) = ComputeAmounts(newLines, proposal.OverheadPercent);

        // Equipment/Manpower are already loaded and tracked here too --
        // RequireAsync included both on the same first query. Unlike
        // BudgetLines, neither entity carries a unique index, so plain
        // Clear() (which EF resolves as a delete via the required-FK cascade
        // relationship) is safe here.
        proposal.Equipment.Clear();
        proposal.Manpower.Clear();
        ApplyEquipmentAndManpower(proposal, input.Equipment, input.Manpower);

        proposal.CoPis.Clear();
        ApplyCoPis(proposal, input.CoPis);

        proposal.UpdatedAt = DateTimeOffset.UtcNow;
        proposal.ConcurrencyVersion++;
        await db.SaveChangesAsync(ct);
        await audit.LogAsync(
            nameof(ResearchProposal), proposal.Id, "Updated", actorUserId,
            $"Title={proposal.Title};DurationMonths={proposal.DurationMonths};ProposedAmount={proposal.ProposedAmount}", ct);
    }

    /// <summary>
    /// Returns the newly created lines directly rather than relying on
    /// <c>proposal.BudgetLines</c> reflecting them immediately: EF's
    /// relationship fixup (which would otherwise add them to that navigation
    /// collection automatically) runs lazily on DetectChanges, not the moment
    /// db.ProposalBudgetLines.Add returns. UpdateAsync's caller needs the new
    /// lines right away, to compute ProposedAmount/OverheadAmount/TotalAmount.
    /// </summary>
    private IReadOnlyList<ProposalBudgetLine> ApplyBudgetLines(
        ResearchProposal proposal, IReadOnlyList<ProposalBudgetLineInput> lines)
    {
        var created = new List<ProposalBudgetLine>(lines.Count);

        foreach (var line in lines)
        {
            if (line.HeadName == BudgetHeadName.Other && string.IsNullOrWhiteSpace(line.CustomLabel))
            {
                throw new ArgumentException(
                    "CustomLabel is required when HeadName is Other.", nameof(lines));
            }

            var lineId = Guid.NewGuid();
            var budgetLine = new ProposalBudgetLine
            {
                Id = lineId,
                ResearchProposalId = proposal.Id,
                HeadName = line.HeadName,
                CustomLabel = line.CustomLabel,
                IncludeInOverhead = line.IncludeInOverhead,
            };

            for (var i = 0; i < line.YearAmounts.Count; i++)
            {
                budgetLine.Years.Add(new ProposalBudgetLineYear
                {
                    Id = Guid.NewGuid(),
                    ProposalBudgetLineId = lineId,
                    Year = i + 1,
                    Amount = line.YearAmounts[i],
                });
            }

            // db.ProposalBudgetLines.Add(...), not proposal.BudgetLines.Add(...):
            // on UpdateAsync's already-tracked proposal, adding to BOTH the
            // DbSet and the navigation collection double-tracked the same
            // conceptual row -- EF's own relationship fixup already adds a
            // db.Add()'d child to its parent's navigation collection once
            // DetectChanges runs, so the explicit proposal.BudgetLines.Add
            // this used to also call created a second, duplicate entry
            // (caught by asserting on summary.BudgetLines.Count, not just
            // that the call didn't throw). Adding only to the DbSet avoids
            // both the duplication and the earlier Modified-instead-of-Added
            // DbUpdateConcurrencyException this class of bug also caused.
            db.ProposalBudgetLines.Add(budgetLine);
            created.Add(budgetLine);
        }

        return created;
    }

    // db.ProposalEquipment.Add/db.ProposalManpowerPositions.Add, not just the
    // navigation collections: same reasoning as ApplyBudgetLines above -- on
    // UpdateAsync's already-tracked proposal, adding only to the navigation
    // collection left new rows tracked as Modified instead of Added, which
    // SaveChangesAsync then rejected with DbUpdateConcurrencyException on
    // every edit that added equipment or manpower rows.
    private void ApplyEquipmentAndManpower(
        ResearchProposal proposal,
        IReadOnlyList<ProposalEquipmentInput> equipment,
        IReadOnlyList<ProposalManpowerPositionInput> manpower)
    {
        foreach (var e in equipment)
        {
            var row = new ProposalEquipment
            {
                Id = Guid.NewGuid(),
                ResearchProposalId = proposal.Id,
                Name = e.Name,
                Unit = e.Unit,
                Amount = e.Amount,
            };
            db.ProposalEquipment.Add(row);
        }

        foreach (var m in manpower)
        {
            var positionId = Guid.NewGuid();
            var row = new ProposalManpowerPosition
            {
                Id = positionId,
                ResearchProposalId = proposal.Id,
                Designation = m.Designation,
                Positions = m.Positions,
                HraPercent = m.HraPercent,
            };

            for (var i = 0; i < m.StipendByYear.Count; i++)
            {
                row.Years.Add(new ProposalManpowerPositionYear
                {
                    Id = Guid.NewGuid(),
                    ProposalManpowerPositionId = positionId,
                    Year = i + 1,
                    Stipend = m.StipendByYear[i],
                });
            }

            db.ProposalManpowerPositions.Add(row);
        }
    }

    // db.ProposalCoPis.Add(...), not proposal.CoPis.Add(...): same reasoning
    // as ApplyBudgetLines/ApplyEquipmentAndManpower above.
    private void ApplyCoPis(ResearchProposal proposal, IReadOnlyList<ProposalCoPiInput> coPis)
    {
        foreach (var c in coPis)
        {
            var row = new ProposalCoPi
            {
                Id = Guid.NewGuid(),
                ResearchProposalId = proposal.Id,
                IsInsideInstitute = c.IsInsideInstitute,
                InstituteName = c.InstituteName,
                Name = c.Name,
                Department = c.Department,
                Designation = c.Designation,
            };
            db.ProposalCoPis.Add(row);
        }
    }

    /// <summary>
    /// Overhead is computed per year -- each year's own sum of
    /// <see cref="ProposalBudgetLine.IncludeInOverhead"/> lines' amounts is
    /// multiplied by <paramref name="overheadPercent"/> independently, then
    /// summed into the single stored <c>OverheadAmount</c>. NOT a lump total
    /// (all years' amounts summed first) split evenly afterward -- a
    /// front-loaded or back-loaded budget must produce front-loaded or
    /// back-loaded overhead to match, not an even blend across years.
    /// </summary>
    private static (decimal ProposedAmount, decimal OverheadAmount, decimal TotalAmount) ComputeAmounts(
        IReadOnlyCollection<ProposalBudgetLine> lines, decimal overheadPercent)
    {
        decimal proposedAmount = 0m;
        foreach (var line in lines)
        {
            if (line.HeadName != BudgetHeadName.RecurringOverhead)
            {
                proposedAmount += line.Years.Sum(y => y.Amount);
            }
        }

        var overheadLines = lines.Where(l => l.IncludeInOverhead).ToList();
        var yearsCount = lines.SelectMany(l => l.Years).Select(y => y.Year).DefaultIfEmpty(0).Max();
        decimal overheadAmount = 0m;
        for (var year = 1; year <= yearsCount; year++)
        {
            var yearBase = overheadLines.Sum(l => l.Years.FirstOrDefault(y => y.Year == year)?.Amount ?? 0m);
            overheadAmount += yearBase * overheadPercent / 100m;
        }

        return (proposedAmount, overheadAmount, proposedAmount + overheadAmount);
    }

    /// <summary>ceil(DurationMonths / 12) -- a 28-month proposal needs 3 year
    /// columns because part of the third year is used, not 2.</summary>
    private static int RequireValidDuration(int durationMonths)
    {
        if (durationMonths is < 1 or > 60)
        {
            throw new ArgumentException(
                "Duration must be between 1 and 60 months.", nameof(durationMonths));
        }

        return (int)Math.Ceiling(durationMonths / 12.0);
    }

    private static void RequireValidBudgetLines(
        IReadOnlyList<ProposalBudgetLineInput> lines, int expectedYears)
    {
        foreach (var line in lines)
        {
            if (line.YearAmounts.Count != expectedYears)
            {
                throw new InvalidBudgetYearCountException(line.HeadName, expectedYears, line.YearAmounts.Count);
            }
        }

        var seen = new HashSet<(BudgetHeadName HeadName, string NormalizedLabel)>();
        foreach (var line in lines)
        {
            var normalizedLabel = (line.CustomLabel ?? string.Empty).Trim().ToUpperInvariant();
            var key = (line.HeadName, normalizedLabel);
            if (!seen.Add(key))
            {
                var display = line.HeadName == BudgetHeadName.Other
                    ? $"Two budget lines are both labeled '{line.CustomLabel}'; each Other line needs a distinct label."
                    : $"Two budget lines both use head '{line.HeadName}'; each head may appear only once.";
                throw new ArgumentException(display, nameof(lines));
            }
        }
    }

    private static void RequireValidManpower(
        IReadOnlyList<ProposalManpowerPositionInput> manpower, int expectedYears)
    {
        foreach (var m in manpower)
        {
            if (m.StipendByYear.Count != expectedYears)
            {
                throw new ArgumentException(
                    $"Manpower position '{m.Designation}' has {m.StipendByYear.Count} year(s) of stipend " +
                    $"but the proposal duration requires {expectedYears}.", nameof(manpower));
            }
        }
    }

    public async Task SubmitForApprovalAsync(Guid proposalId, Guid piUserId, string? remarks = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(remarks))
        {
            throw new WorkflowTransitionException(
                "A remark is required when submitting a proposal.");
        }

        var proposal = await RequireOwnedByAsync(proposalId, piUserId, ct);
        RequireStatus(proposal, ProposalStatus.Draft, nameof(SubmitForApprovalAsync));

        var checklist = await checklistService.GetChecklistAsync(
            RequestType.ResearchProposal, WorkflowPhase.Indent, proposal.Id, "ResearchProposal", ct);
        var missing = checklist.Items
            .Where(i => i.IsMandatory && !i.IsSatisfied)
            .Select(i => i.DocumentKind)
            .ToList();
        if (missing.Count > 0)
        {
            throw new MandatoryDocumentMissingException(proposal.Id, missing);
        }

        if (proposal.CoPis.Count > 0)
        {
            var hasConsent = await db.Documents.AnyAsync(
                d => d.OwnerId == proposal.Id && d.OwnerType == "ResearchProposal"
                  && d.Kind == DocumentKind.CoPiConsent, ct);
            if (!hasConsent)
            {
                throw new MandatoryDocumentMissingException(proposal.Id, [DocumentKind.CoPiConsent]);
            }
        }

        var instance = await workflowEngine.RaiseAsync(
            RequestType.ResearchProposal, proposal.Id, WorkflowPhase.Indent, piUserId, ct);

        // BRD §A1: Set 21 working days initial countdown timer on submission
        instance.ExpiresAt = DateTimeOffset.UtcNow.AddDays(21);
        proposal.WorkflowInstanceId = instance.Id;
        proposal.Status = ProposalStatus.UnderApproval;
        proposal.UpdatedAt = DateTimeOffset.UtcNow;
        proposal.ConcurrencyVersion++;

        // Advance from Draft (PI stage) to WithHOD (HOD stage) so the HOD can review and forward
        await workflowEngine.ForwardAsync(
            instance.Id, piUserId, ["Faculty"], string.IsNullOrWhiteSpace(remarks) ? "Submitted for HOD approval" : remarks, ct);

        await db.SaveChangesAsync(ct);
    }


    /// <summary>Stages the route gives no role -- the engine would let anyone
    /// with any role act there, so ownership is what actually restricts them to
    /// the PI.</summary>
    /// <remarks>
    /// Draft and ReturnedToPI both carry empty AllowedRoles in
    /// <see cref="ResearchProposalWorkflowSeeder.Route"/> for the same reason:
    /// each is the PI's own step (first submission, and revising after a
    /// Return), not a role-gated one. ReturnedToPI exists precisely because
    /// forwarding it straight to AssignedToDealingAssistant (RegularStaff-only)
    /// would have made the "PI revises" step impossible -- this check is what
    /// keeps that promise, since the engine's role gate alone permits anyone
    /// at a roleless stage.
    /// </remarks>
    private static readonly HashSet<WorkflowStage> PiOnlyStages =
        [WorkflowStage.Draft, WorkflowStage.ReturnedToPI];

    public async Task ForwardAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var proposal = await RequireUnderApprovalAsync(proposalId, ct);
        await RequirePiIfAtPiOnlyStageAsync(proposal, actorUserId, actorRoles, ct);
        await workflowEngine.ForwardAsync(proposal.WorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);
    }

    /// <summary>
    /// The R&amp;C office's WithRnCOffice-stage action: names a specific
    /// RegularStaff person as the Dealing Assistant instead of leaving the
    /// proposal open to whichever RegularStaff account happens to act on it
    /// first. Thin wrapper over IWorkflowEngineService.AssignAndForwardAsync,
    /// matching ForwardAsync's own shape.
    /// </summary>
    public async Task AssignToDealingAssistantAsync(
        Guid proposalId, Guid assigneeUserId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var proposal = await RequireUnderApprovalAsync(proposalId, ct);
        await workflowEngine.AssignAndForwardAsync(
            proposal.WorkflowInstanceId!.Value, assigneeUserId, actorUserId, actorRoles, remarks, ct);
    }

    private async Task RequirePiIfAtPiOnlyStageAsync(
        ResearchProposal proposal, Guid actorUserId, IReadOnlyCollection<string> actorRoles, CancellationToken ct)
    {
        var instance = await workflowEngine.GetAsync(proposal.WorkflowInstanceId!.Value, ct);
        if (instance is null)
        {
            return;
        }

        if (instance.CurrentStage == WorkflowStage.ReturnedToPI && proposal.OwnerUserId != actorUserId)
        {
            throw new NotTheProposalOwnerException(proposal.Id);
        }

        if (instance.CurrentStage == WorkflowStage.Draft && proposal.OwnerUserId != actorUserId)
        {
            var isAuthorizedRole = actorRoles.Any(r =>
                r.Equals("HOD", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("Dean", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("Superintendent", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("DeputyRegistrar", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("RegularStaff", StringComparison.OrdinalIgnoreCase));

            if (!isAuthorizedRole)
            {
                throw new NotTheProposalOwnerException(proposal.Id);
            }
        }
    }

    public async Task RejectAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var proposal = await RequireUnderApprovalAsync(proposalId, ct);
        await workflowEngine.RejectAsync(proposal.WorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);

        proposal.Status = ProposalStatus.Rejected;
        proposal.UpdatedAt = DateTimeOffset.UtcNow;
        proposal.ConcurrencyVersion++;
        await db.SaveChangesAsync(ct);
    }

    public async Task ReturnAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var proposal = await RequireUnderApprovalAsync(proposalId, ct);

        // Status is not touched: a returned proposal has moved backward within
        // the internal chain, not left it. UnderApproval already covers "the PI
        // needs to act on this before it can proceed", which is equally true
        // whether that action is forwarding for the first time or resubmitting.
        await workflowEngine.ReturnAsync(proposal.WorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);
    }

    public async Task ApproveAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var proposal = await RequireUnderApprovalAsync(proposalId, ct);
        await workflowEngine.ApproveAsync(proposal.WorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);

        proposal.Status = ProposalStatus.Approved;
        proposal.UpdatedAt = DateTimeOffset.UtcNow;
        proposal.ConcurrencyVersion++;
        await db.SaveChangesAsync(ct);
    }

    public async Task RecordAgencySubmissionAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        DateOnly submittedOn, CancellationToken ct = default)
    {
        var proposal = await RequireOfficeOrOwnerAsync(proposalId, actorUserId, actorRoles, ct);
        RequireStatus(proposal, ProposalStatus.Approved, nameof(RecordAgencySubmissionAsync));

        proposal.Status = ProposalStatus.SubmittedToAgency;
        proposal.SubmittedToAgencyOn = submittedOn;
        proposal.UpdatedAt = DateTimeOffset.UtcNow;
        proposal.ConcurrencyVersion++;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// The only method in this service that may set <see cref="ResearchProposal.ProjectId"/>.
    /// </summary>
    /// <remarks>
    /// Every <see cref="ProposalBudgetLine"/> becomes a <see cref="BudgetHead"/>
    /// row via <c>IProjectService.CreateAsync</c>, using <c>ToBudgetHeadInput</c>
    /// to carry each line's own genuine year-wise amounts forward into the
    /// sanctioned Project's Year1-Year5 columns; every equipment and manpower
    /// row is carried forward the same way. Redistributing an already-sanctioned
    /// project's budget across years afterward is the deferred
    /// BudgetRedistributionHistory work (spec §6), on the Project, not here.
    /// </remarks>
    public async Task<Guid> RecordSanctionAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        RecordSanctionInput input, CancellationToken ct = default)
    {
        var proposal = await RequireOfficeOrOwnerAsync(proposalId, actorUserId, actorRoles, ct);
        RequireStatus(proposal, ProposalStatus.SubmittedToAgency, nameof(RecordSanctionAsync));

        var hasSanctionLetter = await db.Documents.AnyAsync(
            d => d.OwnerId == proposal.Id && d.OwnerType == "ResearchProposal" && d.Kind == DocumentKind.SanctionLetter, ct);
        if (!hasSanctionLetter)
        {
            throw new InvalidOperationException("Sanction Letter is mandatory. Please upload the Sanction Letter before recording sanction.");
        }

        var budgetHeads = proposal.BudgetLines
            .Select(l => ToBudgetHeadInput(l))
            .ToList();
        var equipment = proposal.Equipment
            .Select(e => new SanctionedEquipmentInput(null, e.Name, e.Unit, e.Amount))
            .ToList();
        var manpower = proposal.Manpower
            .Select(m =>
            {
                var year1Stipend = m.Years.OrderBy(y => y.Year).FirstOrDefault()?.Stipend ?? 0m;
                var year1Hra = year1Stipend * m.HraPercent / 100m;
                return new SanctionedManpowerPositionInput(null, m.Designation, m.Positions, year1Stipend, year1Hra);
            })
            .ToList();

        var blendedOverheadPercent = proposal.ProposedAmount == 0m
            ? 0m
            : Math.Round(proposal.OverheadAmount / proposal.ProposedAmount * 100m, 2);

        var effectiveStartDate = input.ProjectStartDate ?? input.SanctionDate;
        if (effectiveStartDate < input.SanctionDate)
        {
            throw new ArgumentException("Project start date cannot be earlier than sanction date.", nameof(input));
        }

        var collaborators = proposal.CoPis
            .Select(cp => new CollaboratorInput(
                null, 
                string.IsNullOrWhiteSpace(cp.InstituteName) ? "MNNIT Allahabad" : cp.InstituteName, 
                cp.Name, 
                cp.IsInsideInstitute, 
                cp.Department, 
                cp.Designation))
            .ToList();

        var project = await projectService.CreateAsync(
            ownerUserId: proposal.OwnerUserId,
            projectType: proposal.ProposalType switch
            {
                ProposalType.IndustrySponsoredProject => ProjectType.TypeIIIndustrySponsored,
                ProposalType.ConsultancyProject        => ProjectType.TypeIIIConsultancy,
                ProposalType.Testing                   => ProjectType.TypeIVTesting,
                ProposalType.OtherActivities           => ProjectType.TypeVOther,
                _                                      => ProjectType.TypeIResearch,
            },
            sanctionNo: input.SanctionNo,
            sanctionDate: input.SanctionDate,
            projectTitle: proposal.Title,
            startDate: effectiveStartDate,
            agency: proposal.Agency,
            durationMonths: proposal.DurationMonths,
            totalSanctioned: input.TotalSanctioned,
            collaborators: collaborators,
            budgetHeads: budgetHeads,
            equipment: equipment,
            manpower: manpower,
            overheadPercent: blendedOverheadPercent,
            ct: ct);

        proposal.Status = ProposalStatus.Sanctioned;
        proposal.AgencyDecisionOn = input.SanctionDate;
        proposal.ProjectId = project.Id;
        proposal.SanctionedByUserId = actorUserId;
        proposal.UpdatedAt = DateTimeOffset.UtcNow;
        proposal.ConcurrencyVersion++;
        await db.SaveChangesAsync(ct);

        return project.Id;
    }

    /// <summary>
    /// A proposal's Years are 1-indexed and only as many as its duration
    /// implies (up to 5, per RequireValidDuration); BudgetHead has exactly
    /// five fixed year columns, so any year beyond what this line actually
    /// carries -- including all of them, for a proposal shorter than 5 years
    /// -- stays at its Project-side default of 0. Replaces the old
    /// placeholder that put the entire line total in Year1Amount regardless
    /// of how many years the proposal actually spanned.
    /// </summary>
    private static BudgetHeadInput ToBudgetHeadInput(ProposalBudgetLine line)
    {
        decimal AmountForYear(int year) =>
            line.Years.FirstOrDefault(y => y.Year == year)?.Amount ?? 0m;

        return new BudgetHeadInput(
            null, line.HeadName,
            AmountForYear(1), AmountForYear(2), AmountForYear(3), AmountForYear(4), AmountForYear(5),
            line.CustomLabel);
    }

    public async Task RecordNotFundedAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, CancellationToken ct = default)
    {
        var proposal = await RequireOfficeOrOwnerAsync(proposalId, actorUserId, actorRoles, ct);
        RequireStatus(proposal, ProposalStatus.SubmittedToAgency, nameof(RecordNotFundedAsync));

        proposal.Status = ProposalStatus.NotFunded;
        proposal.AgencyDecisionOn = DateOnly.FromDateTime(DateTime.UtcNow);
        proposal.UpdatedAt = DateTimeOffset.UtcNow;
        proposal.ConcurrencyVersion++;
        await db.SaveChangesAsync(ct);
    }

    public async Task WithdrawAsync(Guid proposalId, Guid piUserId, CancellationToken ct = default)
    {
        var proposal = await RequireOwnedByAsync(proposalId, piUserId, ct);

        if (proposal.Status is ProposalStatus.Approved or ProposalStatus.SubmittedToAgency or ProposalStatus.Sanctioned or ProposalStatus.Withdrawn or ProposalStatus.Rejected or ProposalStatus.NotFunded)
        {
            throw new InvalidProposalStatusException(
                proposalId, nameof(WithdrawAsync), "Draft or UnderApproval", proposal.Status.ToString());
        }

        if (proposal.WorkflowInstanceId is { } instanceId)
        {
            // Cancel is not role-gated in the engine (any non-terminal stage),
            // matching every other slice's withdrawal path.
            await workflowEngine.CancelAsync(instanceId, piUserId, [], "Withdrawn by the PI", ct);
        }

        proposal.Status = ProposalStatus.Withdrawn;
        proposal.UpdatedAt = DateTimeOffset.UtcNow;
        proposal.ConcurrencyVersion++;
        await db.SaveChangesAsync(ct);
    }

    public async Task ExtendExpiryAsync(Guid proposalId, Guid actorUserId, int additionalDays = 21, CancellationToken ct = default)
    {
        if (additionalDays <= 0)
        {
            throw new ArgumentException("additionalDays must be greater than zero.", nameof(additionalDays));
        }

        var proposal = await RequireAsync(proposalId, ct);
        if (proposal.WorkflowInstanceId is not { } instanceId) return;

        var instance = await db.WorkflowInstances.FirstOrDefaultAsync(w => w.Id == instanceId, ct);
        if (instance is not null)
        {
            var baseDate = instance.ExpiresAt ?? DateTimeOffset.UtcNow;
            instance.ExpiresAt = baseDate.AddDays(additionalDays);
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task<ResearchProposalSummary> GetAsync(
        Guid proposalId, Guid requestingUserId, CancellationToken ct = default)
    {
        var proposal = await RequireAsync(proposalId, ct);
        return await ToSummaryAsync(proposal, ct);
    }

    public async Task<(Guid OwnerUserId, Guid DepartmentId)?> GetOwnershipAsync(
        Guid proposalId, CancellationToken ct = default)
    {
        var row = await db.ResearchProposals
            .Where(p => p.Id == proposalId)
            .Select(p => new { p.OwnerUserId, p.DepartmentId })
            .FirstOrDefaultAsync(ct);

        return row is null ? null : (row.OwnerUserId, row.DepartmentId);
    }

    public async Task<PagedResult<ResearchProposalSummary>> ListOwnAsync(
        Guid piUserId, int page = 1, int pageSize = 10, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var baseQuery = db.ResearchProposals
            .Where(p => p.OwnerUserId == piUserId)
            .OrderByDescending(p => p.CreatedAt);

        var totalCount = await baseQuery.CountAsync(ct);

        var proposals = await baseQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(p => p.BudgetLines).ThenInclude(l => l.Years)
            .Include(p => p.Equipment)
            .Include(p => p.Manpower).ThenInclude(m => m.Years)
            .ToListAsync(ct);

        var items = await ToSummariesAsync(proposals, ct);
        return new PagedResult<ResearchProposalSummary>(items, totalCount, page, pageSize);
    }

    public async Task<IReadOnlyList<ResearchProposalSummary>> ListForHodAsync(
        Guid hodUserId, CancellationToken ct = default)
    {
        var departmentId = await userDepartment.GetDepartmentIdAsync(hodUserId, ct)
            ?? throw new PiHasNoDepartmentException(hodUserId);

        // Scoped to the HOD's own department. Widening this to every department
        // for an R&C-based HOD is Phase 8's IPageAccessService concern at the
        // page-access layer (Task 8), not something this query decides for
        // itself -- this method answers "this department's proposals", and the
        // controller resolves which departments that means for the caller.
        var proposals = await db.ResearchProposals
            .Include(p => p.BudgetLines).ThenInclude(l => l.Years)
            .Include(p => p.Equipment)
            .Include(p => p.Manpower).ThenInclude(m => m.Years)
            .Where(p => p.DepartmentId == departmentId && p.Status == ProposalStatus.UnderApproval)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        return await ToSummariesAsync(proposals, ct);
    }

    /// <summary>Stages the R&amp;C office chain owns, per
    /// <see cref="ResearchProposalWorkflowSeeder.Route"/>. Draft and WithHOD
    /// belong to the PI/HOD respectively, not the office, so they are
    /// deliberately excluded even though both are UnderApproval too.</summary>
    private static readonly HashSet<WorkflowStage> OfficeChainStages =
    [
        WorkflowStage.WithRnCOffice,
        WorkflowStage.AssignedToDealingAssistant,
        WorkflowStage.WithSuperintendent,
        WorkflowStage.WithDeputyRegistrar,
        WorkflowStage.WithDean,
    ];

    public async Task<IReadOnlyList<ResearchProposalSummary>> ListForRnCOfficeAsync(
        Guid officeUserId, CancellationToken ct = default)
    {
        if (!await instituteWideScope.IsInstituteWideAsync(officeUserId, ct))
        {
            // Mirrors PageAccessService.IsInstituteWideAsync's own refusal: an
            // office role whose department is not R&C sees nothing here, the
            // same as it would not have received the page grant in the first
            // place. Empty rather than an exception -- "nothing to show" is
            // the honest answer for an office account outside R&C, not an
            // error condition the caller needs to handle specially.
            return [];
        }

        var underApproval = await db.ResearchProposals
            .Include(p => p.BudgetLines).ThenInclude(l => l.Years)
            .Include(p => p.Equipment)
            .Include(p => p.Manpower).ThenInclude(m => m.Years)
            .Where(p => p.Status == ProposalStatus.UnderApproval)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        var atOfficeStage = new List<ResearchProposal>();
        foreach (var proposal in underApproval)
        {
            if (proposal.WorkflowInstanceId is not { } instanceId)
            {
                continue;
            }

            var instance = await workflowEngine.GetAsync(instanceId, ct);
            if (instance is not null && OfficeChainStages.Contains(instance.CurrentStage))
            {
                atOfficeStage.Add(proposal);
            }
        }

        return await ToSummariesAsync(atOfficeStage, ct);
    }

    public async Task<IReadOnlyList<ResearchProposalSummary>> ListPendingForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var pending = await pendingQuery.ListPendingInstancesAsync(
            RequestType.ResearchProposal, WorkflowPhase.Indent, roles, userId, ct);
        if (pending.Count == 0)
        {
            return [];
        }

        // pending.Keys.Contains(...), not pending.ContainsKey(...): the
        // dictionary's own ContainsKey cannot be translated to SQL by the
        // real MySQL provider (only the more permissive InMemory test
        // provider tolerates it), so every call silently threw
        // InvalidOperationException -- swallowed by DashboardService's
        // per-type catch, so a HOD's pending proposals never appeared on
        // their dashboard, with no visible error. Keys.Contains translates
        // to a SQL IN (...) clause, same result set.
        var pendingIds = pending.Keys;
        var proposals = await db.ResearchProposals
            .Include(p => p.BudgetLines).ThenInclude(l => l.Years)
            .Include(p => p.Equipment)
            .Include(p => p.Manpower).ThenInclude(m => m.Years)
            .Where(p => p.WorkflowInstanceId != null && pendingIds.Contains(p.WorkflowInstanceId.Value))
            .ToListAsync(ct);

        var departmentId = await userDepartment.GetDepartmentIdAsync(userId, ct);
        var isInstituteWide = await instituteWideScope.IsInstituteWideAsync(userId, ct);

        // Mirrors ListForHodAsync/ListForRnCOfficeAsync's own split rather
        // than a blanket "same department OR institute-wide" check: an
        // office-chain stage (WithRnCOffice, AssignedToDealingAssistant,
        // WithSuperintendent, WithDeputyRegistrar, WithDean) is
        // institute-wide-or-nothing, exactly like ListForRnCOfficeAsync --
        // a RegularStaff account whose own department happens to coincide
        // with the proposal's must not see it that way, since RegularStaff
        // sits in every office-chain stage's AllowedRoles regardless of
        // which department raised the proposal. Every other stage (Draft,
        // WithHOD, ReturnedToPI, ...) stays department-scoped, like
        // ListForHodAsync.
        bool IsVisible(ResearchProposal p) =>
            pending.TryGetValue(p.WorkflowInstanceId!.Value, out var stage) && OfficeChainStages.Contains(stage)
                ? isInstituteWide
                : departmentId is not null && p.DepartmentId == departmentId;

        var visible = proposals.Where(IsVisible).ToList();

        return await ToSummariesAsync(visible, ct);
    }

    public async Task UndoLastActionAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, CancellationToken ct = default)
    {
        var proposal = await RequireOfficeOrOwnerAsync(proposalId, actorUserId, actorRoles, ct);

        if (proposal.Status != ProposalStatus.Sanctioned)
        {
            if (proposal.WorkflowInstanceId is not { } instanceId)
            {
                throw new CannotUndoException("This proposal has no workflow instance to undo an action on.");
            }

            // Status is a ResearchProposal-level field the engine knows
            // nothing about -- ApproveAsync/RejectAsync each set it AFTER
            // calling into the engine, so undoing the underlying WorkflowStep
            // alone leaves Status stuck at Approved/Rejected even though
            // CurrentStage has correctly reverted. RequireUnderApprovalAsync
            // (the gate every other chain action goes through) requires
            // Status == UnderApproval, so a stuck Status would permanently
            // brick the proposal -- no other code path resets it back.
            // Peek at what the last non-undone step's Action actually was
            // BEFORE calling the engine's undo, since that call is what flips
            // IsUndone on it.
            var instanceBeforeUndo = await workflowEngine.GetAsync(instanceId, ct)
                ?? throw new CannotUndoException("This proposal's workflow instance could not be found.");
            var lastAction = instanceBeforeUndo.Steps
                .Where(s => !s.IsUndone)
                .OrderBy(s => s.Timestamp)
                .LastOrDefault()?.Action;

            await workflowEngine.UndoLastActionAsync(instanceId, actorUserId, ct);

            if (lastAction is WorkflowAction.Approve or WorkflowAction.Reject)
            {
                proposal.Status = ProposalStatus.UnderApproval;
                proposal.UpdatedAt = DateTimeOffset.UtcNow;
                proposal.ConcurrencyVersion++;
                await db.SaveChangesAsync(ct);
            }

            return;
        }

        // Sanction: RecordSanctionAsync never calls AppendStep, so there is no
        // WorkflowStep for the engine to undo -- reverse the three fields it
        // set directly, and remove the Project it created, but only if
        // genuinely nothing has touched that Project since.
        //
        // RecordSanctionAsync also records no WorkflowStep, meaning the
        // engine's own "only the original actor may undo" check (which
        // compares against WorkflowStep.ActorUserId) has nothing to compare
        // against here. SanctionedByUserId is that record for this one
        // action -- enforce the same rule against it directly.
        if (proposal.SanctionedByUserId != actorUserId)
        {
            throw new CannotUndoException("Only the person who recorded the sanction may undo it.");
        }

        if (proposal.ProjectId is not { } projectId)
        {
            throw new CannotUndoException("This proposal is Sanctioned but has no linked Project to undo.");
        }

        var hasDownstreamActivity = await projectService.HasAnyDownstreamActivityAsync(projectId, ct);
        if (hasDownstreamActivity)
        {
            throw new CannotUndoException(
                "This project already has grant receipts or budget re-appropriations recorded against it, " +
                "and can no longer be undone.");
        }

        await projectService.HardDeleteUntouchedAsync(projectId, actorUserId, ct);

        proposal.Status = ProposalStatus.SubmittedToAgency;
        proposal.ProjectId = null;
        proposal.SanctionedByUserId = null;
        proposal.AgencyDecisionOn = null;
        proposal.UpdatedAt = DateTimeOffset.UtcNow;
        proposal.ConcurrencyVersion++;
        await db.SaveChangesAsync(ct);
    }

    private async Task<ResearchProposal> RequireAsync(Guid proposalId, CancellationToken ct) =>
        await db.ResearchProposals
            .Include(p => p.BudgetLines).ThenInclude(l => l.Years)
            .Include(p => p.Equipment)
            .Include(p => p.Manpower).ThenInclude(m => m.Years)
            .Include(p => p.CoPis)
            .FirstOrDefaultAsync(p => p.Id == proposalId, ct)
            ?? throw new ProposalNotFoundException(proposalId);

    private async Task<ResearchProposal> RequireOwnedByAsync(Guid proposalId, Guid userId, CancellationToken ct)
    {
        var proposal = await RequireAsync(proposalId, ct);
        if (proposal.OwnerUserId != userId)
        {
            throw new NotTheProposalOwnerException(proposalId);
        }

        return proposal;
    }

    /// <summary>
    /// RecordAgencySubmissionAsync/RecordSanctionAsync/RecordNotFundedAsync run
    /// after the internal chain has already concluded, so no workflow stage
    /// protects them -- the controller's [PageAccess("proposals-rnc.agency-actions")]
    /// covers Office roles, but a PI sometimes submits to the agency and
    /// records the outcome themselves too (confirmed live: faculty1 got a 403
    /// recording their own approved proposal's submission date). An Office
    /// caller may act on any proposal, matching their existing reach; a PI
    /// caller may only act on their own.
    /// </summary>
    private async Task<ResearchProposal> RequireOfficeOrOwnerAsync(
        Guid proposalId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, CancellationToken ct)
    {
        var proposal = await RequireAsync(proposalId, ct);

        var isOfficeRole = actorRoles.Any(r =>
            r.Equals("Dean", StringComparison.OrdinalIgnoreCase) ||
            r.Equals("DeputyRegistrar", StringComparison.OrdinalIgnoreCase) ||
            r.Equals("Superintendent", StringComparison.OrdinalIgnoreCase) ||
            r.Equals("RegularStaff", StringComparison.OrdinalIgnoreCase));

        if (!isOfficeRole && proposal.OwnerUserId != actorUserId)
        {
            throw new NotTheProposalOwnerException(proposalId);
        }

        return proposal;
    }

    private async Task<ResearchProposal> RequireUnderApprovalAsync(Guid proposalId, CancellationToken ct)
    {
        var proposal = await RequireAsync(proposalId, ct);
        RequireStatus(proposal, ProposalStatus.UnderApproval, "act on");
        return proposal;
    }

    private static void RequireStatus(ResearchProposal proposal, ProposalStatus required, string action)
    {
        if (proposal.Status != required)
        {
            throw new InvalidProposalStatusException(
                proposal.Id, action, required.ToString(), proposal.Status.ToString());
        }
    }

    private async Task<ResearchProposalSummary> ToSummaryAsync(ResearchProposal proposal, CancellationToken ct)
    {
        WorkflowStage? currentStage = null;
        DateTimeOffset? expiresAt = null;
        if (proposal.WorkflowInstanceId is { } instanceId)
        {
            var instance = await workflowEngine.GetAsync(instanceId, ct);
            currentStage = instance?.CurrentStage;
            expiresAt = instance?.ExpiresAt;
        }

        var budgetLines = proposal.BudgetLines
            .Select(l => new ProposalBudgetLineSummary(
                l.HeadName,
                l.Years.OrderBy(y => y.Year).Select(y => y.Amount).ToList(),
                l.IncludeInOverhead,
                l.CustomLabel))
            .ToList();
        var equipment = proposal.Equipment
            .Select(e => new ProposalEquipmentSummary(e.Name, e.Unit, e.Amount))
            .ToList();
        var manpower = proposal.Manpower
            .Select(m =>
            {
                var stipendByYear = m.Years.OrderBy(y => y.Year).Select(y => y.Stipend).ToList();
                var hraByYear = stipendByYear.Select(s => s * m.HraPercent / 100m).ToList();
                return new ProposalManpowerPositionSummary(m.Designation, m.Positions, m.HraPercent, stipendByYear, hraByYear);
            })
            .ToList();
        var coPis = proposal.CoPis
            .Select(c => new ProposalCoPiSummary(c.Name, c.Department, c.Designation, c.IsInsideInstitute, c.InstituteName))
            .ToList();

        return new ResearchProposalSummary(
            proposal.Id, proposal.OwnerUserId, proposal.DepartmentId, proposal.Title, proposal.ProposalType, proposal.Agency,
            proposal.ProposedAmount, proposal.OverheadAmount, proposal.OverheadPercent, proposal.DurationMonths, proposal.Status,
            proposal.WorkflowInstanceId, currentStage, expiresAt, proposal.SubmittedToAgencyOn, proposal.AgencyDecisionOn,
            proposal.ProjectId, proposal.CreatedAt, budgetLines, equipment, manpower, proposal.TotalAmount, coPis);
    }


    private async Task<IReadOnlyList<ResearchProposalSummary>> ToSummariesAsync(
        IReadOnlyList<ResearchProposal> proposals, CancellationToken ct)
    {
        var summaries = new List<ResearchProposalSummary>(proposals.Count);
        foreach (var proposal in proposals)
        {
            summaries.Add(await ToSummaryAsync(proposal, ct));
        }

        return summaries;
    }
}
