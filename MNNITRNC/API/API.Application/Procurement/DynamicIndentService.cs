using API.Application.Common;
using API.Application.Documents;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Procurement;

public record DynamicIndentItemInput(
    string Name,
    bool IsConsumable,
    string TechnicalSpecs,
    string UnitOfMeasurement,
    int Quantity,
    decimal EstimatedCostInclTax
);

public record IndentHeadSelectionInput(
    Guid BudgetHeadId,
    OverheadSubHead? SubHead,
    decimal? ManualAmount);

public record RaiseDynamicIndentInput(
    bool IsRule166,
    Guid ProjectId,
    IReadOnlyList<IndentHeadSelectionInput> HeadSelections,
    IndentType IndentType,
    GemAvailability GemAvailability,
    GemCategoryType? GemCategoryType,
    StockAvailability StockAvailability,
    string? StockBookSerialNo,
    string? StockBookPage,
    DateOnly? StockBookDate,
    string? StockDescription,
    string? StockQuantity,
    string? StockActualCost,
    string? StockCondition,
    string Purpose,
    PurposeOfAcquiring? PurposeOfAcquiring,
    bool InstallationRequired,
    bool TrainingRequired,
    string? QualificationCriterion,
    string? MaxDeliveryPeriod,
    int? NumberOfEnclosures,
    string? PerpetualLicense,
    string? NonAvailabilityCertificateNumber,
    DateOnly? NonAvailabilityCertificateIssueDate,
    DateOnly? NonAvailabilityCertificateValidityDate,
    DateOnly? QuotationDate,
    string? CommitteeFacultyUserId,
    string? BiddingNumber,
    DateOnly? BidPublicationDate,
    IReadOnlyList<DynamicIndentItemInput> Items,
    byte[]? EstimatePdf,
    byte[]? GemQuotation,
    byte[]? PecCertificate,
    byte[]? MacCertificate,
    byte[]? PacCertificate,
    byte[]? OtherSingleTenderDoc,
    byte[]? NonAvailabilityCertificate
);

