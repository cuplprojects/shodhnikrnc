# Phase 3c: Document Checklist Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a database-configurable document checklist — per `(RequestType, WorkflowPhase)`, seeded with the BRD's required documents — that reports which expected documents a request has and which it is missing, plus the additive `WorkflowStepResponse` fields the frontend's `ApprovalTimeline` needs.

**Architecture:** One new entity (`DocumentChecklistItem`) holding the configured expectations, seeded via `DbSeeder`. An `IDocumentChecklistService` joins configured items against existing `Document` rows for a given request to produce satisfied/unsatisfied state. Exposed on the existing `DocumentsController`. Advisory only — nothing here gates a workflow transition.

**Tech Stack:** .NET 8, EF Core 8 + Pomelo/MySQL, xUnit + FluentAssertions. Extends Phase 1's `Document`/`DocumentKind` and `WorkflowInstance` model; no changes to the workflow engine's behaviour.

## Global Constraints

- Target framework `net8.0`, nullable + implicit usings enabled.
- **Advisory, never blocking.** This plan must not add any check that prevents a workflow transition. The only document gates in the system remain the signed-copy-before-assign rule (Phase 1's engine) and the E-Way Bill >₹50,000 rule (Phase 3b's `ProcessBillAsync`). If a task seems to require blocking behaviour, that is a misreading — stop and report it.
- `WorkflowStepResponse` is extended **additively**. Do not rename or remove `Stage`, `Action`, `ActorUserId`, `Remarks`, or `Timestamp` — Phase 1's `WorkflowController` and any existing consumer depend on them.
- Checklist items are seeded, not hardcoded in application logic, so office staff can later change them without a deploy.
- `IsMandatory` is stored and returned but not enforced in this plan.
- Do not modify Phase 1's `IWorkflowEngineService`/`WorkflowEngineService`, Phase 2's project code, or Phase 3b's indent services.

## Context: why this exists

The frontend component `UI/src/components/DocumentUploader.jsx` was scaffolded against a checklist API that the backend never had. Rather than strip the component down to the existing API, the decision (recorded in `notes/specs/2026-08-08-procurement-indent-slice-design.md`) was to build the backend to match. `UI/src/components/ApprovalTimeline.jsx` has the same problem in miniature — it reads `stepName` and `sequenceOrder`, which `WorkflowStepResponse` does not expose. Task 5 adds those additively.

Note the component currently posts `subjectType`/`subjectId`/`uploadedByUserId` and queries by `workflowDefinitionId`. This plan does **not** adopt those names — the backend's existing vocabulary is `ownerType`/`ownerId` and `(requestType, phase, requestId)`. Phase 3d updates the component to match the API built here; the API is the source of truth, not the scaffold.

---

## File Structure

```
API/
  API.Domain/
    Entities/
      DocumentChecklistItem.cs             (new)
  API.Application/
    Common/
      IApplicationDbContext.cs             (modify: add DbSet)
    Documents/
      IDocumentChecklistService.cs         (new)
      DocumentChecklistService.cs          (new)
      DocumentChecklistResult.cs           (new)
  API.Infrastructure/
    Persistence/
      ApplicationDbContext.cs              (modify: DbSet + OnModelCreating)
      Migrations/                          (new migration)
  API/
    Contracts/Documents/
      DocumentChecklistResponse.cs         (new)
    Contracts/Workflow/
      WorkflowInstanceResponse.cs          (modify: extend WorkflowStepResponse)
    Controllers/
      DocumentsController.cs               (modify: add checklist endpoint)
      WorkflowController.cs                (modify: populate new step fields)
    Seed/
      DbSeeder.cs                          (modify: seed checklist items)
    Program.cs                             (modify: DI registration)
  API.Tests/
    Documents/
      DocumentChecklistServiceTests.cs     (new)
```

---

## Task 1: `DocumentChecklistItem` entity and EF configuration

