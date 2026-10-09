using API.Application.Common;
using API.Application.Documents;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace API.Application.Procurement;

/// <summary>
/// The raise/read/bill sequence is identical for all three indent types; only the
/// backing DbSet, the RequestType and a couple of type-specific validations differ.
/// The spec chose three parallel entities, but that decision does not require three
/// parallel copies of this logic.
/// </summary>
public abstract class IndentServiceBase<TIndent>(
    IApplicationDbContext db,
    IProcurementTierCalculator tierCalculator,
    IIndentBudgetValidator budgetValidator,
    IWorkflowEngineService workflowEngine,
    IWorkflowDefinitionService workflowDefinitions,
    IDocumentGenerationService documentGeneration,
    IDocumentStorageService documentStorage,
    IFacultyProfileProvider facultyProfiles,
    API.Application.Projects.IProjectService projectService) : IIndentService
    where TIndent : class
{
    private const decimal EWayBillThreshold = 50_000m;

    /// <summary>
    /// Exposed so derived services can reach their own DbSet without recapturing
    /// the context in their primary constructor (CS9107).
    /// </summary>
    protected IApplicationDbContext Db => db;

    protected abstract DbSet<TIndent> Set { get; }
    protected abstract RequestType RequestType { get; }
    protected abstract IndentType IndentType { get; }
    protected abstract string OwnerType { get; }

    protected abstract TIndent NewIndent(RaiseIndentInput input, Guid id);

    /// <summary>
    /// Expression forms of the Id/ProjectId accessors. The method versions below
    /// cannot appear inside a <c>Where</c>: EF cannot translate a virtual call, so
    /// the query would either throw or silently fall back to loading the whole table.
    /// </summary>
    protected abstract Expression<Func<TIndent, bool>> HasId(Guid indentId);
    protected abstract Expression<Func<TIndent, bool>> BelongsToProject(Guid projectId);

    protected abstract Guid IdOf(TIndent indent);
    protected abstract Guid ProjectIdOf(TIndent indent);
    protected abstract Guid BudgetHeadIdOf(TIndent indent);
    protected abstract Guid WorkflowInstanceIdOf(TIndent indent);
    protected abstract void SetWorkflowInstanceId(TIndent indent, Guid workflowInstanceId);
    protected abstract string NameOf(TIndent indent);
    protected abstract decimal EstimatedCostOf(TIndent indent);
    protected abstract GemAvailability GemAvailabilityOf(TIndent indent);
    protected abstract DateTimeOffset CreatedAtOf(TIndent indent);
    protected abstract IndentDocumentModel BuildDocumentModel(
        TIndent indent, Project project, BudgetHead head, FacultyProfileInfo faculty,
        IReadOnlyList<IndentCommitteeMemberModel> committee, ProcurementTier tier);
    protected abstract void ApplyBillFields(TIndent indent, ProcessBillInput input);
    protected abstract IndentSummary MapToSummary(TIndent indent, WorkflowStage stage);

    /// <summary>Type-specific validation at raise time. Base implementation does nothing.</summary>
    protected virtual Task ValidateRaiseAsync(RaiseIndentInput input, Project project, CancellationToken ct)
        => Task.CompletedTask;

    /// <summary>Type-specific validation at bill time. Base implementation does nothing.</summary>
    protected virtual void ValidateBill(TIndent indent, ProcessBillInput input) { }

    public async Task<Guid> RaiseAsync(RaiseIndentInput input, Guid requestingUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Purpose))
        {
            throw new WorkflowTransitionException(
                "A remark is required when raising an indent request.");
        }

        var project = await LoadOwnedProjectAsync(input.ProjectId, requestingUserId, ct);

        ValidateNonAvailabilityCertificate(input);
        await ValidateRaiseAsync(input, project, ct);

        var head = await db.BudgetHeads.FirstOrDefaultAsync(b => b.Id == input.BudgetHeadId, ct)
            ?? throw new ArgumentException(
                $"Budget head '{input.BudgetHeadId}' was not found.", nameof(input));

        if (head.ProjectId != project.Id)
        {
            throw new ArgumentException(
                "The budget head does not belong to the specified project.", nameof(input));
        }

        // Computed server-side: legacy trusted a client-sent mode_of_purchase.
        var tier = tierCalculator.DetermineTier(input.GemAvailability, input.EstimatedCost);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await budgetValidator.EnsureSufficientAsync(input.BudgetHeadId, today, input.EstimatedCost, ct);

        var indentId = Guid.NewGuid();
        var indent = NewIndent(input, indentId);
        Set.Add(indent);
        await db.SaveChangesAsync(ct);

        var committee = await PersistCommitteeAsync(input, tier, indentId, ct);

        var faculty = await facultyProfiles.GetAsync(project.OwnerUserId, ct);
        var model = BuildDocumentModel(indent, project, head, faculty, committee, tier);
        var pdf = await documentGeneration.GenerateIndentAsync(tier, model, input.GemQuotationPdf, ct);
        await StoreDocumentAsync(indentId, DocumentKind.Indent, pdf, requestingUserId, ct);

        var instance = await workflowEngine.RaiseAsync(
            RequestType, indentId, WorkflowPhase.Indent, requestingUserId, ct);
        if (project.CurrentDaUserId is { } daUserId)
        {
            instance.AssignedToUserId = daUserId;
            instance.IsAssignedViaProjectDa = true;
        }
        SetWorkflowInstanceId(indent, instance.Id);
        await db.SaveChangesAsync(ct);

        return indentId;
    }

    public async Task<IReadOnlyList<IndentSummary>> ListForProjectAsync(
        Guid projectId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null,
        CancellationToken ct = default)
    {
        _ = await projectService.GetAsync(projectId, requestingUserId, requestingUserRoles, ct)
            ?? throw new ProjectAccessDeniedException(projectId);

        var indents = await Set.Where(BelongsToProject(projectId)).ToListAsync(ct);
        var legacySummaries = await ToSummariesAsync(indents, ct);

        var dynamicIndents = await db.Indents
            .Include(i => i.Items)
            .Where(i => i.ProjectId == projectId && i.IndentType == IndentType)
            .ToListAsync(ct);

        if (dynamicIndents.Count == 0)
        {
            return legacySummaries;
        }

        var dynamicWorkflowIds = dynamicIndents.Select(i => i.WorkflowInstanceId).ToHashSet();
        var dynamicStages = await db.WorkflowInstances
            .Where(w => dynamicWorkflowIds.Contains(w.Id) && w.Phase == WorkflowPhase.Indent)
            .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);

        var dynamicSummaries = dynamicIndents.Select(i =>
        {
            var firstItem = i.Items.FirstOrDefault();
            var name = firstItem?.Name ?? i.Purpose ?? "Indent";
            var cost = i.Items.Sum(item => item.EstimatedCostInclTax);
            var gem = i.GemAvailability;
            var tier = tierCalculator.DetermineTier(gem, cost);
            var stage = dynamicStages.TryGetValue(i.WorkflowInstanceId, out var s) ? s : WorkflowStage.Raised;

            return new IndentSummary(
                i.Id,
                i.ProjectId,
                i.BudgetHeadId,
                i.WorkflowInstanceId,
                name,
                cost,
                gem,
                tier,
                stage,
                i.CreatedAt,
                IndentType: i.IndentType,
                IndentNumber: i.IndentNumber);
        }).ToList();

        return [.. legacySummaries, .. dynamicSummaries];
    }

    public async Task<IndentSummary> GetAsync(Guid indentId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default)
    {
        var indent = await FindAsync(indentId, ct);
        if (indent != null)
        {
            var project = await projectService.GetAsync(ProjectIdOf(indent), requestingUserId, requestingUserRoles, ct);
            if (project == null) throw new ProjectAccessDeniedException(ProjectIdOf(indent));
            return (await ToSummariesAsync([indent], ct)).Single();
        }

        var dynamicIndent = await db.Indents.Include(i => i.Items).FirstOrDefaultAsync(i => i.Id == indentId, ct);
        if (dynamicIndent != null)
        {
            var project = await projectService.GetAsync(dynamicIndent.ProjectId, requestingUserId, requestingUserRoles, ct);
            if (project == null) throw new ProjectAccessDeniedException(dynamicIndent.ProjectId);

            var stage = await db.WorkflowInstances
                .Where(w => w.Id == dynamicIndent.WorkflowInstanceId && w.Phase == WorkflowPhase.Indent)
                .Select(w => w.CurrentStage)
                .FirstOrDefaultAsync(ct);

            var name = dynamicIndent.Items.FirstOrDefault()?.Name ?? dynamicIndent.Purpose ?? "Indent";
            var cost = dynamicIndent.Items.Sum(item => item.EstimatedCostInclTax);

            return new IndentSummary(
                dynamicIndent.Id,
                dynamicIndent.ProjectId,
                dynamicIndent.BudgetHeadId,
                dynamicIndent.WorkflowInstanceId,
                name,
                cost,
                dynamicIndent.GemAvailability,
                tierCalculator.DetermineTier(dynamicIndent.GemAvailability, cost),
                stage,
                dynamicIndent.CreatedAt,
                dynamicIndent.PaymentRouting,
                dynamicIndent.MiscellaneousExpenditure,
                dynamicIndent.BiddingNumber,
                dynamicIndent.BidPublicationDate,
                dynamicIndent.PurchaseOrderNumber,
                dynamicIndent.PurchaseOrderDate,
                dynamicIndent.BindingLocation,
                dynamicIndent.ComparativeStatementNumber,
                dynamicIndent.ComparativeStatementSigned,
                dynamicIndent.OriginalBillReference ?? dynamicIndent.BillNo,
                dynamicIndent.BillAmount,
                dynamicIndent.GenerationDate,
                dynamicIndent.ItemReceivingDate,
                dynamicIndent.BillProcessStatus,
                dynamicIndent.StockEntryConfirmed,
                dynamicIndent.EWayBillNumber,
                dynamicIndent.StockBookPage,
                dynamicIndent.StockDescription,
                dynamicIndent.StockQuantity,
                dynamicIndent.StockActualCost,
                dynamicIndent.StockCondition,
                dynamicIndent.MeasurementBookNumber,
                dynamicIndent.BillFileUrl,
                dynamicIndent.EWayBillFileUrl,
                dynamicIndent.SatisfactoryCertificateFileUrl,
                IndentType: dynamicIndent.IndentType,
                IndentNumber: dynamicIndent.IndentNumber);
        }

        throw new IndentNotFoundException(indentId);
    }

    public async Task ProcessBillAsync(
        Guid indentId, ProcessBillInput input, Guid requestingUserId,
        IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default)
    {
        var indent = await FindAsync(indentId, ct);
        if (indent != null)
        {
            var project = await projectService.GetAsync(ProjectIdOf(indent), requestingUserId, requestingUserRoles, ct)
                ?? throw new ProjectAccessDeniedException(ProjectIdOf(indent));

            var instance = await workflowEngine.GetAsync(WorkflowInstanceIdOf(indent), ct)
                ?? throw new InvalidOperationException(
                    $"Workflow instance for indent '{indentId}' was not found.");

            if (instance.Phase != WorkflowPhase.Indent || (instance.CurrentStage != WorkflowStage.Approved && instance.CurrentStage != WorkflowStage.IndentApproved))
            {
                throw new InvalidOperationException(
                    $"Indent '{indentId}' must be approved before its bill can be processed " +
                    $"(phase {instance.Phase}, stage {instance.CurrentStage}).");
            }

            if (EstimatedCostOf(indent) > EWayBillThreshold && string.IsNullOrWhiteSpace(input.EWayBillNumber))
            {
                throw new ArgumentException(
                    $"An e-way bill number is required for purchases above Rs. {EWayBillThreshold:F0}.",
                    nameof(input));
            }

            ValidateBill(indent, input);

            ApplyBillFields(indent, input);
            await db.SaveChangesAsync(ct);

            var headId = BudgetHeadIdOf(indent);
            var head = await db.BudgetHeads.FirstOrDefaultAsync(b => b.Id == headId, ct)
                ?? await db.BudgetHeads.FirstOrDefaultAsync(b => b.ProjectId == ProjectIdOf(indent), ct)
                ?? new BudgetHead
                {
                    Id = headId != Guid.Empty ? headId : Guid.NewGuid(),
                    ProjectId = ProjectIdOf(indent),
                    HeadName = BudgetHeadName.RecurringConsumable
                };
            var faculty = await facultyProfiles.GetAsync(project.OwnerUserId, ct);
            var committee = await LoadCommitteeAsync(indentId, ct);

            var billTier = tierCalculator.DetermineTier(GemAvailabilityOf(indent), EstimatedCostOf(indent));
            var model = BuildDocumentModel(indent, project, head, faculty, committee, billTier);
            var pdf = await documentGeneration.GenerateBillCoverLetterAsync(model, ct);
            var billWorkflow = await workflowEngine.GetByRequestAsync(RequestType, indentId, WorkflowPhase.Bill, ct);
            if (billWorkflow is null)
            {
                var billInstance = await workflowEngine.RaiseAsync(RequestType, indentId, WorkflowPhase.Bill, requestingUserId, ct);
                if (project.CurrentDaUserId is { } daUserId)
                {
                    billInstance.AssignedToUserId = daUserId;
                    billInstance.IsAssignedViaProjectDa = true;
                    await db.SaveChangesAsync(ct);
                }
            }
            return;
        }

        // Process bill for dynamic unified Indent entity
        var dynamicIndent = await db.Indents.Include(i => i.Items).FirstOrDefaultAsync(i => i.Id == indentId, ct)
            ?? throw new IndentNotFoundException(indentId);

        var dynamicProject = await projectService.GetAsync(dynamicIndent.ProjectId, requestingUserId, requestingUserRoles, ct)
            ?? throw new ProjectAccessDeniedException(dynamicIndent.ProjectId);

        var dynamicInstance = await workflowEngine.GetAsync(dynamicIndent.WorkflowInstanceId, ct)
            ?? throw new InvalidOperationException(
                $"Workflow instance for indent '{indentId}' was not found.");

        if (dynamicInstance.Phase != WorkflowPhase.Indent || (dynamicInstance.CurrentStage != WorkflowStage.Approved && dynamicInstance.CurrentStage != WorkflowStage.IndentApproved))
        {
            throw new InvalidOperationException(
                $"Indent '{indentId}' must be approved before its bill can be processed " +
                $"(phase {dynamicInstance.Phase}, stage {dynamicInstance.CurrentStage}).");
        }

        var totalCost = dynamicIndent.Items.Sum(item => item.EstimatedCostInclTax);
        if (totalCost > EWayBillThreshold && string.IsNullOrWhiteSpace(input.EWayBillNumber))
        {
            throw new ArgumentException(
                $"An e-way bill number is required for purchases above Rs. {EWayBillThreshold:F0}.",
                nameof(input));
        }

        dynamicIndent.BillNo = input.BillNumber ?? input.OriginalBillReference;
        dynamicIndent.OriginalBillReference = input.BillNumber ?? input.OriginalBillReference;
        dynamicIndent.BillAmount = input.BillAmount;
        dynamicIndent.GenerationDate = input.GenerationDate;
        dynamicIndent.ItemReceivingDate = input.ItemReceivingDate;
        dynamicIndent.BillProcessStatus = input.BillProcessStatus ?? "Submitted";
        dynamicIndent.BillFileUrl = input.BillFileUrl ?? dynamicIndent.BillFileUrl;
        dynamicIndent.EWayBillFileUrl = input.EWayBillFileUrl ?? dynamicIndent.EWayBillFileUrl;
        dynamicIndent.SatisfactoryCertificateFileUrl = input.SatisfactoryCertificateFileUrl ?? dynamicIndent.SatisfactoryCertificateFileUrl;
        dynamicIndent.StockEntryConfirmed = input.StockEntryConfirmed;
        dynamicIndent.EWayBillNumber = input.EWayBillNumber;
        dynamicIndent.EWayBillPartA = input.EWayBillPartA;
        dynamicIndent.EWayBillPartB = input.EWayBillPartB;
        dynamicIndent.MeasurementBookNumber = input.MeasurementBookNumber;
        dynamicIndent.StockBookPage = input.StockBookPage;
        dynamicIndent.StockDescription = input.StockDescription;
        dynamicIndent.StockQuantity = input.StockQuantity;
        dynamicIndent.StockActualCost = input.StockActualCost;
        dynamicIndent.StockCondition = input.StockCondition;
        dynamicIndent.MiscellaneousExpenditure = input.MiscellaneousExpenditure;
        dynamicIndent.PurchaseOrderNumber = input.PurchaseOrderNumber;
        dynamicIndent.PurchaseOrderDate = input.PurchaseOrderDate;
        dynamicIndent.BindingLocation = input.BindingLocation ?? "Prayagraj";
        dynamicIndent.ComparativeStatementNumber = input.ComparativeStatementNumber;
        dynamicIndent.ComparativeStatementSigned = input.ComparativeStatementSigned;

        await db.SaveChangesAsync(ct);

        var dynamicHeadId = dynamicIndent.BudgetHeadId;
        var dynamicHead = await db.BudgetHeads.FirstOrDefaultAsync(b => b.Id == dynamicHeadId, ct)
            ?? await db.BudgetHeads.FirstOrDefaultAsync(b => b.ProjectId == dynamicIndent.ProjectId, ct)
            ?? new BudgetHead
            {
                Id = dynamicHeadId != Guid.Empty ? dynamicHeadId : Guid.NewGuid(),
                ProjectId = dynamicIndent.ProjectId,
                HeadName = BudgetHeadName.RecurringConsumable
            };

        var dynamicFaculty = await facultyProfiles.GetAsync(dynamicProject.OwnerUserId, ct);
        var dynamicCommittee = await LoadCommitteeAsync(indentId, ct);
        var dynamicBillTier = tierCalculator.DetermineTier(dynamicIndent.GemAvailability, totalCost);

        var firstItem = dynamicIndent.Items.FirstOrDefault();
        var itemName = firstItem?.Name ?? dynamicIndent.Purpose ?? "Indent Item";
        var itemSpecs = firstItem?.TechnicalSpecs ?? string.Empty;
        var itemUnit = firstItem?.UnitOfMeasurement ?? "Unit";
        var itemQty = dynamicIndent.Items.Sum(item => item.Quantity);

        var dynamicModel = IndentDocumentModelFactory.Build(
            dynamicProject, dynamicHead, dynamicFaculty, dynamicCommittee,
            itemName, true, itemSpecs, itemUnit, itemQty, dynamicIndent.Purpose ?? "Purchasing items for research",
            dynamicIndent.GemAvailability, totalCost,
            dynamicIndent.StockBookPage, dynamicIndent.StockDescription, dynamicIndent.StockQuantity, dynamicIndent.StockActualCost, dynamicIndent.StockCondition,
            dynamicBillTier);

        var dynamicPdf = await documentGeneration.GenerateBillCoverLetterAsync(dynamicModel, ct);
        var dynamicBillWorkflow = await workflowEngine.GetByRequestAsync(RequestType, indentId, WorkflowPhase.Bill, ct);
        if (dynamicBillWorkflow is null)
        {
            var dynamicBillInstance = await workflowEngine.RaiseAsync(RequestType, indentId, WorkflowPhase.Bill, requestingUserId, ct);
            if (dynamicProject.CurrentDaUserId is { } dynamicDaUserId)
            {
                dynamicBillInstance.AssignedToUserId = dynamicDaUserId;
                dynamicBillInstance.IsAssignedViaProjectDa = true;
                await db.SaveChangesAsync(ct);
            }
        }
    }

    private async Task<(Guid WorkflowInstanceId, GemAvailability GemAvailability, decimal EstimatedCost)> ResolveIndentWorkflowInfoAsync(Guid indentId, CancellationToken ct)
    {
        var indent = await FindAsync(indentId, ct);
        if (indent != null)
        {
            return (WorkflowInstanceIdOf(indent), GemAvailabilityOf(indent), EstimatedCostOf(indent));
        }

        var dynamicIndent = await db.Indents.Include(i => i.Items).FirstOrDefaultAsync(i => i.Id == indentId, ct);
        if (dynamicIndent != null)
        {
            var cost = dynamicIndent.Items.Sum(item => item.EstimatedCostInclTax);
            return (dynamicIndent.WorkflowInstanceId, dynamicIndent.GemAvailability, cost);
        }

        throw new IndentNotFoundException(indentId);
    }

    public async Task ForwardAsync(
        Guid indentId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var (workflowInstanceId, gemAvail, cost) = await ResolveIndentWorkflowInfoAsync(indentId, ct);
        await RequireMarketCommitteeCompleteIfApplicableAsync(workflowInstanceId, gemAvail, cost, indentId, ct);
        await workflowEngine.ForwardAsync(workflowInstanceId, actorUserId, actorRoles, remarks, ct);
    }

    public async Task ForwardToDirectorAsync(
        Guid indentId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var (workflowInstanceId, gemAvail, cost) = await ResolveIndentWorkflowInfoAsync(indentId, ct);
        await RequireMarketCommitteeCompleteIfApplicableAsync(workflowInstanceId, gemAvail, cost, indentId, ct);
        await workflowEngine.ForwardToDirectorAsync(workflowInstanceId, actorUserId, actorRoles, remarks, ct);
    }

    public async Task ApproveAsync(
        Guid indentId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var (workflowInstanceId, gemAvail, cost) = await ResolveIndentWorkflowInfoAsync(indentId, ct);
        await RequireMarketCommitteeCompleteIfApplicableAsync(workflowInstanceId, gemAvail, cost, indentId, ct);
        await workflowEngine.ApproveAsync(workflowInstanceId, actorUserId, actorRoles, remarks, ct);
    }

    public async Task RejectAsync(
        Guid indentId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var (workflowInstanceId, _, _) = await ResolveIndentWorkflowInfoAsync(indentId, ct);
        await workflowEngine.RejectAsync(workflowInstanceId, actorUserId, actorRoles, remarks, ct);
    }

    public async Task ReturnAsync(
        Guid indentId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var (workflowInstanceId, _, _) = await ResolveIndentWorkflowInfoAsync(indentId, ct);
        await workflowEngine.ReturnAsync(workflowInstanceId, actorUserId, actorRoles, remarks, ct);
    }

    public async Task<MarketCommitteeStepsSummary?> GetMarketCommitteeStepsAsync(Guid indentId, CancellationToken ct = default)
    {
        var process = await db.MarketCommitteeProcesses
            .FirstOrDefaultAsync(m => m.IndentType == IndentType && m.IndentId == indentId, ct);

        return process is null
            ? null
            : new MarketCommitteeStepsSummary(
                process.CommitteeFormedOn, process.NoticeIssuedOn, process.ComparativeStatementSignedOn, process.IsComplete);
    }

    public async Task RecordMarketCommitteeStepAsync(
        Guid indentId, MarketCommitteeStep step, DateOnly recordedOn,
        Guid actorUserId, IReadOnlyCollection<string> actorRoles, CancellationToken ct = default)
    {
        var (workflowInstanceId, _, _) = await ResolveIndentWorkflowInfoAsync(indentId, ct);

        var instance = await workflowEngine.GetAsync(workflowInstanceId, ct)
            ?? throw new InvalidOperationException($"Workflow instance for indent '{indentId}' was not found.");
        var stageDefinition = await workflowDefinitions.GetStageAsync(
            instance.RequestType, instance.Phase, instance.CurrentStage, ct);
        var allowedRoles = stageDefinition.AllowedRoleList();
        if (allowedRoles.Count > 0 && !actorRoles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
        {
            throw new WorkflowAuthorizationException(
                $"Recording this step is permitted to: {string.Join(", ", allowedRoles)}.");
        }

        var process = await db.MarketCommitteeProcesses
            .FirstOrDefaultAsync(m => m.IndentType == IndentType && m.IndentId == indentId, ct);

        if (process is null)
        {
            process = new MarketCommitteeProcess { Id = Guid.NewGuid(), IndentType = IndentType, IndentId = indentId };
            db.MarketCommitteeProcesses.Add(process);
        }

        switch (step)
        {
            case MarketCommitteeStep.CommitteeFormed: process.CommitteeFormedOn = recordedOn; break;
            case MarketCommitteeStep.NoticeIssued: process.NoticeIssuedOn = recordedOn; break;
            case MarketCommitteeStep.ComparativeStatementSigned: process.ComparativeStatementSignedOn = recordedOn; break;
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Blocks Approve/Forward/ForwardToDirector from advancing an indent past
    /// ForwardedDR (or, for Consumable/Equipment/Contingency/DynamicIndent's
    /// own IndentWorkflowSeeder chain, the equivalent IndentWithDean stage --
    /// see ForwardToDirectorAsync's own identical check) while it sits in the
    /// Non-GeM Rs.2L-25L ("Market Committee") band with its offline committee
    /// process not yet fully recorded. A no-op for every other stage and every
    /// other tier.
    /// </summary>
    private async Task RequireMarketCommitteeCompleteIfApplicableAsync(Guid workflowInstanceId, GemAvailability gemAvailability, decimal estimatedCost, Guid indentId, CancellationToken ct)
    {
        var instance = await workflowEngine.GetAsync(workflowInstanceId, ct);
        if (instance is null ||
            (instance.CurrentStage != WorkflowStage.ForwardedDR && instance.CurrentStage != WorkflowStage.IndentWithDean))
        {
            return;
        }

        var tier = tierCalculator.DetermineTier(gemAvailability, estimatedCost);
        if (tier != ProcurementTier.NonGem2LakhTo25Lakh)
        {
            return;
        }

        var process = await db.MarketCommitteeProcesses
            .FirstOrDefaultAsync(m => m.IndentType == IndentType && m.IndentId == indentId, ct);

        if (process is null || !process.IsComplete)
        {
            throw new MarketCommitteeProcessIncompleteException(indentId);
        }
    }

    private async Task<Project> LoadOwnedProjectAsync(Guid projectId, Guid requestingUserId, CancellationToken ct)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct)
            ?? throw new ProjectAccessDeniedException(projectId);

        if (project.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        if (project.Status != ProjectStatus.Approved && project.Status != ProjectStatus.Active)
        {
            throw new InvalidOperationException("Indents cannot be raised until the project is approved by the Dean.");
        }

        return project;
    }

    private static void ValidateNonAvailabilityCertificate(RaiseIndentInput input)
    {
        if (input.GemAvailability != GemAvailability.No)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(input.NonAvailabilityCertificateNumber))
        {
            throw new ArgumentException(
                "A GeM non-availability certificate number is required for non-GeM procurement.",
                nameof(input));
        }

        if (!string.IsNullOrWhiteSpace(input.NacItemName) &&
            !string.Equals(input.NacItemName.Trim(), input.Name.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                $"BRD A7.3 Rule Violation: Item name in Non-Availability Certificate ('{input.NacItemName}') " +
                $"must be exactly identical to Indent item name ('{input.Name}').",
                nameof(input));
        }

        if (input.NonAvailabilityCertificateIssueDate is { } issueDate
            && issueDate > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw new ArgumentException(
                $"The GeM non-availability certificate generation date ({issueDate:yyyy-MM-dd}) cannot be in the future.",
                nameof(input));
        }

        if (input.NonAvailabilityCertificateIssueDate is { } certIssueDate &&
            input.QuotationDate is { } quotationDate &&
            certIssueDate >= quotationDate)
        {
            throw new ArgumentException(
                $"BRD A7.3 Rule Violation: Non-GeM Certificate Date of Generation ({certIssueDate:yyyy-MM-dd}) " +
                $"must be strictly BEFORE the Date of Quotation ({quotationDate:yyyy-MM-dd}).",
                nameof(input));
        }

        if (input.NonAvailabilityCertificateValidityDate is { } validity
            && validity < DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw new ArgumentException(
                $"The GeM non-availability certificate expired on {validity:yyyy-MM-dd}.",
                nameof(input));
        }
    }

    private async Task<IReadOnlyList<IndentCommitteeMemberModel>> PersistCommitteeAsync(
        RaiseIndentInput input, ProcurementTier tier, Guid indentId, CancellationToken ct)
    {
        // Only the Rs.2L-25L non-GeM tier prints a committee roster (Annexure 11),
        // so members submitted for any other tier are deliberately discarded.
        if (tier != ProcurementTier.NonGem2LakhTo25Lakh || input.CommitteeMembers.Count == 0)
        {
            return [];
        }

        var committee = new ProcurementCommittee
        {
            Id = Guid.NewGuid(),
            IndentType = IndentType,
            IndentId = indentId,
        };

        foreach (var (name, role) in input.CommitteeMembers)
        {
            committee.Members.Add(new ProcurementCommitteeMember
            {
                Id = Guid.NewGuid(),
                ProcurementCommitteeId = committee.Id,
                Name = name,
                Role = role,
            });
        }

        db.ProcurementCommittees.Add(committee);
        await db.SaveChangesAsync(ct);

        return [.. committee.Members.Select(m => new IndentCommitteeMemberModel(m.Name, m.Role.ToString()))];
    }

    private async Task<IReadOnlyList<IndentCommitteeMemberModel>> LoadCommitteeAsync(
        Guid indentId, CancellationToken ct)
    {
        var committee = await db.ProcurementCommittees
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.IndentType == IndentType && c.IndentId == indentId, ct);

        return committee is null
            ? []
            : [.. committee.Members.Select(m => new IndentCommitteeMemberModel(m.Name, m.Role.ToString()))];
    }

    private async Task StoreDocumentAsync(
        Guid indentId, DocumentKind kind, byte[] pdf, Guid uploadedByUserId, CancellationToken ct)
    {
        var documentId = Guid.NewGuid();
        var fileName = $"{kind.ToString().ToLowerInvariant()}-{indentId}.pdf";

        using var stream = new MemoryStream(pdf);
        var storagePath = await documentStorage.SaveAsync(documentId, 1, stream, fileName, ct);

        db.Documents.Add(new Document
        {
            Id = documentId,
            OwnerType = OwnerType,
            OwnerId = indentId,
            Kind = kind,
            Version = 1,
            Status = DocumentStatus.Uploaded,
            StoragePath = storagePath,
            UploadedByUserId = uploadedByUserId,
            UploadedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(ct);
    }

    private Task<TIndent?> FindAsync(Guid indentId, CancellationToken ct)
        => Set.FirstOrDefaultAsync(HasId(indentId), ct);

    private async Task<IReadOnlyList<IndentSummary>> ToSummariesAsync(
        IReadOnlyList<TIndent> indents, CancellationToken ct)
    {
        if (indents.Count == 0)
        {
            return [];
        }

        var workflowIds = indents.Select(WorkflowInstanceIdOf).ToHashSet();
        var stages = await db.WorkflowInstances
            .Where(w => workflowIds.Contains(w.Id) && w.Phase == WorkflowPhase.Indent)
            .ToDictionaryAsync(w => w.Id, w => w.CurrentStage, ct);

        return
        [
            .. indents.Select(i => MapToSummary(
                i, stages.TryGetValue(WorkflowInstanceIdOf(i), out var stage) ? stage : WorkflowStage.Raised)),
        ];
    }

}
