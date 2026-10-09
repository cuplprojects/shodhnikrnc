# Phase 2 Backend: Projects/Grants Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend (entities, services, EF Core migration, REST API) for project/grant management — project CRUD with soft delete, budget heads, collaborators, sanctioned equipment/manpower, grant receipts with server-validated overhead split, and budget-summary reporting.

**Architecture:** Follows Phase 1's Clean Architecture conventions exactly: entities in `API.Domain`, services/interfaces in `API.Application`, EF configuration in `API.Infrastructure`, controllers/contracts in `API` (presentation). Reuses Phase 1's `IApplicationDbContext`, `ClaimsPrincipalExtensions.GetUserId()`, and the `ProblemDetails`-via-middleware pattern for domain exceptions.

**Tech Stack:** .NET 8, EF Core 8 + Pomelo/MySQL (already configured), xUnit + FluentAssertions (already configured), ASP.NET Core Identity roles (already seeded: Faculty, RegularStaff, Superintendent, DeputyRegistrar, Dean).

## Global Constraints

- Target framework: `net8.0`, nullable + implicit usings enabled — matches every existing `.csproj` in the solution.
- Money fields use `decimal`, never `double`/`float`.
- Dates use `DateOnly` (not `DateTime`) for pure calendar dates (`StartDate`, `SanctionDate`, `ReceivedDate`, `TransactionDate`) — no time-of-day component is meaningful for any of these.
- `ProjectType` is restricted to exactly these 5 values (stored as string, validated at the API boundary, not a C# `enum` persisted as int — keeps the DB human-readable and matches how Phase 1 stored `RequestType` etc. as enums, but these labels are long free-form strings from the legacy UI so we store the display string directly via a C# enum with `[Description]`/explicit string conversion, not raw free text):
  `TypeIResearch`, `TypeIIIndustrySponsored`, `TypeIIIConsultancy`, `TypeIVTesting`, `TypeVOther`.
- `BudgetHead.HeadName` is restricted to exactly these 7 values: `EquipmentNonRecurring`, `RecurringConsumable`, `RecurringContingency`, `RecurringTravel`, `RecurringOverhead`, `RecurringFieldCharges`, `RecurringManpower`.
- Overhead split ratio: IDF 40%, PDF 40%, DDF 20% (code-verified legacy ratio — NOT the BRD's stated 40/20/40). Tolerance for "matches ratio" validation: computed split amounts must equal the submitted amounts exactly after rounding both to 2 decimal places.
- All project-scoped endpoints are owner-scoped: a Faculty user can only see/modify their own projects (`OwnerUserId` match against the JWT `sub` claim via `ClaimsPrincipalExtensions.GetUserId()`).
- Soft delete only — no entity in this slice is ever hard-deleted via the API.
- Every mutating endpoint requires `[Authorize]`; only `Faculty`-role users create/edit/delete projects and record grant receipts in this slice (HOD/Dean/institute-wide read access is out of scope per the spec).

---

## File Structure

```
API/
  API.Domain/
    Entities/
      Project.cs                          (new)
      Collaborator.cs                     (new)
      BudgetHead.cs                       (new)
      SanctionedEquipment.cs              (new)
      SanctionedManpowerPosition.cs       (new)
      GrantReceipt.cs                     (new)
    Enums/
      ProjectType.cs                      (new)
      BudgetHeadName.cs                   (new)
      GrantReceiptType.cs                 (new)
      OverheadSubHead.cs                  (new)
  API.Application/
    Projects/
      IProjectYearCalculator.cs           (new)
      ProjectYearCalculator.cs            (new)
      IOverheadSplitValidator.cs          (new)
      OverheadSplitValidator.cs           (new)
      OverheadSplitValidationResult.cs    (new)
      IProjectService.cs                  (new)
      ProjectService.cs                   (new)
      ProjectNotFoundException.cs         (new)
      ProjectAccessDeniedException.cs     (new)
  API.Infrastructure/
    Persistence/
      ApplicationDbContext.cs              (modify: add 6 new DbSets + OnModelCreating config)
      Migrations/                          (new migration generated here)
  API/
    Contracts/
      Projects/
        ProjectListItemResponse.cs         (new)
        ProjectDetailResponse.cs           (new)
        CollaboratorDto.cs                 (new)
        BudgetHeadDto.cs                   (new)
        SanctionedEquipmentDto.cs          (new)
        SanctionedManpowerPositionDto.cs   (new)
        CreateProjectRequest.cs            (new)
        UpdateProjectRequest.cs            (new)
        BudgetSummaryResponse.cs           (new)
        BudgetSummaryLineResponse.cs       (new)
        GrantReceiptResponse.cs            (new)
        RecordGrantReceiptRequest.cs       (new)
    Controllers/
      ProjectsController.cs                (new)
    Middleware/
      ProjectExceptionMiddleware.cs        (new)
    Program.cs                             (modify: register services + middleware)
  API.Tests/
    Projects/
      ProjectYearCalculatorTests.cs        (new)
      OverheadSplitValidatorTests.cs       (new)
      ProjectServiceUpsertTests.cs         (new)
```

---

## Task 1: Domain entities and enums

**Files:**
- Create: `API/API.Domain/Enums/ProjectType.cs`
- Create: `API/API.Domain/Enums/BudgetHeadName.cs`
- Create: `API/API.Domain/Enums/GrantReceiptType.cs`
- Create: `API/API.Domain/Enums/OverheadSubHead.cs`
- Create: `API/API.Domain/Entities/Project.cs`
- Create: `API/API.Domain/Entities/Collaborator.cs`
- Create: `API/API.Domain/Entities/BudgetHead.cs`
- Create: `API/API.Domain/Entities/SanctionedEquipment.cs`
- Create: `API/API.Domain/Entities/SanctionedManpowerPosition.cs`
- Create: `API/API.Domain/Entities/GrantReceipt.cs`

**Interfaces:**
- Produces (consumed by every later task in this plan):
  - `enum ProjectType { TypeIResearch, TypeIIIndustrySponsored, TypeIIIConsultancy, TypeIVTesting, TypeVOther }`
  - `enum BudgetHeadName { EquipmentNonRecurring, RecurringConsumable, RecurringContingency, RecurringTravel, RecurringOverhead, RecurringFieldCharges, RecurringManpower }`
  - `enum GrantReceiptType { Head, OverheadSplit }`
  - `enum OverheadSubHead { Idf, Pdf, Ddf }`
  - `class Project` — `Id (Guid)`, `OwnerUserId (Guid)`, `ProjectType (ProjectType)`, `SanctionNo (string)`, `SanctionDate (DateOnly)`, `ProjectTitle (string)`, `StartDate (DateOnly)`, `Agency (string)`, `DurationMonths (int)`, `TotalSanctioned (decimal)`, `IsDeleted (bool)`, `DeletedAt (DateTimeOffset?)`, `DeletedByUserId (Guid?)`, `CreatedAt (DateTimeOffset)`, plus navigation collections `Collaborators`, `BudgetHeads`, `SanctionedEquipment`, `SanctionedManpowerPositions`, `GrantReceipts`.
  - `class Collaborator` — `Id (Guid)`, `ProjectId (Guid)`, `Institute (string)`, `Faculty (string)`.
  - `class BudgetHead` — `Id (Guid)`, `ProjectId (Guid)`, `HeadName (BudgetHeadName)`, `Year1Amount (decimal)`, `Year2Amount (decimal)`, `Year3Amount (decimal)`, `Total (decimal)`.
  - `class SanctionedEquipment` — `Id (Guid)`, `ProjectId (Guid)`, `Name (string)`, `Unit (string)`, `Amount (decimal)`.
  - `class SanctionedManpowerPosition` — `Id (Guid)`, `ProjectId (Guid)`, `Designation (string)`, `Positions (int)`, `Stipend (decimal)`, `Hra (decimal)`.
  - `class GrantReceipt` — `Id (Guid)`, `ProjectId (Guid)`, `BudgetHeadId (Guid)`, `ReceivedDate (DateOnly)`, `Amount (decimal)`, `Type (GrantReceiptType)`, `ParentReceiptId (Guid?)`, `SubHead (OverheadSubHead?)`.

- [ ] **Step 1: Write the four enums**

`API/API.Domain/Enums/ProjectType.cs`:
```csharp
namespace API.Domain.Enums;

public enum ProjectType
{
    TypeIResearch,
    TypeIIIndustrySponsored,
    TypeIIIConsultancy,
    TypeIVTesting,
    TypeVOther
}
```

`API/API.Domain/Enums/BudgetHeadName.cs`:
```csharp
namespace API.Domain.Enums;

public enum BudgetHeadName
{
    EquipmentNonRecurring,
    RecurringConsumable,
    RecurringContingency,
    RecurringTravel,
    RecurringOverhead,
    RecurringFieldCharges,
    RecurringManpower
}
```

`API/API.Domain/Enums/GrantReceiptType.cs`:
```csharp
namespace API.Domain.Enums;

public enum GrantReceiptType
{
    Head,
    OverheadSplit
}
```

`API/API.Domain/Enums/OverheadSubHead.cs`:
```csharp
namespace API.Domain.Enums;

public enum OverheadSubHead
{
    Idf,
    Pdf,
    Ddf
}
```

- [ ] **Step 2: Write the six entities**

`API/API.Domain/Entities/Project.cs`:
```csharp
using API.Domain.Enums;

namespace API.Domain.Entities;

public class Project
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public ProjectType ProjectType { get; set; }
    public required string SanctionNo { get; set; }
    public DateOnly SanctionDate { get; set; }
    public required string ProjectTitle { get; set; }
    public DateOnly StartDate { get; set; }
    public required string Agency { get; set; }
    public int DurationMonths { get; set; }
    public decimal TotalSanctioned { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Collaborator> Collaborators { get; set; } = new List<Collaborator>();
    public ICollection<BudgetHead> BudgetHeads { get; set; } = new List<BudgetHead>();
    public ICollection<SanctionedEquipment> SanctionedEquipment { get; set; } = new List<SanctionedEquipment>();
    public ICollection<SanctionedManpowerPosition> SanctionedManpowerPositions { get; set; } = new List<SanctionedManpowerPosition>();
    public ICollection<GrantReceipt> GrantReceipts { get; set; } = new List<GrantReceipt>();
}
```

`API/API.Domain/Entities/Collaborator.cs`:
```csharp
namespace API.Domain.Entities;

public class Collaborator
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public required string Institute { get; set; }
    public required string Faculty { get; set; }
}
```

`API/API.Domain/Entities/BudgetHead.cs`:
```csharp
using API.Domain.Enums;

namespace API.Domain.Entities;

public class BudgetHead
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public BudgetHeadName HeadName { get; set; }
    public decimal Year1Amount { get; set; }
    public decimal Year2Amount { get; set; }
    public decimal Year3Amount { get; set; }
    public decimal Total { get; set; }
}
```

`API/API.Domain/Entities/SanctionedEquipment.cs`:
```csharp
namespace API.Domain.Entities;

public class SanctionedEquipment
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public required string Unit { get; set; }
    public decimal Amount { get; set; }
}
```

`API/API.Domain/Entities/SanctionedManpowerPosition.cs`:
```csharp
namespace API.Domain.Entities;

public class SanctionedManpowerPosition
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public required string Designation { get; set; }
    public int Positions { get; set; }
    public decimal Stipend { get; set; }
    public decimal Hra { get; set; }
}
```

`API/API.Domain/Entities/GrantReceipt.cs`:
```csharp
using API.Domain.Enums;

namespace API.Domain.Entities;

public class GrantReceipt
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid BudgetHeadId { get; set; }
    public DateOnly ReceivedDate { get; set; }
    public decimal Amount { get; set; }
    public GrantReceiptType Type { get; set; }
    public Guid? ParentReceiptId { get; set; }
    public OverheadSubHead? SubHead { get; set; }
}
```

- [ ] **Step 3: Build to confirm compilation**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx`
Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add API/API.Domain/Entities/Project.cs API/API.Domain/Entities/Collaborator.cs API/API.Domain/Entities/BudgetHead.cs API/API.Domain/Entities/SanctionedEquipment.cs API/API.Domain/Entities/SanctionedManpowerPosition.cs API/API.Domain/Entities/GrantReceipt.cs API/API.Domain/Enums/ProjectType.cs API/API.Domain/Enums/BudgetHeadName.cs API/API.Domain/Enums/GrantReceiptType.cs API/API.Domain/Enums/OverheadSubHead.cs
git commit -m "Add Project/Grant domain entities and enums"
```

---

## Task 2: `IProjectYearCalculator` — financial-year-relative ordinal year

**Files:**
- Create: `API/API.Application/Projects/IProjectYearCalculator.cs`
- Create: `API/API.Application/Projects/ProjectYearCalculator.cs`
- Test: `API/API.Tests/Projects/ProjectYearCalculatorTests.cs`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure date logic).
- Produces (consumed by Task 5's `ProjectService` and Task 6's budget-summary logic):
  ```csharp
  public interface IProjectYearCalculator
  {
      int GetProjectYear(DateOnly projectStartDate, DateOnly transactionDate);
  }
  ```
  Semantics: Indian financial year runs April 1 – March 31. "Project year N" = the count of financial-year boundaries crossed between `projectStartDate`'s financial year and `transactionDate`'s financial year, plus 1 (so a transaction in the same financial year as the project start is "year 1"). A `transactionDate` before `projectStartDate` is invalid and throws `ArgumentException`.

- [ ] **Step 1: Write the failing tests**

`API/API.Tests/Projects/ProjectYearCalculatorTests.cs`:
```csharp
using API.Application.Projects;
using FluentAssertions;
using Xunit;

namespace API.Tests.Projects;

public class ProjectYearCalculatorTests
{
    private readonly ProjectYearCalculator _calculator = new();

    [Fact]
    public void GetProjectYear_SameFinancialYearAsStart_ReturnsYear1()
    {
        var start = new DateOnly(2024, 6, 15);
        var transaction = new DateOnly(2024, 11, 1);

        var year = _calculator.GetProjectYear(start, transaction);

        year.Should().Be(1);
    }

    [Fact]
    public void GetProjectYear_NextFinancialYear_ReturnsYear2()
    {
        var start = new DateOnly(2024, 6, 15);
        var transaction = new DateOnly(2025, 4, 2);

        var year = _calculator.GetProjectYear(start, transaction);

        year.Should().Be(2);
    }

    [Fact]
    public void GetProjectYear_StartInMarch_TransactionInAprilSameCalendarYear_ReturnsYear2()
    {
        var start = new DateOnly(2024, 3, 20);
        var transaction = new DateOnly(2024, 4, 5);

        var year = _calculator.GetProjectYear(start, transaction);

        year.Should().Be(2);
    }

    [Fact]
    public void GetProjectYear_ThreeFinancialYearsLater_ReturnsYear4()
    {
        var start = new DateOnly(2022, 5, 1);
        var transaction = new DateOnly(2025, 5, 1);

        var year = _calculator.GetProjectYear(start, transaction);

        year.Should().Be(4);
    }

    [Fact]
    public void GetProjectYear_TransactionBeforeStart_Throws()
    {
        var start = new DateOnly(2024, 6, 15);
        var transaction = new DateOnly(2024, 1, 1);

        var act = () => _calculator.GetProjectYear(start, transaction);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void GetProjectYear_SameDate_ReturnsYear1()
    {
        var date = new DateOnly(2024, 6, 15);

        var year = _calculator.GetProjectYear(date, date);

        year.Should().Be(1);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter ProjectYearCalculatorTests`
Expected: FAIL — compile error, `ProjectYearCalculator` doesn't exist.

- [ ] **Step 3: Write `IProjectYearCalculator`**

`API/API.Application/Projects/IProjectYearCalculator.cs`:
```csharp
namespace API.Application.Projects;

public interface IProjectYearCalculator
{
    int GetProjectYear(DateOnly projectStartDate, DateOnly transactionDate);
}
```

- [ ] **Step 4: Write `ProjectYearCalculator`**

`API/API.Application/Projects/ProjectYearCalculator.cs`:
```csharp
namespace API.Application.Projects;

public class ProjectYearCalculator : IProjectYearCalculator
{
    public int GetProjectYear(DateOnly projectStartDate, DateOnly transactionDate)
    {
        if (transactionDate < projectStartDate)
        {
            throw new ArgumentException(
                $"Transaction date {transactionDate} cannot be before project start date {projectStartDate}.",
                nameof(transactionDate));
        }

        var startFinancialYear = GetFinancialYearStart(projectStartDate);
        var transactionFinancialYear = GetFinancialYearStart(transactionDate);

        return transactionFinancialYear - startFinancialYear + 1;
    }

    private static int GetFinancialYearStart(DateOnly date)
    {
        return date.Month >= 4 ? date.Year : date.Year - 1;
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter ProjectYearCalculatorTests`
Expected: PASS — 6 tests passed.

- [ ] **Step 6: Commit**

```bash
git add API/API.Application/Projects/IProjectYearCalculator.cs API/API.Application/Projects/ProjectYearCalculator.cs API/API.Tests/Projects/ProjectYearCalculatorTests.cs
git commit -m "Add IProjectYearCalculator with financial-year-relative ordinal year logic"
```

---

## Task 3: `IOverheadSplitValidator` — server-side 40/40/20 validation

**Files:**
- Create: `API/API.Application/Projects/OverheadSplitValidationResult.cs`
- Create: `API/API.Application/Projects/IOverheadSplitValidator.cs`
- Create: `API/API.Application/Projects/OverheadSplitValidator.cs`
- Test: `API/API.Tests/Projects/OverheadSplitValidatorTests.cs`

**Interfaces:**
- Consumes: `OverheadSubHead` enum (Task 1).
- Produces (consumed by Task 5's `ProjectService.RecordGrantReceiptAsync`):
  ```csharp
  public record OverheadSplitValidationResult(bool IsValid, string? ErrorMessage)
  {
      public static OverheadSplitValidationResult Success() => new(true, null);
      public static OverheadSplitValidationResult Failure(string message) => new(false, message);
  }

  public interface IOverheadSplitValidator
  {
      OverheadSplitValidationResult Validate(decimal overheadAmount, IReadOnlyDictionary<OverheadSubHead, decimal> submittedSplit);
  }
  ```

- [ ] **Step 1: Write the failing tests**

`API/API.Tests/Projects/OverheadSplitValidatorTests.cs`:
```csharp
using API.Application.Projects;
using API.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace API.Tests.Projects;

public class OverheadSplitValidatorTests
{
    private readonly OverheadSplitValidator _validator = new();

    [Fact]
    public void Validate_ExactMatchingSplit_ReturnsSuccess()
    {
        var split = new Dictionary<OverheadSubHead, decimal>
        {
            [OverheadSubHead.Idf] = 4000m,
            [OverheadSubHead.Pdf] = 4000m,
            [OverheadSubHead.Ddf] = 2000m,
        };

        var result = _validator.Validate(10000m, split);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_SplitDoesNotSumToOverheadAmount_ReturnsFailure()
    {
        var split = new Dictionary<OverheadSubHead, decimal>
        {
            [OverheadSubHead.Idf] = 4000m,
            [OverheadSubHead.Pdf] = 4000m,
            [OverheadSubHead.Ddf] = 1000m,
        };

        var result = _validator.Validate(10000m, split);

        result.IsValid.Should().BeFalse();
        result.ErrorMessage.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Validate_SumMatchesButRatioWrong_ReturnsFailure()
    {
        var split = new Dictionary<OverheadSubHead, decimal>
        {
            [OverheadSubHead.Idf] = 5000m,
            [OverheadSubHead.Pdf] = 3000m,
            [OverheadSubHead.Ddf] = 2000m,
        };

        var result = _validator.Validate(10000m, split);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_MissingSubHead_ReturnsFailure()
    {
        var split = new Dictionary<OverheadSubHead, decimal>
        {
            [OverheadSubHead.Idf] = 4000m,
            [OverheadSubHead.Pdf] = 4000m,
        };

        var result = _validator.Validate(10000m, split);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_RoundedAmountsWithinTolerance_ReturnsSuccess()
    {
        var split = new Dictionary<OverheadSubHead, decimal>
        {
            [OverheadSubHead.Idf] = 3333.33m,
            [OverheadSubHead.Pdf] = 3333.33m,
            [OverheadSubHead.Ddf] = 1666.67m,
        };

        var result = _validator.Validate(8333.33m, split);

        result.IsValid.Should().BeTrue();
    }
}
```

Note: the 5th test's numbers are constructed so `8333.33 * 0.4 = 3333.332` rounds to `3333.33`, `8333.33 * 0.2 = 1666.666` rounds to `1666.67` — verify these are the exact values used so the "round to 2dp" comparison in the implementation matches.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter OverheadSplitValidatorTests`
Expected: FAIL — compile error, types don't exist.

- [ ] **Step 3: Write `OverheadSplitValidationResult` and `IOverheadSplitValidator`**

`API/API.Application/Projects/OverheadSplitValidationResult.cs`:
```csharp
namespace API.Application.Projects;

public record OverheadSplitValidationResult(bool IsValid, string? ErrorMessage)
{
    public static OverheadSplitValidationResult Success() => new(true, null);
    public static OverheadSplitValidationResult Failure(string message) => new(false, message);
}
```

`API/API.Application/Projects/IOverheadSplitValidator.cs`:
```csharp
using API.Domain.Enums;

namespace API.Application.Projects;

public interface IOverheadSplitValidator
{
    OverheadSplitValidationResult Validate(decimal overheadAmount, IReadOnlyDictionary<OverheadSubHead, decimal> submittedSplit);
}
```

- [ ] **Step 4: Write `OverheadSplitValidator`**

`API/API.Application/Projects/OverheadSplitValidator.cs`:
```csharp
using API.Domain.Enums;

namespace API.Application.Projects;

public class OverheadSplitValidator : IOverheadSplitValidator
{
    private static readonly IReadOnlyDictionary<OverheadSubHead, decimal> ExpectedRatios = new Dictionary<OverheadSubHead, decimal>
    {
        [OverheadSubHead.Idf] = 0.40m,
        [OverheadSubHead.Pdf] = 0.40m,
        [OverheadSubHead.Ddf] = 0.20m,
    };

    public OverheadSplitValidationResult Validate(decimal overheadAmount, IReadOnlyDictionary<OverheadSubHead, decimal> submittedSplit)
    {
        foreach (var subHead in ExpectedRatios.Keys)
        {
            if (!submittedSplit.ContainsKey(subHead))
            {
                return OverheadSplitValidationResult.Failure(
                    $"Missing required overhead sub-head '{subHead}'.");
            }
        }

        var submittedTotal = submittedSplit.Values.Sum();
        if (Math.Round(submittedTotal, 2) != Math.Round(overheadAmount, 2))
        {
            return OverheadSplitValidationResult.Failure(
                $"Overhead split totals {submittedTotal:F2} but must equal the overhead amount {overheadAmount:F2}.");
        }

        foreach (var (subHead, ratio) in ExpectedRatios)
        {
            var expectedAmount = Math.Round(overheadAmount * ratio, 2);
            var submittedAmount = Math.Round(submittedSplit[subHead], 2);

            if (expectedAmount != submittedAmount)
            {
                return OverheadSplitValidationResult.Failure(
                    $"Overhead sub-head '{subHead}' must be {expectedAmount:F2} ({ratio:P0} of {overheadAmount:F2}) but was {submittedAmount:F2}.");
            }
        }

        return OverheadSplitValidationResult.Success();
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter OverheadSplitValidatorTests`
Expected: PASS — 5 tests passed.

- [ ] **Step 6: Commit**

```bash
git add API/API.Application/Projects/OverheadSplitValidationResult.cs API/API.Application/Projects/IOverheadSplitValidator.cs API/API.Application/Projects/OverheadSplitValidator.cs API/API.Tests/Projects/OverheadSplitValidatorTests.cs
git commit -m "Add IOverheadSplitValidator enforcing server-side 40/40/20 IDF/PDF/DDF ratio"
```

---

## Task 4: EF Core configuration and migration

**Files:**
- Modify: `API/API.Infrastructure/Persistence/ApplicationDbContext.cs`

**Interfaces:**
- Consumes: all 6 entities from Task 1.
- Produces: `IApplicationDbContext` gains no new interface members in this task (the interface stays workflow/document-focused per Phase 1's design — Projects/Grants entities are accessed via `ApplicationDbContext`'s own `DbSet<T>` properties directly, added here, not through the cross-cutting interface). A new EF Core migration is generated and applied.

- [ ] **Step 1: Add the 6 new `DbSet` properties and `OnModelCreating` configuration**

Modify `API/API.Infrastructure/Persistence/ApplicationDbContext.cs` — add after the existing `Documents` DbSet property:

```csharp
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Collaborator> Collaborators => Set<Collaborator>();
    public DbSet<BudgetHead> BudgetHeads => Set<BudgetHead>();
    public DbSet<SanctionedEquipment> SanctionedEquipment => Set<SanctionedEquipment>();
    public DbSet<SanctionedManpowerPosition> SanctionedManpowerPositions => Set<SanctionedManpowerPosition>();
    public DbSet<GrantReceipt> GrantReceipts => Set<GrantReceipt>();
```

Add inside `OnModelCreating`, after the existing `Document` entity configuration block:

```csharp
        builder.Entity<Project>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasIndex(p => p.OwnerUserId);
            entity.HasMany(p => p.Collaborators)
                .WithOne()
                .HasForeignKey(c => c.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.BudgetHeads)
                .WithOne()
                .HasForeignKey(b => b.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.SanctionedEquipment)
                .WithOne()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.SanctionedManpowerPositions)
                .WithOne()
                .HasForeignKey(m => m.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.GrantReceipts)
                .WithOne()
                .HasForeignKey(g => g.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Collaborator>(entity =>
        {
            entity.HasKey(c => c.Id);
        });

        builder.Entity<BudgetHead>(entity =>
        {
            entity.HasKey(b => b.Id);
            entity.HasIndex(b => new { b.ProjectId, b.HeadName }).IsUnique();
        });

        builder.Entity<SanctionedEquipment>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        builder.Entity<SanctionedManpowerPosition>(entity =>
        {
            entity.HasKey(m => m.Id);
        });

        builder.Entity<GrantReceipt>(entity =>
        {
            entity.HasKey(g => g.Id);
            entity.HasIndex(g => g.BudgetHeadId);
            entity.HasOne<GrantReceipt>()
                .WithMany()
                .HasForeignKey(g => g.ParentReceiptId)
                .OnDelete(DeleteBehavior.Restrict);
        });
```

Add the required `using API.Domain.Entities;` is already present at the top of the file (Phase 1 already imports this namespace for `Document`/`WorkflowInstance` etc.) — no new using statements needed since `Project`, `Collaborator`, `BudgetHead`, `SanctionedEquipment`, `SanctionedManpowerPosition`, `GrantReceipt` all live in the same `API.Domain.Entities` namespace.

- [ ] **Step 2: Build to confirm compilation**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx`
Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Generate the migration**

Run:
```bash
cd D:/Projects/MNNITRNC
dotnet ef migrations add AddProjectsAndGrants --project API/API.Infrastructure --startup-project API/API/API.csproj --output-dir Persistence/Migrations
```
Expected: A new migration file is created containing `CreateTable` calls for `Projects`, `Collaborators`, `BudgetHeads`, `SanctionedEquipment`, `SanctionedManpowerPositions`, `GrantReceipts`, with the FK/cascade/unique-index configuration matching Step 1.

- [ ] **Step 4: Build to confirm the migration compiles**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx`
Expected: Build succeeded, 0 errors.

- [ ] **Step 5: Apply the migration to the real database**

The database connection string is configured via `dotnet user-secrets` on the `API/API/API.csproj` project (already set up from Phase 1 — do not print or hardcode the actual connection string anywhere). Apply it using the same env-var override pattern `ApplicationDbContextFactory` supports:

```bash
cd D:/Projects/MNNITRNC
MNNITRNC_CONNECTION_STRING="<the connection string, obtained by running: dotnet user-secrets list --project API/API/API.csproj>" dotnet ef database update --project API/API.Infrastructure --startup-project API/API/API.csproj
```
Expected: `Applying migration '..._AddProjectsAndGrants'.` then `Done.` with no errors. If no database is reachable in the execution environment, note this explicitly in the task report rather than silently skipping — this step should be attempted for real, not assumed.

- [ ] **Step 6: Commit**

```bash
git add API/API.Infrastructure/Persistence/ApplicationDbContext.cs API/API.Infrastructure/Persistence/Migrations
git commit -m "Add EF Core configuration and migration for Project/Grant entities"
```

---

## Task 5: `ProjectService` — CRUD with stable-ID upsert, soft delete, grant receipt recording

**Files:**
- Create: `API/API.Application/Projects/ProjectNotFoundException.cs`
- Create: `API/API.Application/Projects/ProjectAccessDeniedException.cs`
- Create: `API/API.Application/Projects/IProjectService.cs`
- Create: `API/API.Application/Projects/ProjectService.cs`
- Test: `API/API.Tests/Projects/ProjectServiceUpsertTests.cs`

**Interfaces:**
- Consumes: `IApplicationDbContext` (Phase 1), `IProjectYearCalculator` (Task 2), `IOverheadSplitValidator` (Task 3), all entities (Task 1).
- Produces (consumed by Task 6's `ProjectsController`):
  ```csharp
  public class ProjectNotFoundException(Guid projectId) : Exception($"Project '{projectId}' was not found.");
  public class ProjectAccessDeniedException(Guid projectId) : Exception($"Access to project '{projectId}' is denied.");

  public record CollaboratorInput(Guid? Id, string Institute, string Faculty);
  public record BudgetHeadInput(Guid? Id, BudgetHeadName HeadName, decimal Year1Amount, decimal Year2Amount, decimal Year3Amount);
  public record SanctionedEquipmentInput(Guid? Id, string Name, string Unit, decimal Amount);
  public record SanctionedManpowerPositionInput(Guid? Id, string Designation, int Positions, decimal Stipend, decimal Hra);

  public interface IProjectService
  {
      Task<Project> CreateAsync(Guid ownerUserId, ProjectType projectType, string sanctionNo, DateOnly sanctionDate, string projectTitle, DateOnly startDate, string agency, int durationMonths, decimal totalSanctioned, IReadOnlyList<CollaboratorInput> collaborators, IReadOnlyList<BudgetHeadInput> budgetHeads, IReadOnlyList<SanctionedEquipmentInput> equipment, IReadOnlyList<SanctionedManpowerPositionInput> manpower, CancellationToken ct = default);

      Task<Project?> GetAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default);

      Task<IReadOnlyList<Project>> ListForOwnerAsync(Guid ownerUserId, CancellationToken ct = default);

      Task<Project> UpdateAsync(Guid projectId, Guid requestingUserId, ProjectType projectType, string sanctionNo, DateOnly sanctionDate, string projectTitle, DateOnly startDate, string agency, int durationMonths, decimal totalSanctioned, IReadOnlyList<CollaboratorInput> collaborators, IReadOnlyList<BudgetHeadInput> budgetHeads, IReadOnlyList<SanctionedEquipmentInput> equipment, IReadOnlyList<SanctionedManpowerPositionInput> manpower, CancellationToken ct = default);

      Task SoftDeleteAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default);

      Task<GrantReceipt> RecordGrantReceiptAsync(Guid projectId, Guid requestingUserId, Guid budgetHeadId, DateOnly receivedDate, decimal amount, IReadOnlyDictionary<OverheadSubHead, decimal>? overheadSplit, CancellationToken ct = default);
  }
  ```

Upsert semantics for `UpdateAsync`'s child collections (budget heads, collaborators, equipment, manpower): for each input list, any item with a non-null `Id` matching an existing row is updated in place; any item with `Id = null` is inserted as new; any existing row whose `Id` does not appear in the input list is removed. This never does a blanket delete-all — existing `GrantReceipt.BudgetHeadId` FKs on `BudgetHead` rows that are matched-and-updated (not removed-and-reinserted) remain valid.

- [ ] **Step 1: Write the failing tests for the upsert diffing logic**

`API/API.Tests/Projects/ProjectServiceUpsertTests.cs`:
```csharp
using API.Application.Common;
using API.Application.Projects;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Projects;

public class ProjectServiceUpsertTests
{
    private static (ProjectService Service, TestProjectsDbContext Db) CreateService()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        var service = new ProjectService(db, new ProjectYearCalculator(), new OverheadSplitValidator());
        return (service, db);
    }

    private static async Task<Project> CreateSampleProjectAsync(ProjectService service, Guid ownerUserId)
    {
        return await service.CreateAsync(
            ownerUserId,
            ProjectType.TypeIResearch,
            "SAN-001",
            new DateOnly(2024, 6, 1),
            "Sample Project",
            new DateOnly(2024, 6, 1),
            "DST",
            36,
            1000000m,
            [new CollaboratorInput(null, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(null, BudgetHeadName.RecurringOverhead, 10000m, 10000m, 10000m)],
            [],
            []);
    }

    [Fact]
    public async Task UpdateAsync_KeepsSameBudgetHeadId_WhenIdIsPassedBackInUpdate()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var originalHeadId = project.BudgetHeads.Single().Id;

        var updated = await service.UpdateAsync(
            project.Id, ownerId, project.ProjectType, project.SanctionNo, project.SanctionDate,
            project.ProjectTitle, project.StartDate, project.Agency, project.DurationMonths, project.TotalSanctioned,
            [new CollaboratorInput(project.Collaborators.Single().Id, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(originalHeadId, BudgetHeadName.RecurringOverhead, 20000m, 20000m, 20000m)],
            [], []);

        updated.BudgetHeads.Single().Id.Should().Be(originalHeadId);
        updated.BudgetHeads.Single().Year1Amount.Should().Be(20000m);
    }

    [Fact]
    public async Task UpdateAsync_RemovesBudgetHead_WhenOmittedFromInputList()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var updated = await service.UpdateAsync(
            project.Id, ownerId, project.ProjectType, project.SanctionNo, project.SanctionDate,
            project.ProjectTitle, project.StartDate, project.Agency, project.DurationMonths, project.TotalSanctioned,
            [new CollaboratorInput(project.Collaborators.Single().Id, "IIT Delhi", "Dr. A Sharma")],
            [], [], []);

        updated.BudgetHeads.Should().BeEmpty();
    }

    [Fact]
    public async Task UpdateAsync_AddsNewBudgetHead_WhenIdIsNull()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var existingHeadId = project.BudgetHeads.Single().Id;

        var updated = await service.UpdateAsync(
            project.Id, ownerId, project.ProjectType, project.SanctionNo, project.SanctionDate,
            project.ProjectTitle, project.StartDate, project.Agency, project.DurationMonths, project.TotalSanctioned,
            [new CollaboratorInput(project.Collaborators.Single().Id, "IIT Delhi", "Dr. A Sharma")],
            [
                new BudgetHeadInput(existingHeadId, BudgetHeadName.RecurringOverhead, 10000m, 10000m, 10000m),
                new BudgetHeadInput(null, BudgetHeadName.RecurringConsumable, 5000m, 5000m, 5000m),
            ],
            [], []);

        updated.BudgetHeads.Should().HaveCount(2);
        updated.BudgetHeads.Should().Contain(h => h.Id == existingHeadId);
        updated.BudgetHeads.Should().Contain(h => h.HeadName == BudgetHeadName.RecurringConsumable && h.Id != existingHeadId);
    }

    [Fact]
    public async Task UpdateAsync_GrantReceiptBudgetHeadLink_SurvivesUpdateThatKeepsHead()
    {
        var (service, db) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        var receipt = await service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2024, 7, 1), 10000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 4000m,
                [OverheadSubHead.Pdf] = 4000m,
                [OverheadSubHead.Ddf] = 2000m,
            });

        await service.UpdateAsync(
            project.Id, ownerId, project.ProjectType, project.SanctionNo, project.SanctionDate,
            project.ProjectTitle, project.StartDate, project.Agency, project.DurationMonths, project.TotalSanctioned,
            [new CollaboratorInput(project.Collaborators.Single().Id, "IIT Delhi", "Dr. A Sharma")],
            [new BudgetHeadInput(headId, BudgetHeadName.RecurringOverhead, 15000m, 15000m, 15000m)],
            [], []);

        var reloadedReceipt = await db.GrantReceipts.FindAsync(receipt.Id);
        reloadedReceipt!.BudgetHeadId.Should().Be(headId);
    }

    [Fact]
    public async Task SoftDeleteAsync_SetsIsDeletedAndExcludesFromListForOwner()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        await service.SoftDeleteAsync(project.Id, ownerId);

        var list = await service.ListForOwnerAsync(ownerId);
        list.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAsync_DifferentOwner_ThrowsAccessDenied()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);

        var act = () => service.GetAsync(project.Id, otherUserId);

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task RecordGrantReceiptAsync_OverheadHeadWithInvalidSplit_ThrowsArgumentException()
    {
        var (service, _) = CreateService();
        var ownerId = Guid.NewGuid();
        var project = await CreateSampleProjectAsync(service, ownerId);
        var headId = project.BudgetHeads.Single().Id;

        var act = () => service.RecordGrantReceiptAsync(
            project.Id, ownerId, headId, new DateOnly(2024, 7, 1), 10000m,
            new Dictionary<OverheadSubHead, decimal>
            {
                [OverheadSubHead.Idf] = 5000m,
                [OverheadSubHead.Pdf] = 3000m,
                [OverheadSubHead.Ddf] = 2000m,
            });

        await act.Should().ThrowAsync<ArgumentException>();
    }
}
```

This test file references `TestProjectsDbContext` — add it now:

`API/API.Tests/Projects/TestProjectsDbContext.cs`:
```csharp
using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Tests.Projects;

public class TestProjectsDbContext(DbContextOptions<TestProjectsDbContext> options)
    : DbContext(options), IApplicationDbContext
{
    public DbSet<WorkflowInstance> WorkflowInstances => Set<WorkflowInstance>();
    public DbSet<WorkflowStep> WorkflowSteps => Set<WorkflowStep>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Collaborator> Collaborators => Set<Collaborator>();
    public DbSet<BudgetHead> BudgetHeads => Set<BudgetHead>();
    public DbSet<SanctionedEquipment> SanctionedEquipment => Set<SanctionedEquipment>();
    public DbSet<SanctionedManpowerPosition> SanctionedManpowerPositions => Set<SanctionedManpowerPosition>();
    public DbSet<GrantReceipt> GrantReceipts => Set<GrantReceipt>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<WorkflowInstance>(entity =>
        {
            entity.HasKey(w => w.Id);
            entity.HasMany(w => w.Steps).WithOne().HasForeignKey(s => s.WorkflowInstanceId);
        });
        builder.Entity<WorkflowStep>().HasKey(s => s.Id);
        builder.Entity<Document>().HasKey(d => d.Id);

        builder.Entity<Project>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasMany(p => p.Collaborators).WithOne().HasForeignKey(c => c.ProjectId);
            entity.HasMany(p => p.BudgetHeads).WithOne().HasForeignKey(b => b.ProjectId);
            entity.HasMany(p => p.SanctionedEquipment).WithOne().HasForeignKey(e => e.ProjectId);
            entity.HasMany(p => p.SanctionedManpowerPositions).WithOne().HasForeignKey(m => m.ProjectId);
            entity.HasMany(p => p.GrantReceipts).WithOne().HasForeignKey(g => g.ProjectId);
        });
        builder.Entity<Collaborator>().HasKey(c => c.Id);
        builder.Entity<BudgetHead>().HasKey(b => b.Id);
        builder.Entity<SanctionedEquipment>().HasKey(e => e.Id);
        builder.Entity<SanctionedManpowerPosition>().HasKey(m => m.Id);
        builder.Entity<GrantReceipt>().HasKey(g => g.Id);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter ProjectServiceUpsertTests`
Expected: FAIL — compile error, `ProjectService` and related types don't exist.

- [ ] **Step 3: Write the exception types**

`API/API.Application/Projects/ProjectNotFoundException.cs`:
```csharp
namespace API.Application.Projects;

public class ProjectNotFoundException(Guid projectId) : Exception($"Project '{projectId}' was not found.");
```

`API/API.Application/Projects/ProjectAccessDeniedException.cs`:
```csharp
namespace API.Application.Projects;

public class ProjectAccessDeniedException(Guid projectId) : Exception($"Access to project '{projectId}' is denied.");
```

- [ ] **Step 4: Write `IProjectService` with its input records**

`API/API.Application/Projects/IProjectService.cs`:
```csharp
using API.Domain.Entities;
using API.Domain.Enums;

namespace API.Application.Projects;

public record CollaboratorInput(Guid? Id, string Institute, string Faculty);
public record BudgetHeadInput(Guid? Id, BudgetHeadName HeadName, decimal Year1Amount, decimal Year2Amount, decimal Year3Amount);
public record SanctionedEquipmentInput(Guid? Id, string Name, string Unit, decimal Amount);
public record SanctionedManpowerPositionInput(Guid? Id, string Designation, int Positions, decimal Stipend, decimal Hra);

public interface IProjectService
{
    Task<Project> CreateAsync(
        Guid ownerUserId, ProjectType projectType, string sanctionNo, DateOnly sanctionDate,
        string projectTitle, DateOnly startDate, string agency, int durationMonths, decimal totalSanctioned,
        IReadOnlyList<CollaboratorInput> collaborators, IReadOnlyList<BudgetHeadInput> budgetHeads,
        IReadOnlyList<SanctionedEquipmentInput> equipment, IReadOnlyList<SanctionedManpowerPositionInput> manpower,
        CancellationToken ct = default);

    Task<Project?> GetAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default);

    Task<IReadOnlyList<Project>> ListForOwnerAsync(Guid ownerUserId, CancellationToken ct = default);

    Task<Project> UpdateAsync(
        Guid projectId, Guid requestingUserId, ProjectType projectType, string sanctionNo, DateOnly sanctionDate,
        string projectTitle, DateOnly startDate, string agency, int durationMonths, decimal totalSanctioned,
        IReadOnlyList<CollaboratorInput> collaborators, IReadOnlyList<BudgetHeadInput> budgetHeads,
        IReadOnlyList<SanctionedEquipmentInput> equipment, IReadOnlyList<SanctionedManpowerPositionInput> manpower,
        CancellationToken ct = default);

    Task SoftDeleteAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default);

    Task<GrantReceipt> RecordGrantReceiptAsync(
        Guid projectId, Guid requestingUserId, Guid budgetHeadId, DateOnly receivedDate, decimal amount,
        IReadOnlyDictionary<OverheadSubHead, decimal>? overheadSplit, CancellationToken ct = default);
}
```

- [ ] **Step 5: Write `ProjectService`**

`API/API.Application/Projects/ProjectService.cs`:
```csharp
using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Projects;

public class ProjectService(
    IApplicationDbContext db,
    IProjectYearCalculator yearCalculator,
    IOverheadSplitValidator overheadSplitValidator) : IProjectService
{
    public async Task<Project> CreateAsync(
        Guid ownerUserId, ProjectType projectType, string sanctionNo, DateOnly sanctionDate,
        string projectTitle, DateOnly startDate, string agency, int durationMonths, decimal totalSanctioned,
        IReadOnlyList<CollaboratorInput> collaborators, IReadOnlyList<BudgetHeadInput> budgetHeads,
        IReadOnlyList<SanctionedEquipmentInput> equipment, IReadOnlyList<SanctionedManpowerPositionInput> manpower,
        CancellationToken ct = default)
    {
        var project = new Project
        {
            Id = Guid.NewGuid(),
            OwnerUserId = ownerUserId,
            ProjectType = projectType,
            SanctionNo = sanctionNo,
            SanctionDate = sanctionDate,
            ProjectTitle = projectTitle,
            StartDate = startDate,
            Agency = agency,
            DurationMonths = durationMonths,
            TotalSanctioned = totalSanctioned,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        foreach (var c in collaborators)
        {
            project.Collaborators.Add(new Collaborator { Id = Guid.NewGuid(), ProjectId = project.Id, Institute = c.Institute, Faculty = c.Faculty });
        }

        foreach (var b in budgetHeads)
        {
            project.BudgetHeads.Add(new BudgetHead
            {
                Id = Guid.NewGuid(),
                ProjectId = project.Id,
                HeadName = b.HeadName,
                Year1Amount = b.Year1Amount,
                Year2Amount = b.Year2Amount,
                Year3Amount = b.Year3Amount,
                Total = b.Year1Amount + b.Year2Amount + b.Year3Amount,
            });
        }

        foreach (var e in equipment)
        {
            project.SanctionedEquipment.Add(new SanctionedEquipment { Id = Guid.NewGuid(), ProjectId = project.Id, Name = e.Name, Unit = e.Unit, Amount = e.Amount });
        }

        foreach (var m in manpower)
        {
            project.SanctionedManpowerPositions.Add(new SanctionedManpowerPosition
            {
                Id = Guid.NewGuid(),
                ProjectId = project.Id,
                Designation = m.Designation,
                Positions = m.Positions,
                Stipend = m.Stipend,
                Hra = m.Hra,
            });
        }

        db.Projects.Add(project);
        db.Collaborators.AddRange(project.Collaborators);
        db.BudgetHeads.AddRange(project.BudgetHeads);
        db.SanctionedEquipment.AddRange(project.SanctionedEquipment);
        db.SanctionedManpowerPositions.AddRange(project.SanctionedManpowerPositions);

        await db.SaveChangesAsync(ct);
        return project;
    }

    public async Task<Project?> GetAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default)
    {
        var project = await LoadProjectWithChildrenAsync(projectId, ct);
        if (project is null || project.IsDeleted)
        {
            return null;
        }

        if (project.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        return project;
    }

    public async Task<IReadOnlyList<Project>> ListForOwnerAsync(Guid ownerUserId, CancellationToken ct = default)
    {
        return await db.Projects
            .Where(p => p.OwnerUserId == ownerUserId && !p.IsDeleted)
            .ToListAsync(ct);
    }

    public async Task<Project> UpdateAsync(
        Guid projectId, Guid requestingUserId, ProjectType projectType, string sanctionNo, DateOnly sanctionDate,
        string projectTitle, DateOnly startDate, string agency, int durationMonths, decimal totalSanctioned,
        IReadOnlyList<CollaboratorInput> collaborators, IReadOnlyList<BudgetHeadInput> budgetHeads,
        IReadOnlyList<SanctionedEquipmentInput> equipment, IReadOnlyList<SanctionedManpowerPositionInput> manpower,
        CancellationToken ct = default)
    {
        var project = await LoadProjectWithChildrenAsync(projectId, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (project.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        project.ProjectType = projectType;
        project.SanctionNo = sanctionNo;
        project.SanctionDate = sanctionDate;
        project.ProjectTitle = projectTitle;
        project.StartDate = startDate;
        project.Agency = agency;
        project.DurationMonths = durationMonths;
        project.TotalSanctioned = totalSanctioned;

        UpsertCollaborators(project, collaborators);
        UpsertBudgetHeads(project, budgetHeads);
        UpsertEquipment(project, equipment);
        UpsertManpower(project, manpower);

        await db.SaveChangesAsync(ct);
        return project;
    }

    public async Task SoftDeleteAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (project.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        project.IsDeleted = true;
        project.DeletedAt = DateTimeOffset.UtcNow;
        project.DeletedByUserId = requestingUserId;

        await db.SaveChangesAsync(ct);
    }

    public async Task<GrantReceipt> RecordGrantReceiptAsync(
        Guid projectId, Guid requestingUserId, Guid budgetHeadId, DateOnly receivedDate, decimal amount,
        IReadOnlyDictionary<OverheadSubHead, decimal>? overheadSplit, CancellationToken ct = default)
    {
        var project = await LoadProjectWithChildrenAsync(projectId, ct)
            ?? throw new ProjectNotFoundException(projectId);

        if (project.OwnerUserId != requestingUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        var budgetHead = project.BudgetHeads.FirstOrDefault(b => b.Id == budgetHeadId)
            ?? throw new ArgumentException($"Budget head '{budgetHeadId}' does not belong to project '{projectId}'.", nameof(budgetHeadId));

        // Project year is computed but not persisted on GrantReceipt directly in this task;
        // it is derived on read (budget-summary) from ReceivedDate vs Project.StartDate.
        _ = yearCalculator.GetProjectYear(project.StartDate, receivedDate);

        var receipt = new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            BudgetHeadId = budgetHeadId,
            ReceivedDate = receivedDate,
            Amount = amount,
            Type = GrantReceiptType.Head,
        };

        db.GrantReceipts.Add(receipt);

        if (budgetHead.HeadName == BudgetHeadName.RecurringOverhead)
        {
            if (overheadSplit is null)
            {
                throw new ArgumentException("Overhead split is required when recording a receipt against the Overhead budget head.", nameof(overheadSplit));
            }

            var validation = overheadSplitValidator.Validate(amount, overheadSplit);
            if (!validation.IsValid)
            {
                throw new ArgumentException(validation.ErrorMessage, nameof(overheadSplit));
            }

            foreach (var (subHead, subAmount) in overheadSplit)
            {
                db.GrantReceipts.Add(new GrantReceipt
                {
                    Id = Guid.NewGuid(),
                    ProjectId = projectId,
                    BudgetHeadId = budgetHeadId,
                    ReceivedDate = receivedDate,
                    Amount = subAmount,
                    Type = GrantReceiptType.OverheadSplit,
                    ParentReceiptId = receipt.Id,
                    SubHead = subHead,
                });
            }
        }

        await db.SaveChangesAsync(ct);
        return receipt;
    }

    private async Task<Project?> LoadProjectWithChildrenAsync(Guid projectId, CancellationToken ct)
    {
        return await db.Projects
            .Include(p => p.Collaborators)
            .Include(p => p.BudgetHeads)
            .Include(p => p.SanctionedEquipment)
            .Include(p => p.SanctionedManpowerPositions)
            .Include(p => p.GrantReceipts)
            .FirstOrDefaultAsync(p => p.Id == projectId, ct);
    }

    private void UpsertCollaborators(Project project, IReadOnlyList<CollaboratorInput> inputs)
    {
        var inputIds = inputs.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToHashSet();
        foreach (var existing in project.Collaborators.Where(c => !inputIds.Contains(c.Id)).ToList())
        {
            project.Collaborators.Remove(existing);
            db.Collaborators.Remove(existing);
        }

        foreach (var input in inputs)
        {
            if (input.Id.HasValue)
            {
                var existing = project.Collaborators.First(c => c.Id == input.Id.Value);
                existing.Institute = input.Institute;
                existing.Faculty = input.Faculty;
            }
            else
            {
                var created = new Collaborator { Id = Guid.NewGuid(), ProjectId = project.Id, Institute = input.Institute, Faculty = input.Faculty };
                project.Collaborators.Add(created);
                db.Collaborators.Add(created);
            }
        }
    }

    private void UpsertBudgetHeads(Project project, IReadOnlyList<BudgetHeadInput> inputs)
    {
        var inputIds = inputs.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToHashSet();
        foreach (var existing in project.BudgetHeads.Where(b => !inputIds.Contains(b.Id)).ToList())
        {
            project.BudgetHeads.Remove(existing);
            db.BudgetHeads.Remove(existing);
        }

        foreach (var input in inputs)
        {
            var total = input.Year1Amount + input.Year2Amount + input.Year3Amount;
            if (input.Id.HasValue)
            {
                var existing = project.BudgetHeads.First(b => b.Id == input.Id.Value);
                existing.HeadName = input.HeadName;
                existing.Year1Amount = input.Year1Amount;
                existing.Year2Amount = input.Year2Amount;
                existing.Year3Amount = input.Year3Amount;
                existing.Total = total;
            }
            else
            {
                var created = new BudgetHead
                {
                    Id = Guid.NewGuid(),
                    ProjectId = project.Id,
                    HeadName = input.HeadName,
                    Year1Amount = input.Year1Amount,
                    Year2Amount = input.Year2Amount,
                    Year3Amount = input.Year3Amount,
                    Total = total,
                };
                project.BudgetHeads.Add(created);
                db.BudgetHeads.Add(created);
            }
        }
    }

    private void UpsertEquipment(Project project, IReadOnlyList<SanctionedEquipmentInput> inputs)
    {
        var inputIds = inputs.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToHashSet();
        foreach (var existing in project.SanctionedEquipment.Where(e => !inputIds.Contains(e.Id)).ToList())
        {
            project.SanctionedEquipment.Remove(existing);
            db.SanctionedEquipment.Remove(existing);
        }

        foreach (var input in inputs)
        {
            if (input.Id.HasValue)
            {
                var existing = project.SanctionedEquipment.First(e => e.Id == input.Id.Value);
                existing.Name = input.Name;
                existing.Unit = input.Unit;
                existing.Amount = input.Amount;
            }
            else
            {
                var created = new SanctionedEquipment { Id = Guid.NewGuid(), ProjectId = project.Id, Name = input.Name, Unit = input.Unit, Amount = input.Amount };
                project.SanctionedEquipment.Add(created);
                db.SanctionedEquipment.Add(created);
            }
        }
    }

    private void UpsertManpower(Project project, IReadOnlyList<SanctionedManpowerPositionInput> inputs)
    {
        var inputIds = inputs.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToHashSet();
        foreach (var existing in project.SanctionedManpowerPositions.Where(m => !inputIds.Contains(m.Id)).ToList())
        {
            project.SanctionedManpowerPositions.Remove(existing);
            db.SanctionedManpowerPositions.Remove(existing);
        }

        foreach (var input in inputs)
        {
            if (input.Id.HasValue)
            {
                var existing = project.SanctionedManpowerPositions.First(m => m.Id == input.Id.Value);
                existing.Designation = input.Designation;
                existing.Positions = input.Positions;
                existing.Stipend = input.Stipend;
                existing.Hra = input.Hra;
            }
            else
            {
                var created = new SanctionedManpowerPosition
                {
                    Id = Guid.NewGuid(),
                    ProjectId = project.Id,
                    Designation = input.Designation,
                    Positions = input.Positions,
                    Stipend = input.Stipend,
                    Hra = input.Hra,
                };
                project.SanctionedManpowerPositions.Add(created);
                db.SanctionedManpowerPositions.Add(created);
            }
        }
    }
}
```

Note: `GetAsync`'s access-check ordering (checking `IsDeleted` before `OwnerUserId`) is deliberate — a non-owner requesting a soft-deleted project sees "not found," not "access denied," avoiding leaking existence information.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter ProjectServiceUpsertTests`
Expected: PASS — 7 tests passed.

- [ ] **Step 7: Commit**

```bash
git add API/API.Application/Projects/ProjectNotFoundException.cs API/API.Application/Projects/ProjectAccessDeniedException.cs API/API.Application/Projects/IProjectService.cs API/API.Application/Projects/ProjectService.cs API/API.Tests/Projects/ProjectServiceUpsertTests.cs API/API.Tests/Projects/TestProjectsDbContext.cs
git commit -m "Add ProjectService with stable-ID upsert, soft delete, and grant receipt recording"
```

---

## Task 6: Budget summary reporting

**Files:**
- Create: `API/API.Application/Projects/IBudgetSummaryService.cs`
- Create: `API/API.Application/Projects/BudgetSummaryService.cs`
- Create: `API/API.Application/Projects/BudgetSummaryLine.cs`

**Interfaces:**
- Consumes: `IApplicationDbContext` (Phase 1, including the `Expenditure` entity — note: Phase 1's spec mentions `Expenditure` as owned by future Procurement/Travel slices; if `IApplicationDbContext`/`ApplicationDbContext` does not yet expose an `Expenditure` DbSet because no earlier task created it, this task must add a **minimal read-only `Expenditure` entity and DbSet** solely for this reporting join — not the full Procurement/Travel expenditure-writing logic, which remains out of scope. See Step 1.
- Produces (consumed by Task 7's `ProjectsController`):
  ```csharp
  public record BudgetSummaryLine(BudgetHeadName HeadName, int ProjectYear, decimal Sanctioned, decimal GrantReceived, decimal Spent, decimal Available);

  public interface IBudgetSummaryService
  {
      Task<IReadOnlyList<BudgetSummaryLine>> GetBudgetSummaryAsync(Guid projectId, CancellationToken ct = default);
  }
  ```

- [ ] **Step 1: Add a minimal read-only `Expenditure` entity if one does not already exist**

Check first: `grep -r "class Expenditure" API/API.Domain/Entities/` — if this returns a result, an `Expenditure` entity already exists (from a task not in this plan); skip to Step 2 and adapt the join in `BudgetSummaryService` to whatever shape it has, noting the adaptation in your task report. If it does NOT exist, create it now:

`API/API.Domain/Entities/Expenditure.cs`:
```csharp
namespace API.Domain.Entities;

public class Expenditure
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public required string SectionType { get; set; }
    public DateOnly TransactionDate { get; set; }
    public decimal Amount { get; set; }
}
```

This is intentionally minimal (no `PaymentMode`, `ReferenceNumber`, polymorphic `ItemId` etc. — those belong to whichever future slice owns writing to this table). Add to `ApplicationDbContext.cs`:
```csharp
    public DbSet<Expenditure> Expenditure => Set<Expenditure>();
```
and in `OnModelCreating`:
```csharp
        builder.Entity<Expenditure>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.ProjectId);
        });
```
Generate a migration for this addition alongside Task 4's migration (do this as part of Task 4's migration generation if this task runs after Task 4 chronologically — since this plan executes tasks in order, by the time this task runs Task 4's migration is already applied; generate a **second, small migration** here specifically for the `Expenditure` table):
```bash
cd D:/Projects/MNNITRNC
dotnet ef migrations add AddMinimalExpenditureTableForBudgetReporting --project API/API.Infrastructure --startup-project API/API/API.csproj --output-dir Persistence/Migrations
```
Apply it the same way as Task 4 Step 5 (env-var connection string override, `dotnet ef database update`).

- [ ] **Step 2: Write `BudgetSummaryLine` and `IBudgetSummaryService`**

`API/API.Application/Projects/BudgetSummaryLine.cs`:
```csharp
using API.Domain.Enums;

namespace API.Application.Projects;

public record BudgetSummaryLine(BudgetHeadName HeadName, int ProjectYear, decimal Sanctioned, decimal GrantReceived, decimal Spent, decimal Available);
```

`API/API.Application/Projects/IBudgetSummaryService.cs`:
```csharp
namespace API.Application.Projects;

public interface IBudgetSummaryService
{
    Task<IReadOnlyList<BudgetSummaryLine>> GetBudgetSummaryAsync(Guid projectId, CancellationToken ct = default);
}
```

- [ ] **Step 3: Write `BudgetSummaryService`**

`API/API.Application/Projects/BudgetSummaryService.cs`:
```csharp
using API.Application.Common;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Projects;

public class BudgetSummaryService(IApplicationDbContext db, IProjectYearCalculator yearCalculator) : IBudgetSummaryService
{
    private static readonly IReadOnlyDictionary<BudgetHeadName, string> HeadNameToSectionType = new Dictionary<BudgetHeadName, string>
    {
        [BudgetHeadName.RecurringConsumable] = "consumable",
        [BudgetHeadName.RecurringContingency] = "contingency",
        [BudgetHeadName.EquipmentNonRecurring] = "equipment",
        [BudgetHeadName.RecurringTravel] = "travel",
    };

    public async Task<IReadOnlyList<BudgetSummaryLine>> GetBudgetSummaryAsync(Guid projectId, CancellationToken ct = default)
    {
        var project = await db.Projects
            .Include(p => p.BudgetHeads)
            .Include(p => p.GrantReceipts)
            .FirstOrDefaultAsync(p => p.Id == projectId, ct)
            ?? throw new ProjectNotFoundException(projectId);

        var expenditureRows = await db.Expenditure
            .Where(e => e.ProjectId == projectId)
            .ToListAsync(ct);

        var results = new List<BudgetSummaryLine>();

        foreach (var head in project.BudgetHeads)
        {
            var yearlyAmounts = new[] { head.Year1Amount, head.Year2Amount, head.Year3Amount };

            for (var yearIndex = 0; yearIndex < yearlyAmounts.Length; yearIndex++)
            {
                var projectYear = yearIndex + 1;
                var sanctioned = yearlyAmounts[yearIndex];

                var grantReceived = project.GrantReceipts
                    .Where(g => g.BudgetHeadId == head.Id && g.Type == Domain.Enums.GrantReceiptType.Head)
                    .Where(g => yearCalculator.GetProjectYear(project.StartDate, g.ReceivedDate) == projectYear)
                    .Sum(g => g.Amount);

                var spent = 0m;
                if (HeadNameToSectionType.TryGetValue(head.HeadName, out var sectionType))
                {
                    spent = expenditureRows
                        .Where(e => e.SectionType == sectionType)
                        .Where(e => yearCalculator.GetProjectYear(project.StartDate, e.TransactionDate) == projectYear)
                        .Sum(e => e.Amount);
                }

                results.Add(new BudgetSummaryLine(head.HeadName, projectYear, sanctioned, grantReceived, spent, grantReceived - spent));
            }
        }

        return results;
    }
}
```

- [ ] **Step 4: Build to confirm compilation**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx`
Expected: Build succeeded.

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx`
Expected: All tests pass (15 from Phase 1 + 6 + 5 + 7 from this plan's Tasks 2/3/5 = 33 total).

- [ ] **Step 6: Commit**

```bash
git add API/API.Domain/Entities/Expenditure.cs API/API.Infrastructure/Persistence/ApplicationDbContext.cs API/API.Infrastructure/Persistence/Migrations API/API.Application/Projects/BudgetSummaryLine.cs API/API.Application/Projects/IBudgetSummaryService.cs API/API.Application/Projects/BudgetSummaryService.cs
git commit -m "Add budget summary reporting (sanctioned/received/spent/available per head per year)"
```

---

## Task 7: `ProjectsController` and DTOs

**Files:**
- Create: `API/API/Contracts/Projects/CollaboratorDto.cs`
- Create: `API/API/Contracts/Projects/BudgetHeadDto.cs`
- Create: `API/API/Contracts/Projects/SanctionedEquipmentDto.cs`
- Create: `API/API/Contracts/Projects/SanctionedManpowerPositionDto.cs`
- Create: `API/API/Contracts/Projects/ProjectListItemResponse.cs`
- Create: `API/API/Contracts/Projects/ProjectDetailResponse.cs`
- Create: `API/API/Contracts/Projects/CreateProjectRequest.cs`
- Create: `API/API/Contracts/Projects/UpdateProjectRequest.cs`
- Create: `API/API/Contracts/Projects/BudgetSummaryResponse.cs`
- Create: `API/API/Contracts/Projects/GrantReceiptResponse.cs`
- Create: `API/API/Contracts/Projects/RecordGrantReceiptRequest.cs`
- Create: `API/API/Controllers/ProjectsController.cs`
- Create: `API/API/Middleware/ProjectExceptionMiddleware.cs`
- Modify: `API/API/Program.cs`

**Interfaces:**
- Consumes: `IProjectService` (Task 5), `IBudgetSummaryService` (Task 6), `ClaimsPrincipalExtensions.GetUserId()` (Phase 1).
- Produces: the REST API surface per the spec.

- [ ] **Step 1: Write the DTOs**

`API/API/Contracts/Projects/CollaboratorDto.cs`:
```csharp
namespace API.Contracts.Projects;

public record CollaboratorDto(Guid? Id, string Institute, string Faculty);
```

`API/API/Contracts/Projects/BudgetHeadDto.cs`:
```csharp
using API.Domain.Enums;

namespace API.Contracts.Projects;

public record BudgetHeadDto(Guid? Id, BudgetHeadName HeadName, decimal Year1Amount, decimal Year2Amount, decimal Year3Amount, decimal Total);
```

`API/API/Contracts/Projects/SanctionedEquipmentDto.cs`:
```csharp
namespace API.Contracts.Projects;

public record SanctionedEquipmentDto(Guid? Id, string Name, string Unit, decimal Amount);
```

`API/API/Contracts/Projects/SanctionedManpowerPositionDto.cs`:
```csharp
namespace API.Contracts.Projects;

public record SanctionedManpowerPositionDto(Guid? Id, string Designation, int Positions, decimal Stipend, decimal Hra);
```

`API/API/Contracts/Projects/ProjectListItemResponse.cs`:
```csharp
using API.Domain.Enums;

namespace API.Contracts.Projects;

public record ProjectListItemResponse(
    Guid Id, ProjectType ProjectType, string ProjectTitle, string Agency,
    decimal TotalSanctioned, DateOnly StartDate, int DurationMonths);
```

`API/API/Contracts/Projects/ProjectDetailResponse.cs`:
```csharp
using API.Domain.Enums;

namespace API.Contracts.Projects;

public record ProjectDetailResponse(
    Guid Id, ProjectType ProjectType, string SanctionNo, DateOnly SanctionDate, string ProjectTitle,
    DateOnly StartDate, string Agency, int DurationMonths, decimal TotalSanctioned,
    IReadOnlyList<CollaboratorDto> Collaborators, IReadOnlyList<BudgetHeadDto> BudgetHeads,
    IReadOnlyList<SanctionedEquipmentDto> SanctionedEquipment,
    IReadOnlyList<SanctionedManpowerPositionDto> SanctionedManpowerPositions);
```

`API/API/Contracts/Projects/CreateProjectRequest.cs`:
```csharp
using API.Domain.Enums;

namespace API.Contracts.Projects;

public record CreateProjectRequest(
    ProjectType ProjectType, string SanctionNo, DateOnly SanctionDate, string ProjectTitle,
    DateOnly StartDate, string Agency, int DurationMonths, decimal TotalSanctioned,
    IReadOnlyList<CollaboratorDto> Collaborators, IReadOnlyList<BudgetHeadDto> BudgetHeads,
    IReadOnlyList<SanctionedEquipmentDto> SanctionedEquipment,
    IReadOnlyList<SanctionedManpowerPositionDto> SanctionedManpowerPositions);
```

`API/API/Contracts/Projects/UpdateProjectRequest.cs`:
```csharp
using API.Domain.Enums;

namespace API.Contracts.Projects;

public record UpdateProjectRequest(
    ProjectType ProjectType, string SanctionNo, DateOnly SanctionDate, string ProjectTitle,
    DateOnly StartDate, string Agency, int DurationMonths, decimal TotalSanctioned,
    IReadOnlyList<CollaboratorDto> Collaborators, IReadOnlyList<BudgetHeadDto> BudgetHeads,
    IReadOnlyList<SanctionedEquipmentDto> SanctionedEquipment,
    IReadOnlyList<SanctionedManpowerPositionDto> SanctionedManpowerPositions);
```

`API/API/Contracts/Projects/BudgetSummaryResponse.cs`:
```csharp
using API.Domain.Enums;

namespace API.Contracts.Projects;

public record BudgetSummaryResponse(IReadOnlyList<BudgetSummaryLineDto> Lines);

public record BudgetSummaryLineDto(BudgetHeadName HeadName, int ProjectYear, decimal Sanctioned, decimal GrantReceived, decimal Spent, decimal Available);
```

`API/API/Contracts/Projects/GrantReceiptResponse.cs`:
```csharp
using API.Domain.Enums;

namespace API.Contracts.Projects;

public record GrantReceiptResponse(Guid Id, Guid BudgetHeadId, DateOnly ReceivedDate, decimal Amount, GrantReceiptType Type, Guid? ParentReceiptId, OverheadSubHead? SubHead);
```

`API/API/Contracts/Projects/RecordGrantReceiptRequest.cs`:
```csharp
using API.Domain.Enums;

namespace API.Contracts.Projects;

public record RecordGrantReceiptRequest(Guid BudgetHeadId, DateOnly ReceivedDate, decimal Amount, IReadOnlyDictionary<OverheadSubHead, decimal>? OverheadSplit);
```

- [ ] **Step 2: Write `ProjectsController`**

`API/API/Controllers/ProjectsController.cs`:
```csharp
using API.Application.Projects;
using API.Contracts.Projects;
using API.Domain.Entities;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize(Roles = "Faculty")]
public class ProjectsController(IProjectService projectService, IBudgetSummaryService budgetSummaryService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProjectListItemResponse>>> List()
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var projects = await projectService.ListForOwnerAsync(userId.Value);
        return Ok(projects.Select(ToListItem).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectDetailResponse>> Get(Guid id)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var project = await projectService.GetAsync(id, userId.Value);
        if (project is null)
        {
            return NotFound();
        }

        return Ok(ToDetail(project));
    }

    [HttpPost]
    public async Task<ActionResult<ProjectDetailResponse>> Create(CreateProjectRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var project = await projectService.CreateAsync(
            userId.Value, request.ProjectType, request.SanctionNo, request.SanctionDate, request.ProjectTitle,
            request.StartDate, request.Agency, request.DurationMonths, request.TotalSanctioned,
            request.Collaborators.Select(c => new CollaboratorInput(c.Id, c.Institute, c.Faculty)).ToList(),
            request.BudgetHeads.Select(b => new BudgetHeadInput(b.Id, b.HeadName, b.Year1Amount, b.Year2Amount, b.Year3Amount)).ToList(),
            request.SanctionedEquipment.Select(e => new SanctionedEquipmentInput(e.Id, e.Name, e.Unit, e.Amount)).ToList(),
            request.SanctionedManpowerPositions.Select(m => new SanctionedManpowerPositionInput(m.Id, m.Designation, m.Positions, m.Stipend, m.Hra)).ToList());

        return CreatedAtAction(nameof(Get), new { id = project.Id }, ToDetail(project));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectDetailResponse>> Update(Guid id, UpdateProjectRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var project = await projectService.UpdateAsync(
            id, userId.Value, request.ProjectType, request.SanctionNo, request.SanctionDate, request.ProjectTitle,
            request.StartDate, request.Agency, request.DurationMonths, request.TotalSanctioned,
            request.Collaborators.Select(c => new CollaboratorInput(c.Id, c.Institute, c.Faculty)).ToList(),
            request.BudgetHeads.Select(b => new BudgetHeadInput(b.Id, b.HeadName, b.Year1Amount, b.Year2Amount, b.Year3Amount)).ToList(),
            request.SanctionedEquipment.Select(e => new SanctionedEquipmentInput(e.Id, e.Name, e.Unit, e.Amount)).ToList(),
            request.SanctionedManpowerPositions.Select(m => new SanctionedManpowerPositionInput(m.Id, m.Designation, m.Positions, m.Stipend, m.Hra)).ToList());

        return Ok(ToDetail(project));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await projectService.SoftDeleteAsync(id, userId.Value);
        return NoContent();
    }

    [HttpGet("{id:guid}/budget-summary")]
    public async Task<ActionResult<BudgetSummaryResponse>> GetBudgetSummary(Guid id)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var project = await projectService.GetAsync(id, userId.Value);
        if (project is null)
        {
            return NotFound();
        }

        var lines = await budgetSummaryService.GetBudgetSummaryAsync(id);
        return Ok(new BudgetSummaryResponse(lines.Select(l => new BudgetSummaryLineDto(l.HeadName, l.ProjectYear, l.Sanctioned, l.GrantReceived, l.Spent, l.Available)).ToList()));
    }

    [HttpGet("{id:guid}/grant-receipts")]
    public async Task<ActionResult<IReadOnlyList<GrantReceiptResponse>>> ListGrantReceipts(Guid id)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var project = await projectService.GetAsync(id, userId.Value);
        if (project is null)
        {
            return NotFound();
        }

        return Ok(project.GrantReceipts.Select(g => new GrantReceiptResponse(g.Id, g.BudgetHeadId, g.ReceivedDate, g.Amount, g.Type, g.ParentReceiptId, g.SubHead)).ToList());
    }

    [HttpPost("{id:guid}/grant-receipts")]
    public async Task<ActionResult<GrantReceiptResponse>> RecordGrantReceipt(Guid id, RecordGrantReceiptRequest request)
    {
        var userId = User.GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var receipt = await projectService.RecordGrantReceiptAsync(
            id, userId.Value, request.BudgetHeadId, request.ReceivedDate, request.Amount, request.OverheadSplit);

        return Ok(new GrantReceiptResponse(receipt.Id, receipt.BudgetHeadId, receipt.ReceivedDate, receipt.Amount, receipt.Type, receipt.ParentReceiptId, receipt.SubHead));
    }

    private static ProjectListItemResponse ToListItem(Project p) =>
        new(p.Id, p.ProjectType, p.ProjectTitle, p.Agency, p.TotalSanctioned, p.StartDate, p.DurationMonths);

    private static ProjectDetailResponse ToDetail(Project p) => new(
        p.Id, p.ProjectType, p.SanctionNo, p.SanctionDate, p.ProjectTitle, p.StartDate, p.Agency,
        p.DurationMonths, p.TotalSanctioned,
        p.Collaborators.Select(c => new CollaboratorDto(c.Id, c.Institute, c.Faculty)).ToList(),
        p.BudgetHeads.Select(b => new BudgetHeadDto(b.Id, b.HeadName, b.Year1Amount, b.Year2Amount, b.Year3Amount, b.Total)).ToList(),
        p.SanctionedEquipment.Select(e => new SanctionedEquipmentDto(e.Id, e.Name, e.Unit, e.Amount)).ToList(),
        p.SanctionedManpowerPositions.Select(m => new SanctionedManpowerPositionDto(m.Id, m.Designation, m.Positions, m.Stipend, m.Hra)).ToList());
}
```

- [ ] **Step 3: Write `ProjectExceptionMiddleware`**

Following the exact pattern of Phase 1's `WorkflowExceptionMiddleware`:

`API/API/Middleware/ProjectExceptionMiddleware.cs`:
```csharp
using API.Application.Projects;
using Microsoft.AspNetCore.Mvc;

namespace API.Middleware;

/// <summary>
/// Catches Project/Grant domain exceptions (not found, access denied, validation) and translates
/// them into appropriate HTTP status codes instead of unhandled 500s.
/// </summary>
public class ProjectExceptionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ProjectNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Project not found", ex.Message);
        }
        catch (ProjectAccessDeniedException ex)
        {
            await WriteProblem(context, StatusCodes.Status403Forbidden, "Access denied", ex.Message);
        }
        catch (ArgumentException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Validation error", ex.Message);
        }
    }

    private static async Task WriteProblem(HttpContext context, int statusCode, string title, string detail)
    {
        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(problemDetails);
    }
}
```

- [ ] **Step 4: Register services and middleware in `Program.cs`**

Find the existing service registrations for `IWorkflowEngineService` etc. in `Program.cs` and add alongside them:
```csharp
builder.Services.AddScoped<IProjectYearCalculator, ProjectYearCalculator>();
builder.Services.AddScoped<IOverheadSplitValidator, OverheadSplitValidator>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IBudgetSummaryService, BudgetSummaryService>();
```
Add the corresponding `using API.Application.Projects;` at the top of `Program.cs`.

Find where `app.UseMiddleware<WorkflowExceptionMiddleware>();` (or equivalent) is registered and add immediately after it:
```csharp
app.UseMiddleware<ProjectExceptionMiddleware>();
```
Add `using API.Middleware;` if not already present (it should already be present since `WorkflowExceptionMiddleware` lives in the same namespace).

- [ ] **Step 5: Build to confirm compilation**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx`
Expected: Build succeeded, 0 errors.

- [ ] **Step 6: Manual live verification against the real database**

Get the connection string and start the app:
```bash
cd D:/Projects/MNNITRNC
dotnet user-secrets list --project API/API/API.csproj
```
Then, in `API/API`:
```bash
ASPNETCORE_ENVIRONMENT=Development dotnet run --urls http://localhost:5899
```
In a separate terminal, log in as faculty1 and use the returned token to create a project:
```bash
TOKEN=$(curl -s -X POST http://localhost:5899/api/auth/login -H "Content-Type: application/json" -d '{"userName":"faculty1","password":"Faculty@12345"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

curl -s -X POST http://localhost:5899/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectType": "TypeIResearch",
    "sanctionNo": "SAN-TEST-001",
    "sanctionDate": "2024-06-01",
    "projectTitle": "Test Project",
    "startDate": "2024-06-01",
    "agency": "DST",
    "durationMonths": 36,
    "totalSanctioned": 1000000,
    "collaborators": [],
    "budgetHeads": [{"id": null, "headName": "RecurringOverhead", "year1Amount": 10000, "year2Amount": 10000, "year3Amount": 10000, "total": 30000}],
    "sanctionedEquipment": [],
    "sanctionedManpowerPositions": []
  }' -w "\nHTTP_STATUS:%{http_code}\n"
```
Expected: `201` (or `200`, confirm actual `CreatedAtAction` behavior) with a JSON body containing the created project including a `budgetHeads` array with one entry.

Then confirm `GET /api/projects` returns it, and `GET /api/projects/{id}/budget-summary` returns 3 lines for the Overhead head (years 1/2/3) with `sanctioned` matching the input and `grantReceived`/`spent`/`available` all zero.

Stop the app process afterward (find the PID on port 5899 via `netstat`, `taskkill` only that PID).

- [ ] **Step 7: Commit**

```bash
git add API/API/Contracts/Projects API/API/Controllers/ProjectsController.cs API/API/Middleware/ProjectExceptionMiddleware.cs API/API/Program.cs
git commit -m "Add ProjectsController with full CRUD, grant receipts, and budget summary endpoints"
```

---

## Task 8: Full-solution verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx`
Expected: All tests pass.

- [ ] **Step 2: Run a full clean build**

Run: `cd D:/Projects/MNNITRNC && dotnet clean API/API.slnx && dotnet build API/API.slnx`
Expected: Build succeeded, 0 warnings related to nullable reference type violations in new code.

- [ ] **Step 3: Confirm the migration(s) applied cleanly to the real database**

Run: `MNNITRNC_CONNECTION_STRING="<connection string>" dotnet ef migrations list --project API/API.Infrastructure --startup-project API/API/API.csproj`
Expected: every migration generated in this plan (Tasks 4 and 6) is listed with no `(Pending)` marker.

- [ ] **Step 4: Confirm no plan step was skipped**

Check off any unchecked boxes above only after re-running the corresponding command and confirming the expected output.

---

## Self-Review Notes (for the plan author, not a task)

- **Spec coverage check**: entities/edit-upsert ✅ (Tasks 1, 5), soft delete ✅ (Task 5), overhead split server validation ✅ (Task 3, wired into Task 5), unified year semantics via `IProjectYearCalculator` ✅ (Task 2, consumed by Tasks 5 and 6), budget summary reporting ✅ (Task 6), sanctioned equipment/manpower as simple child entities ✅ (Task 1), owner-scoping ✅ (Task 5's `ProjectAccessDeniedException` checks, Task 7's `[Authorize(Roles = "Faculty")]` + `GetUserId()`). HOD/Dean broader-scope access and the underlying proposal/sanction approval workflow are explicitly out of scope per the spec — no task needed.
- **Type consistency**: `IProjectService`'s method signatures (Task 5) are consumed verbatim by `ProjectsController` (Task 7) — parameter order and types match. `IOverheadSplitValidator.Validate` (Task 3) is consumed with the exact same `IReadOnlyDictionary<OverheadSubHead, decimal>` shape in `ProjectService.RecordGrantReceiptAsync` (Task 5) and `RecordGrantReceiptRequest.OverheadSplit` (Task 7). `IProjectYearCalculator.GetProjectYear` (Task 2) is consumed identically in Task 5 (receipt recording — computed but not persisted, since `GrantReceipt` stores `ReceivedDate`, not `ProjectYear`, per the "auto-derive from date" decision) and Task 6 (budget summary — derives project-year per grant receipt and per expenditure row at read time).
- **Expenditure ownership caveat**: Task 6 adds a deliberately minimal `Expenditure` entity/table since no earlier plan (Phase 1) created one and this slice needs to read it for budget-summary reporting. This is flagged explicitly in Task 6 so the implementer checks for a pre-existing entity first rather than assuming — if a fuller `Expenditure` entity already exists by the time this plan executes (e.g., a Procurement/Travel slice landed first), Task 6 must adapt rather than create a conflicting duplicate.