**Files:**
- Create: `API/API.Domain/Entities/DocumentChecklistItem.cs`
- Modify: `API/API.Application/Common/IApplicationDbContext.cs`
- Modify: `API/API.Infrastructure/Persistence/ApplicationDbContext.cs`
- Modify: `API/API.Tests/Workflow/TestDbContext.cs`
- Modify: `API/API.Tests/Projects/TestProjectsDbContext.cs`
- Modify: `API/API.Tests/Procurement/TestProcurementDbContext.cs` (created by Phase 3b — if Phase 3b has not been executed yet, skip this file and note it in your report)

**Interfaces:**
- Consumes: Phase 1's `RequestType`, `WorkflowPhase`, `DocumentKind` enums.
- Produces:
  ```csharp
  public class DocumentChecklistItem
  {
      public Guid Id { get; set; }
      public RequestType RequestType { get; set; }
      public WorkflowPhase Phase { get; set; }
      public DocumentKind DocumentKind { get; set; }
      public required string Name { get; set; }
      public bool IsMandatory { get; set; }
      public int DisplayOrder { get; set; }
  }
  ```
  Satisfaction is derived, not stored: an item is satisfied for a given request when a `Document` row exists with a matching `Kind` for that request's `(OwnerType, OwnerId)`.

- [ ] **Step 1: Write the entity**

`API/API.Domain/Entities/DocumentChecklistItem.cs`:
```csharp
using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// A configured expectation that a request of a given type and phase should have a
/// document of a given kind. Satisfaction is computed by joining against Document rows;
/// it is not stored here. Advisory only — nothing gates a workflow transition on this.
/// </summary>
public class DocumentChecklistItem
{
    public Guid Id { get; set; }
    public RequestType RequestType { get; set; }
    public WorkflowPhase Phase { get; set; }
    public DocumentKind DocumentKind { get; set; }
    public required string Name { get; set; }
    public bool IsMandatory { get; set; }
    public int DisplayOrder { get; set; }
}
```

- [ ] **Step 2: Add the DbSet to `IApplicationDbContext`**

Add before `SaveChangesAsync`:
```csharp
    DbSet<DocumentChecklistItem> DocumentChecklistItems { get; }
```

- [ ] **Step 3: Implement it in `ApplicationDbContext`**

Add the property:
```csharp
    public DbSet<DocumentChecklistItem> DocumentChecklistItems => Set<DocumentChecklistItem>();
```
And in `OnModelCreating`:
```csharp
        builder.Entity<DocumentChecklistItem>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => new { i.RequestType, i.Phase });
        });
```

- [ ] **Step 4: Update every test DbContext**

Each test DbContext implements `IApplicationDbContext`, so all of them break until updated. Add the same `DbSet` property and a `builder.Entity<DocumentChecklistItem>().HasKey(i => i.Id);` line to:
- `API/API.Tests/Workflow/TestDbContext.cs`
- `API/API.Tests/Projects/TestProjectsDbContext.cs`
- `API/API.Tests/Procurement/TestProcurementDbContext.cs` (only if Phase 3b has been executed)

