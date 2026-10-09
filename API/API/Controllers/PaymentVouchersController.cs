using API.Application.Common;
using API.Application.Procurement;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

public class PaymentVoucherItemResponseDto
{
    public Guid Id { get; set; }
    public Guid PaymentVoucherId { get; set; }
    public Guid? BudgetHeadId { get; set; }
    public Guid? FellowshipClaimId { get; set; }
    public string? LetterNoDateMbNo { get; set; }
    public string SupplierInvoiceGoods { get; set; } = string.Empty;
    public string HeadCategory { get; set; } = "Consumable";
    public decimal CurrentHeadBalance { get; set; }
    public decimal BillAmount { get; set; }
    public decimal TdsGst { get; set; }
    public decimal TdsIt { get; set; }
    public decimal BalanceAfterPayment { get; set; }
}

public class PaymentVoucherResponseDto
{
    public Guid Id { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? IndentId { get; set; }
    public string VoucherNo { get; set; } = string.Empty;
    public string VoucherType { get; set; } = "upto100k";
    public string Date { get; set; } = string.Empty;
    public decimal TaxableAmount { get; set; }
    public decimal PayableAmount { get; set; }
    public decimal Amount { get; set; }
    public bool ShowTdsGst { get; set; }
    public decimal TdsGstRate { get; set; }
    public bool ShowTdsIt { get; set; }
    public decimal TdsItRate { get; set; }
    public string BankAccountNo { get; set; } = string.Empty;
    public string? ChequeNo { get; set; }
    public string ChequeDate { get; set; } = string.Empty;
    public decimal PayRs { get; set; }
    public string CoordinatorNameDept { get; set; } = string.Empty;
    public string ProjectSanctionNo { get; set; } = string.Empty;
    public string? FundingAgency { get; set; }
    public string PaymentTo { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending Approval";
    public string CurrentStage { get; set; } = string.Empty;
    public string? SignedFilesJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    public string PayeeAccountName { get; set; } = string.Empty;
    public string PayeeAccountNo { get; set; } = string.Empty;
    public string PayeeIfscCode { get; set; } = string.Empty;
    public string PayeeBankName { get; set; } = string.Empty;

    public decimal FirmPaymentAmount { get; set; }
    public decimal BobTransferAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string AmountInWords { get; set; } = string.Empty;

    public List<PaymentVoucherItemResponseDto> Items { get; set; } = new();
}

public class CreatePaymentVoucherItemDto
{
    public Guid? BudgetHeadId { get; set; }
    public string? LetterNoDateMbNo { get; set; }
    public string SupplierInvoiceGoods { get; set; } = string.Empty;
    public string HeadCategory { get; set; } = "Consumable";
    public decimal CurrentHeadBalance { get; set; }
    public decimal BillAmount { get; set; }
    public decimal TdsGst { get; set; }
    public decimal TdsIt { get; set; }
    public decimal BalanceAfterPayment { get; set; }
}

public class CreatePaymentVoucherDto
{
    public Guid? ProjectId { get; set; }
    public Guid? IndentId { get; set; }
    public string? VoucherNo { get; set; }
    public string? VoucherType { get; set; }
    public string? Date { get; set; }
    public decimal TaxableAmount { get; set; }
    public decimal PayableAmount { get; set; }
    public decimal Amount { get; set; }
    public bool ShowTdsGst { get; set; }
    public decimal TdsGstRate { get; set; } = 2m;
    public bool ShowTdsIt { get; set; }
    public decimal TdsItRate { get; set; } = 2m;
    public string BankAccountNo { get; set; } = "77660100016031";
    public string? ChequeNo { get; set; }
    public string? ChequeDate { get; set; }
    public decimal PayRs { get; set; }
    public string CoordinatorNameDept { get; set; } = string.Empty;
    public string ProjectSanctionNo { get; set; } = string.Empty;
    public string? FundingAgency { get; set; }
    public string PaymentTo { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending Approval";
    public string? CurrentStage { get; set; }
    public string? SignedFilesJson { get; set; }
    public List<CreatePaymentVoucherItemDto> Items { get; set; } = new();
}

public class UpdatePaymentVoucherStatusDto
{
    public required string Status { get; set; }
    public string? CurrentStage { get; set; }
    public string? SignedFilesJson { get; set; }
}

public class PaymentVoucherAccountDetailsDto
{
    public Guid Id { get; set; }
    public string PayeeName { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string AccountNo { get; set; } = string.Empty;
    public string IfscCode { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
}

public class CreatePaymentVoucherAccountDetailsDto
{
    public string PayeeName { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string AccountNo { get; set; } = string.Empty;
    public string IfscCode { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string? CreatedBy { get; set; }
}

[ApiController]
[Route("api/payment-vouchers")]
[AllowAnonymous]
public class PaymentVouchersController(
    IApplicationDbContext db,
    IIndentBudgetValidator budgetValidator) : ControllerBase
{
    private static bool _tablesCreated = false;

    private async Task EnsureTablesCreatedAsync(CancellationToken ct)
    {
        if (_tablesCreated) return;
        try
        {
            if (db is DbContext dbContext)
            {
                await dbContext.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS `paymentvouchers` (
                      `Id` char(36) NOT NULL,
                      `ProjectId` char(36) NULL,
                      `IndentId` char(36) NULL,
                      `VoucherNo` varchar(100) NOT NULL,
                      `VoucherType` varchar(50) NOT NULL,
                      `Date` date NOT NULL,
                      `TaxableAmount` decimal(18,2) NOT NULL,
                      `PayableAmount` decimal(18,2) NOT NULL,
                      `Amount` decimal(18,2) NOT NULL,
                      `ShowTdsGst` tinyint(1) NOT NULL,
                      `TdsGstRate` decimal(5,2) NOT NULL,
                      `ShowTdsIt` tinyint(1) NOT NULL,
                      `TdsItRate` decimal(5,2) NOT NULL,
                      `BankAccountNo` varchar(100) NOT NULL,
                      `ChequeNo` longtext NULL,
                      `ChequeDate` date NOT NULL,
                      `PayRs` decimal(18,2) NOT NULL,
                      `CoordinatorNameDept` longtext NOT NULL,
                      `ProjectSanctionNo` longtext NOT NULL,
                      `FundingAgency` longtext NULL,
                      `PaymentTo` longtext NOT NULL,
                      `Status` varchar(50) NOT NULL,
                      `CurrentStage` varchar(150) NOT NULL,
                      `SignedFilesJson` longtext NULL,
                      `CreatedAt` datetime(6) NOT NULL,
                      `UpdatedAt` datetime(6) NULL,
                      PRIMARY KEY (`Id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                ", ct);

                await dbContext.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS `paymentvoucheritems` (
                      `Id` char(36) NOT NULL,
                      `PaymentVoucherId` char(36) NOT NULL,
                      `BudgetHeadId` char(36) NULL,
                      `LetterNoDateMbNo` longtext NULL,
                      `SupplierInvoiceGoods` varchar(1000) NOT NULL,
                      `HeadCategory` varchar(100) NOT NULL,
                      `CurrentHeadBalance` decimal(18,2) NOT NULL,
                      `BillAmount` decimal(18,2) NOT NULL,
                      `TdsGst` decimal(18,2) NOT NULL,
                      `TdsIt` decimal(18,2) NOT NULL,
                      `BalanceAfterPayment` decimal(18,2) NOT NULL,
                      PRIMARY KEY (`Id`),
                      KEY `IX_PaymentVoucherItems_PaymentVoucherId` (`PaymentVoucherId`),
                      CONSTRAINT `FK_PaymentVoucherItems_PaymentVouchers_PaymentVoucherId` FOREIGN KEY (`PaymentVoucherId`) REFERENCES `paymentvouchers` (`Id`) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                ", ct);

                await dbContext.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS `PaymentVoucherAccountDetails` (
                      `Id` char(36) NOT NULL,
                      `PayeeName` varchar(255) NOT NULL,
                      `AccountName` varchar(255) NOT NULL,
                      `AccountNo` varchar(100) NOT NULL,
                      `IfscCode` varchar(50) NOT NULL,
                      `BankName` varchar(255) NOT NULL,
                      `CreatedAt` datetime(6) NOT NULL,
                      `CreatedBy` varchar(255) NULL,
                      PRIMARY KEY (`Id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                ", ct);

                await dbContext.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS `paymentvoucheraccountdetails` (
                      `Id` char(36) NOT NULL,
                      `PayeeName` varchar(255) NOT NULL,
                      `AccountName` varchar(255) NOT NULL,
                      `AccountNo` varchar(100) NOT NULL,
                      `IfscCode` varchar(50) NOT NULL,
                      `BankName` varchar(255) NOT NULL,
                      `CreatedAt` datetime(6) NOT NULL,
                      `CreatedBy` varchar(255) NULL,
                      PRIMARY KEY (`Id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                ", ct);

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"ALTER TABLE `paymentvouchers` ADD COLUMN `SignedFilesJson` longtext NULL;", ct);
                }
                catch { }

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"ALTER TABLE `paymentvouchers` ADD COLUMN `ProjectId` char(36) NULL;", ct);
                }
                catch { }

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"ALTER TABLE `paymentvouchers` ADD COLUMN `IndentId` char(36) NULL;", ct);
                }
                catch { }

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"ALTER TABLE `paymentvoucheritems` ADD COLUMN `BudgetHeadId` char(36) NULL;", ct);
                }
                catch { }

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(@"ALTER TABLE `paymentvoucheritems` ADD COLUMN `FellowshipClaimId` char(36) NULL;", ct);
                }
                catch { }

                // Backfill null BudgetHeadId for existing paymentvoucheritems & expenditure
                var vouchersWithProject = await db.PaymentVouchers
                    .Where(v => v.ProjectId != null)
                    .ToListAsync(ct);

                var voucherMap = vouchersWithProject.ToDictionary(v => v.Id);

                var nullItems = await db.PaymentVoucherItems
                    .Where(i => i.BudgetHeadId == null)
                    .ToListAsync(ct);

                var itemsToFix = nullItems
                    .Where(i => voucherMap.ContainsKey(i.PaymentVoucherId))
                    .ToList();

                if (itemsToFix.Count > 0)
                {
                    var projectIds = itemsToFix.Select(i => voucherMap[i.PaymentVoucherId].ProjectId!.Value).Distinct().ToList();
                    var allHeads = await db.BudgetHeads.Where(h => projectIds.Contains(h.ProjectId)).ToListAsync(ct);

                    foreach (var item in itemsToFix)
                    {
                        var projId = voucherMap[item.PaymentVoucherId].ProjectId!.Value;
                        var projHeads = allHeads.Where(h => h.ProjectId == projId);
                        var matched = MatchBudgetHead(projHeads, item.HeadCategory, null);
                        if (matched != null)
                        {
                            item.BudgetHeadId = matched.Id;
                        }
                    }

                    var nullExpenditures = await db.Expenditure
                        .Where(e => e.BudgetHeadId == null && e.SectionType.StartsWith("Payment Voucher "))
                        .ToListAsync(ct);

                    var voucherNoMap = itemsToFix
                        .Where(i => i.BudgetHeadId != null)
                        .ToDictionary(i => voucherMap[i.PaymentVoucherId].VoucherNo, i => i.BudgetHeadId!.Value);

                    foreach (var exp in nullExpenditures)
                    {
                        var voucherNo = exp.SectionType.Replace("Payment Voucher ", "").Trim();
                        if (voucherNoMap.TryGetValue(voucherNo, out var bHeadId))
                        {
                            exp.BudgetHeadId = bHeadId;
                        }
                    }

                    await db.SaveChangesAsync(ct);
                }

                _tablesCreated = true;
            }
        }
        catch
        {
            // Table setup fallback
        }
    }

    public static string GetFriendlyHeadLabel(string rawHeadStr)
    {
        if (string.IsNullOrWhiteSpace(rawHeadStr)) return "Consumable";
        var str = rawHeadStr.Trim();
        var lower = str.ToLowerInvariant();

        if (lower.Contains("travel")) return "Travel";
        if (lower.Contains("consumable")) return "Consumable";
        if (lower.Contains("contingency")) return "Contingency";
        if (lower.Contains("equipment") || lower.Contains("nonrecurring") || lower.Contains("non-recurring")) return "Equipment";
        if (lower.Contains("manpower")) return "Manpower";
        if (lower.Contains("overhead")) return "Overhead";
        if (lower.Contains("fieldcharge") || lower.Contains("field charge") || lower.Contains("field")) return "Field Charges";
        return str;
    }

    public static BudgetHead? MatchBudgetHead(IEnumerable<BudgetHead> heads, string? category, Guid? budgetHeadId)
    {
        var list = heads.ToList();
        if (budgetHeadId.HasValue)
        {
            var byId = list.FirstOrDefault(h => h.Id == budgetHeadId.Value);
            if (byId != null) return byId;
        }

        if (string.IsNullOrWhiteSpace(category)) return null;

        var cat = category.Trim();
        var catFriendly = GetFriendlyHeadLabel(cat);

        return list.FirstOrDefault(h =>
            h.Id.ToString().Equals(cat, StringComparison.OrdinalIgnoreCase) ||
            h.HeadName.ToString().Equals(cat, StringComparison.OrdinalIgnoreCase) ||
            (h.CustomLabel != null && h.CustomLabel.Equals(cat, StringComparison.OrdinalIgnoreCase)) ||
            GetFriendlyHeadLabel(h.HeadName.ToString()).Equals(catFriendly, StringComparison.OrdinalIgnoreCase) ||
            (h.CustomLabel != null && GetFriendlyHeadLabel(h.CustomLabel).Equals(catFriendly, StringComparison.OrdinalIgnoreCase))
        );
    }

    [HttpGet("project-head-snapshots/{projectId:guid}")]
    public async Task<ActionResult> GetProjectHeadSnapshots(Guid projectId, CancellationToken ct)
    {
        await EnsureTablesCreatedAsync(ct);
        var heads = await db.BudgetHeads
            .Where(b => b.ProjectId == projectId)
            .ToListAsync(ct);

        var approvedReceipts = await db.GrantReceipts
            .Where(g => g.ProjectId == projectId && g.Status == GrantReceiptStatus.Approved)
            .ToListAsync(ct);

        var totalProjectGrantReceived = approvedReceipts.Sum(g => g.Amount);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var expenditureRows = await db.Expenditure
            .Where(e => e.ProjectId == projectId)
            .ToListAsync(ct);

        var hasSpecificHeadGrants = approvedReceipts.Any(g => g.BudgetHeadId != null);

        var snapshots = new List<object>();

        foreach (var head in heads)
        {
            var snap = await budgetValidator.GetSnapshotAsync(head.Id, today, ct);
            var headGrantReceived = approvedReceipts
                .Where(g => g.BudgetHeadId == head.Id || (!hasSpecificHeadGrants && heads.Count == 1))
                .Sum(g => g.Amount);

            var paidForHead = expenditureRows
                .Where(e => e.BudgetHeadId == head.Id)
                .Sum(e => e.Amount);

            decimal availableBal;
            if (headGrantReceived > 0)
            {
                availableBal = Math.Max(0m, headGrantReceived - paidForHead);
            }
            else if (!hasSpecificHeadGrants && totalProjectGrantReceived > 0)
            {
                availableBal = Math.Max(0m, totalProjectGrantReceived - expenditureRows.Sum(e => e.Amount));
            }
            else
            {
                availableBal = 0m;
            }

            snapshots.Add(new
            {
                budgetHeadId = head.Id,
                headName = head.HeadName.ToString(),
                customLabel = head.CustomLabel,
                displayName = head.HeadName == BudgetHeadName.Other && !string.IsNullOrWhiteSpace(head.CustomLabel)
                    ? head.CustomLabel
                    : GetFriendlyHeadLabel(head.HeadName.ToString()),
                sanctioned = snap.Sanctioned,
                committed = snap.Committed,
                paid = paidForHead,
                grantReceived = headGrantReceived,
                totalProjectGrantReceived,
                available = availableBal
            });
        }

        return Ok(snapshots);
    }

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        await EnsureTablesCreatedAsync(ct);

        var query = db.PaymentVouchers
            .Include(v => v.Items)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(v => v.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.Trim().ToLower();
            query = query.Where(v =>
                (v.VoucherNo != null && v.VoucherNo.ToLower().Contains(searchLower)) ||
                (v.CoordinatorNameDept != null && v.CoordinatorNameDept.ToLower().Contains(searchLower)) ||
                (v.PaymentTo != null && v.PaymentTo.ToLower().Contains(searchLower)) ||
                (v.ProjectSanctionNo != null && v.ProjectSanctionNo.ToLower().Contains(searchLower))
            );
        }

        var totalCount = await query.CountAsync(ct);
        var orderedQuery = query.OrderByDescending(v => v.CreatedAt);

        List<PaymentVoucher> entities;
        if (pageSize <= 0)
        {
            entities = await orderedQuery.ToListAsync(ct);
        }
        else
        {
            entities = await orderedQuery
                .Skip((Math.Max(1, pageNumber) - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(ct);
        }

        var response = entities.Select(MapToResponse).ToList();
        var effectivePageSize = pageSize > 0 ? pageSize : (totalCount > 0 ? totalCount : 1);
        var totalPages = (int)Math.Ceiling(totalCount / (double)effectivePageSize);

        return Ok(new
        {
            items = response,
            totalCount = totalCount,
            pageNumber = Math.Max(1, pageNumber),
            pageSize = effectivePageSize,
            totalPages = totalPages > 0 ? totalPages : 1
        });
    }


    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PaymentVoucherResponseDto>> GetById(Guid id, CancellationToken ct)
    {
        await EnsureTablesCreatedAsync(ct);

        var entity = await db.PaymentVouchers
            .Include(v => v.Items)
            .FirstOrDefaultAsync(v => v.Id == id, ct);

        if (entity is null)
        {
            return NotFound(new { detail = $"Payment Voucher '{id}' not found." });
        }

        return Ok(MapToResponse(entity));
    }

    [HttpPost]
    public async Task<ActionResult<PaymentVoucherResponseDto>> Create(
        [FromBody] CreatePaymentVoucherDto dto, CancellationToken ct)
    {
        await EnsureTablesCreatedAsync(ct);

        if (string.IsNullOrWhiteSpace(dto.CoordinatorNameDept) ||
            string.IsNullOrWhiteSpace(dto.ProjectSanctionNo) ||
            string.IsNullOrWhiteSpace(dto.PaymentTo))
        {
            return BadRequest(new { detail = "Coordinator, Project/Sanction No., and Payee Name are required." });
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (dto.ProjectId.HasValue)
        {
            var approvedGrantReceipts = await db.GrantReceipts
                .Where(g => g.ProjectId == dto.ProjectId.Value && g.Status == GrantReceiptStatus.Approved)
                .ToListAsync(ct);

            var totalGrantReceived = approvedGrantReceipts.Sum(g => g.Amount);
            if (totalGrantReceived <= 0)
            {
                return BadRequest(new { detail = "Payment cannot be processed: No grant money received for this project. Please grant the payment first." });
            }

            var projectHeadsForCheck = await db.BudgetHeads
                .Where(b => b.ProjectId == dto.ProjectId.Value)
                .ToListAsync(ct);

            var expenditureRows = await db.Expenditure
                .Where(e => e.ProjectId == dto.ProjectId.Value)
                .ToListAsync(ct);

            var hasSpecificHeadGrants = approvedGrantReceipts.Any(g => g.BudgetHeadId != null);

            foreach (var itemDto in dto.Items)
            {
                var matchedHead = MatchBudgetHead(projectHeadsForCheck, itemDto.HeadCategory, itemDto.BudgetHeadId);
                Guid? itemHeadId = matchedHead?.Id;

                if (itemHeadId.HasValue)
                {
                    var headGrant = approvedGrantReceipts
                        .Where(g => g.BudgetHeadId == itemHeadId.Value || (!hasSpecificHeadGrants && projectHeadsForCheck.Count == 1))
                        .Sum(g => g.Amount);

                    var paidForHead = expenditureRows
                        .Where(e => e.BudgetHeadId == itemHeadId.Value)
                        .Sum(e => e.Amount);

                    decimal headAvailable;
                    if (headGrant > 0)
                    {
                        headAvailable = Math.Max(0m, headGrant - paidForHead);
                    }
                    else if (!hasSpecificHeadGrants && totalGrantReceived > 0)
                    {
                        headAvailable = Math.Max(0m, totalGrantReceived - expenditureRows.Sum(e => e.Amount));
                    }
                    else
                    {
                        headAvailable = 0m;
                    }

                    var itemAmount = itemDto.BillAmount > 0 ? itemDto.BillAmount : dto.TaxableAmount;

                    if (headAvailable <= 0)
                    {
                        return BadRequest(new { detail = $"Payment cannot be processed for {itemDto.HeadCategory}: Available grant balance is ₹0. Please record a grant receipt first." });
                    }

                    if (itemAmount > headAvailable)
                    {
                        return BadRequest(new { detail = $"Your bill is ₹{itemAmount:N2}, but the available grant balance for {itemDto.HeadCategory} is ₹{headAvailable:N2}. It cannot be processed." });
                    }
                }
            }
        }
        DateOnly voucherDate = today;
        if (!string.IsNullOrWhiteSpace(dto.Date) && DateOnly.TryParse(dto.Date, out var parsedDate))
        {
            voucherDate = parsedDate;
        }

        DateOnly chequeDate = today;
        if (!string.IsNullOrWhiteSpace(dto.ChequeDate) && DateOnly.TryParse(dto.ChequeDate, out var parsedChqDate))
        {
            chequeDate = parsedChqDate;
        }

        var voucherNo = dto.VoucherNo;
        if (string.IsNullOrWhiteSpace(voucherNo))
        {
            voucherNo = $"PV/{DateTime.UtcNow.Year}/{DateTime.UtcNow.Month:D2}/{Random.Shared.Next(100, 999)}";
        }

        var totalBill = dto.Items.Sum(i => i.BillAmount);
        var totalTdsGst = dto.ShowTdsGst ? dto.Items.Sum(i => i.TdsGst) : 0m;
        var totalTdsIt = dto.ShowTdsIt ? dto.Items.Sum(i => i.TdsIt) : 0m;
        var totalTds = totalTdsGst + totalTdsIt;
        var netPayable = Math.Max(0m, totalBill - totalTds);

        var voucherType = dto.VoucherType;
        if (string.IsNullOrWhiteSpace(voucherType))
        {
            voucherType = totalBill > 100000m ? "above100k" : "upto100k";
        }

        var entity = new PaymentVoucher
        {
            Id = Guid.NewGuid(),
            ProjectId = dto.ProjectId,
            IndentId = dto.IndentId,
            VoucherNo = voucherNo,
            VoucherType = voucherType,
            Date = voucherDate,
            TaxableAmount = dto.TaxableAmount > 0 ? dto.TaxableAmount : totalBill,
            PayableAmount = dto.PayableAmount > 0 ? dto.PayableAmount : (netPayable > 0 ? netPayable : totalBill),
            Amount = dto.Amount > 0 ? dto.Amount : totalBill,
            ShowTdsGst = dto.ShowTdsGst,
            TdsGstRate = dto.TdsGstRate,
            ShowTdsIt = dto.ShowTdsIt,
            TdsItRate = dto.TdsItRate,
            BankAccountNo = string.IsNullOrWhiteSpace(dto.BankAccountNo) ? "77660100016031" : dto.BankAccountNo,
            ChequeNo = dto.ChequeNo,
            ChequeDate = chequeDate,
            PayRs = dto.PayRs > 0 ? dto.PayRs : totalBill,
            CoordinatorNameDept = dto.CoordinatorNameDept,
            ProjectSanctionNo = dto.ProjectSanctionNo,
            FundingAgency = dto.FundingAgency,
            PaymentTo = dto.PaymentTo,
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Pending Approval" : dto.Status,
            CurrentStage = string.IsNullOrWhiteSpace(dto.CurrentStage) ? "Office Assistant Verification" : dto.CurrentStage,
            SignedFilesJson = dto.SignedFilesJson,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var projectHeads = dto.ProjectId.HasValue 
            ? await db.BudgetHeads.Where(b => b.ProjectId == dto.ProjectId.Value).ToListAsync(ct)
            : new List<BudgetHead>();

        foreach (var itemDto in dto.Items)
        {
            var matchedHead = MatchBudgetHead(projectHeads, itemDto.HeadCategory, itemDto.BudgetHeadId);
            Guid? itemHeadId = matchedHead?.Id;

            entity.Items.Add(new PaymentVoucherItem
            {
                Id = Guid.NewGuid(),
                PaymentVoucherId = entity.Id,
                BudgetHeadId = itemHeadId,
                LetterNoDateMbNo = itemDto.LetterNoDateMbNo,
                SupplierInvoiceGoods = itemDto.SupplierInvoiceGoods,
                HeadCategory = string.IsNullOrWhiteSpace(itemDto.HeadCategory) ? "Consumable" : itemDto.HeadCategory,
                CurrentHeadBalance = itemDto.CurrentHeadBalance,
                BillAmount = itemDto.BillAmount,
                TdsGst = itemDto.TdsGst,
                TdsIt = itemDto.TdsIt,
                BalanceAfterPayment = itemDto.BalanceAfterPayment
            });

            // Record Expenditure row for project budget tracking when voucher is submitted
            if (dto.ProjectId.HasValue)
            {
                var expenditureAmount = itemDto.BillAmount > 0 ? itemDto.BillAmount : entity.TaxableAmount;
                if (expenditureAmount > 0)
                {
                    db.Expenditure.Add(new Expenditure
                    {
                        Id = Guid.NewGuid(),
                        ProjectId = dto.ProjectId.Value,
                        BudgetHeadId = itemHeadId,
                        SectionType = $"Payment Voucher {entity.VoucherNo}",
                        TransactionDate = voucherDate,
                        Amount = expenditureAmount,
                    });
                }
            }
        }

        db.PaymentVouchers.Add(entity);
        await db.SaveChangesAsync(ct);

        var response = MapToResponse(entity);
        return CreatedAtAction(nameof(GetById), new { id = entity.Id }, response);
    }

    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<PaymentVoucherResponseDto>> UpdateStatus(
        Guid id, [FromBody] UpdatePaymentVoucherStatusDto dto, CancellationToken ct)
    {
        await EnsureTablesCreatedAsync(ct);

        var entity = await db.PaymentVouchers
            .Include(v => v.Items)
            .FirstOrDefaultAsync(v => v.Id == id, ct);

        if (entity is null)
        {
            return NotFound(new { detail = $"Payment Voucher '{id}' not found." });
        }

        entity.Status = dto.Status;
        if (!string.IsNullOrWhiteSpace(dto.CurrentStage))
        {
            entity.CurrentStage = dto.CurrentStage;
        }
        if (dto.SignedFilesJson != null)
        {
            entity.SignedFilesJson = dto.SignedFilesJson;
        }

        entity.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return Ok(MapToResponse(entity));
    }

    private static PaymentVoucherResponseDto MapToResponse(PaymentVoucher entity)
    {
        var totalBill = entity.Items.Sum(i => i.BillAmount);
        var totalTdsGst = entity.ShowTdsGst ? entity.Items.Sum(i => i.TdsGst) : 0m;
        var totalTdsIt = entity.ShowTdsIt ? entity.Items.Sum(i => i.TdsIt) : 0m;
        var bobTransfer = totalTdsGst + totalTdsIt;
        var firmPayment = Math.Max(0m, totalBill - bobTransfer);
        var grandTotal = totalBill > 0 ? totalBill : entity.Amount;

        return new PaymentVoucherResponseDto
        {
            Id = entity.Id,
            ProjectId = entity.ProjectId,
            IndentId = entity.IndentId,
            VoucherNo = entity.VoucherNo,
            VoucherType = entity.VoucherType,
            Date = entity.Date.ToString("yyyy-MM-dd"),
            TaxableAmount = entity.TaxableAmount,
            PayableAmount = entity.PayableAmount,
            Amount = entity.Amount,
            ShowTdsGst = entity.ShowTdsGst,
            TdsGstRate = entity.TdsGstRate,
            ShowTdsIt = entity.ShowTdsIt,
            TdsItRate = entity.TdsItRate,
            BankAccountNo = entity.BankAccountNo,
            ChequeNo = entity.ChequeNo,
            ChequeDate = entity.ChequeDate.ToString("yyyy-MM-dd"),
            PayRs = entity.PayRs,
            CoordinatorNameDept = entity.CoordinatorNameDept,
            ProjectSanctionNo = entity.ProjectSanctionNo,
            FundingAgency = entity.FundingAgency,
            PaymentTo = entity.PaymentTo,
            Status = entity.Status,
            CurrentStage = entity.CurrentStage,
            SignedFilesJson = entity.SignedFilesJson,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            FirmPaymentAmount = firmPayment,
            BobTransferAmount = bobTransfer,
            TotalAmount = grandTotal,
            AmountInWords = NumberToWordsConverter.Convert((long)grandTotal),
            Items = entity.Items.Select(i => new PaymentVoucherItemResponseDto
            {
                Id = i.Id,
                PaymentVoucherId = i.PaymentVoucherId,
                BudgetHeadId = i.BudgetHeadId,
                FellowshipClaimId = i.FellowshipClaimId,
                LetterNoDateMbNo = i.LetterNoDateMbNo,
                SupplierInvoiceGoods = i.SupplierInvoiceGoods,
                HeadCategory = i.HeadCategory,
                CurrentHeadBalance = i.CurrentHeadBalance,
                BillAmount = i.BillAmount,
                TdsGst = i.TdsGst,
                TdsIt = i.TdsIt,
                BalanceAfterPayment = i.BalanceAfterPayment
            }).ToList()
        };
    }

    [HttpGet("account-details")]
    public async Task<ActionResult> GetAccountDetails(CancellationToken ct)
    {
        await EnsureTablesCreatedAsync(ct);
        var items = await db.PaymentVoucherAccountDetails
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new PaymentVoucherAccountDetailsDto
            {
                Id = x.Id,
                PayeeName = x.PayeeName,
                AccountName = x.AccountName,
                AccountNo = x.AccountNo,
                IfscCode = x.IfscCode,
                BankName = x.BankName,
                CreatedAt = x.CreatedAt,
                CreatedBy = x.CreatedBy
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpPost("account-details")]
    public async Task<ActionResult> CreateAccountDetails([FromBody] CreatePaymentVoucherAccountDetailsDto dto, CancellationToken ct)
    {
        await EnsureTablesCreatedAsync(ct);
        if (string.IsNullOrWhiteSpace(dto.PayeeName) && string.IsNullOrWhiteSpace(dto.AccountName))
        {
            return BadRequest(new { message = "Payee name or account name is required." });
        }

        var payeeName = !string.IsNullOrWhiteSpace(dto.PayeeName) ? dto.PayeeName.Trim() : dto.AccountName.Trim();
        var accountName = !string.IsNullOrWhiteSpace(dto.AccountName) ? dto.AccountName.Trim() : payeeName;

        var entity = new PaymentVoucherAccountDetails
        {
            Id = Guid.NewGuid(),
            PayeeName = payeeName,
            AccountName = accountName,
            AccountNo = dto.AccountNo?.Trim() ?? string.Empty,
            IfscCode = dto.IfscCode?.Trim().ToUpper() ?? string.Empty,
            BankName = dto.BankName?.Trim() ?? string.Empty,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = !string.IsNullOrWhiteSpace(dto.CreatedBy)
                ? dto.CreatedBy
                : (User?.Identity?.Name ?? "User")
        };

        db.PaymentVoucherAccountDetails.Add(entity);
        await db.SaveChangesAsync(ct);

        return Ok(new PaymentVoucherAccountDetailsDto
        {
            Id = entity.Id,
            PayeeName = entity.PayeeName,
            AccountName = entity.AccountName,
            AccountNo = entity.AccountNo,
            IfscCode = entity.IfscCode,
            BankName = entity.BankName,
            CreatedAt = entity.CreatedAt,
            CreatedBy = entity.CreatedBy
        });
    }
}

public static class NumberToWordsConverter
{
    public static string Convert(long number)
    {
        if (number == 0) return "Rupees Zero Only";
        if (number < 0) return "Rupees Minus " + Convert(Math.Abs(number));

        string words = "";

        if ((number / 10000000) > 0)
        {
            words += Convert(number / 10000000).Replace("Rupees ", "").Replace(" Only", "") + " Crore ";
            number %= 10000000;
        }

        if ((number / 100000) > 0)
        {
            words += Convert(number / 100000).Replace("Rupees ", "").Replace(" Only", "") + " Lakh ";
            number %= 100000;
        }

        if ((number / 1000) > 0)
        {
            words += Convert(number / 1000).Replace("Rupees ", "").Replace(" Only", "") + " Thousand ";
            number %= 1000;
        }

        if ((number / 100) > 0)
        {
            words += Convert(number / 100).Replace("Rupees ", "").Replace(" Only", "") + " Hundred ";
            number %= 100;
        }

        if (number > 0)
        {
            var unitsMap = new[] { "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen" };
            var tensMap = new[] { "Zero", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety" };

            if (number < 20)
                words += unitsMap[number];
            else
            {
                words += tensMap[number / 10];
                if ((number % 10) > 0)
                    words += "-" + unitsMap[number % 10];
            }
        }

        return "Rupees " + words.Trim() + " Only";
    }
}