public class DynamicIndentService(
    IApplicationDbContext db,
    IWorkflowEngineService workflowEngine,
    IDocumentStorageService documentStorage,
    IIndentBudgetValidator budgetValidator) : IDynamicIndentService
{
    public async Task<Guid> RaiseAsync(RaiseDynamicIndentInput input, Guid requestingUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Purpose))
        {
            throw new WorkflowTransitionException(
                "A remark is required when raising an indent request.");
        }

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == input.ProjectId && !p.IsDeleted, ct)
            ?? throw new InvalidOperationException($"Project '{input.ProjectId}' was not found.");

        if (project.Status != ProjectStatus.Approved && project.Status != ProjectStatus.Active)
        {
            throw new InvalidOperationException("Indents cannot be raised until the project is approved by the Dean.");
        }

        var indentCost = 0m;
        if (input.Items is null || input.Items.Count == 0)
        {
            throw new InvalidOperationException("At least one item is required.");
        }
        
        foreach (var item in input.Items)
        {
            indentCost += item.EstimatedCostInclTax;
        }

        if (input.GemAvailability == GemAvailability.No && !input.IsRule166 && indentCost > 2500000m)
        {
            throw new ArgumentException("Non-GeM procurement exceeding Rs. 25,00,000 is not supported via this route.");
        }

        if (input.GemAvailability == GemAvailability.Yes && indentCost > 50000m && input.GemQuotation is null)
        {
            throw new ArgumentException("GeM Quotation / Estimate is required for GeM purchases above Rs. 50,000.");
        }

        if (input.HeadSelections is null || input.HeadSelections.Count == 0)
        {
            throw new ArgumentException("At least one budget head must be selected.", nameof(input));
        }

        if (input.HeadSelections.Any(h => h.SubHead == OverheadSubHead.Idf))
        {
            throw new ArgumentException(
                "Idf is not a selectable budget head for an Indent.", nameof(input));
        }

        // The plain RecurringOverhead head and its PDF/DDF sub-heads draw from
        // the same underlying overhead money via two disjoint Sanctioned pools
        // with no reconciliation between them -- selecting both on the same
        // Indent risks double-committing the same funds. The frontend already
        // hides the plain head once sub-heads are offered; this is
        // defense-in-depth against a client that skips that UI, matching this
        // codebase's established pattern of enforcing head-selection rules
        // unconditionally server-side (see the Idf-rejection check above).
        var subHeadHeadIds = input.HeadSelections
            .Where(h => h.SubHead is not null)
            .Select(h => h.BudgetHeadId)
            .ToHashSet();
        if (subHeadHeadIds.Count > 0 &&
            input.HeadSelections.Any(h => h.SubHead is null && subHeadHeadIds.Contains(h.BudgetHeadId)))
        {
            throw new ArgumentException(
                "A budget head's plain (non-overhead) selection cannot be combined with a PDF/DDF selection on the same head.",
                nameof(input));
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var hasAnyManualAmount = input.HeadSelections.Any(h => h.ManualAmount.HasValue);
        var hasAnyBlankAmount = input.HeadSelections.Any(h => !h.ManualAmount.HasValue);

        if (hasAnyManualAmount && hasAnyBlankAmount)
        {
            throw new ArgumentException(
                "Either provide a manual amount for all selected heads, or none (waterfall).", nameof(input));
        }

        var newAllocations = new List<IndentBudgetHeadAllocation>();

        if (hasAnyManualAmount)
        {
            var manualSum = input.HeadSelections.Sum(h => h.ManualAmount!.Value);
            if (manualSum != indentCost)
            {
                throw new ArgumentException(
                    $"The manually entered amounts (total {manualSum:0.00}) must equal the indent's total cost ({indentCost:0.00}).",
                    nameof(input));
            }

            for (int i = 0; i < input.HeadSelections.Count; i++)
            {
                var selection = input.HeadSelections[i];
                await budgetValidator.EnsureSufficientAsync(
                    selection.BudgetHeadId, today, selection.ManualAmount!.Value, ct, subHead: selection.SubHead);

                newAllocations.Add(new IndentBudgetHeadAllocation
                {
                    Id = Guid.NewGuid(),
                    BudgetHeadId = selection.BudgetHeadId,
                    SubHead = selection.SubHead,
                    CommittedAmount = selection.ManualAmount.Value,
                    OrderIndex = i,
                });
            }
        }
        else
        {
            decimal remainingCost = indentCost;
            for (int i = 0; i < input.HeadSelections.Count; i++)
            {
                var selection = input.HeadSelections[i];
                var snapshot = await budgetValidator.GetSnapshotAsync(
                    selection.BudgetHeadId, today, ct, subHead: selection.SubHead);

                decimal available = Math.Max(0, snapshot.Available);
                decimal drawAmount = Math.Min(remainingCost, available);

                if (drawAmount > 0)
                {
                    newAllocations.Add(new IndentBudgetHeadAllocation
                    {
                        Id = Guid.NewGuid(),
                        BudgetHeadId = selection.BudgetHeadId,
                        SubHead = selection.SubHead,
                        CommittedAmount = drawAmount,
                        OrderIndex = i,
                    });
                    remainingCost -= drawAmount;
                }

                if (remainingCost <= 0) break;
            }

            if (remainingCost > 0)
            {
                var primarySnapshot = await budgetValidator.GetSnapshotAsync(
                    input.HeadSelections[0].BudgetHeadId, today, ct, subHead: input.HeadSelections[0].SubHead);
                throw new InsufficientBudgetException(indentCost, primarySnapshot);
            }
        }

        var rule = DetermineProcurementRule(input.IsRule166, input.GemAvailability, indentCost);

        if (rule == IndentProcurementRule.Rule155MarketCommittee && string.IsNullOrWhiteSpace(input.CommitteeFacultyUserId))
        {
            throw new ArgumentException("Exactly one faculty/official must be selected for the Rule 155 committee.");
        }

        var indentId = Guid.NewGuid();

        var instance = await workflowEngine.RaiseAsync(
            RequestType.DynamicIndent,
            indentId,
            WorkflowPhase.Indent,
            requestingUserId,
            ct);
        if (project.CurrentDaUserId is { } daUserId)
        {
            instance.AssignedToUserId = daUserId;
            instance.IsAssignedViaProjectDa = true;
        }

        var indent = new Indent
        {
            Id = indentId,
            IndentNumber = await GenerateIndentNumberAsync(db, ct),
            IndentType = input.IndentType,
            ProjectId = input.ProjectId,
            BudgetHeadId = input.HeadSelections[0].BudgetHeadId,
            WorkflowInstanceId = instance.Id,
            OwnerUserId = requestingUserId,
            GemAvailability = input.GemAvailability,
            GemCategoryType = input.GemCategoryType,
            ProcurementRule = rule,
            StockAvailability = input.StockAvailability,
            StockBookSerialNo = input.StockBookSerialNo,
            StockBookPage = input.StockBookPage,
            StockBookDate = input.StockBookDate,
            StockDescription = input.StockDescription,
            StockQuantity = input.StockQuantity,
            StockActualCost = input.StockActualCost,
            StockCondition = input.StockCondition,
            Purpose = input.Purpose,
            PurposeOfAcquiring = input.PurposeOfAcquiring,
            InstallationRequired = input.InstallationRequired,
            TrainingRequired = input.TrainingRequired,
            QualificationCriterion = input.QualificationCriterion,
            MaxDeliveryPeriod = input.MaxDeliveryPeriod,
            NumberOfEnclosures = input.NumberOfEnclosures,
            PerpetualLicense = input.PerpetualLicense,
            NonAvailabilityCertificateNumber = input.NonAvailabilityCertificateNumber,
            NonAvailabilityCertificateIssueDate = input.NonAvailabilityCertificateIssueDate,
            NonAvailabilityCertificateValidityDate = input.NonAvailabilityCertificateValidityDate,
            QuotationDate = input.QuotationDate,
            CommitteeFacultyUserId = input.CommitteeFacultyUserId,
            BiddingNumber = input.BiddingNumber,
            BidPublicationDate = input.BidPublicationDate,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var serialNo = 1;
        foreach (var item in input.Items)
        {
            indent.Items.Add(new IndentItem
            {
                SerialNumber = serialNo++,
                Name = item.Name,
                IsConsumable = item.IsConsumable,
                TechnicalSpecs = item.TechnicalSpecs,
                UnitOfMeasurement = item.UnitOfMeasurement,
                Quantity = item.Quantity,
                EstimatedCostInclTax = item.EstimatedCostInclTax
            });
        }

        db.Indents.Add(indent);

        foreach (var allocation in newAllocations)
        {
            allocation.IndentId = indentId;
            db.IndentBudgetHeadAllocations.Add(allocation);
        }

        async Task SaveDocAsync(DocumentKind kind, byte[] content)
        {
            var docId = Guid.NewGuid();
            using var ms = new MemoryStream(content);
            var path = await documentStorage.SaveAsync(docId, 1, ms, $"{kind}.pdf", ct);
            db.Documents.Add(new API.Domain.Entities.Document
            {
                Id = docId,
                OwnerId = indentId,
                OwnerType = "DynamicIndent",
                Kind = kind,
                StoragePath = path,
                Version = 1,
                UploadedByUserId = requestingUserId,
                UploadedAt = DateTimeOffset.UtcNow
            });
        }

        if (input.EstimatePdf is not null) await SaveDocAsync(DocumentKind.EstimatePdf, input.EstimatePdf);
        if (input.GemQuotation is not null) await SaveDocAsync(DocumentKind.GemQuotation, input.GemQuotation);
        if (input.PecCertificate is not null) await SaveDocAsync(DocumentKind.PecCertificate, input.PecCertificate);
        if (input.MacCertificate is not null) await SaveDocAsync(DocumentKind.MacCertificate, input.MacCertificate);
        if (input.PacCertificate is not null) await SaveDocAsync(DocumentKind.PacCertificate, input.PacCertificate);
        if (input.OtherSingleTenderDoc is not null) await SaveDocAsync(DocumentKind.OtherSingleTenderDoc, input.OtherSingleTenderDoc);
        if (input.NonAvailabilityCertificate is not null) await SaveDocAsync(DocumentKind.NonAvailabilityCertificate, input.NonAvailabilityCertificate);

        await db.SaveChangesAsync(ct);

        return indent.Id;
    }

    private IndentProcurementRule DetermineProcurementRule(bool isRule166, GemAvailability gem, decimal cost)
    {
        if (isRule166)
        {
            return IndentProcurementRule.Rule166SingleTender;
        }

        if (gem == GemAvailability.Yes)
        {
            if (cost <= 50000) return IndentProcurementRule.GemDirectPurchase;
            if (cost <= 1000000) return IndentProcurementRule.GemL1Buying;
            return IndentProcurementRule.GemBidding;
        }
        else
        {
            if (cost <= 200000) return IndentProcurementRule.Rule154DirectPurchase;
            return IndentProcurementRule.Rule155MarketCommittee;
        }
    }

    private async Task<string> GenerateIndentNumberAsync(IApplicationDbContext db, CancellationToken ct)
    {
        // Standard financial year format MNIT/RNC/IND/2026-27/0001
        var year = DateTime.UtcNow.Year;
        var month = DateTime.UtcNow.Month;
        var fy = month < 4 ? $"{year - 1}-{year % 100}" : $"{year}-{(year + 1) % 100}";
        
        var prefix = $"MNIT/RNC/IND/{fy}/";
        
        var lastIndent = await db.Indents
            .Where(i => i.IndentNumber.StartsWith(prefix))
            .OrderByDescending(i => i.IndentNumber)
            .FirstOrDefaultAsync(ct);

        if (lastIndent is null)
        {
            return prefix + "0001";
        }

        var lastNumStr = lastIndent.IndentNumber.Substring(prefix.Length);
        if (int.TryParse(lastNumStr, out int lastNum))
        {
            return prefix + (lastNum + 1).ToString("D4");
        }

        return prefix + "0001"; // Fallback
    }
}