- [ ] **Step 5: Build**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx`
Expected: Build succeeded, 0 errors.

- [ ] **Step 6: Generate and apply the migration**

```bash
cd D:/Projects/MNNITRNC
dotnet ef migrations add AddDocumentChecklistItems --project API/API.Infrastructure --startup-project API/API/API.csproj --output-dir Persistence/Migrations
```
Then apply it, taking the connection string from user-secrets (do not print or hardcode it):
```bash
MNNITRNC_CONNECTION_STRING="<value from: dotnet user-secrets list --project API/API/API.csproj>" dotnet ef database update --project API/API.Infrastructure --startup-project API/API/API.csproj
```
Expected: `Applying migration '..._AddDocumentChecklistItems'.` then `Done.` If no database is reachable, report that explicitly rather than skipping silently.

- [ ] **Step 7: Run the full test suite**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx`
Expected: all pre-existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add API/API.Domain/Entities/DocumentChecklistItem.cs API/API.Application/Common/IApplicationDbContext.cs API/API.Infrastructure/Persistence API/API.Tests
git commit -m "Add DocumentChecklistItem entity and migration"
```

---

## Task 2: Seed the BRD's document requirements

**Files:**
- Modify: `API/API/Seed/DbSeeder.cs`

**Interfaces:**
- Consumes: `DocumentChecklistItem` (Task 1).
- Produces: idempotent seed data covering the BRD A7.4 procurement requirements plus the indent-phase signed copy.

Seed set (all `RequestType.Consumable`, `Contingency`, and `Equipment` unless noted):

| Phase | DocumentKind | Name | Mandatory | Order | Applies to |
|---|---|---|---|---|---|
| Indent | `Indent` | Generated Indent Form | true | 1 | all three |
| Indent | `SignedCopy` | Signed Indent Copy | true | 2 | all three |
| Indent | `GemQuotation` | GeM Quotation | false | 3 | all three |
| Bill | `CoverLetter` | Bill Cover Letter | true | 1 | all three |
| Bill | `SignedCopy` | Original Bill | true | 2 | all three |
| Bill | `SignedCopy` | Stock Entry Proof | false | 3 | all three |
| Bill | `SignedCopy` | Measurement Book | true | 4 | `Equipment` only |
| Bill | `SignedCopy` | E-Way Bill | false | 5 | all three |

Notes for the implementer: several Bill-phase items share `DocumentKind.SignedCopy` because Phase 1's `DocumentKind` enum has no finer-grained values for them. That is intentional for now — the `Name` distinguishes them for display, and satisfaction is evaluated per `DocumentKind`, so uploading one signed copy will satisfy all `SignedCopy` items in that phase. Record this limitation in your task report; a future slice may want to extend `DocumentKind` rather than overload it. Do **not** extend the enum in this plan — that would ripple into Phase 1 and 3b code this plan is constrained not to touch. E-Way Bill is marked non-mandatory here because its real enforcement is conditional (>₹50,000) and lives in Phase 3b's `ProcessBillAsync`; marking it mandatory would misrepresent it as always required.

- [ ] **Step 1: Add the seeding method**

Extend `DbSeeder` with a `SeedDocumentChecklistAsync(IApplicationDbContext db)` that inserts the rows above only when no `DocumentChecklistItem` rows exist for that `(RequestType, Phase, DocumentKind, Name)` combination — matching the idempotent style `DbSeeder` already uses for roles and users. Call it from the existing `SeedAsync` entry point.

- [ ] **Step 2: Build**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx`
Expected: Build succeeded.

- [ ] **Step 3: Verify seeding against the real database**

Start the API in Development (which runs the seeder):
```bash
cd D:/Projects/MNNITRNC/API/API
ASPNETCORE_ENVIRONMENT=Development dotnet run --urls http://localhost:5899
```
Once it is listening, stop it, then start it a second time — the seeder must not create duplicates on the second run. Verify the row count is stable across both runs (query the database directly, or add a temporary log line). Report the observed counts. Stop the app afterwards (find the PID by port via `netstat`, `taskkill` only that PID).

- [ ] **Step 4: Commit**

```bash
git add API/API/Seed/DbSeeder.cs
git commit -m "Seed document checklist items from the BRD document requirements"
```

---

## Task 3: `IDocumentChecklistService`

**Files:**
- Create: `API/API.Application/Documents/DocumentChecklistResult.cs`
- Create: `API/API.Application/Documents/IDocumentChecklistService.cs`
- Create: `API/API.Application/Documents/DocumentChecklistService.cs`
- Test: `API/API.Tests/Documents/DocumentChecklistServiceTests.cs`

