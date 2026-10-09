# Phase 3b: Indent Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend for consumable/contingency/equipment indent management — entities, server-computed GeM cost-tier selection, budget validation, committee tracking, indent raising with PDF generation, bill-phase processing, and the REST API — all on top of Phase 1's generic workflow engine.

**Architecture:** Three parallel entities (`ConsumableIndent`, `ContingencyIndent`, `EquipmentIndent`) per the spec's locked decision, each with its own service and controller. Cross-cutting procurement logic lives in two shared services: `IProcurementTierCalculator` (derives which Annexure applies from GeM availability + cost) and `IIndentBudgetValidator` (enforces the BRD's Available-Budget rule). Approval-chain actions reuse Phase 1's existing `WorkflowController`/`IWorkflowEngineService` unchanged — this plan only owns raise/read/bill-process and the procurement-specific validation around them.

**Tech Stack:** .NET 8, EF Core 8 + Pomelo/MySQL, xUnit + FluentAssertions. Consumes Phase 3a's `IDocumentGenerationService`, Phase 1's `IWorkflowEngineService`/`IDocumentStorageService`, and Phase 2's `IProjectYearCalculator`.

## Global Constraints

- Target framework `net8.0`, nullable + implicit usings enabled.
- Money is `decimal`, dates are `DateOnly` — matching Phase 2's conventions.
- **Cost tiers are always server-computed.** No client-submitted tier/annexure/`mode_of_purchase` value is ever trusted. Thresholds (from legacy, richer than the BRD's summary):
  - GeM: `<= 50_000` → Annexure 6; `> 50_000 && <= 100_000` → Annexure 7; `> 100_000` → Annexure 8.
  - Non-GeM: `<= 100_000` → Annexure 9; `> 100_000 && <= 200_000` → Annexure 10; `> 200_000 && <= 2_500_000` → Annexure 11.
  - `> 2_500_000` (non-GeM): rejected — bidding-only tier, out of scope per the spec.
- `GemAvailability` is a two-value enum (`Yes`/`No`). Legacy's dead third value `'na'` is deliberately not carried over.
- Non-Availability Certificate fields are required when `GemAvailability == No`, and `ValidityDate` must not be in the past.
- E-Way Bill number is required at bill-processing time when `EstimatedCost > 50_000`.
- All Faculty-facing endpoints are owner-scoped: a user may only act on indents belonging to their own projects. Reuse Phase 2's `ProjectAccessDeniedException` pattern.
- Cancellation is a workflow transition to `WorkflowStage.Cancelled` — never a row delete.
- Do not modify Phase 1's workflow engine or Phase 2's project/grant code. This plan only adds.

---

## File Structure

```
API/
  API.Domain/
    Entities/
      ConsumableIndent.cs                  (new)
      ContingencyIndent.cs                 (new)
      EquipmentIndent.cs                   (new)
      ProcurementCommittee.cs              (new)
      ProcurementCommitteeMember.cs        (new)
    Enums/
      GemAvailability.cs                   (new)
      IndentType.cs                        (new)
      CommitteeMemberRole.cs               (new)
  API.Application/
    Common/
      IApplicationDbContext.cs             (modify: add 5 DbSets)
    Procurement/
      IProcurementTierCalculator.cs        (new)
      ProcurementTierCalculator.cs         (new)
      BiddingTierNotSupportedException.cs  (new)
      IIndentBudgetValidator.cs            (new)
      IndentBudgetValidator.cs             (new)
      IndentBudgetSnapshot.cs              (new)
      InsufficientBudgetException.cs       (new)
      IndentNotFoundException.cs           (new)
      IIndentService.cs                    (new — shared contract, 3 impls)
      ConsumableIndentService.cs           (new)
      ContingencyIndentService.cs          (new)
      EquipmentIndentService.cs            (new)
  API.Infrastructure/
    Persistence/
      ApplicationDbContext.cs              (modify: DbSets + OnModelCreating)
      Migrations/                          (new migration)
  API/
    Contracts/Procurement/
      RaiseIndentRequest.cs                (new)
      IndentResponse.cs                    (new)
      IndentListItemResponse.cs            (new)
      ProcessBillRequest.cs                (new)
      CommitteeMemberDto.cs                (new)
      IndentBudgetSnapshotResponse.cs      (new)
    Controllers/
      ConsumableIndentsController.cs       (new)
      ContingencyIndentsController.cs      (new)
      EquipmentIndentsController.cs        (new)
    Middleware/
      ProcurementExceptionMiddleware.cs    (new)
    Program.cs                             (modify: DI + middleware)
  API.Tests/
    Procurement/
      ProcurementTierCalculatorTests.cs    (new)
      IndentBudgetValidatorTests.cs        (new)
      IndentServiceTests.cs                (new)
      TestProcurementDbContext.cs          (new)
```

---

## Task 1: Domain enums and entities

**Files:**
- Create: `API/API.Domain/Enums/GemAvailability.cs`
- Create: `API/API.Domain/Enums/IndentType.cs`
- Create: `API/API.Domain/Enums/CommitteeMemberRole.cs`
- Create: `API/API.Domain/Entities/ConsumableIndent.cs`
- Create: `API/API.Domain/Entities/ContingencyIndent.cs`
- Create: `API/API.Domain/Entities/EquipmentIndent.cs`
- Create: `API/API.Domain/Entities/ProcurementCommittee.cs`
- Create: `API/API.Domain/Entities/ProcurementCommitteeMember.cs`

**Interfaces:**
- Produces (consumed by every later task):
  - `enum GemAvailability { Yes, No }`
  - `enum IndentType { Consumable, Contingency, Equipment }`
  - `enum CommitteeMemberRole { Chairperson, FacultyMember, Indenter, RnCRepresentative, AdminRepresentative, FinanceRepresentative }`
  - Three indent entities with the shared shape below; `EquipmentIndent` additionally has `SanctionedEquipmentId (Guid)`.
  - `ProcurementCommittee` — `Id`, `IndentType`, `IndentId`, `Members`.
  - `ProcurementCommitteeMember` — `Id`, `ProcurementCommitteeId`, `Name`, `Role`.

- [ ] **Step 1: Write the three enums**

`API/API.Domain/Enums/GemAvailability.cs`:
```csharp
namespace API.Domain.Enums;

public enum GemAvailability
{
    Yes,
    No
}
```

`API/API.Domain/Enums/IndentType.cs`:
```csharp
namespace API.Domain.Enums;

public enum IndentType
{
    Consumable,
    Contingency,
    Equipment
}
```

`API/API.Domain/Enums/CommitteeMemberRole.cs`:
```csharp
namespace API.Domain.Enums;

public enum CommitteeMemberRole
{
    Chairperson,
    FacultyMember,
    Indenter,
    RnCRepresentative,
    AdminRepresentative,
    FinanceRepresentative
}
```

- [ ] **Step 2: Write `ConsumableIndent`**

`API/API.Domain/Entities/ConsumableIndent.cs`:
```csharp
using API.Domain.Enums;

namespace API.Domain.Entities;

public class ConsumableIndent
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid BudgetHeadId { get; set; }
    public Guid WorkflowInstanceId { get; set; }

    public required string Name { get; set; }
    public required string TechnicalSpecs { get; set; }
    public required string UnitOfMeasurement { get; set; }
    public int Quantity { get; set; }
    public required string Purpose { get; set; }
    public GemAvailability GemAvailability { get; set; }
    public decimal EstimatedCost { get; set; }

    public string? NonAvailabilityCertificateNumber { get; set; }
    public DateOnly? NonAvailabilityCertificateIssueDate { get; set; }
    public DateOnly? NonAvailabilityCertificateValidityDate { get; set; }

    public string? StockBookPage { get; set; }
    public string? StockDescription { get; set; }
    public string? StockQuantity { get; set; }
    public string? StockActualCost { get; set; }
    public string? StockCondition { get; set; }

    public string? OriginalBillReference { get; set; }
    public bool StockEntryConfirmed { get; set; }
    public string? EWayBillNumber { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
```

- [ ] **Step 3: Write `ContingencyIndent`**

Identical to `ConsumableIndent` in every field — copy the file, changing only the class name to `ContingencyIndent`. (The spec deliberately chose three parallel entities over a shared base; this duplication is the accepted cost of that decision.)

- [ ] **Step 4: Write `EquipmentIndent`**

Same as `ConsumableIndent`, with the class renamed and two additions: `public Guid SanctionedEquipmentId { get; set; }` (required FK to Phase 2's `SanctionedEquipment` — fixing legacy's missing constraint) and `public string? MeasurementBookNumber { get; set; }` (equipment-only bill-phase field per BRD A7.4).

- [ ] **Step 5: Write the committee entities**

`API/API.Domain/Entities/ProcurementCommittee.cs`:
```csharp
using API.Domain.Enums;

namespace API.Domain.Entities;

public class ProcurementCommittee
{
    public Guid Id { get; set; }
    public IndentType IndentType { get; set; }
    public Guid IndentId { get; set; }

    public ICollection<ProcurementCommitteeMember> Members { get; set; } = new List<ProcurementCommitteeMember>();
}
```

`API/API.Domain/Entities/ProcurementCommitteeMember.cs`:
```csharp
using API.Domain.Enums;

namespace API.Domain.Entities;

public class ProcurementCommitteeMember
{
    public Guid Id { get; set; }
    public Guid ProcurementCommitteeId { get; set; }
    public required string Name { get; set; }
    public CommitteeMemberRole Role { get; set; }
}
```

- [ ] **Step 6: Build**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx`
Expected: Build succeeded, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add API/API.Domain/Entities/ConsumableIndent.cs API/API.Domain/Entities/ContingencyIndent.cs API/API.Domain/Entities/EquipmentIndent.cs API/API.Domain/Entities/ProcurementCommittee.cs API/API.Domain/Entities/ProcurementCommitteeMember.cs API/API.Domain/Enums/GemAvailability.cs API/API.Domain/Enums/IndentType.cs API/API.Domain/Enums/CommitteeMemberRole.cs
git commit -m "Add procurement indent domain entities and enums"
```

---

## Task 2: `IProcurementTierCalculator`

**Files:**
- Create: `API/API.Application/Procurement/BiddingTierNotSupportedException.cs`
- Create: `API/API.Application/Procurement/IProcurementTierCalculator.cs`
- Create: `API/API.Application/Procurement/ProcurementTierCalculator.cs`
- Test: `API/API.Tests/Procurement/ProcurementTierCalculatorTests.cs`

**Interfaces:**
- Consumes: `GemAvailability` (Task 1), `ProcurementTier` (Phase 3a, `API.Application.Documents`).
- Produces (consumed by Task 5's indent services):
  ```csharp
  public class BiddingTierNotSupportedException(decimal estimatedCost)
      : Exception($"Indents above Rs. 25,00,000 (requested: {estimatedCost:F2}) must go through the bidding process, which is not supported.");

  public interface IProcurementTierCalculator
  {
      ProcurementTier DetermineTier(GemAvailability gemAvailability, decimal estimatedCost);
  }
  ```

- [ ] **Step 1: Write the failing tests**

`API/API.Tests/Procurement/ProcurementTierCalculatorTests.cs`:
```csharp
using API.Application.Documents;
using API.Application.Procurement;
using API.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace API.Tests.Procurement;

public class ProcurementTierCalculatorTests
{
    private readonly ProcurementTierCalculator _calculator = new();

    [Theory]
    [InlineData(1, ProcurementTier.GemUpTo50k)]
    [InlineData(50_000, ProcurementTier.GemUpTo50k)]
    [InlineData(50_001, ProcurementTier.Gem50kTo1Lakh)]
    [InlineData(100_000, ProcurementTier.Gem50kTo1Lakh)]
    [InlineData(100_001, ProcurementTier.GemAbove1Lakh)]
    [InlineData(5_000_000, ProcurementTier.GemAbove1Lakh)]
    public void DetermineTier_Gem_MapsCostToCorrectAnnexure(decimal cost, ProcurementTier expected)
    {
        _calculator.DetermineTier(GemAvailability.Yes, cost).Should().Be(expected);
    }

    [Theory]
    [InlineData(1, ProcurementTier.NonGemUpTo1Lakh)]
    [InlineData(100_000, ProcurementTier.NonGemUpTo1Lakh)]
    [InlineData(100_001, ProcurementTier.NonGem1LakhTo2Lakh)]
    [InlineData(200_000, ProcurementTier.NonGem1LakhTo2Lakh)]
    [InlineData(200_001, ProcurementTier.NonGem2LakhTo25Lakh)]
    [InlineData(2_500_000, ProcurementTier.NonGem2LakhTo25Lakh)]
    public void DetermineTier_NonGem_MapsCostToCorrectAnnexure(decimal cost, ProcurementTier expected)
    {
        _calculator.DetermineTier(GemAvailability.No, cost).Should().Be(expected);
    }

    [Fact]
    public void DetermineTier_NonGemAboveBiddingThreshold_Throws()
    {
        var act = () => _calculator.DetermineTier(GemAvailability.No, 2_500_001m);

        act.Should().Throw<BiddingTierNotSupportedException>();
    }

    [Fact]
    public void DetermineTier_ZeroOrNegativeCost_Throws()
    {
        var zero = () => _calculator.DetermineTier(GemAvailability.Yes, 0m);
        var negative = () => _calculator.DetermineTier(GemAvailability.Yes, -1m);

        zero.Should().Throw<ArgumentOutOfRangeException>();
        negative.Should().Throw<ArgumentOutOfRangeException>();
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter ProcurementTierCalculatorTests`
Expected: FAIL — compile error, types don't exist.

- [ ] **Step 3: Write the exception**

`API/API.Application/Procurement/BiddingTierNotSupportedException.cs`:
```csharp
namespace API.Application.Procurement;

public class BiddingTierNotSupportedException(decimal estimatedCost)
    : Exception($"Indents above Rs. 25,00,000 (requested: {estimatedCost:F2}) must go through the bidding process, which is not supported.");
```

- [ ] **Step 4: Write the interface and implementation**

`API/API.Application/Procurement/IProcurementTierCalculator.cs`:
```csharp
using API.Application.Documents;
using API.Domain.Enums;

namespace API.Application.Procurement;

public interface IProcurementTierCalculator
{
    ProcurementTier DetermineTier(GemAvailability gemAvailability, decimal estimatedCost);
}
```

`API/API.Application/Procurement/ProcurementTierCalculator.cs`:
```csharp
using API.Application.Documents;
using API.Domain.Enums;

namespace API.Application.Procurement;

/// <summary>
/// Derives which Annexure form applies from GeM availability and estimated cost.
/// Thresholds mirror the legacy system's actual behaviour. Unlike legacy — which
/// trusted a client-submitted mode_of_purchase string — this is computed server-side
/// on every call so the form and its approval routing cannot be spoofed.
/// </summary>
public class ProcurementTierCalculator : IProcurementTierCalculator
{
    private const decimal BiddingThreshold = 2_500_000m;

    public ProcurementTier DetermineTier(GemAvailability gemAvailability, decimal estimatedCost)
    {
        if (estimatedCost <= 0m)
        {
            throw new ArgumentOutOfRangeException(
                nameof(estimatedCost), estimatedCost, "Estimated cost must be greater than zero.");
        }

        if (gemAvailability == GemAvailability.Yes)
        {
            return estimatedCost switch
            {
                <= 50_000m => ProcurementTier.GemUpTo50k,
                <= 100_000m => ProcurementTier.Gem50kTo1Lakh,
                _ => ProcurementTier.GemAbove1Lakh,
            };
        }

        if (estimatedCost > BiddingThreshold)
        {
            throw new BiddingTierNotSupportedException(estimatedCost);
        }

        return estimatedCost switch
        {
            <= 100_000m => ProcurementTier.NonGemUpTo1Lakh,
            <= 200_000m => ProcurementTier.NonGem1LakhTo2Lakh,
            _ => ProcurementTier.NonGem2LakhTo25Lakh,
        };
    }
}
```

Note: the GeM path has no bidding cap — legacy's Annexure 8 covers "above Rs. 1,00,000" with no upper bound, and the tests assert that (a ₹50L GeM item still maps to Annexure 8). Only the non-GeM path has the ₹25L ceiling.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter ProcurementTierCalculatorTests`
Expected: PASS — 14 tests passed (6 + 6 theory cases + 2 facts).

- [ ] **Step 6: Commit**

```bash
git add API/API.Application/Procurement/BiddingTierNotSupportedException.cs API/API.Application/Procurement/IProcurementTierCalculator.cs API/API.Application/Procurement/ProcurementTierCalculator.cs API/API.Tests/Procurement/ProcurementTierCalculatorTests.cs
git commit -m "Add server-side procurement tier calculator replacing legacy client-trusted selection"
```

---

## Task 3: EF Core configuration and migration

**Files:**
- Modify: `API/API.Application/Common/IApplicationDbContext.cs`
- Modify: `API/API.Infrastructure/Persistence/ApplicationDbContext.cs`
- Modify: `API/API.Tests/Workflow/TestDbContext.cs`
- Modify: `API/API.Tests/Projects/TestProjectsDbContext.cs`

**Interfaces:**
- Consumes: all entities from Task 1.
- Produces: `IApplicationDbContext` gains `ConsumableIndents`, `ContingencyIndents`, `EquipmentIndents`, `ProcurementCommittees`, `ProcurementCommitteeMembers`. A new EF migration is generated and applied.

Note: both existing test DbContexts implement `IApplicationDbContext`, so adding interface members breaks them until they are updated too. That is why they are modified in this same task — Phase 2's plan hit exactly this and had to fix it mid-task.

- [ ] **Step 1: Add the DbSets to `IApplicationDbContext`**

Add to the interface (before `SaveChangesAsync`):
```csharp
    DbSet<ConsumableIndent> ConsumableIndents { get; }
    DbSet<ContingencyIndent> ContingencyIndents { get; }
    DbSet<EquipmentIndent> EquipmentIndents { get; }
    DbSet<ProcurementCommittee> ProcurementCommittees { get; }
    DbSet<ProcurementCommitteeMember> ProcurementCommitteeMembers { get; }
```

- [ ] **Step 2: Implement them in `ApplicationDbContext`**

Add the matching `public DbSet<T> X => Set<T>();` properties, then add to `OnModelCreating`:
```csharp
        builder.Entity<ConsumableIndent>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.ProjectId);
            entity.HasIndex(i => i.BudgetHeadId);
            entity.HasIndex(i => i.WorkflowInstanceId);
        });

        builder.Entity<ContingencyIndent>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.ProjectId);
            entity.HasIndex(i => i.BudgetHeadId);
            entity.HasIndex(i => i.WorkflowInstanceId);
        });

        builder.Entity<EquipmentIndent>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.ProjectId);
            entity.HasIndex(i => i.BudgetHeadId);
            entity.HasIndex(i => i.WorkflowInstanceId);
            entity.HasIndex(i => i.SanctionedEquipmentId);
            entity.HasOne<SanctionedEquipment>()
                .WithMany()
                .HasForeignKey(i => i.SanctionedEquipmentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<ProcurementCommittee>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.HasIndex(c => new { c.IndentType, c.IndentId });
            entity.HasMany(c => c.Members)
                .WithOne()
                .HasForeignKey(m => m.ProcurementCommitteeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ProcurementCommitteeMember>(entity =>
        {
            entity.HasKey(m => m.Id);
        });
```

- [ ] **Step 3: Update both test DbContexts**

Add the same 5 `DbSet` properties to `API/API.Tests/Workflow/TestDbContext.cs` and `API/API.Tests/Projects/TestProjectsDbContext.cs`, plus minimal `HasKey` configuration for each new entity in their `OnModelCreating` (mirroring how those files already handle Phase 2's entities).

- [ ] **Step 4: Build**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx`
Expected: Build succeeded, 0 errors.

- [ ] **Step 5: Generate the migration**

Run:
```bash
cd D:/Projects/MNNITRNC
dotnet ef migrations add AddProcurementIndents --project API/API.Infrastructure --startup-project API/API/API.csproj --output-dir Persistence/Migrations
```
Expected: a migration creating `ConsumableIndents`, `ContingencyIndents`, `EquipmentIndents`, `ProcurementCommittees`, `ProcurementCommitteeMembers` with the indexes and the `EquipmentIndents → SanctionedEquipment` FK.

- [ ] **Step 6: Apply the migration to the real database**

The connection string is in `dotnet user-secrets` on the `API` project (do not print or hardcode it). Apply via the env-var override the design-time factory supports:
```bash
cd D:/Projects/MNNITRNC
MNNITRNC_CONNECTION_STRING="<value from: dotnet user-secrets list --project API/API/API.csproj>" dotnet ef database update --project API/API.Infrastructure --startup-project API/API/API.csproj
```
Expected: `Applying migration '..._AddProcurementIndents'.` then `Done.` If no database is reachable, report that explicitly rather than silently skipping.

- [ ] **Step 7: Run the full test suite**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx`
Expected: all pre-existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add API/API.Application/Common/IApplicationDbContext.cs API/API.Infrastructure/Persistence API/API.Tests/Workflow/TestDbContext.cs API/API.Tests/Projects/TestProjectsDbContext.cs
git commit -m "Add EF Core configuration and migration for procurement indents"
```

---

## Task 4: `IIndentBudgetValidator`

**Files:**
- Create: `API/API.Application/Procurement/IndentBudgetSnapshot.cs`
- Create: `API/API.Application/Procurement/InsufficientBudgetException.cs`
- Create: `API/API.Application/Procurement/IIndentBudgetValidator.cs`
- Create: `API/API.Application/Procurement/IndentBudgetValidator.cs`
- Create: `API/API.Tests/Procurement/TestProcurementDbContext.cs`
- Test: `API/API.Tests/Procurement/IndentBudgetValidatorTests.cs`

**Interfaces:**
- Consumes: `IApplicationDbContext` (Task 3), Phase 2's `IProjectYearCalculator`, `BudgetHead`, `Expenditure`.
- Produces (consumed by Task 5):
  ```csharp
  public record IndentBudgetSnapshot(
      decimal Sanctioned, decimal Committed, decimal Paid, decimal Available);

  public class InsufficientBudgetException(decimal requested, IndentBudgetSnapshot snapshot)
      : Exception($"Requested {requested:F2} exceeds available budget {snapshot.Available:F2} " +
                  $"(sanctioned {snapshot.Sanctioned:F2}, committed {snapshot.Committed:F2}, paid {snapshot.Paid:F2}).");

  public interface IIndentBudgetValidator
  {
      Task<IndentBudgetSnapshot> GetSnapshotAsync(
          Guid budgetHeadId, DateOnly asOfDate, CancellationToken ct = default);

      Task EnsureSufficientAsync(
          Guid budgetHeadId, DateOnly asOfDate, decimal requestedAmount, CancellationToken ct = default);
  }
  ```

Semantics: `Sanctioned` is the budget head's amount for the project-year containing `asOfDate` (derived via `IProjectYearCalculator` from the owning project's `StartDate`). `Committed` is the sum of `EstimatedCost` across all three indent types against that budget head whose workflow instance is **not** in a terminal stage (`Approved`/`Rejected`/`Cancelled` — note an indent-phase `Approved` still counts as committed until it is paid, so terminal here means `Rejected` or `Cancelled`, plus bill-phase `Approved`). `Paid` is the sum of `Expenditure` rows for the project in that project-year. `Available = Sanctioned - Committed - Paid`.

- [ ] **Step 1: Write the test DbContext**

`API/API.Tests/Procurement/TestProcurementDbContext.cs`: same pattern as `TestProjectsDbContext` (implement `IApplicationDbContext` over EF Core InMemory, with `HasKey` configuration for every entity including Phase 1/2's). Copy `TestProjectsDbContext` and extend it with the 5 procurement DbSets.

- [ ] **Step 2: Write the failing tests**

`API/API.Tests/Procurement/IndentBudgetValidatorTests.cs`:
```csharp
using API.Application.Procurement;
using API.Application.Projects;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

public class IndentBudgetValidatorTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);
    private static readonly DateOnly InYearOne = new(2024, 7, 1);

    private static (IndentBudgetValidator Validator, TestProcurementDbContext Db, Guid BudgetHeadId) Create()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = Guid.NewGuid(),
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-1",
            SanctionDate = ProjectStart,
            ProjectTitle = "P",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 1_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = 100_000m,
            Year2Amount = 50_000m,
            Year3Amount = 0m,
            Total = 150_000m,
        });
        db.SaveChanges();

        return (new IndentBudgetValidator(db, new ProjectYearCalculator()), db, budgetHeadId);
    }

    [Fact]
    public async Task GetSnapshotAsync_NoIndentsOrExpenditure_AvailableEqualsSanctioned()
    {
        var (validator, _, headId) = Create();

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Sanctioned.Should().Be(100_000m);
        snapshot.Committed.Should().Be(0m);
        snapshot.Paid.Should().Be(0m);
        snapshot.Available.Should().Be(100_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_UsesTheCorrectProjectYearAmount()
    {
        var (validator, _, headId) = Create();

        var yearTwo = await validator.GetSnapshotAsync(headId, new DateOnly(2025, 7, 1));

        yearTwo.Sanctioned.Should().Be(50_000m);
    }

    [Fact]
    public async Task EnsureSufficientAsync_WithinBudget_DoesNotThrow()
    {
        var (validator, _, headId) = Create();

        var act = () => validator.EnsureSufficientAsync(headId, InYearOne, 99_000m);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task EnsureSufficientAsync_ExceedsBudget_Throws()
    {
        var (validator, _, headId) = Create();

        var act = () => validator.EnsureSufficientAsync(headId, InYearOne, 100_001m);

        await act.Should().ThrowAsync<InsufficientBudgetException>();
    }

    [Fact]
    public async Task GetSnapshotAsync_NonTerminalIndentCountsAsCommitted()
    {
        var (validator, db, headId) = Create();
        var project = db.Projects.Single();
        var workflowId = Guid.NewGuid();

        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = workflowId,
            RequestType = RequestType.Consumable,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.Forwarded,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.ConsumableIndents.Add(new ConsumableIndent
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = headId,
            WorkflowInstanceId = workflowId,
            Name = "Item",
            TechnicalSpecs = "Spec",
            UnitOfMeasurement = "Nos",
            Quantity = 1,
            Purpose = "Use",
            GemAvailability = GemAvailability.Yes,
            EstimatedCost = 30_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(CancellationToken.None);

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Committed.Should().Be(30_000m);
        snapshot.Available.Should().Be(70_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_CancelledIndentDoesNotCountAsCommitted()
    {
        var (validator, db, headId) = Create();
        var project = db.Projects.Single();
        var workflowId = Guid.NewGuid();

        db.WorkflowInstances.Add(new WorkflowInstance
        {
            Id = workflowId,
            RequestType = RequestType.Consumable,
            RequestId = Guid.NewGuid(),
            Phase = WorkflowPhase.Indent,
            CurrentStage = WorkflowStage.Cancelled,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.ConsumableIndents.Add(new ConsumableIndent
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            BudgetHeadId = headId,
            WorkflowInstanceId = workflowId,
            Name = "Item",
            TechnicalSpecs = "Spec",
            UnitOfMeasurement = "Nos",
            Quantity = 1,
            Purpose = "Use",
            GemAvailability = GemAvailability.Yes,
            EstimatedCost = 30_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(CancellationToken.None);

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Committed.Should().Be(0m);
        snapshot.Available.Should().Be(100_000m);
    }

    [Fact]
    public async Task GetSnapshotAsync_ExpenditureCountsAsPaid()
    {
        var (validator, db, headId) = Create();
        var project = db.Projects.Single();

        db.Expenditure.Add(new Expenditure
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            SectionType = "consumable",
            TransactionDate = InYearOne,
            Amount = 25_000m,
        });
        await db.SaveChangesAsync(CancellationToken.None);

        var snapshot = await validator.GetSnapshotAsync(headId, InYearOne);

        snapshot.Paid.Should().Be(25_000m);
        snapshot.Available.Should().Be(75_000m);
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter IndentBudgetValidatorTests`
Expected: FAIL — compile error, types don't exist.

- [ ] **Step 4: Write the snapshot record and exception**

`API/API.Application/Procurement/IndentBudgetSnapshot.cs`:
```csharp
namespace API.Application.Procurement;

public record IndentBudgetSnapshot(decimal Sanctioned, decimal Committed, decimal Paid, decimal Available);
```

`API/API.Application/Procurement/InsufficientBudgetException.cs`:
```csharp
namespace API.Application.Procurement;

public class InsufficientBudgetException(decimal requested, IndentBudgetSnapshot snapshot)
    : Exception($"Requested {requested:F2} exceeds available budget {snapshot.Available:F2} " +
                $"(sanctioned {snapshot.Sanctioned:F2}, committed {snapshot.Committed:F2}, paid {snapshot.Paid:F2}).");
```

- [ ] **Step 5: Write the interface and implementation**

`API/API.Application/Procurement/IIndentBudgetValidator.cs`:
```csharp
namespace API.Application.Procurement;

public interface IIndentBudgetValidator
{
    Task<IndentBudgetSnapshot> GetSnapshotAsync(Guid budgetHeadId, DateOnly asOfDate, CancellationToken ct = default);

    Task EnsureSufficientAsync(Guid budgetHeadId, DateOnly asOfDate, decimal requestedAmount, CancellationToken ct = default);
}
```

`API/API.Application/Procurement/IndentBudgetValidator.cs`:
```csharp
using API.Application.Common;
using API.Application.Projects;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Procurement;

/// <summary>
/// Enforces the BRD's "Available Budget &lt; Requested Amount" rule (A7.4), which the
/// legacy system never implemented — its procurement tables had no budget-head link at all.
/// </summary>
public class IndentBudgetValidator(
    IApplicationDbContext db,
    IProjectYearCalculator yearCalculator) : IIndentBudgetValidator
{
    private static readonly WorkflowStage[] TerminalStages =
        [WorkflowStage.Rejected, WorkflowStage.Cancelled];

    public async Task<IndentBudgetSnapshot> GetSnapshotAsync(
        Guid budgetHeadId, DateOnly asOfDate, CancellationToken ct = default)
    {
        var head = await db.BudgetHeads.FirstOrDefaultAsync(b => b.Id == budgetHeadId, ct)
            ?? throw new ArgumentException($"Budget head '{budgetHeadId}' was not found.", nameof(budgetHeadId));

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == head.ProjectId, ct)
            ?? throw new InvalidOperationException($"Project '{head.ProjectId}' for budget head '{budgetHeadId}' was not found.");

        var projectYear = yearCalculator.GetProjectYear(project.StartDate, asOfDate);
        var sanctioned = projectYear switch
        {
            1 => head.Year1Amount,
            2 => head.Year2Amount,
            3 => head.Year3Amount,
            _ => 0m,
        };

        var committed = await SumCommittedAsync(budgetHeadId, ct);

        var paid = (await db.Expenditure
                .Where(e => e.ProjectId == head.ProjectId)
                .ToListAsync(ct))
            .Where(e => yearCalculator.GetProjectYear(project.StartDate, e.TransactionDate) == projectYear)
            .Sum(e => e.Amount);

        return new IndentBudgetSnapshot(sanctioned, committed, paid, sanctioned - committed - paid);
    }

    public async Task EnsureSufficientAsync(
        Guid budgetHeadId, DateOnly asOfDate, decimal requestedAmount, CancellationToken ct = default)
    {
        var snapshot = await GetSnapshotAsync(budgetHeadId, asOfDate, ct);
        if (requestedAmount > snapshot.Available)
        {
            throw new InsufficientBudgetException(requestedAmount, snapshot);
        }
    }

    private async Task<decimal> SumCommittedAsync(Guid budgetHeadId, CancellationToken ct)
    {
        var activeWorkflowIds = await db.WorkflowInstances
            .Where(w => !TerminalStages.Contains(w.CurrentStage))
            .Select(w => w.Id)
            .ToListAsync(ct);

        var active = activeWorkflowIds.ToHashSet();

        var consumable = await db.ConsumableIndents
            .Where(i => i.BudgetHeadId == budgetHeadId)
            .Select(i => new { i.WorkflowInstanceId, i.EstimatedCost })
            .ToListAsync(ct);
        var contingency = await db.ContingencyIndents
            .Where(i => i.BudgetHeadId == budgetHeadId)
            .Select(i => new { i.WorkflowInstanceId, i.EstimatedCost })
            .ToListAsync(ct);
        var equipment = await db.EquipmentIndents
            .Where(i => i.BudgetHeadId == budgetHeadId)
            .Select(i => new { i.WorkflowInstanceId, i.EstimatedCost })
            .ToListAsync(ct);

        return consumable.Concat(contingency).Concat(equipment)
            .Where(i => active.Contains(i.WorkflowInstanceId))
            .Sum(i => i.EstimatedCost);
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter IndentBudgetValidatorTests`
Expected: PASS — 7 tests passed.

- [ ] **Step 7: Commit**

```bash
git add API/API.Application/Procurement/IndentBudgetSnapshot.cs API/API.Application/Procurement/InsufficientBudgetException.cs API/API.Application/Procurement/IIndentBudgetValidator.cs API/API.Application/Procurement/IndentBudgetValidator.cs API/API.Tests/Procurement/TestProcurementDbContext.cs API/API.Tests/Procurement/IndentBudgetValidatorTests.cs
git commit -m "Add indent budget validator implementing the BRD available-budget rule"
```

---

## Task 5: Indent services (raise, read, cancel-support, bill processing)

**Files:**
- Create: `API/API.Application/Procurement/IndentNotFoundException.cs`
- Create: `API/API.Application/Procurement/IIndentService.cs`
- Create: `API/API.Application/Procurement/ConsumableIndentService.cs`
- Create: `API/API.Application/Procurement/ContingencyIndentService.cs`
- Create: `API/API.Application/Procurement/EquipmentIndentService.cs`
- Test: `API/API.Tests/Procurement/IndentServiceTests.cs`

**Interfaces:**
- Consumes: `IProcurementTierCalculator` (Task 2), `IIndentBudgetValidator` (Task 4), `IApplicationDbContext` (Task 3), Phase 1's `IWorkflowEngineService`/`IDocumentStorageService`, Phase 3a's `IDocumentGenerationService`, Phase 2's `ProjectAccessDeniedException`.
- Produces (consumed by Task 6's controllers):
  ```csharp
  public record RaiseIndentInput(
      Guid ProjectId, Guid BudgetHeadId, string Name, string TechnicalSpecs,
      string UnitOfMeasurement, int Quantity, string Purpose,
      GemAvailability GemAvailability, decimal EstimatedCost,
      string? NonAvailabilityCertificateNumber,
      DateOnly? NonAvailabilityCertificateIssueDate,
      DateOnly? NonAvailabilityCertificateValidityDate,
      Guid? SanctionedEquipmentId,
      IReadOnlyList<(string Name, CommitteeMemberRole Role)> CommitteeMembers,
      byte[]? GemQuotationPdf);

  public record ProcessBillInput(
      string OriginalBillReference, bool StockEntryConfirmed,
      string? EWayBillNumber, string? MeasurementBookNumber,
      string? StockBookPage, string? StockDescription,
      string? StockQuantity, string? StockActualCost, string? StockCondition);

  public record IndentSummary(
      Guid Id, Guid ProjectId, Guid BudgetHeadId, Guid WorkflowInstanceId,
      string Name, decimal EstimatedCost, GemAvailability GemAvailability,
      ProcurementTier Tier, WorkflowStage CurrentStage, DateTimeOffset CreatedAt);

  public interface IIndentService
  {
      Task<Guid> RaiseAsync(RaiseIndentInput input, Guid requestingUserId, CancellationToken ct = default);
      Task<IReadOnlyList<IndentSummary>> ListForProjectAsync(Guid projectId, Guid requestingUserId, CancellationToken ct = default);
      Task<IndentSummary> GetAsync(Guid indentId, Guid requestingUserId, CancellationToken ct = default);
      Task ProcessBillAsync(Guid indentId, ProcessBillInput input, Guid requestingUserId, CancellationToken ct = default);
  }
  ```

`RaiseAsync` sequence: verify project ownership → validate NAC fields when `GemAvailability == No` → compute tier → validate budget → persist the indent → persist committee members when the tier is `NonGem2LakhTo25Lakh` → generate the Annexure PDF (merging the GeM quotation when supplied) → store it via `IDocumentStorageService` and record a `Document` row → create the Indent-phase `WorkflowInstance` via `IWorkflowEngineService.RaiseAsync` → return the new indent's id.

`ProcessBillAsync`: require the indent's workflow instance to be `Phase == Indent && CurrentStage == Approved` (legacy's gate) → validate `EWayBillNumber` is present when `EstimatedCost > 50_000` → validate `MeasurementBookNumber` is present for equipment → persist bill fields → generate the bill cover letter and store it → raise a new Bill-phase `WorkflowInstance`.

- [ ] **Step 1: Write the failing tests**

First write the two test doubles, then the test class.

`API/API.Tests/Procurement/StubDocumentGenerationService.cs`:
```csharp
using API.Application.Documents;

namespace API.Tests.Procurement;

public class StubDocumentGenerationService : IDocumentGenerationService
{
    public static readonly byte[] FakePdf = "%PDF-1.4 stub"u8.ToArray();

    public List<(ProcurementTier Tier, IndentDocumentModel Model, byte[]? Quotation)> IndentCalls { get; } = [];
    public List<IndentDocumentModel> BillCoverLetterCalls { get; } = [];

    public Task<byte[]> GenerateIndentAsync(
        ProcurementTier tier, IndentDocumentModel model, byte[]? gemQuotationPdf = null, CancellationToken ct = default)
    {
        IndentCalls.Add((tier, model, gemQuotationPdf));
        return Task.FromResult(FakePdf);
    }

    public Task<byte[]> GenerateBillCoverLetterAsync(IndentDocumentModel model, CancellationToken ct = default)
    {
        BillCoverLetterCalls.Add(model);
        return Task.FromResult(FakePdf);
    }
}
```

`API/API.Tests/Procurement/StubDocumentStorageService.cs`:
```csharp
using API.Application.Documents;

namespace API.Tests.Procurement;

public class StubDocumentStorageService : IDocumentStorageService
{
    public List<(Guid DocumentId, int Version, string FileName)> Saved { get; } = [];

    public Task<string> SaveAsync(Guid documentId, int version, Stream content, string originalFileName, CancellationToken ct = default)
    {
        Saved.Add((documentId, version, originalFileName));
        return Task.FromResult($"{documentId}/v{version}.pdf");
    }

    public Task<Stream> OpenReadAsync(string storagePath, CancellationToken ct = default)
        => Task.FromResult<Stream>(new MemoryStream(StubDocumentGenerationService.FakePdf));

    public void Delete(string storagePath) { }
}
```

`API/API.Tests/Procurement/IndentServiceTests.cs`:
```csharp
using API.Application.Documents;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Procurement;

public class IndentServiceTests
{
    private static readonly DateOnly ProjectStart = new(2024, 6, 1);

    private sealed record Fixture(
        TestProcurementDbContext Db,
        ConsumableIndentService Consumable,
        ContingencyIndentService Contingency,
        EquipmentIndentService Equipment,
        WorkflowEngineService Workflow,
        StubDocumentGenerationService DocGen,
        Guid OwnerUserId,
        Guid ProjectId,
        Guid BudgetHeadId,
        Guid SanctionedEquipmentId);

    private static Fixture Create(decimal year1Budget = 1_000_000m)
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var ownerUserId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var budgetHeadId = Guid.NewGuid();
        var sanctionedEquipmentId = Guid.NewGuid();

        db.Projects.Add(new Project
        {
            Id = projectId,
            OwnerUserId = ownerUserId,
            ProjectType = ProjectType.TypeIResearch,
            SanctionNo = "SAN-1",
            SanctionDate = ProjectStart,
            ProjectTitle = "Test Project",
            StartDate = ProjectStart,
            Agency = "DST",
            DurationMonths = 36,
            TotalSanctioned = 5_000_000m,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.BudgetHeads.Add(new BudgetHead
        {
            Id = budgetHeadId,
            ProjectId = projectId,
            HeadName = BudgetHeadName.RecurringConsumable,
            Year1Amount = year1Budget,
            Year2Amount = year1Budget,
            Year3Amount = year1Budget,
            Total = year1Budget * 3,
        });
        db.SanctionedEquipment.Add(new SanctionedEquipment
        {
            Id = sanctionedEquipmentId,
            ProjectId = projectId,
            Name = "Vacuum Pump",
            Unit = "Nos",
            Amount = 300_000m,
        });
        db.SaveChanges();

        var yearCalculator = new ProjectYearCalculator();
        var tierCalculator = new ProcurementTierCalculator();
        var budgetValidator = new IndentBudgetValidator(db, yearCalculator);
        var workflow = new WorkflowEngineService(db);
        var docGen = new StubDocumentGenerationService();
        var storage = new StubDocumentStorageService();

        return new Fixture(
            db,
            new ConsumableIndentService(db, tierCalculator, budgetValidator, workflow, docGen, storage),
            new ContingencyIndentService(db, tierCalculator, budgetValidator, workflow, docGen, storage),
            new EquipmentIndentService(db, tierCalculator, budgetValidator, workflow, docGen, storage),
            workflow,
            docGen,
            ownerUserId,
            projectId,
            budgetHeadId,
            sanctionedEquipmentId);
    }

    private static RaiseIndentInput Input(
        Fixture f,
        decimal cost = 40_000m,
        GemAvailability gem = GemAvailability.Yes,
        string? certificateNumber = null,
        DateOnly? certificateValidity = null,
        Guid? sanctionedEquipmentId = null,
        IReadOnlyList<(string Name, CommitteeMemberRole Role)>? committee = null) =>
        new(
            ProjectId: f.ProjectId,
            BudgetHeadId: f.BudgetHeadId,
            Name: "Test Item",
            TechnicalSpecs: "Spec",
            UnitOfMeasurement: "Nos",
            Quantity: 1,
            Purpose: "Research use",
            GemAvailability: gem,
            EstimatedCost: cost,
            NonAvailabilityCertificateNumber: certificateNumber,
            NonAvailabilityCertificateIssueDate: null,
            NonAvailabilityCertificateValidityDate: certificateValidity,
            SanctionedEquipmentId: sanctionedEquipmentId,
            CommitteeMembers: committee ?? [],
            GemQuotationPdf: null);

    private static ProcessBillInput BillInput(
        string? eWayBillNumber = null, string? measurementBookNumber = null) =>
        new(
            OriginalBillReference: "BILL-1",
            StockEntryConfirmed: true,
            EWayBillNumber: eWayBillNumber,
            MeasurementBookNumber: measurementBookNumber,
            StockBookPage: "12",
            StockDescription: "Prior stock",
            StockQuantity: "1",
            StockActualCost: "30000",
            StockCondition: "Good");

    /// <summary>Drives an indent's workflow instance from Raised through to Approved.</summary>
    private static async Task ApproveIndentAsync(Fixture f, Guid workflowInstanceId)
    {
        var actor = Guid.NewGuid();
        await f.Workflow.UploadSignedCopyAsync(workflowInstanceId, actor, null);
        await f.Workflow.AssignAsync(workflowInstanceId, actor, actor, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, null);
        await f.Workflow.ForwardAsync(workflowInstanceId, actor, null);
        await f.Workflow.ApproveAsync(workflowInstanceId, actor, null);
    }

    [Fact]
    public async Task RaiseAsync_ValidConsumableIndent_PersistsIndentAndCreatesWorkflowInstance()
    {
        var f = Create();

        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        indent.EstimatedCost.Should().Be(40_000m);
        indent.ProjectId.Should().Be(f.ProjectId);

        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == indent.WorkflowInstanceId);
        instance.RequestType.Should().Be(RequestType.Consumable);
        instance.RequestId.Should().Be(indentId);
        instance.Phase.Should().Be(WorkflowPhase.Indent);
        instance.CurrentStage.Should().Be(WorkflowStage.Raised);

        f.DocGen.IndentCalls.Should().ContainSingle()
            .Which.Tier.Should().Be(ProcurementTier.GemUpTo50k);
    }

    [Fact]
    public async Task RaiseAsync_NonGemWithoutCertificateNumber_ThrowsArgumentException()
    {
        var f = Create();

        var act = () => f.Consumable.RaiseAsync(
            Input(f, gem: GemAvailability.No, certificateNumber: null), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RaiseAsync_NonGemWithExpiredCertificateValidity_ThrowsArgumentException()
    {
        var f = Create();
        var expired = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);

        var act = () => f.Consumable.RaiseAsync(
            Input(f, gem: GemAvailability.No, certificateNumber: "NAC-1", certificateValidity: expired),
            f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task RaiseAsync_ExceedingBudget_ThrowsInsufficientBudgetException()
    {
        var f = Create(year1Budget: 30_000m);

        var act = () => f.Consumable.RaiseAsync(Input(f, cost: 40_000m), f.OwnerUserId);

        await act.Should().ThrowAsync<InsufficientBudgetException>();
    }

    [Fact]
    public async Task RaiseAsync_NonGemAbove25Lakh_ThrowsBiddingTierNotSupportedException()
    {
        var f = Create(year1Budget: 10_000_000m);

        var act = () => f.Consumable.RaiseAsync(
            Input(f, cost: 3_000_000m, gem: GemAvailability.No, certificateNumber: "NAC-1"),
            f.OwnerUserId);

        await act.Should().ThrowAsync<BiddingTierNotSupportedException>();
    }

    [Fact]
    public async Task RaiseAsync_NonGem2LakhTo25LakhTier_PersistsCommitteeMembers()
    {
        var f = Create();
        var committee = new List<(string, CommitteeMemberRole)>
        {
            ("Prof. C Rao", CommitteeMemberRole.Chairperson),
            ("Dr. D Singh", CommitteeMemberRole.FacultyMember),
        };

        var indentId = await f.Consumable.RaiseAsync(
            Input(f, cost: 500_000m, gem: GemAvailability.No, certificateNumber: "NAC-1", committee: committee),
            f.OwnerUserId);

        var persisted = await f.Db.ProcurementCommittees
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.IndentType == IndentType.Consumable && c.IndentId == indentId);

        persisted.Should().NotBeNull();
        persisted!.Members.Should().HaveCount(2);
        persisted.Members.Select(m => m.Name).Should().Contain(["Prof. C Rao", "Dr. D Singh"]);
    }

    [Fact]
    public async Task RaiseAsync_GemTier_DoesNotPersistCommitteeMembers()
    {
        var f = Create();
        var committee = new List<(string, CommitteeMemberRole)>
        {
            ("Prof. C Rao", CommitteeMemberRole.Chairperson),
        };

        var indentId = await f.Consumable.RaiseAsync(
            Input(f, cost: 40_000m, gem: GemAvailability.Yes, committee: committee), f.OwnerUserId);

        var persisted = await f.Db.ProcurementCommittees
            .FirstOrDefaultAsync(c => c.IndentType == IndentType.Consumable && c.IndentId == indentId);

        persisted.Should().BeNull();
    }

    [Fact]
    public async Task RaiseAsync_DifferentProjectOwner_ThrowsProjectAccessDeniedException()
    {
        var f = Create();

        var act = () => f.Consumable.RaiseAsync(Input(f), Guid.NewGuid());

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task ProcessBillAsync_BeforeIndentApproved_Throws()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var act = () => f.Consumable.ProcessBillAsync(indentId, BillInput(), f.OwnerUserId);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task ProcessBillAsync_Above50kWithoutEWayBill_ThrowsArgumentException()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 60_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        await ApproveIndentAsync(f, indent.WorkflowInstanceId);

        var act = () => f.Consumable.ProcessBillAsync(indentId, BillInput(eWayBillNumber: null), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task ProcessBillAsync_Above50kWithEWayBill_CreatesBillPhaseWorkflowInstance()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 60_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        await ApproveIndentAsync(f, indent.WorkflowInstanceId);

        await f.Consumable.ProcessBillAsync(indentId, BillInput(eWayBillNumber: "EWB-123"), f.OwnerUserId);

        var billInstance = await f.Db.WorkflowInstances
            .FirstOrDefaultAsync(w => w.RequestId == indentId && w.Phase == WorkflowPhase.Bill);
        billInstance.Should().NotBeNull();

        var reloaded = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        reloaded.EWayBillNumber.Should().Be("EWB-123");
        reloaded.OriginalBillReference.Should().Be("BILL-1");
        f.DocGen.BillCoverLetterCalls.Should().ContainSingle();
    }

    [Fact]
    public async Task ProcessBillAsync_Below50kWithoutEWayBill_Succeeds()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f, cost: 40_000m), f.OwnerUserId);
        var indent = await f.Db.ConsumableIndents.FirstAsync(i => i.Id == indentId);
        await ApproveIndentAsync(f, indent.WorkflowInstanceId);

        var act = () => f.Consumable.ProcessBillAsync(indentId, BillInput(eWayBillNumber: null), f.OwnerUserId);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task GetAsync_DifferentOwner_ThrowsProjectAccessDeniedException()
    {
        var f = Create();
        var indentId = await f.Consumable.RaiseAsync(Input(f), f.OwnerUserId);

        var act = () => f.Consumable.GetAsync(indentId, Guid.NewGuid());

        await act.Should().ThrowAsync<ProjectAccessDeniedException>();
    }

    [Fact]
    public async Task RaiseAsync_Contingency_PersistsWithContingencyRequestType()
    {
        var f = Create();

        var indentId = await f.Contingency.RaiseAsync(Input(f), f.OwnerUserId);

        var indent = await f.Db.ContingencyIndents.FirstAsync(i => i.Id == indentId);
        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == indent.WorkflowInstanceId);
        instance.RequestType.Should().Be(RequestType.Contingency);
    }

    [Fact]
    public async Task RaiseAsync_Equipment_LinksToSanctionedEquipment()
    {
        var f = Create();

        var indentId = await f.Equipment.RaiseAsync(
            Input(f, sanctionedEquipmentId: f.SanctionedEquipmentId), f.OwnerUserId);

        var indent = await f.Db.EquipmentIndents.FirstAsync(i => i.Id == indentId);
        indent.SanctionedEquipmentId.Should().Be(f.SanctionedEquipmentId);

        var instance = await f.Db.WorkflowInstances.FirstAsync(w => w.Id == indent.WorkflowInstanceId);
        instance.RequestType.Should().Be(RequestType.Equipment);
    }

    [Fact]
    public async Task RaiseAsync_EquipmentWithoutSanctionedEquipmentId_ThrowsArgumentException()
    {
        var f = Create();

        var act = () => f.Equipment.RaiseAsync(Input(f, sanctionedEquipmentId: null), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task ProcessBillAsync_EquipmentWithoutMeasurementBookNumber_ThrowsArgumentException()
    {
        var f = Create();
        var indentId = await f.Equipment.RaiseAsync(
            Input(f, cost: 40_000m, sanctionedEquipmentId: f.SanctionedEquipmentId), f.OwnerUserId);
        var indent = await f.Db.EquipmentIndents.FirstAsync(i => i.Id == indentId);
        await ApproveIndentAsync(f, indent.WorkflowInstanceId);

        var act = () => f.Equipment.ProcessBillAsync(
            indentId, BillInput(measurementBookNumber: null), f.OwnerUserId);

        await act.Should().ThrowAsync<ArgumentException>();
    }
}
```

Note the constructor signature these tests assume for all three services:
`(IApplicationDbContext db, IProcurementTierCalculator tierCalculator, IIndentBudgetValidator budgetValidator, IWorkflowEngineService workflowEngine, IDocumentGenerationService documentGeneration, IDocumentStorageService documentStorage)`. Implement Steps 4–5 to match exactly, or adjust these tests if you deviate.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter IndentServiceTests`
Expected: FAIL — compile error, service types don't exist.

- [ ] **Step 3: Write `IndentNotFoundException` and `IIndentService`**

`API/API.Application/Procurement/IndentNotFoundException.cs`:
```csharp
namespace API.Application.Procurement;

public class IndentNotFoundException(Guid indentId) : Exception($"Indent '{indentId}' was not found.");
```

`API/API.Application/Procurement/IIndentService.cs`: the records and interface exactly as given in the Interfaces block above.

- [ ] **Step 4: Write `ConsumableIndentService`**

Implement `IIndentService` against `db.ConsumableIndents`, following the `RaiseAsync`/`ProcessBillAsync` sequences described above. Key details:
- Ownership check: load the `Project`, compare `OwnerUserId` to `requestingUserId`, throw Phase 2's `ProjectAccessDeniedException` on mismatch.
- NAC validation: when `GemAvailability == No`, require a non-empty `NonAvailabilityCertificateNumber`; if `NonAvailabilityCertificateValidityDate` is supplied it must be `>= DateOnly.FromDateTime(DateTime.UtcNow)`.
- Budget: call `EnsureSufficientAsync(input.BudgetHeadId, DateOnly.FromDateTime(DateTime.UtcNow), input.EstimatedCost, ct)`.
- Workflow: `await workflowEngine.RaiseAsync(RequestType.Consumable, indent.Id, WorkflowPhase.Indent, requestingUserId, ct)` and store the returned instance's `Id` on the indent.
- Document: build an `IndentDocumentModel` from the indent + project + the requesting user's profile fields, call `documentGeneration.GenerateIndentAsync(tier, model, input.GemQuotationPdf, ct)`, save via `documentStorage.SaveAsync(...)`, and add a `Document` row (`OwnerType = "ConsumableIndent"`, `OwnerId = indent.Id`, `Kind = DocumentKind.Indent`, `Version = 1`, `Status = DocumentStatus.Uploaded`).

- [ ] **Step 5: Write `ContingencyIndentService` and `EquipmentIndentService`**

Same implementation against `db.ContingencyIndents` / `db.EquipmentIndents`, with `RequestType.Contingency` / `RequestType.Equipment` and `OwnerType` strings `"ContingencyIndent"` / `"EquipmentIndent"`. `EquipmentIndentService` additionally: requires `input.SanctionedEquipmentId` to be non-null and to exist on the same project (throw `ArgumentException` otherwise), and requires `MeasurementBookNumber` in `ProcessBillAsync`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter IndentServiceTests`
Expected: PASS — all tests written in Step 1 pass.

- [ ] **Step 7: Commit**

```bash
git add API/API.Application/Procurement/IndentNotFoundException.cs API/API.Application/Procurement/IIndentService.cs API/API.Application/Procurement/ConsumableIndentService.cs API/API.Application/Procurement/ContingencyIndentService.cs API/API.Application/Procurement/EquipmentIndentService.cs API/API.Tests/Procurement/IndentServiceTests.cs
git commit -m "Add indent services with tier computation, budget validation, and bill processing"
```

---

## Task 6: Controllers, contracts, and exception middleware

**Files:**
- Create: `API/API/Contracts/Procurement/CommitteeMemberDto.cs`
- Create: `API/API/Contracts/Procurement/RaiseIndentRequest.cs`
- Create: `API/API/Contracts/Procurement/IndentResponse.cs`
- Create: `API/API/Contracts/Procurement/IndentListItemResponse.cs`
- Create: `API/API/Contracts/Procurement/ProcessBillRequest.cs`
- Create: `API/API/Contracts/Procurement/IndentBudgetSnapshotResponse.cs`
- Create: `API/API/Controllers/ConsumableIndentsController.cs`
- Create: `API/API/Controllers/ContingencyIndentsController.cs`
- Create: `API/API/Controllers/EquipmentIndentsController.cs`
- Create: `API/API/Middleware/ProcurementExceptionMiddleware.cs`
- Modify: `API/API/Program.cs`

**Interfaces:**
- Consumes: the three indent services (Task 5), `IIndentBudgetValidator` (Task 4), Phase 1's `ClaimsPrincipalExtensions.GetUserId()`.
- Produces: the REST surface described in the spec.

- [ ] **Step 1: Write the contracts**

Follow Phase 2's `Contracts/Projects` record style. `RaiseIndentRequest` carries the form fields plus `IReadOnlyList<CommitteeMemberDto> CommitteeMembers`; the GeM quotation arrives as a separate `IFormFile` on the action (multipart), not inside the JSON record. Note Phase 1's `DocumentsController.Upload` had to bind `IFormFile` through a wrapper model to keep Swagger generation working — apply the same pattern here: a single `[FromForm]` request model containing both the scalar fields and the `IFormFile`.

- [ ] **Step 2: Write `ConsumableIndentsController`**

```csharp
[ApiController]
[Route("api/consumable-indents")]
[Authorize(Roles = "Faculty")]
public class ConsumableIndentsController(
    ConsumableIndentService indentService,
    IIndentBudgetValidator budgetValidator) : ControllerBase
```
Actions:
- `POST /api/projects/{projectId:guid}/consumable-indents` — `[Consumes("multipart/form-data")]`, binds a single `[FromForm]` model, calls `RaiseAsync`, returns `CreatedAtAction`.
- `GET /api/projects/{projectId:guid}/consumable-indents` — list.
- `GET /api/consumable-indents/{id:guid}` — detail.
- `POST /api/consumable-indents/{id:guid}/process-bill` — bill processing.
- `GET /api/budget-heads/{budgetHeadId:guid}/indent-budget` — returns the `IndentBudgetSnapshot` so the UI can show availability before submitting. Put this on the consumable controller only (it is type-agnostic); do not duplicate it on the other two.

Use `User.GetUserId()` and return `Unauthorized()` when null, exactly as Phase 2's `ProjectsController` does.

- [ ] **Step 3: Write the other two controllers**

Same shape at `api/contingency-indents` and `api/equipment-indents`, minus the shared budget endpoint. `EquipmentIndentsController`'s raise model includes `SanctionedEquipmentId`, and its process-bill model includes `MeasurementBookNumber`.

- [ ] **Step 4: Write `ProcurementExceptionMiddleware`**

Follow `ProjectExceptionMiddleware`'s shape exactly (Phase 2), mapping:
- `IndentNotFoundException` → 404
- `InsufficientBudgetException` → 400 (title "Insufficient budget")
- `BiddingTierNotSupportedException` → 400 (title "Bidding tier not supported")

`ProjectAccessDeniedException` → 403 and generic `ArgumentException` → 400 are already handled by the existing `ProjectExceptionMiddleware`, which runs earlier in the pipeline — do not duplicate those cases here.

- [ ] **Step 5: Register everything in `Program.cs`**

```csharp
builder.Services.AddScoped<IProcurementTierCalculator, ProcurementTierCalculator>();
builder.Services.AddScoped<IIndentBudgetValidator, IndentBudgetValidator>();
builder.Services.AddScoped<ConsumableIndentService>();
builder.Services.AddScoped<ContingencyIndentService>();
builder.Services.AddScoped<EquipmentIndentService>();
```
And after the existing `ProjectExceptionMiddleware` registration:
```csharp
app.UseMiddleware<ProcurementExceptionMiddleware>();
```
Add `using API.Application.Procurement;`.

- [ ] **Step 6: Build and run the full suite**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx && dotnet test API/API.slnx`
Expected: Build succeeded; all tests pass.

- [ ] **Step 7: Live verification against the real database**

Start the API (`cd API/API && ASPNETCORE_ENVIRONMENT=Development dotnet run`), then with a `faculty1` token (`POST /api/auth/login`, `faculty1` / `Faculty@12345`):
1. Create a project with a `RecurringConsumable` budget head of ₹100,000 in year 1 (reuse Phase 2's projects endpoint).
2. `GET /api/budget-heads/{id}/indent-budget` — expect `available: 100000`.
3. Raise a consumable indent of ₹40,000 (GeM) — expect 201, and a generated indent PDF retrievable via the documents endpoint.
4. `GET /api/budget-heads/{id}/indent-budget` again — expect `committed: 40000`, `available: 60000`.
5. Raise a second indent of ₹70,000 — expect 400 with an insufficient-budget message.
6. Raise a non-GeM indent of ₹3,000,000 — expect 400 bidding-tier-not-supported.
7. Confirm Swagger still generates (`GET /swagger/v1/swagger.json` → 200) given the new multipart actions.
Paste real responses in your task report. Stop the app afterwards (find the PID by port via `netstat`, `taskkill` only that PID).

- [ ] **Step 8: Commit**

```bash
git add API/API/Contracts/Procurement API/API/Controllers/ConsumableIndentsController.cs API/API/Controllers/ContingencyIndentsController.cs API/API/Controllers/EquipmentIndentsController.cs API/API/Middleware/ProcurementExceptionMiddleware.cs API/API/Program.cs
git commit -m "Add procurement indent controllers, contracts, and exception middleware"
```

---

## Task 7: Full-solution verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx`
Expected: all tests pass — 33 from Phases 1–2, ~26 from Phase 3a, and 37 from this plan (14 tier calculator + 7 budget validator + 16 indent service).

- [ ] **Step 2: Clean build**

Run: `cd D:/Projects/MNNITRNC && dotnet clean API/API.slnx && dotnet build API/API.slnx`
Expected: Build succeeded, 0 warnings in new code.

- [ ] **Step 3: Confirm migrations are applied**

Run: `MNNITRNC_CONNECTION_STRING="<value>" dotnet ef migrations list --project API/API.Infrastructure --startup-project API/API/API.csproj`
Expected: every migration listed with no `(Pending)` marker.

- [ ] **Step 4: Confirm no plan step was skipped**

Check off unchecked boxes above only after re-running the corresponding command and confirming expected output.

---

## Self-Review Notes (for the plan author, not a task)

- **Spec coverage check**: three separate entities ✅ (Task 1), server-computed tier ✅ (Task 2), `EquipmentIndent → SanctionedEquipment` FK ✅ (Task 3), budget validation ✅ (Task 4), committee tracking ✅ (Tasks 1, 3, 5), GeM quotation merge ✅ (Task 5, via Phase 3a's service), bill-phase BRD fields ✅ (Tasks 1, 5), soft cancellation ✅ — no work needed, Phase 1's `CancelAsync` already transitions to `WorkflowStage.Cancelled` and Task 4's validator excludes cancelled indents from Committed. `GemAvailability` two-value enum ✅ (Task 1).
- **Type consistency**: `ProcurementTier` (Phase 3a) is consumed unchanged by `IProcurementTierCalculator` (Task 2) and `IIndentService.IndentSummary` (Task 5). `IndentBudgetSnapshot` (Task 4) is returned directly by the budget endpoint (Task 6). `IIndentService`'s records (Task 5) are mapped from the contracts in Task 6 — the contracts are separate types so the API surface can evolve independently of the service signature, matching how Phase 2 separated `Contracts/Projects` DTOs from `IProjectService` input records.
- **Deliberate seam with Phase 3a**: `IndentDocumentModel.BudgetHeadName` exists but Phase 3a's templates render the Office-Use Fund Availability block as legacy does (blank lines). Populating it with real `IndentBudgetSnapshot` figures is a natural follow-up but is not required by this plan's acceptance criteria; flagged so it is a conscious omission rather than an oversight.
- **Service constructor signature is pinned by Task 5's tests.** The test fixture constructs all three services with `(IApplicationDbContext, IProcurementTierCalculator, IIndentBudgetValidator, IWorkflowEngineService, IDocumentGenerationService, IDocumentStorageService)`. Steps 4–5 must match that ordering, and Task 6's DI registration depends on it too.
- **`ProcessBillAsync_BeforeIndentApproved_Throws` asserts on the base `Exception` type** rather than a specific one, because the guard could reasonably be expressed as either an `InvalidOperationException` or a `WorkflowTransitionException` depending on whether the check is made in the service or delegated to the workflow engine. Tighten the assertion once the implementation picks one.
