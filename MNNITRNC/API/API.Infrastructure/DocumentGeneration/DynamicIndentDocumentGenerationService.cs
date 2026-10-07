using API.Domain.Entities;
using API.Domain.Enums;
using API.Application.Common;
using API.Application.Documents;
using Microsoft.EntityFrameworkCore;
using API.Infrastructure.Persistence;
using API.Infrastructure.DocumentGeneration.Templates;

namespace API.Infrastructure.DocumentGeneration;

public interface IDynamicIndentDocumentGenerationService
{
    Task<byte[]> GenerateIndentDocumentAsync(Guid indentId, CancellationToken ct = default);
}

public class DynamicIndentDocumentGenerationService(
    IHtmlPdfRenderer renderer,
    IApplicationDbContext db) : IDynamicIndentDocumentGenerationService
{
    public async Task<byte[]> GenerateIndentDocumentAsync(Guid indentId, CancellationToken ct = default)
    {
        var indent = await db.Indents
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == indentId, ct)
            ?? throw new ArgumentException("Indent not found", nameof(indentId));

        var model = await BuildModelFromIndentAsync(indent, ct);
        var html = GenerateHtml(indent, model);
        var shell = IndentHtmlShell.Wrap(html);
        return await renderer.RenderAsync(shell, ct);
    }

    private string GenerateHtml(Indent indent, IndentDocumentModel model)
    {
        var isGem = indent.GemAvailability == GemAvailability.Yes;
        var cost = indent.Items.Sum(i => i.EstimatedCostInclTax);

        if (indent.ProcurementRule == IndentProcurementRule.Rule166SingleTender)
        {
            var html = Annexure11Template.Render(model);
            return html.Replace("REQUISITION [Rs. 2,00,000 to Rs. 25 Lakh]", "REQUISITION [Rule 166 - Single Tender Enquiry]");
        }

        if (isGem)
        {
            if (cost <= 50000) return Annexure6Template.Render(model);
            if (cost <= 1000000) return Annexure7Template.Render(model);
            return Annexure8Template.Render(model);
        }
        else
        {
            if (cost <= 100000) return Annexure9Template.Render(model);
            if (cost <= 200000) return Annexure10Template.Render(model);
            return Annexure11Template.Render(model);
        }
    }

    private async Task<IndentDocumentModel> BuildModelFromIndentAsync(Indent indent, CancellationToken ct)
    {
        var cost = indent.Items.Sum(i => i.EstimatedCostInclTax);

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == indent.ProjectId, ct);
        var budgetHead = await db.BudgetHeads.FirstOrDefaultAsync(b => b.Id == indent.BudgetHeadId, ct);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == indent.OwnerUserId, ct);
        var facultyProfile = await db.FacultyProfiles.FirstOrDefaultAsync(fp => fp.UserId == indent.OwnerUserId.ToString(), ct);
        var department = user?.DepartmentId != null ? await db.Departments.FirstOrDefaultAsync(d => d.Id == user.DepartmentId, ct) : null;

        var facultyName = !string.IsNullOrWhiteSpace(facultyProfile?.Name) ? facultyProfile.Name : (user?.FullName ?? "Indenter Name");
        var designation = !string.IsNullOrWhiteSpace(facultyProfile?.Designation) ? facultyProfile.Designation : "Faculty";
        var departmentName = !string.IsNullOrWhiteSpace(facultyProfile?.Department) ? facultyProfile.Department : (department?.Name ?? "Department");

        var items = indent.Items.OrderBy(i => i.SerialNumber).Select(i => new IndentDocumentItemModel(
            i.SerialNumber, i.Name, i.IsConsumable, i.TechnicalSpecs ?? "", i.UnitOfMeasurement ?? "", i.Quantity, i.EstimatedCostInclTax
        )).ToList();

        // Stock parsing
        string? stockPage = indent.StockBookPage, stockDesc = indent.StockDescription, stockQty = indent.StockQuantity, stockCost = indent.StockActualCost, stockCond = indent.StockCondition;

        var committee = new List<IndentCommitteeMemberModel>();
        if (!string.IsNullOrWhiteSpace(indent.CommitteeFacultyUserId))
        {
            var commFaculty = await db.FacultyProfiles.FirstOrDefaultAsync(fp => fp.UserId == indent.CommitteeFacultyUserId, ct);
            if (commFaculty != null && !string.IsNullOrWhiteSpace(commFaculty.Name))
            {
                committee.Add(new IndentCommitteeMemberModel(commFaculty.Name, "Committee Member"));
            }
        }

        return new IndentDocumentModel(
            SanctionNo: project?.SanctionNo ?? "N/A",
            ProjectTitle: project?.ProjectTitle ?? "N/A",
            Agency: project?.Agency ?? "N/A",
            BudgetHeadName: budgetHead?.HeadName.ToString() ?? "N/A",
            FacultyName: facultyName,
            FacultyDesignation: designation,
            FacultyDepartment: departmentName,
            Items: items,
            Purpose: indent.Purpose ?? "",
            GemAvailability: indent.GemAvailability == GemAvailability.Yes ? "yes" : "no",
            ModeOfPurchase: "dynamic",
            Status: "indent_raised",
            StockBookPage: stockPage,
            StockDescription: stockDesc,
            StockQuantity: stockQty,
            StockActualCost: stockCost,
            StockCondition: stockCond,
            InstallationRequired: indent.InstallationRequired,
            TrainingRequired: indent.TrainingRequired,
            QualificationCriterion: indent.QualificationCriterion,
            NumberOfEnclosures: indent.NumberOfEnclosures,
            MaxDeliveryPeriod: indent.MaxDeliveryPeriod,
            PurposeOfAcquiring: indent.PurposeOfAcquiring?.ToString(),
            PerpetualLicense: indent.PerpetualLicense,
            CommitteeMembers: committee
        )
        {
            IndentNumber = indent.IndentNumber ?? "",
            IndentDate = indent.CreatedAt.ToString("dd/MM/yyyy")
        };
    }

    // Legacy internal hardcoded templates removed.

}
