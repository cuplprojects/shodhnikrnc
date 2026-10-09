using API.Application.Documents;
using API.Domain.Enums;

namespace API.Application.Procurement;

public record RaiseIndentInput(
    Guid ProjectId, Guid BudgetHeadId, string Name, string TechnicalSpecs,
    string UnitOfMeasurement, int Quantity, string Purpose,
    GemAvailability GemAvailability, decimal EstimatedCost,
    string? NonAvailabilityCertificateNumber,
    DateOnly? NonAvailabilityCertificateIssueDate,
    DateOnly? NonAvailabilityCertificateValidityDate,
    Guid? SanctionedEquipmentId,
    IReadOnlyList<(string Name, CommitteeMemberRole Role)> CommitteeMembers,
    byte[]? GemQuotationPdf,
    string? PaymentRouting = "Party Payment",
    string? BiddingNumber = null,
    DateOnly? BidPublicationDate = null,
    string? NacItemName = null,
    DateOnly? QuotationDate = null);

public record ProcessBillInput(
    string OriginalBillReference, bool StockEntryConfirmed,
    string? EWayBillNumber, string? MeasurementBookNumber,
    string? StockBookPage, string? StockDescription,
    string? StockQuantity, string? StockActualCost, string? StockCondition,
    decimal? MiscellaneousExpenditure = null,
    string? PurchaseOrderNumber = null,
    DateOnly? PurchaseOrderDate = null,
    string? BindingLocation = "Prayagraj",
    string? ComparativeStatementNumber = null,
    bool ComparativeStatementSigned = false,
    string? EWayBillPartA = null,
    string? EWayBillPartB = null,
    string? BillNumber = null,
    decimal? BillAmount = null,
    DateOnly? GenerationDate = null,
    DateOnly? ItemReceivingDate = null,
    string? BillProcessStatus = null,
    string? BillFileUrl = null,
    string? EWayBillFileUrl = null,
    string? SatisfactoryCertificateFileUrl = null);

public record IndentSummary(
    Guid Id, Guid ProjectId, Guid BudgetHeadId, Guid WorkflowInstanceId,
    string Name, decimal EstimatedCost, GemAvailability GemAvailability,
    ProcurementTier Tier, WorkflowStage CurrentStage, DateTimeOffset CreatedAt,
    string? PaymentRouting = "Party Payment",
    decimal? MiscellaneousExpenditure = null,
    string? BiddingNumber = null,
    DateOnly? BidPublicationDate = null,
    string? PurchaseOrderNumber = null,
    DateOnly? PurchaseOrderDate = null,
    string? BindingLocation = "Prayagraj",
    string? ComparativeStatementNumber = null,
    bool ComparativeStatementSigned = false,
    string? OriginalBillReference = null,
    decimal? BillAmount = null,
    DateOnly? GenerationDate = null,
    DateOnly? ItemReceivingDate = null,
    string? BillProcessStatus = null,
    bool StockEntryConfirmed = false,
    string? EWayBillNumber = null,
    string? StockBookPage = null,
    string? StockDescription = null,
    string? StockQuantity = null,
    string? StockActualCost = null,
    string? StockCondition = null,
    string? MeasurementBookNumber = null,
    string? BillFileUrl = null,
    string? EWayBillFileUrl = null,
    string? SatisfactoryCertificateFileUrl = null,
    IndentType? IndentType = null,
    string? IndentNumber = null);

/// <summary>The three offline Market Committee steps, and whether all are recorded.</summary>
public record MarketCommitteeStepsSummary(
    DateOnly? CommitteeFormedOn, DateOnly? NoticeIssuedOn, DateOnly? ComparativeStatementSignedOn, bool IsComplete);

/// <summary>One of the three steps <see cref="MarketCommitteeStepsSummary"/> tracks.</summary>
public enum MarketCommitteeStep { CommitteeFormed, NoticeIssued, ComparativeStatementSigned }

public interface IIndentService
{
    Task<Guid> RaiseAsync(RaiseIndentInput input, Guid requestingUserId, CancellationToken ct = default);
    Task<IReadOnlyList<IndentSummary>> ListForProjectAsync(
        Guid projectId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null,
        CancellationToken ct = default);
    Task<IndentSummary> GetAsync(
        Guid indentId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null,
        CancellationToken ct = default);
    Task ProcessBillAsync(Guid indentId, ProcessBillInput input, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default);
    Task ForwardAsync(Guid indentId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task ForwardToDirectorAsync(Guid indentId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task ApproveAsync(Guid indentId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task RejectAsync(Guid indentId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);
    Task ReturnAsync(Guid indentId, Guid actorUserId, IReadOnlyCollection<string> actorRoles, string? remarks, CancellationToken ct = default);

    /// <summary>The recorded Market Committee steps for this indent, or null if none has been recorded yet.</summary>
    Task<MarketCommitteeStepsSummary?> GetMarketCommitteeStepsAsync(Guid indentId, CancellationToken ct = default);

    /// <summary>
    /// Records (or overwrites) one Market Committee step's date. Permitted to whoever
    /// holds a role allowed at the indent's current workflow stage -- no new permission
    /// concept beyond the ordinary workflow-action check.
    /// </summary>
    Task RecordMarketCommitteeStepAsync(
        Guid indentId, MarketCommitteeStep step, DateOnly recordedOn,
        Guid actorUserId, IReadOnlyCollection<string> actorRoles, CancellationToken ct = default);
}
