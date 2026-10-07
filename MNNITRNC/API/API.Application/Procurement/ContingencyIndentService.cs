using API.Application.Common;
using API.Application.Documents;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace API.Application.Procurement;

public class ContingencyIndentService(
    IApplicationDbContext dbContext,
    IProcurementTierCalculator tierCalculator,
    IIndentBudgetValidator budgetValidator,
    IWorkflowEngineService workflowEngine,
    IWorkflowDefinitionService workflowDefinitions,
    IDocumentGenerationService documentGeneration,
    IDocumentStorageService documentStorage,
    IFacultyProfileProvider facultyProfiles,
    IProjectService projectService)
    : IndentServiceBase<ContingencyIndent>(
        dbContext, tierCalculator, budgetValidator, workflowEngine, workflowDefinitions,
        documentGeneration, documentStorage, facultyProfiles, projectService)
{
    protected override DbSet<ContingencyIndent> Set => Db.ContingencyIndents;
    protected override RequestType RequestType => RequestType.Contingency;
    protected override IndentType IndentType => IndentType.Contingency;
    protected override string OwnerType => "ContingencyIndent";

    protected override ContingencyIndent NewIndent(RaiseIndentInput input, Guid id) => new()
    {
        Id = id,
        ProjectId = input.ProjectId,
        BudgetHeadId = input.BudgetHeadId,
        Name = input.Name,
        TechnicalSpecs = input.TechnicalSpecs,
        UnitOfMeasurement = input.UnitOfMeasurement,
        Quantity = input.Quantity,
        Purpose = input.Purpose,
        GemAvailability = input.GemAvailability,
        EstimatedCost = input.EstimatedCost,
        NonAvailabilityCertificateNumber = input.NonAvailabilityCertificateNumber,
        NonAvailabilityCertificateIssueDate = input.NonAvailabilityCertificateIssueDate,
        NonAvailabilityCertificateValidityDate = input.NonAvailabilityCertificateValidityDate,
        PaymentRouting = input.PaymentRouting ?? "Party Payment",
        BiddingNumber = input.BiddingNumber,
        BidPublicationDate = input.BidPublicationDate,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    protected override Expression<Func<ContingencyIndent, bool>> HasId(Guid indentId) => i => i.Id == indentId;
    protected override Expression<Func<ContingencyIndent, bool>> BelongsToProject(Guid projectId) => i => i.ProjectId == projectId;

    protected override Guid IdOf(ContingencyIndent i) => i.Id;
    protected override Guid ProjectIdOf(ContingencyIndent i) => i.ProjectId;
    protected override Guid BudgetHeadIdOf(ContingencyIndent i) => i.BudgetHeadId;
    protected override Guid WorkflowInstanceIdOf(ContingencyIndent i) => i.WorkflowInstanceId;
    protected override void SetWorkflowInstanceId(ContingencyIndent i, Guid id) => i.WorkflowInstanceId = id;
    protected override string NameOf(ContingencyIndent i) => i.Name;
    protected override decimal EstimatedCostOf(ContingencyIndent i) => i.EstimatedCost;
    protected override GemAvailability GemAvailabilityOf(ContingencyIndent i) => i.GemAvailability;
    protected override DateTimeOffset CreatedAtOf(ContingencyIndent i) => i.CreatedAt;

    protected override IndentDocumentModel BuildDocumentModel(
        ContingencyIndent i, Project project, BudgetHead head, FacultyProfileInfo faculty,
        IReadOnlyList<IndentCommitteeMemberModel> committee, ProcurementTier tier) =>
        IndentDocumentModelFactory.Build(
            project, head, faculty, committee,
            i.Name, false, i.TechnicalSpecs, i.UnitOfMeasurement, i.Quantity, i.Purpose,
            i.GemAvailability, i.EstimatedCost,
            i.StockBookPage, i.StockDescription, i.StockQuantity, i.StockActualCost, i.StockCondition,
            tier);

    protected override void ApplyBillFields(ContingencyIndent i, ProcessBillInput input)
    {
        i.OriginalBillReference = input.BillNumber ?? input.OriginalBillReference;
        i.BillAmount = input.BillAmount;
        i.GenerationDate = input.GenerationDate;
        i.ItemReceivingDate = input.ItemReceivingDate;
        i.BillProcessStatus = input.BillProcessStatus ?? "Submitted";
        i.BillFileUrl = input.BillFileUrl ?? i.BillFileUrl;
        i.EWayBillFileUrl = input.EWayBillFileUrl ?? i.EWayBillFileUrl;
        i.SatisfactoryCertificateFileUrl = input.SatisfactoryCertificateFileUrl ?? i.SatisfactoryCertificateFileUrl;
        i.StockEntryConfirmed = input.StockEntryConfirmed;
        i.EWayBillNumber = input.EWayBillNumber;
        i.StockBookPage = input.StockBookPage;
        i.StockDescription = input.StockDescription;
        i.StockQuantity = input.StockQuantity;
        i.StockActualCost = input.StockActualCost;
        i.StockCondition = input.StockCondition;
        i.MiscellaneousExpenditure = input.MiscellaneousExpenditure;
        i.PurchaseOrderNumber = input.PurchaseOrderNumber;
        i.PurchaseOrderDate = input.PurchaseOrderDate;
        i.BindingLocation = input.BindingLocation ?? "Prayagraj";
        i.ComparativeStatementNumber = input.ComparativeStatementNumber;
        i.ComparativeStatementSigned = input.ComparativeStatementSigned;
    }

    protected override IndentSummary MapToSummary(ContingencyIndent i, WorkflowStage stage) => new(
        Id: i.Id,
        ProjectId: i.ProjectId,
        BudgetHeadId: i.BudgetHeadId,
        WorkflowInstanceId: i.WorkflowInstanceId,
        Name: i.Name,
        EstimatedCost: i.EstimatedCost,
        GemAvailability: i.GemAvailability,
        Tier: tierCalculator.DetermineTier(i.GemAvailability, i.EstimatedCost),
        CurrentStage: stage,
        CreatedAt: i.CreatedAt,
        PaymentRouting: i.PaymentRouting,
        MiscellaneousExpenditure: i.MiscellaneousExpenditure,
        BiddingNumber: i.BiddingNumber,
        BidPublicationDate: i.BidPublicationDate,
        PurchaseOrderNumber: i.PurchaseOrderNumber,
        PurchaseOrderDate: i.PurchaseOrderDate,
        BindingLocation: i.BindingLocation,
        ComparativeStatementNumber: i.ComparativeStatementNumber,
        ComparativeStatementSigned: i.ComparativeStatementSigned,
        OriginalBillReference: i.OriginalBillReference,
        BillAmount: i.BillAmount,
        GenerationDate: i.GenerationDate,
        ItemReceivingDate: i.ItemReceivingDate,
        BillProcessStatus: i.BillProcessStatus,
        StockEntryConfirmed: i.StockEntryConfirmed,
        EWayBillNumber: i.EWayBillNumber,
        StockBookPage: i.StockBookPage,
        StockDescription: i.StockDescription,
        StockQuantity: i.StockQuantity,
        StockActualCost: i.StockActualCost,
        StockCondition: i.StockCondition,
        MeasurementBookNumber: null,
        BillFileUrl: i.BillFileUrl,
        EWayBillFileUrl: i.EWayBillFileUrl,
        SatisfactoryCertificateFileUrl: i.SatisfactoryCertificateFileUrl,
        IndentType: IndentType);
}