**Interfaces:**
- Consumes: `IApplicationDbContext` (Task 1).
- Produces (consumed by Task 4's endpoint):
  ```csharp
  public record DocumentChecklistItemResult(
      Guid ChecklistItemId, string Name, DocumentKind DocumentKind,
      bool IsMandatory, bool IsSatisfied, int DisplayOrder);

  public record DocumentChecklistResult(
      RequestType RequestType, WorkflowPhase Phase, Guid RequestId,
      IReadOnlyList<DocumentChecklistItemResult> Items);

  public interface IDocumentChecklistService
  {
      Task<DocumentChecklistResult> GetChecklistAsync(
          RequestType requestType, WorkflowPhase phase, Guid requestId,
          string ownerType, CancellationToken ct = default);
  }
  ```
  `ownerType` is the `Document.OwnerType` string the caller uses for this request (e.g. `"ConsumableIndent"`), since `Document` rows are keyed by `(OwnerType, OwnerId)` rather than by request type.

- [ ] **Step 1: Write the failing tests**

`API/API.Tests/Documents/DocumentChecklistServiceTests.cs`:
```csharp
using API.Application.Documents;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Documents;

public class DocumentChecklistServiceTests
{
    private const string OwnerType = "ConsumableIndent";

    private static (DocumentChecklistService Service, TestDbContext Db) Create()
    {
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestDbContext(options);
        return (new DocumentChecklistService(db), db);
    }

    private static void SeedItems(TestDbContext db)
    {
        db.DocumentChecklistItems.AddRange(
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.Consumable,
                Phase = WorkflowPhase.Indent,
                DocumentKind = DocumentKind.Indent,
                Name = "Generated Indent Form",
                IsMandatory = true,
                DisplayOrder = 1,
            },
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.Consumable,
                Phase = WorkflowPhase.Indent,
                DocumentKind = DocumentKind.GemQuotation,
                Name = "GeM Quotation",
                IsMandatory = false,
                DisplayOrder = 2,
            },
            // Different phase — must not appear in Indent-phase results.
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.Consumable,
                Phase = WorkflowPhase.Bill,
                DocumentKind = DocumentKind.CoverLetter,
                Name = "Bill Cover Letter",
                IsMandatory = true,
                DisplayOrder = 1,
            },
            // Different request type — must not appear either.
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.Travel,
                Phase = WorkflowPhase.Indent,
                DocumentKind = DocumentKind.Indent,
                Name = "Travel Form",
                IsMandatory = true,
                DisplayOrder = 1,
            });
        db.SaveChanges();
    }

    private static void AddDocument(TestDbContext db, Guid ownerId, DocumentKind kind)
    {
        db.Documents.Add(new Document
        {
            Id = Guid.NewGuid(),
            OwnerType = OwnerType,
            OwnerId = ownerId,
            Kind = kind,
            Version = 1,
            Status = DocumentStatus.Uploaded,
            StoragePath = "path.pdf",
            UploadedByUserId = Guid.NewGuid(),
            UploadedAt = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task GetChecklistAsync_ReturnsOnlyItemsForTheRequestedTypeAndPhase()
    {
        var (service, db) = Create();
        SeedItems(db);

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, Guid.NewGuid(), OwnerType);

        result.Items.Should().HaveCount(2);
        result.Items.Select(i => i.Name)
            .Should().BeEquivalentTo(["Generated Indent Form", "GeM Quotation"]);
    }

    [Fact]
    public async Task GetChecklistAsync_NoDocuments_AllItemsUnsatisfied()
    {
        var (service, db) = Create();
        SeedItems(db);

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, Guid.NewGuid(), OwnerType);

        result.Items.Should().OnlyContain(i => !i.IsSatisfied);
    }

    [Fact]
    public async Task GetChecklistAsync_MatchingDocument_MarksThatItemSatisfied()
    {
        var (service, db) = Create();
        SeedItems(db);
        var requestId = Guid.NewGuid();
        AddDocument(db, requestId, DocumentKind.Indent);

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, requestId, OwnerType);

        result.Items.Single(i => i.DocumentKind == DocumentKind.Indent).IsSatisfied.Should().BeTrue();
        result.Items.Single(i => i.DocumentKind == DocumentKind.GemQuotation).IsSatisfied.Should().BeFalse();
    }

    [Fact]
    public async Task GetChecklistAsync_DocumentForADifferentRequest_DoesNotSatisfy()
    {
        var (service, db) = Create();
        SeedItems(db);
        AddDocument(db, Guid.NewGuid(), DocumentKind.Indent);

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, Guid.NewGuid(), OwnerType);

        result.Items.Should().OnlyContain(i => !i.IsSatisfied);
    }

    [Fact]
    public async Task GetChecklistAsync_ReturnsItemsInDisplayOrder()
    {
        var (service, db) = Create();
        SeedItems(db);

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, Guid.NewGuid(), OwnerType);

        result.Items.Select(i => i.DisplayOrder).Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task GetChecklistAsync_PreservesMandatoryFlag()
    {
        var (service, db) = Create();
        SeedItems(db);

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, Guid.NewGuid(), OwnerType);

        result.Items.Single(i => i.Name == "Generated Indent Form").IsMandatory.Should().BeTrue();
        result.Items.Single(i => i.Name == "GeM Quotation").IsMandatory.Should().BeFalse();
    }

    [Fact]
    public async Task GetChecklistAsync_NoConfiguredItems_ReturnsEmptyList()
    {
        var (service, _) = Create();

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, Guid.NewGuid(), OwnerType);

        result.Items.Should().BeEmpty();
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter DocumentChecklistServiceTests`
Expected: FAIL — compile error, the service types don't exist.

- [ ] **Step 3: Write the result records**

`API/API.Application/Documents/DocumentChecklistResult.cs`:
```csharp
using API.Domain.Enums;

namespace API.Application.Documents;

public record DocumentChecklistItemResult(
    Guid ChecklistItemId,
    string Name,
    DocumentKind DocumentKind,
    bool IsMandatory,
    bool IsSatisfied,
    int DisplayOrder);

public record DocumentChecklistResult(
    RequestType RequestType,
    WorkflowPhase Phase,
    Guid RequestId,
    IReadOnlyList<DocumentChecklistItemResult> Items);
```

- [ ] **Step 4: Write the interface**

`API/API.Application/Documents/IDocumentChecklistService.cs`:
```csharp
using API.Domain.Enums;

namespace API.Application.Documents;

public interface IDocumentChecklistService
{
    Task<DocumentChecklistResult> GetChecklistAsync(
        RequestType requestType,
        WorkflowPhase phase,
        Guid requestId,
        string ownerType,
        CancellationToken ct = default);
}
```

- [ ] **Step 5: Write the implementation**

`API/API.Application/Documents/DocumentChecklistService.cs`:
```csharp
using API.Application.Common;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Documents;

/// <summary>
/// Reports which configured documents a request has and which it is missing.
/// Advisory only — this never blocks a workflow transition.
/// </summary>
public class DocumentChecklistService(IApplicationDbContext db) : IDocumentChecklistService
{
    public async Task<DocumentChecklistResult> GetChecklistAsync(
        RequestType requestType,
        WorkflowPhase phase,
        Guid requestId,
        string ownerType,
        CancellationToken ct = default)
    {
        var configured = await db.DocumentChecklistItems
            .Where(i => i.RequestType == requestType && i.Phase == phase)
            .OrderBy(i => i.DisplayOrder)
            .ToListAsync(ct);

        var presentKinds = await db.Documents
            .Where(d => d.OwnerType == ownerType && d.OwnerId == requestId)
            .Select(d => d.Kind)
            .Distinct()
            .ToListAsync(ct);

        var present = presentKinds.ToHashSet();

        var items = configured
            .Select(i => new DocumentChecklistItemResult(
                i.Id,
                i.Name,
                i.DocumentKind,
                i.IsMandatory,
                present.Contains(i.DocumentKind),
                i.DisplayOrder))
            .ToList();

        return new DocumentChecklistResult(requestType, phase, requestId, items);
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx --filter DocumentChecklistServiceTests`
Expected: PASS — 7 tests passed.

- [ ] **Step 7: Commit**

```bash
git add API/API.Application/Documents/DocumentChecklistResult.cs API/API.Application/Documents/IDocumentChecklistService.cs API/API.Application/Documents/DocumentChecklistService.cs API/API.Tests/Documents/DocumentChecklistServiceTests.cs
git commit -m "Add document checklist service reporting satisfied and missing documents"
```

---

## Task 4: Checklist endpoint

**Files:**
- Create: `API/API/Contracts/Documents/DocumentChecklistResponse.cs`
- Modify: `API/API/Controllers/DocumentsController.cs`
- Modify: `API/API/Program.cs`

**Interfaces:**
- Consumes: `IDocumentChecklistService` (Task 3).
- Produces: `GET /api/documents/checklist?requestType=&phase=&requestId=&ownerType=` returning the checklist with satisfied state.

- [ ] **Step 1: Write the response contract**

`API/API/Contracts/Documents/DocumentChecklistResponse.cs`:
```csharp
using API.Domain.Enums;

namespace API.Contracts.Documents;

public record DocumentChecklistItemResponse(
    Guid ChecklistItemId,
    string Name,
    DocumentKind DocumentKind,
    bool IsMandatory,
    bool IsSatisfied,
    int DisplayOrder);

public record DocumentChecklistResponse(
    RequestType RequestType,
    WorkflowPhase Phase,
    Guid RequestId,
    IReadOnlyList<DocumentChecklistItemResponse> Items);
```

- [ ] **Step 2: Add the endpoint to `DocumentsController`**

Inject `IDocumentChecklistService` into the existing primary constructor alongside `IApplicationDbContext db` and `IDocumentStorageService storage`, then add:
```csharp
    [HttpGet("checklist")]
    public async Task<ActionResult<DocumentChecklistResponse>> GetChecklist(
        [FromQuery] RequestType requestType,
        [FromQuery] WorkflowPhase phase,
        [FromQuery] Guid requestId,
        [FromQuery] string ownerType)
    {
        if (string.IsNullOrWhiteSpace(ownerType))
        {
            return BadRequest("ownerType is required.");
        }

        var result = await checklistService.GetChecklistAsync(requestType, phase, requestId, ownerType);

        return Ok(new DocumentChecklistResponse(
            result.RequestType,
            result.Phase,
            result.RequestId,
            result.Items
                .Select(i => new DocumentChecklistItemResponse(
                    i.ChecklistItemId, i.Name, i.DocumentKind, i.IsMandatory, i.IsSatisfied, i.DisplayOrder))
                .ToList()));
    }
```
The controller already carries `[Authorize]` at class level, so this endpoint requires authentication like the rest.

- [ ] **Step 3: Register the service in `Program.cs`**

```csharp
builder.Services.AddScoped<IDocumentChecklistService, DocumentChecklistService>();
```

- [ ] **Step 4: Build and run the full suite**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx && dotnet test API/API.slnx`
Expected: Build succeeded; all tests pass.

- [ ] **Step 5: Live verification**

Start the API in Development, log in as `faculty1` / `Faculty@12345` via `POST /api/auth/login`, then:
```bash
curl -s "http://localhost:5899/api/documents/checklist?requestType=Consumable&phase=Indent&requestId=00000000-0000-0000-0000-000000000001&ownerType=ConsumableIndent" \
  -H "Authorization: Bearer $TOKEN" -w "\nHTTP:%{http_code}\n"
```
Expected: `200` with the three seeded Indent-phase items, all `isSatisfied: false`. Also confirm `GET /swagger/v1/swagger.json` still returns 200. Paste real output in your report, then stop the app (PID by port via `netstat`, `taskkill` that PID only).

- [ ] **Step 6: Commit**

```bash
git add API/API/Contracts/Documents/DocumentChecklistResponse.cs API/API/Controllers/DocumentsController.cs API/API/Program.cs
git commit -m "Add document checklist endpoint"
```

---

## Task 5: Extend `WorkflowStepResponse` for the timeline UI

**Files:**
- Modify: `API/API/Contracts/Workflow/WorkflowInstanceResponse.cs`
- Modify: `API/API/Controllers/WorkflowController.cs`

**Interfaces:**
- Produces: `WorkflowStepResponse` gains `StepName` (display label) and `SequenceOrder` (1-based position within the instance), **added after** the existing members so positional construction elsewhere keeps working.

- [ ] **Step 1: Extend the response record**

`API/API/Contracts/Workflow/WorkflowInstanceResponse.cs` — change only `WorkflowStepResponse`:
```csharp
public record WorkflowStepResponse(
    WorkflowStage Stage,
    WorkflowAction Action,
    Guid ActorUserId,
    string? Remarks,
    DateTimeOffset Timestamp,
    string StepName,
    int SequenceOrder);
```

- [ ] **Step 2: Populate the new fields in `WorkflowController`**

The `Get` action currently projects steps ordered by `Timestamp`. Update that projection to supply the two new values — `SequenceOrder` from the ordered index (1-based), and `StepName` from a small display-label helper:
```csharp
    private static string BuildStepName(WorkflowStage stage, WorkflowAction action) => action switch
    {
        WorkflowAction.Raise => "Raised",
        WorkflowAction.UploadSignedCopy => "Signed copy uploaded",
        WorkflowAction.Assign => "Assigned to staff",
        WorkflowAction.Forward => $"Forwarded ({stage})",
        WorkflowAction.Approve => "Approved",
        WorkflowAction.Reject => "Rejected",
        WorkflowAction.ForwardToDirector => "Forwarded to Director",
        WorkflowAction.Cancel => "Cancelled",
        _ => action.ToString(),
    };
```
Use `.Select((s, index) => ...)` over the ordered sequence so `SequenceOrder` is `index + 1`.

- [ ] **Step 3: Build and run the full suite**

Run: `cd D:/Projects/MNNITRNC && dotnet build API/API.slnx && dotnet test API/API.slnx`
Expected: Build succeeded; all tests pass. If any test constructs `WorkflowStepResponse` positionally it will fail to compile — fix it by supplying the two new arguments.

- [ ] **Step 4: Live verification**

With the API running and a `faculty1` token, fetch any existing workflow instance:
```bash
curl -s "http://localhost:5899/api/workflow/$INSTANCE_ID" -H "Authorization: Bearer $TOKEN"
```
Expected: each step now carries `stepName` and `sequenceOrder` alongside the existing fields. Paste real output in your report.

- [ ] **Step 5: Commit**

```bash
git add API/API/Contracts/Workflow/WorkflowInstanceResponse.cs API/API/Controllers/WorkflowController.cs
git commit -m "Add StepName and SequenceOrder to workflow step responses"
```

---

## Task 6: Full-solution verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `cd D:/Projects/MNNITRNC && dotnet test API/API.slnx`
Expected: all tests pass, including this plan's 7 new checklist service tests.

- [ ] **Step 2: Clean build**

Run: `cd D:/Projects/MNNITRNC && dotnet clean API/API.slnx && dotnet build API/API.slnx`
Expected: Build succeeded, 0 warnings in new code.

- [ ] **Step 3: Confirm migrations applied**

Run: `MNNITRNC_CONNECTION_STRING="<value>" dotnet ef migrations list --project API/API.Infrastructure --startup-project API/API/API.csproj`
Expected: every migration listed with no `(Pending)` marker.

- [ ] **Step 4: Confirm no plan step was skipped**

Check off unchecked boxes above only after re-running the corresponding command and confirming expected output.

---

## Self-Review Notes (for the plan author, not a task)

- **Spec coverage check**: database-configurable checklist ✅ (Tasks 1, 2), configurable `IsMandatory` ✅ (Tasks 1, 2, 3), seeded from BRD A7.4 ✅ (Task 2), advisory-not-blocking ✅ (enforced by the Global Constraints and by the fact that no task touches the workflow engine), checklist endpoint ✅ (Task 4), additive `WorkflowStepResponse` extension ✅ (Task 5).
- **Known limitation, deliberately accepted**: several Bill-phase checklist items share `DocumentKind.SignedCopy` because Phase 1's enum lacks finer-grained values, so uploading one signed copy satisfies all of them. Extending `DocumentKind` would require touching Phase 1 and 3b code this plan is constrained against, and would ripple into the storage service's kind handling. Task 2 instructs the implementer to record this in their report so it surfaces for a future slice rather than being silently absorbed.
- **Ordering dependency**: Task 1 Step 4 touches `TestProcurementDbContext.cs`, which only exists if Phase 3b has been executed. The step says to skip it and report if absent, so this plan can run either before or after 3b.
- **Type consistency**: `DocumentChecklistItemResult`/`DocumentChecklistResult` (Task 3) map one-to-one onto `DocumentChecklistItemResponse`/`DocumentChecklistResponse` (Task 4), following the same Application-record-to-API-contract separation Phases 2 and 3b use. `DocumentChecklistService`'s constructor takes only `IApplicationDbContext`, matching the DI registration in Task 4 Step 3.
