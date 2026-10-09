# Phase 1: Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Clean Architecture solution skeleton, database, authentication/RBAC, generic workflow engine, and document storage that every later Research Track feature slice (Projects, Procurement, Travel, Manpower) will build on.

**Architecture:** .NET 8 Web API with 4 projects (`API.Domain`, `API.Application`, `API.Infrastructure`, `API`) referenced from the existing `API.slnx`. EF Core + Pomelo (MySQL). JWT bearer auth against seed-only accounts with real ASP.NET Identity-style roles. A generic `WorkflowInstance`/`WorkflowStep` engine keyed by `(RequestType, RequestId)` so later slices plug in without inventing their own status columns. A `Document` entity + `IDocumentStorageService` (local disk) for the upload/seal/reupload cycle.

**Tech Stack:** .NET 8, EF Core 8, Pomelo.EntityFrameworkCore.MySql, ASP.NET Core Identity (`Microsoft.AspNetCore.Identity.EntityFrameworkCore`), JWT Bearer (`Microsoft.AspNetCore.Authentication.JwtBearer`), xUnit + FluentAssertions for tests, MailKit (wired but not exercised until a later slice sends real email).

## Global Constraints

- Target framework: `net8.0`, nullable + implicit usings enabled (matches existing `API.csproj`).
- Database: MySQL via Pomelo — no SQL Server, no raw ADO.NET.
- Auth: JWT bearer tokens; **no self-registration** — accounts are created only via seed data or an authenticated admin endpoint.
- Roles: `Faculty`, `RegularStaff`, `Superintendent`, `DeputyRegistrar`, `Dean` — **exactly one active user may hold `Superintendent`, `DeputyRegistrar`, or `Dean` at a time** (enforced in application logic, not DB constraint, since EF Core can't express "at most one row with role X" declaratively across a many-to-many Identity join table).
- No `Director` login/role — Director is a workflow stage value only.
- Documents live on local disk under a configurable root path; every stored file has a DB `Document` row with a GUID key — never a bare filesystem path returned to clients.
- Workflow engine must be generic across request types — no per-feature status columns get added in this phase or later.
- Clean Architecture dependency direction: `API.Domain` has zero project references; `API.Application` references only `API.Domain`; `API.Infrastructure` references `API.Application` + `API.Domain`; `API` (presentation) references all three.

---

## File Structure

```
API/
  API.slnx                          (modify: add 3 new project references)
  API.Domain/
    API.Domain.csproj               (new)
    Entities/
      ApplicationUser.cs            (new — extends IdentityUser<Guid>)
      WorkflowInstance.cs           (new)
      WorkflowStep.cs                (new)
      Document.cs                    (new)
    Enums/
      RequestType.cs                 (new)
      WorkflowPhase.cs                (new)
      WorkflowStage.cs                (new)
      WorkflowAction.cs               (new)
      DocumentKind.cs                  (new)
      DocumentStatus.cs                (new)
  API.Application/
    API.Application.csproj           (new)
    Common/
      IApplicationDbContext.cs        (new — DbContext interface, keeps Infrastructure swappable)
      Result.cs                        (new — simple success/error result type)
    Workflow/
      IWorkflowEngineService.cs        (new)
      WorkflowEngineService.cs         (new)
      WorkflowTransitionException.cs   (new)
    Documents/
      IDocumentStorageService.cs        (new)
    Auth/
      IJwtTokenService.cs               (new)
  API.Infrastructure/
    API.Infrastructure.csproj          (new)
    Persistence/
      ApplicationDbContext.cs           (new)
      ApplicationDbContextFactory.cs     (new — design-time factory for `dotnet ef migrations`)
    Documents/
      LocalDiskDocumentStorageService.cs (new)
    Auth/
      JwtTokenService.cs                 (new)
  API/
    API.csproj                          (modify: add project refs + packages)
    Program.cs                          (modify: DI wiring, auth, Identity, Swagger JWT support)
    appsettings.json                     (modify: connection string, JWT settings placeholders)
    Controllers/
      AuthController.cs                  (new)
      WorkflowController.cs               (new)
      DocumentsController.cs               (new)
    Seed/
      DbSeeder.cs                          (new — roles + one user per role)
  API.Tests/
    API.Tests.csproj                    (new — xUnit project)
    Workflow/
      WorkflowEngineServiceTests.cs        (new)
    Documents/
      LocalDiskDocumentStorageServiceTests.cs (new)
    Auth/
      JwtTokenServiceTests.cs                (new)
```

---

## Task 1: Solution skeleton — Domain/Application/Infrastructure projects wired into the solution

**Files:**
- Create: `API/API.Domain/API.Domain.csproj`
- Create: `API/API.Application/API.Application.csproj`
- Create: `API/API.Infrastructure/API.Infrastructure.csproj`
- Create: `API/API.Domain/Class1.cs` (temporary placeholder, deleted in Task 2 once real entities exist)
- Modify: `API/API.slnx`
- Modify: `API/API/API.csproj`

**Interfaces:**
- Produces: four buildable projects, correct reference graph (`API.Application` → `API.Domain`; `API.Infrastructure` → `API.Application`, `API.Domain`; `API` → all three).

- [ ] **Step 1: Create the three new class library projects**

Run:
```bash
cd D:/Projects/MNNITRNC/API
dotnet new classlib -n API.Domain -o API.Domain --framework net8.0
dotnet new classlib -n API.Application -o API.Application --framework net8.0
dotnet new classlib -n API.Infrastructure -o API.Infrastructure --framework net8.0
```

- [ ] **Step 2: Delete the template `Class1.cs` files**

Delete `API/API.Domain/Class1.cs`, `API/API.Application/Class1.cs`, `API/API.Infrastructure/Class1.cs`.

- [ ] **Step 3: Set nullable + implicit usings on all three new csproj files**

Each of the three new `.csproj` files should read:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

</Project>
```

- [ ] **Step 4: Add project references**

Run:
```bash
cd D:/Projects/MNNITRNC/API
dotnet add API.Application/API.Application.csproj reference API.Domain/API.Domain.csproj
dotnet add API.Infrastructure/API.Infrastructure.csproj reference API.Application/API.Application.csproj
dotnet add API.Infrastructure/API.Infrastructure.csproj reference API.Domain/API.Domain.csproj
dotnet add API/API.csproj reference API.Domain/API.Domain.csproj
dotnet add API/API.csproj reference API.Application/API.Application.csproj
dotnet add API/API.csproj reference API.Infrastructure/API.Infrastructure.csproj
```

- [ ] **Step 5: Add all four projects to the solution**

Run:
```bash
cd D:/Projects/MNNITRNC/API
dotnet sln API.slnx add API.Domain/API.Domain.csproj API.Application/API.Application.csproj API.Infrastructure/API.Infrastructure.csproj
```//API/API.csproj is already present in API.slnx.

- [ ] **Step 6: Build the solution to confirm the skeleton compiles**

Run: `cd D:/Projects/MNNITRNC/API && dotnet build`
Expected: Build succeeded, 0 errors, across all 4 projects.

- [ ] **Step 7: Commit**

```bash
git add API/API.Domain API/API.Application API/API.Infrastructure API/API.slnx API/API/API.csproj
git commit -m "Scaffold Clean Architecture project skeleton (Domain/Application/Infrastructure)"
```

---

## Task 2: Domain enums and core entities

**Files:**
- Create: `API/API.Domain/Enums/RequestType.cs`
- Create: `API/API.Domain/Enums/WorkflowPhase.cs`
- Create: `API/API.Domain/Enums/WorkflowStage.cs`
- Create: `API/API.Domain/Enums/WorkflowAction.cs`
- Create: `API/API.Domain/Enums/DocumentKind.cs`
- Create: `API/API.Domain/Enums/DocumentStatus.cs`
- Create: `API/API.Domain/Entities/ApplicationUser.cs`
- Create: `API/API.Domain/Entities/WorkflowInstance.cs`
- Create: `API/API.Domain/Entities/WorkflowStep.cs`
- Create: `API/API.Domain/Entities/Document.cs`
- Test: `API/API.Tests/Workflow/WorkflowStageTransitionTests.cs` (transition-table unit tests — no DB, pure domain logic, so it belongs in Domain but the transition table itself lives in Application per Task 4; this test file is created here as an empty placeholder and filled in Task 4)

**Interfaces:**
- Produces:
  - `enum RequestType { Consumable, Contingency, Equipment, Travel, ManpowerDocument }`
  - `enum WorkflowPhase { Indent, Bill }`
  - `enum WorkflowStage { Raised, SignedCopyUploaded, Assigned, Forwarded, ForwardedOSRC, ForwardedDR, Approved, Rejected, Director, Cancelled }`
  - `enum WorkflowAction { Raise, UploadSignedCopy, Assign, Forward, Approve, Reject, ForwardToDirector, Cancel }`
  - `enum DocumentKind { Indent, CoverLetter, SignedCopy, GemQuotation, OfferLetter, Proforma, StipendForm, Advertisement }`
  - `enum DocumentStatus { Uploaded, Sealed, Reuploaded }`
  - `class ApplicationUser : IdentityUser<Guid>` with `public string FullName { get; set; }`
  - `class WorkflowInstance` — `Id (Guid)`, `RequestType (RequestType)`, `RequestId (Guid)`, `Phase (WorkflowPhase)`, `CurrentStage (WorkflowStage)`, `AssignedToUserId (Guid?)`, `CreatedAt (DateTimeOffset)`, `ExpiresAt (DateTimeOffset?)`, `Steps (ICollection<WorkflowStep>)`
  - `class WorkflowStep` — `Id (Guid)`, `WorkflowInstanceId (Guid)`, `Stage (WorkflowStage)`, `Action (WorkflowAction)`, `ActorUserId (Guid)`, `Remarks (string?)`, `Timestamp (DateTimeOffset)`
  - `class Document` — `Id (Guid)`, `OwnerType (string)`, `OwnerId (Guid)`, `Kind (DocumentKind)`, `Version (int)`, `Status (DocumentStatus)`, `StoragePath (string)`, `UploadedByUserId (Guid)`, `UploadedAt (DateTimeOffset)`

- [ ] **Step 1: Add the Identity package reference needed for `IdentityUser<Guid>`**

Run: `cd D:/Projects/MNNITRNC/API && dotnet add API.Domain/API.Domain.csproj package Microsoft.AspNetCore.Identity.EntityFrameworkCore`

- [ ] **Step 2: Write the six enums**

`API/API.Domain/Enums/RequestType.cs`:
```csharp
namespace API.Domain.Enums;

public enum RequestType
{
    Consumable,
    Contingency,
    Equipment,
    Travel,
    ManpowerDocument
}
```

`API/API.Domain/Enums/WorkflowPhase.cs`:
```csharp
namespace API.Domain.Enums;

public enum WorkflowPhase
{
    Indent,
    Bill
}
```

`API/API.Domain/Enums/WorkflowStage.cs`:
```csharp
namespace API.Domain.Enums;

public enum WorkflowStage
{
    Raised,
    SignedCopyUploaded,
    Assigned,
    Forwarded,
    ForwardedOSRC,
    ForwardedDR,
    Approved,
    Rejected,
    Director,
    Cancelled
}
```

`API/API.Domain/Enums/WorkflowAction.cs`:
```csharp
namespace API.Domain.Enums;

public enum WorkflowAction
{
    Raise,
    UploadSignedCopy,
    Assign,
    Forward,
    Approve,
    Reject,
    ForwardToDirector,
    Cancel
}
```

`API/API.Domain/Enums/DocumentKind.cs`:
```csharp
namespace API.Domain.Enums;

public enum DocumentKind
{
    Indent,
    CoverLetter,
    SignedCopy,
    GemQuotation,
    OfferLetter,
    Proforma,
    StipendForm,
    Advertisement
}
```

`API/API.Domain/Enums/DocumentStatus.cs`:
```csharp
namespace API.Domain.Enums;

public enum DocumentStatus
{
    Uploaded,
    Sealed,
    Reuploaded
}
```

- [ ] **Step 3: Write `ApplicationUser`**

`API/API.Domain/Entities/ApplicationUser.cs`:
```csharp
using Microsoft.AspNetCore.Identity;

namespace API.Domain.Entities;

public class ApplicationUser : IdentityUser<Guid>
{
    public required string FullName { get; set; }
}
```

- [ ] **Step 4: Write `WorkflowInstance`, `WorkflowStep`, `Document`**

`API/API.Domain/Entities/WorkflowInstance.cs`:
```csharp
using API.Domain.Enums;

namespace API.Domain.Entities;

public class WorkflowInstance
{
    public Guid Id { get; set; }
    public RequestType RequestType { get; set; }
    public Guid RequestId { get; set; }
    public WorkflowPhase Phase { get; set; }
    public WorkflowStage CurrentStage { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }

    public ICollection<WorkflowStep> Steps { get; set; } = new List<WorkflowStep>();
}
```

`API/API.Domain/Entities/WorkflowStep.cs`:
```csharp
using API.Domain.Enums;

namespace API.Domain.Entities;

public class WorkflowStep
{
    public Guid Id { get; set; }
    public Guid WorkflowInstanceId { get; set; }
    public WorkflowStage Stage { get; set; }
    public WorkflowAction Action { get; set; }
    public Guid ActorUserId { get; set; }
    public string? Remarks { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}
```

`API/API.Domain/Entities/Document.cs`:
```csharp
using API.Domain.Enums;

namespace API.Domain.Entities;

public class Document
{
    public Guid Id { get; set; }
    public required string OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public DocumentKind Kind { get; set; }
    public int Version { get; set; }
    public DocumentStatus Status { get; set; }
    public required string StoragePath { get; set; }
    public Guid UploadedByUserId { get; set; }
    public DateTimeOffset UploadedAt { get; set; }
}
```

- [ ] **Step 5: Build to confirm compilation**

Run: `cd D:/Projects/MNNITRNC/API && dotnet build`
Expected: Build succeeded.

- [ ] **Step 6: Commit**

```bash
git add API/API.Domain
git commit -m "Add core domain entities and enums for workflow engine and documents"
```

---

## Task 3: EF Core DbContext, Identity wiring, and initial migration

**Files:**
- Create: `API/API.Application/Common/IApplicationDbContext.cs`
- Create: `API/API.Infrastructure/Persistence/ApplicationDbContext.cs`
- Create: `API/API.Infrastructure/Persistence/ApplicationDbContextFactory.cs`
- Modify: `API/API.Infrastructure/API.Infrastructure.csproj` (packages)
- Modify: `API/API/appsettings.json` (connection string)
- Modify: `API/API/appsettings.Development.json` (connection string)

**Interfaces:**
- Consumes: `ApplicationUser`, `WorkflowInstance`, `WorkflowStep`, `Document` from Task 2.
- Produces:
  - `interface IApplicationDbContext { DbSet<WorkflowInstance> WorkflowInstances { get; } DbSet<WorkflowStep> WorkflowSteps { get; } DbSet<Document> Documents { get; } Task<int> SaveChangesAsync(CancellationToken ct); }`
  - `class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>, IApplicationDbContext` — the concrete context later tasks (and later feature-slice plans) add `DbSet<T>` properties to.

- [ ] **Step 1: Add EF Core + Pomelo + Identity Stores packages to Infrastructure**

Run:
```bash
cd D:/Projects/MNNITRNC/API
dotnet add API.Infrastructure/API.Infrastructure.csproj package Microsoft.EntityFrameworkCore
dotnet add API.Infrastructure/API.Infrastructure.csproj package Pomelo.EntityFrameworkCore.MySql --version 8.0.2
dotnet add API.Infrastructure/API.Infrastructure.csproj package Microsoft.AspNetCore.Identity.EntityFrameworkCore
dotnet add API.Infrastructure/API.Infrastructure.csproj package Microsoft.EntityFrameworkCore.Design
```

- [ ] **Step 2: Write `IApplicationDbContext`**

`API/API.Application/Common/IApplicationDbContext.cs`:
```csharp
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Common;

public interface IApplicationDbContext
{
    DbSet<WorkflowInstance> WorkflowInstances { get; }
    DbSet<WorkflowStep> WorkflowSteps { get; }
    DbSet<Document> Documents { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
```

- [ ] **Step 3: Write `ApplicationDbContext`**

`API/API.Infrastructure/Persistence/ApplicationDbContext.cs`:
```csharp
using API.Application.Common;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace API.Infrastructure.Persistence;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options), IApplicationDbContext
{
    public DbSet<WorkflowInstance> WorkflowInstances => Set<WorkflowInstance>();
    public DbSet<WorkflowStep> WorkflowSteps => Set<WorkflowStep>();
    public DbSet<Document> Documents => Set<Document>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<WorkflowInstance>(entity =>
        {
            entity.HasKey(w => w.Id);
            entity.HasMany(w => w.Steps)
                .WithOne()
                .HasForeignKey(s => s.WorkflowInstanceId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WorkflowStep>(entity =>
        {
            entity.HasKey(s => s.Id);
        });

        builder.Entity<Document>(entity =>
        {
            entity.HasKey(d => d.Id);
        });
    }
}
```

- [ ] **Step 4: Write the design-time factory (needed because `API.Infrastructure` has no `Program.cs` of its own)**

`API/API.Infrastructure/Persistence/ApplicationDbContextFactory.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace API.Infrastructure.Persistence;

public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseMySql(
            "Server=localhost;Database=mnnitrnc_dev;User=root;Password=;",
            new MySqlServerVersion(new Version(8, 0, 39)));

        return new ApplicationDbContext(optionsBuilder.Options);
    }
}
```

- [ ] **Step 5: Add connection string placeholders to appsettings**

`API/API/appsettings.Development.json` — add:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=mnnitrnc_dev;User=root;Password=;"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

(Merge into the existing file rather than overwrite — keep any existing keys.)

- [ ] **Step 6: Add EF Core + Pomelo package references to the `API` presentation project (needed for `dotnet ef` to resolve the startup project)**

Run:
```bash
cd D:/Projects/MNNITRNC/API
dotnet add API/API.csproj package Microsoft.EntityFrameworkCore.Design
```

- [ ] **Step 7: Generate the initial migration**

Run:
```bash
cd D:/Projects/MNNITRNC/API
dotnet ef migrations add InitialCreate --project API.Infrastructure --startup-project API/API.csproj --output-dir Persistence/Migrations
```
Expected: A `Migrations/` folder appears under `API.Infrastructure/Persistence/` containing `..._InitialCreate.cs` and `ApplicationDbContextModelSnapshot.cs`, with Identity tables (`AspNetUsers`, `AspNetRoles`, etc.) plus `WorkflowInstances`, `WorkflowSteps`, `Documents`.

If `dotnet ef` is not installed, run `dotnet tool install --global dotnet-ef` first.

- [ ] **Step 8: Build to confirm the migration compiles**

Run: `cd D:/Projects/MNNITRNC/API && dotnet build`
Expected: Build succeeded.

- [ ] **Step 9: Commit**

```bash
git add API/API.Application/Common API/API.Infrastructure API/API/appsettings.Development.json API/API/API.csproj
git commit -m "Add EF Core DbContext with Identity and initial migration"
```

---

## Task 4: Workflow engine — stage transition table and `WorkflowEngineService`

**Files:**
- Create: `API/API.Application/Workflow/WorkflowTransitionException.cs`
- Create: `API/API.Application/Workflow/IWorkflowEngineService.cs`
- Create: `API/API.Application/Workflow/WorkflowEngineService.cs`
- Modify: `API/API.Tests/Workflow/WorkflowStageTransitionTests.cs` (replace placeholder from Task 2 with real tests)
- Create: `API/API.Tests/API.Tests.csproj` (this is the first task that needs the test project — created here since it's the first thing under test)

**Interfaces:**
- Consumes: `WorkflowInstance`, `WorkflowStep`, `WorkflowStage`, `WorkflowAction`, `WorkflowPhase`, `RequestType` from Task 2; `IApplicationDbContext` from Task 3.
- Produces:
  - `class WorkflowTransitionException(string message) : Exception(message)`
  - `interface IWorkflowEngineService`:
    ```csharp
    Task<WorkflowInstance> RaiseAsync(RequestType requestType, Guid requestId, WorkflowPhase phase, Guid actorUserId, CancellationToken ct = default);
    Task UploadSignedCopyAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task AssignAsync(Guid workflowInstanceId, Guid assigneeUserId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task ForwardAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task ApproveAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task RejectAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task ForwardToDirectorAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task CancelAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    ```
  - `class WorkflowEngineService(IApplicationDbContext db) : IWorkflowEngineService`

The stage machine encoded in `WorkflowEngineService`:
- `RaiseAsync` creates a new instance at `WorkflowStage.Raised`.
- `UploadSignedCopyAsync` requires `CurrentStage == Raised`, moves to `SignedCopyUploaded`.
- `AssignAsync` requires `CurrentStage == SignedCopyUploaded`, moves to `Assigned`, sets `AssignedToUserId`.
- `ForwardAsync` requires `CurrentStage` is one of `Assigned` (→ `Forwarded`), `Forwarded` (→ `ForwardedOSRC`), `ForwardedOSRC` (→ `ForwardedDR`); any other current stage throws.
- `ApproveAsync` requires `CurrentStage == ForwardedDR`, moves to `Approved`.
- `RejectAsync` requires `CurrentStage == ForwardedDR`, moves to `Rejected` (terminal).
- `ForwardToDirectorAsync` requires `CurrentStage == ForwardedDR`, moves to `Director` (terminal in this engine — no in-app Director action, matching legacy).
- `CancelAsync` allowed from any stage except `Approved`, `Rejected`, `Cancelled` — moves to `Cancelled`.
- Every method appends a `WorkflowStep` row recording the action, resulting stage, actor, remarks, and timestamp (`DateTimeOffset.UtcNow`).
- Illegal transitions throw `WorkflowTransitionException` with a message naming the current stage and attempted action.

- [ ] **Step 1: Create the xUnit test project**

Run:
```bash
cd D:/Projects/MNNITRNC/API
dotnet new xunit -n API.Tests -o API.Tests --framework net8.0
dotnet add API.Tests/API.Tests.csproj package FluentAssertions
dotnet add API.Tests/API.Tests.csproj reference API.Application/API.Application.csproj
dotnet add API.Tests/API.Tests.csproj reference API.Domain/API.Domain.csproj
dotnet sln API.slnx add API.Tests/API.Tests.csproj
```

Delete the template `API/API.Tests/UnitTest1.cs`.

- [ ] **Step 2: Write the failing tests for the transition table**

`API/API.Tests/Workflow/WorkflowStageTransitionTests.cs`:
```csharp
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

public class WorkflowStageTransitionTests
{
    private static readonly Guid ActorId = Guid.NewGuid();
    private static readonly Guid RequestId = Guid.NewGuid();

    private static (WorkflowEngineService Engine, TestDbContext Db) CreateEngine()
    {
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestDbContext(options);
        return (new WorkflowEngineService(db), db);
    }

    [Fact]
    public async Task RaiseAsync_CreatesInstanceAtRaisedStage()
    {
        var (engine, _) = CreateEngine();

        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);

        instance.CurrentStage.Should().Be(WorkflowStage.Raised);
        instance.Phase.Should().Be(WorkflowPhase.Indent);
    }

    [Fact]
    public async Task FullHappyPath_Consumable_ReachesApproved()
    {
        var (engine, _) = CreateEngine();
        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);

        await engine.UploadSignedCopyAsync(instance.Id, ActorId, null);
        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, null);
        await engine.ForwardAsync(instance.Id, ActorId, null);       // -> Forwarded
        await engine.ForwardAsync(instance.Id, ActorId, null);       // -> ForwardedOSRC
        await engine.ForwardAsync(instance.Id, ActorId, null);       // -> ForwardedDR
        await engine.ApproveAsync(instance.Id, ActorId, "looks good");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Approved);
        reloaded.Steps.Should().HaveCount(6);
    }

    [Fact]
    public async Task AssignAsync_BeforeSignedCopyUploaded_Throws()
    {
        var (engine, _) = CreateEngine();
        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);

        var act = () => engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, null);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*Raised*");
    }

    [Fact]
    public async Task ApproveAsync_BeforeForwardedDR_Throws()
    {
        var (engine, _) = CreateEngine();
        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);
        await engine.UploadSignedCopyAsync(instance.Id, ActorId, null);
        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, null);

        var act = () => engine.ApproveAsync(instance.Id, ActorId, null);

        await act.Should().ThrowAsync<WorkflowTransitionException>();
    }

    [Fact]
    public async Task CancelAsync_FromForwarded_MovesToCancelled()
    {
        var (engine, _) = CreateEngine();
        var instance = await engine.RaiseAsync(RequestType.Travel, RequestId, WorkflowPhase.Indent, ActorId);
        await engine.UploadSignedCopyAsync(instance.Id, ActorId, null);
        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, null);
        await engine.ForwardAsync(instance.Id, ActorId, null);

        await engine.CancelAsync(instance.Id, ActorId, "no longer needed");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.Cancelled);
    }

    [Fact]
    public async Task CancelAsync_AfterApproved_Throws()
    {
        var (engine, _) = CreateEngine();
        var instance = await engine.RaiseAsync(RequestType.Consumable, RequestId, WorkflowPhase.Indent, ActorId);
        await engine.UploadSignedCopyAsync(instance.Id, ActorId, null);
        await engine.AssignAsync(instance.Id, Guid.NewGuid(), ActorId, null);
        await engine.ForwardAsync(instance.Id, ActorId, null);
        await engine.ForwardAsync(instance.Id, ActorId, null);
        await engine.ForwardAsync(instance.Id, ActorId, null);
        await engine.ApproveAsync(instance.Id, ActorId, null);

        var act = () => engine.CancelAsync(instance.Id, ActorId, null);

        await act.Should().ThrowAsync<WorkflowTransitionException>();
    }
}
```

This test file references `TestDbContext` and `engine.GetAsync` — add those now too:

`API/API.Tests/Workflow/TestDbContext.cs`:
```csharp
using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Tests.Workflow;

public class TestDbContext(DbContextOptions<TestDbContext> options)
    : DbContext(options), IApplicationDbContext
{
    public DbSet<WorkflowInstance> WorkflowInstances => Set<WorkflowInstance>();
    public DbSet<WorkflowStep> WorkflowSteps => Set<WorkflowStep>();
    public DbSet<Document> Documents => Set<Document>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<WorkflowInstance>().HasKey(w => w.Id);
        builder.Entity<WorkflowInstance>()
            .HasMany(w => w.Steps)
            .WithOne()
            .HasForeignKey(s => s.WorkflowInstanceId);
        builder.Entity<WorkflowStep>().HasKey(s => s.Id);
        builder.Entity<Document>().HasKey(d => d.Id);
    }
}
```

Run: `dotnet add API.Tests/API.Tests.csproj package Microsoft.EntityFrameworkCore.InMemory`

Add `IWorkflowEngineService.GetAsync(Guid id)` to the interface (needed by the tests above):
```csharp
Task<WorkflowInstance?> GetAsync(Guid workflowInstanceId, CancellationToken ct = default);
```

- [ ] **Step 3: Run tests to verify they fail (interface/class don't exist yet)**

Run: `cd D:/Projects/MNNITRNC/API && dotnet test API.Tests/API.Tests.csproj --filter WorkflowStageTransitionTests`
Expected: FAIL — compile error, `WorkflowEngineService` and `IWorkflowEngineService` not found.

- [ ] **Step 4: Write `WorkflowTransitionException`**

`API/API.Application/Workflow/WorkflowTransitionException.cs`:
```csharp
namespace API.Application.Workflow;

public class WorkflowTransitionException(string message) : Exception(message);
```

- [ ] **Step 5: Write `IWorkflowEngineService`**

`API/API.Application/Workflow/IWorkflowEngineService.cs`:
```csharp
using API.Domain.Entities;
using API.Domain.Enums;

namespace API.Application.Workflow;

public interface IWorkflowEngineService
{
    Task<WorkflowInstance> RaiseAsync(RequestType requestType, Guid requestId, WorkflowPhase phase, Guid actorUserId, CancellationToken ct = default);
    Task<WorkflowInstance?> GetAsync(Guid workflowInstanceId, CancellationToken ct = default);
    Task UploadSignedCopyAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task AssignAsync(Guid workflowInstanceId, Guid assigneeUserId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task ForwardAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task ApproveAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task RejectAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task ForwardToDirectorAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
    Task CancelAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default);
}
```

- [ ] **Step 6: Write `WorkflowEngineService`**

`API/API.Application/Workflow/WorkflowEngineService.cs`:
```csharp
using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Workflow;

public class WorkflowEngineService(IApplicationDbContext db) : IWorkflowEngineService
{
    private static readonly IReadOnlyDictionary<WorkflowStage, WorkflowStage> ForwardChain =
        new Dictionary<WorkflowStage, WorkflowStage>
        {
            [WorkflowStage.Assigned] = WorkflowStage.Forwarded,
            [WorkflowStage.Forwarded] = WorkflowStage.ForwardedOSRC,
            [WorkflowStage.ForwardedOSRC] = WorkflowStage.ForwardedDR,
        };

    private static readonly HashSet<WorkflowStage> TerminalStages =
        [WorkflowStage.Approved, WorkflowStage.Rejected, WorkflowStage.Cancelled];

    public async Task<WorkflowInstance> RaiseAsync(RequestType requestType, Guid requestId, WorkflowPhase phase, Guid actorUserId, CancellationToken ct = default)
    {
        var instance = new WorkflowInstance
        {
            Id = Guid.NewGuid(),
            RequestType = requestType,
            RequestId = requestId,
            Phase = phase,
            CurrentStage = WorkflowStage.Raised,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.WorkflowInstances.Add(instance);
        AppendStep(instance, WorkflowAction.Raise, actorUserId, null);
        await db.SaveChangesAsync(ct);
        return instance;
    }

    public async Task<WorkflowInstance?> GetAsync(Guid workflowInstanceId, CancellationToken ct = default)
    {
        return await db.WorkflowInstances
            .Include(w => w.Steps)
            .FirstOrDefaultAsync(w => w.Id == workflowInstanceId, ct);
    }

    public async Task UploadSignedCopyAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        RequireStage(instance, WorkflowStage.Raised, WorkflowAction.UploadSignedCopy);

        instance.CurrentStage = WorkflowStage.SignedCopyUploaded;
        AppendStep(instance, WorkflowAction.UploadSignedCopy, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task AssignAsync(Guid workflowInstanceId, Guid assigneeUserId, Guid actorUserId, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        RequireStage(instance, WorkflowStage.SignedCopyUploaded, WorkflowAction.Assign);

        instance.CurrentStage = WorkflowStage.Assigned;
        instance.AssignedToUserId = assigneeUserId;
        AppendStep(instance, WorkflowAction.Assign, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task ForwardAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);

        if (!ForwardChain.TryGetValue(instance.CurrentStage, out var nextStage))
        {
            throw new WorkflowTransitionException(
                $"Cannot Forward a workflow instance in stage '{instance.CurrentStage}'.");
        }

        instance.CurrentStage = nextStage;
        AppendStep(instance, WorkflowAction.Forward, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task ApproveAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        RequireStage(instance, WorkflowStage.ForwardedDR, WorkflowAction.Approve);

        instance.CurrentStage = WorkflowStage.Approved;
        AppendStep(instance, WorkflowAction.Approve, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task RejectAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        RequireStage(instance, WorkflowStage.ForwardedDR, WorkflowAction.Reject);

        instance.CurrentStage = WorkflowStage.Rejected;
        AppendStep(instance, WorkflowAction.Reject, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task ForwardToDirectorAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);
        RequireStage(instance, WorkflowStage.ForwardedDR, WorkflowAction.ForwardToDirector);

        instance.CurrentStage = WorkflowStage.Director;
        AppendStep(instance, WorkflowAction.ForwardToDirector, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    public async Task CancelAsync(Guid workflowInstanceId, Guid actorUserId, string? remarks, CancellationToken ct = default)
    {
        var instance = await RequireInstanceAsync(workflowInstanceId, ct);

        if (TerminalStages.Contains(instance.CurrentStage))
        {
            throw new WorkflowTransitionException(
                $"Cannot Cancel a workflow instance already in terminal stage '{instance.CurrentStage}'.");
        }

        instance.CurrentStage = WorkflowStage.Cancelled;
        AppendStep(instance, WorkflowAction.Cancel, actorUserId, remarks);
        await db.SaveChangesAsync(ct);
    }

    private async Task<WorkflowInstance> RequireInstanceAsync(Guid workflowInstanceId, CancellationToken ct)
    {
        var instance = await db.WorkflowInstances
            .Include(w => w.Steps)
            .FirstOrDefaultAsync(w => w.Id == workflowInstanceId, ct);

        if (instance is null)
        {
            throw new WorkflowTransitionException($"Workflow instance '{workflowInstanceId}' was not found.");
        }

        return instance;
    }

    private static void RequireStage(WorkflowInstance instance, WorkflowStage requiredStage, WorkflowAction attemptedAction)
    {
        if (instance.CurrentStage != requiredStage)
        {
            throw new WorkflowTransitionException(
                $"Cannot perform '{attemptedAction}' on a workflow instance in stage '{instance.CurrentStage}' (requires '{requiredStage}').");
        }
    }

    private static void AppendStep(WorkflowInstance instance, WorkflowAction action, Guid actorUserId, string? remarks)
    {
        instance.Steps.Add(new WorkflowStep
        {
            Id = Guid.NewGuid(),
            WorkflowInstanceId = instance.Id,
            Stage = instance.CurrentStage,
            Action = action,
            ActorUserId = actorUserId,
            Remarks = remarks,
            Timestamp = DateTimeOffset.UtcNow,
        });
    }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC/API && dotnet test API.Tests/API.Tests.csproj --filter WorkflowStageTransitionTests`
Expected: PASS — 6 tests passed.

- [ ] **Step 8: Commit**

```bash
git add API/API.Application/Workflow API/API.Tests
git commit -m "Implement generic workflow engine with stage transition rules and tests"
```

---

## Task 5: Document storage service (local disk)

**Files:**
- Create: `API/API.Application/Documents/IDocumentStorageService.cs`
- Create: `API/API.Infrastructure/Documents/LocalDiskDocumentStorageService.cs`
- Modify: `API/API/appsettings.Development.json` (add `DocumentStorage:RootPath`)
- Create: `API/API.Tests/Documents/LocalDiskDocumentStorageServiceTests.cs`

**Interfaces:**
- Consumes: none from earlier tasks besides `IApplicationDbContext`-style DI conventions.
- Produces:
  ```csharp
  public interface IDocumentStorageService
  {
      Task<string> SaveAsync(Guid documentId, int version, Stream content, string originalFileName, CancellationToken ct = default);
      Task<Stream> OpenReadAsync(string storagePath, CancellationToken ct = default);
      void Delete(string storagePath);
  }
  ```
  `class LocalDiskDocumentStorageService(IOptions<DocumentStorageOptions> options) : IDocumentStorageService`, where `DocumentStorageOptions` has `public required string RootPath { get; set; }`.

- [ ] **Step 1: Write the failing test**

`API/API.Tests/Documents/LocalDiskDocumentStorageServiceTests.cs`:
```csharp
using API.Application.Documents;
using API.Infrastructure.Documents;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Xunit;

namespace API.Tests.Documents;

public class LocalDiskDocumentStorageServiceTests : IDisposable
{
    private readonly string _tempRoot = Path.Combine(Path.GetTempPath(), "mnnitrnc-doc-tests-" + Guid.NewGuid());

    private LocalDiskDocumentStorageService CreateService()
    {
        var options = Options.Create(new DocumentStorageOptions { RootPath = _tempRoot });
        return new LocalDiskDocumentStorageService(options);
    }

    [Fact]
    public async Task SaveAsync_WritesFileAndReturnsRelativePath()
    {
        var service = CreateService();
        var documentId = Guid.NewGuid();
        using var content = new MemoryStream("hello world"u8.ToArray());

        var storagePath = await service.SaveAsync(documentId, 1, content, "test.pdf");

        storagePath.Should().Contain(documentId.ToString());
        storagePath.Should().EndWith(".pdf");
        File.Exists(Path.Combine(_tempRoot, storagePath)).Should().BeTrue();
    }

    [Fact]
    public async Task OpenReadAsync_ReturnsSavedContent()
    {
        var service = CreateService();
        var documentId = Guid.NewGuid();
        var originalBytes = "hello world"u8.ToArray();
        using (var content = new MemoryStream(originalBytes))
        {
            var storagePath = await service.SaveAsync(documentId, 1, content, "test.pdf");

            await using var readStream = await service.OpenReadAsync(storagePath);
            using var reader = new MemoryStream();
            await readStream.CopyToAsync(reader);

            reader.ToArray().Should().Equal(originalBytes);
        }
    }

    [Fact]
    public async Task SaveAsync_DifferentVersions_ProduceDifferentPaths()
    {
        var service = CreateService();
        var documentId = Guid.NewGuid();

        using var v1 = new MemoryStream("v1"u8.ToArray());
        var path1 = await service.SaveAsync(documentId, 1, v1, "test.pdf");

        using var v2 = new MemoryStream("v2"u8.ToArray());
        var path2 = await service.SaveAsync(documentId, 2, v2, "test.pdf");

        path1.Should().NotBe(path2);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempRoot))
        {
            Directory.Delete(_tempRoot, recursive: true);
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/Projects/MNNITRNC/API && dotnet test API.Tests/API.Tests.csproj --filter LocalDiskDocumentStorageServiceTests`
Expected: FAIL — compile error, types don't exist yet.

- [ ] **Step 3: Write `IDocumentStorageService`**

`API/API.Application/Documents/IDocumentStorageService.cs`:
```csharp
namespace API.Application.Documents;

public interface IDocumentStorageService
{
    Task<string> SaveAsync(Guid documentId, int version, Stream content, string originalFileName, CancellationToken ct = default);
    Task<Stream> OpenReadAsync(string storagePath, CancellationToken ct = default);
    void Delete(string storagePath);
}
```

- [ ] **Step 4: Write `DocumentStorageOptions` and `LocalDiskDocumentStorageService`**

Run: `cd D:/Projects/MNNITRNC/API && dotnet add API.Infrastructure/API.Infrastructure.csproj package Microsoft.Extensions.Options`

`API/API.Infrastructure/Documents/DocumentStorageOptions.cs`:
```csharp
namespace API.Infrastructure.Documents;

public class DocumentStorageOptions
{
    public required string RootPath { get; set; }
}
```

`API/API.Infrastructure/Documents/LocalDiskDocumentStorageService.cs`:
```csharp
using API.Application.Documents;
using Microsoft.Extensions.Options;

namespace API.Infrastructure.Documents;

public class LocalDiskDocumentStorageService(IOptions<DocumentStorageOptions> options) : IDocumentStorageService
{
    private readonly string _rootPath = options.Value.RootPath;

    public async Task<string> SaveAsync(Guid documentId, int version, Stream content, string originalFileName, CancellationToken ct = default)
    {
        var extension = Path.GetExtension(originalFileName);
        var relativePath = Path.Combine(documentId.ToString(), $"v{version}{extension}");
        var fullPath = Path.Combine(_rootPath, relativePath);

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using var fileStream = File.Create(fullPath);
        content.Position = 0;
        await content.CopyToAsync(fileStream, ct);

        return relativePath;
    }

    public Task<Stream> OpenReadAsync(string storagePath, CancellationToken ct = default)
    {
        var fullPath = Path.Combine(_rootPath, storagePath);
        Stream stream = File.OpenRead(fullPath);
        return Task.FromResult(stream);
    }

    public void Delete(string storagePath)
    {
        var fullPath = Path.Combine(_rootPath, storagePath);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC/API && dotnet test API.Tests/API.Tests.csproj --filter LocalDiskDocumentStorageServiceTests`
Expected: PASS — 3 tests passed.

- [ ] **Step 6: Add the storage root path to Development config**

Add to `API/API/appsettings.Development.json`:
```json
{
  "DocumentStorage": {
    "RootPath": "App_Data/documents"
  }
}
```
(Merge into the existing JSON object alongside `ConnectionStrings` and `Logging` from Task 3.)

- [ ] **Step 7: Commit**

```bash
git add API/API.Application/Documents API/API.Infrastructure/Documents API/API.Tests/Documents API/API/appsettings.Development.json
git commit -m "Add local-disk document storage service"
```

---

## Task 6: JWT token service

**Files:**
- Create: `API/API.Application/Auth/IJwtTokenService.cs`
- Create: `API/API.Infrastructure/Auth/JwtTokenService.cs`
- Create: `API/API.Infrastructure/Auth/JwtOptions.cs`
- Modify: `API/API/appsettings.Development.json` (add `Jwt` section)
- Create: `API/API.Tests/Auth/JwtTokenServiceTests.cs`

**Interfaces:**
- Consumes: `ApplicationUser` (Task 2).
- Produces:
  ```csharp
  public interface IJwtTokenService
  {
      string GenerateToken(ApplicationUser user, IList<string> roles);
  }
  ```

- [ ] **Step 1: Add JWT packages**

Run:
```bash
cd D:/Projects/MNNITRNC/API
dotnet add API.Infrastructure/API.Infrastructure.csproj package Microsoft.IdentityModel.Tokens
dotnet add API.Infrastructure/API.Infrastructure.csproj package System.IdentityModel.Tokens.Jwt
dotnet add API.Infrastructure/API.Infrastructure.csproj package Microsoft.Extensions.Options
```

- [ ] **Step 2: Write the failing test**

`API/API.Tests/Auth/JwtTokenServiceTests.cs`:
```csharp
using API.Domain.Entities;
using API.Infrastructure.Auth;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Xunit;

namespace API.Tests.Auth;

public class JwtTokenServiceTests
{
    private static JwtTokenService CreateService()
    {
        var options = Options.Create(new JwtOptions
        {
            SigningKey = "this-is-a-test-signing-key-that-is-long-enough-256-bits",
            Issuer = "mnnitrnc-tests",
            Audience = "mnnitrnc-tests",
            ExpiryMinutes = 60
        });
        return new JwtTokenService(options);
    }

    [Fact]
    public void GenerateToken_IncludesUserIdAndRoleClaims()
    {
        var service = CreateService();
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "deanrc", FullName = "Dean R&C" };

        var token = service.GenerateToken(user, ["Dean"]);

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        jwt.Claims.Should().Contain(c => c.Type == JwtRegisteredClaimNames.Sub && c.Value == user.Id.ToString());
        jwt.Claims.Should().Contain(c => c.Type == System.Security.Claims.ClaimTypes.Role && c.Value == "Dean");
    }

    [Fact]
    public void GenerateToken_ProducesTokenValidatableWithSameKey()
    {
        var service = CreateService();
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "faculty1", FullName = "Faculty One" };

        var token = service.GenerateToken(user, ["Faculty"]);

        var handler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("this-is-a-test-signing-key-that-is-long-enough-256-bits"));

        var act = () => handler.ValidateToken(token, new TokenValidationParameters
        {
            ValidIssuer = "mnnitrnc-tests",
            ValidAudience = "mnnitrnc-tests",
            IssuerSigningKey = key,
        }, out _);

        act.Should().NotThrow();
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd D:/Projects/MNNITRNC/API && dotnet test API.Tests/API.Tests.csproj --filter JwtTokenServiceTests`
Expected: FAIL — compile error, types don't exist.

- [ ] **Step 4: Write `IJwtTokenService`, `JwtOptions`, `JwtTokenService`**

`API/API.Application/Auth/IJwtTokenService.cs`:
```csharp
using API.Domain.Entities;

namespace API.Application.Auth;

public interface IJwtTokenService
{
    string GenerateToken(ApplicationUser user, IList<string> roles);
}
```

`API/API.Infrastructure/Auth/JwtOptions.cs`:
```csharp
namespace API.Infrastructure.Auth;

public class JwtOptions
{
    public required string SigningKey { get; set; }
    public required string Issuer { get; set; }
    public required string Audience { get; set; }
    public int ExpiryMinutes { get; set; } = 60;
}
```

`API/API.Infrastructure/Auth/JwtTokenService.cs`:
```csharp
using API.Application.Auth;
using API.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace API.Infrastructure.Auth;

public class JwtTokenService(IOptions<JwtOptions> options) : IJwtTokenService
{
    private readonly JwtOptions _options = options.Value;

    public string GenerateToken(ApplicationUser user, IList<string> roles)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.UserName ?? string.Empty),
            new("full_name", user.FullName),
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_options.ExpiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd D:/Projects/MNNITRNC/API && dotnet test API.Tests/API.Tests.csproj --filter JwtTokenServiceTests`
Expected: PASS — 2 tests passed.

- [ ] **Step 6: Add JWT config section**

Add to `API/API/appsettings.Development.json`:
```json
{
  "Jwt": {
    "SigningKey": "dev-only-signing-key-replace-in-production-minimum-32-chars",
    "Issuer": "mnnitrnc-api",
    "Audience": "mnnitrnc-client",
    "ExpiryMinutes": 480
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add API/API.Application/Auth API/API.Infrastructure/Auth API/API.Tests/Auth API/API/appsettings.Development.json
git commit -m "Add JWT token generation service"
```

---

## Task 7: Wire everything into `Program.cs` — DI, Identity, JWT auth, Swagger

**Files:**
- Modify: `API/API/Program.cs`
- Modify: `API/API/API.csproj` (packages)

**Interfaces:**
- Consumes: `ApplicationDbContext` (Task 3), `IWorkflowEngineService`/`WorkflowEngineService` (Task 4), `IDocumentStorageService`/`LocalDiskDocumentStorageService` + `DocumentStorageOptions` (Task 5), `IJwtTokenService`/`JwtTokenService` + `JwtOptions` (Task 6).
- Produces: a running app with `/swagger`, JWT bearer auth configured, all services registered for constructor injection into controllers written in Task 8.

- [ ] **Step 1: Add remaining packages to the presentation project**

Run:
```bash
cd D:/Projects/MNNITRNC/API
dotnet add API/API.csproj package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add API/API.csproj package Microsoft.AspNetCore.Identity.EntityFrameworkCore
```

- [ ] **Step 2: Rewrite `Program.cs`**

`API/API/Program.cs`:
```csharp
using API.Application.Auth;
using API.Application.Common;
using API.Application.Documents;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Infrastructure.Auth;
using API.Infrastructure.Documents;
using API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter a valid JWT with the 'Bearer ' prefix.",
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseMySql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        new MySqlServerVersion(new Version(8, 0, 39))));
builder.Services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());

builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.Password.RequiredLength = 8;
        options.User.RequireUniqueEmail = false;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<ApplicationDbContext>();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<DocumentStorageOptions>(builder.Configuration.GetSection("DocumentStorage"));

builder.Services.AddScoped<IWorkflowEngineService, WorkflowEngineService>();
builder.Services.AddScoped<IDocumentStorageService, LocalDiskDocumentStorageService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();

var jwtSection = builder.Configuration.GetSection("Jwt");
builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["SigningKey"]!)),
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
```

- [ ] **Step 3: Build to confirm the app still compiles and starts**

Run: `cd D:/Projects/MNNITRNC/API && dotnet build`
Expected: Build succeeded.

Run: `cd D:/Projects/MNNITRNC/API/API && dotnet run --urls http://localhost:5199 &`
Then: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5199/swagger/index.html`
Expected: `200`. Stop the background process afterward.

- [ ] **Step 4: Commit**

```bash
git add API/API/Program.cs API/API/API.csproj
git commit -m "Wire DI, Identity, JWT auth, and Swagger bearer support into Program.cs"
```

---

## Task 8: Seed data — roles + one user per office tier + a sample faculty user

**Files:**
- Create: `API/API/Seed/DbSeeder.cs`
- Modify: `API/API/Program.cs` (call seeder on startup in Development)

**Interfaces:**
- Consumes: `ApplicationUser`, `RoleManager<IdentityRole<Guid>>`, `UserManager<ApplicationUser>`.
- Produces: `static class DbSeeder { public static async Task SeedAsync(IServiceProvider services); }` — idempotent (safe to run every startup).

Seed data, matching the single-user-per-tier constraint from the spec:
- Roles: `Faculty`, `RegularStaff`, `Superintendent`, `DeputyRegistrar`, `Dean`.
- Users: `deanrc` (Dean, password `Dean@12345`), `dyregrc` (DeputyRegistrar, password `DyReg@12345`), `osrc` (Superintendent, password `Osrc@12345`), `clerk1` (RegularStaff, password `Clerk@12345`), `faculty1` (Faculty, password `Faculty@12345`).

- [ ] **Step 1: Write `DbSeeder`**

`API/API/Seed/DbSeeder.cs`:
```csharp
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace API.Seed;

public static class DbSeeder
{
    private static readonly string[] Roles =
        ["Faculty", "RegularStaff", "Superintendent", "DeputyRegistrar", "Dean"];

    public static async Task SeedAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

        foreach (var role in Roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole<Guid>(role));
            }
        }

        await EnsureUserAsync(userManager, "deanrc", "Dean@12345", "Dean R&C", "Dean");
        await EnsureUserAsync(userManager, "dyregrc", "DyReg@12345", "Deputy Registrar", "DeputyRegistrar");
        await EnsureUserAsync(userManager, "osrc", "Osrc@12345", "Superintendent R&C", "Superintendent");
        await EnsureUserAsync(userManager, "clerk1", "Clerk@12345", "Office Clerk One", "RegularStaff");
        await EnsureUserAsync(userManager, "faculty1", "Faculty@12345", "Faculty Member One", "Faculty");
    }

    private static async Task EnsureUserAsync(UserManager<ApplicationUser> userManager, string userName, string password, string fullName, string role)
    {
        var existing = await userManager.FindByNameAsync(userName);
        if (existing is not null)
        {
            return;
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = userName,
            FullName = fullName,
        };

        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to seed user '{userName}': {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }

        await userManager.AddToRoleAsync(user, role);
    }
}
```

- [ ] **Step 2: Call the seeder at startup (Development only) in `Program.cs`**

Add just before `app.Run();`:
```csharp
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    await DbSeeder.SeedAsync(scope.ServiceProvider);
}
```

Add `using API.Seed;` to the top of `Program.cs`.

- [ ] **Step 3: Apply migrations and run the seeder against a local MySQL instance**

This step requires a reachable MySQL server matching the connection string in `appsettings.Development.json`. If none is available in this environment, skip execution but leave the step documented for the engineer running it locally.

Run:
```bash
cd D:/Projects/MNNITRNC/API
dotnet ef database update --project API.Infrastructure --startup-project API/API.csproj
cd API
dotnet run
```
Expected: App starts, logs show no seeding errors, `AspNetUsers` table has 5 rows.

- [ ] **Step 4: Commit**

```bash
git add API/API/Seed API/API/Program.cs
git commit -m "Add idempotent role and user seed data for dev environment"
```

---

## Task 9: Auth controller — login endpoint

**Files:**
- Create: `API/API/Controllers/AuthController.cs`
- Create: `API/API/Contracts/Auth/LoginRequest.cs`
- Create: `API/API/Contracts/Auth/LoginResponse.cs`

**Interfaces:**
- Consumes: `UserManager<ApplicationUser>`, `IJwtTokenService` (Task 6).
- Produces: `POST /api/auth/login` accepting `{ userName, password }`, returning `200 { token, fullName, roles }` or `401`.

- [ ] **Step 1: Write request/response contracts**

`API/API/Contracts/Auth/LoginRequest.cs`:
```csharp
namespace API.Contracts.Auth;

public record LoginRequest(string UserName, string Password);
```

`API/API/Contracts/Auth/LoginResponse.cs`:
```csharp
namespace API.Contracts.Auth;

public record LoginResponse(string Token, string FullName, IReadOnlyList<string> Roles);
```

- [ ] **Step 2: Write `AuthController`**

`API/API/Controllers/AuthController.cs`:
```csharp
using API.Application.Auth;
using API.Contracts.Auth;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    IJwtTokenService jwtTokenService) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var user = await userManager.FindByNameAsync(request.UserName);
        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
        {
            return Unauthorized();
        }

        var roles = await userManager.GetRolesAsync(user);
        var token = jwtTokenService.GenerateToken(user, roles);

        return Ok(new LoginResponse(token, user.FullName, roles.ToList()));
    }
}
```

- [ ] **Step 3: Build**

Run: `cd D:/Projects/MNNITRNC/API && dotnet build`
Expected: Build succeeded.

- [ ] **Step 4: Manual verification against the seeded database**

Requires the app running with a reachable DB and seed data applied (Task 8, Step 3). If unavailable in this environment, document the expected command for the engineer running it locally:

```bash
curl -s -X POST http://localhost:5199/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userName":"deanrc","password":"Dean@12345"}'
```
Expected: `200` with a JSON body containing `token`, `fullName: "Dean R&C"`, `roles: ["Dean"]`.

- [ ] **Step 5: Commit**

```bash
git add API/API/Controllers/AuthController.cs API/API/Contracts/Auth
git commit -m "Add JWT login endpoint"
```

---

## Task 10: Workflow and Documents controllers (generic engine endpoints)

**Files:**
- Create: `API/API/Controllers/WorkflowController.cs`
- Create: `API/API/Controllers/DocumentsController.cs`
- Create: `API/API/Contracts/Workflow/WorkflowActionRequest.cs`
- Create: `API/API/Contracts/Workflow/WorkflowInstanceResponse.cs`

**Interfaces:**
- Consumes: `IWorkflowEngineService` (Task 4), `IDocumentStorageService` (Task 5).
- Produces: authenticated REST endpoints per the spec's API surface section:
  - `POST /api/workflow/{instanceId}/assign`
  - `POST /api/workflow/{instanceId}/forward`
  - `POST /api/workflow/{instanceId}/approve`
  - `POST /api/workflow/{instanceId}/reject`
  - `POST /api/workflow/{instanceId}/forward-to-director`
  - `POST /api/workflow/{instanceId}/cancel`
  - `GET /api/workflow/{instanceId}`
  - `POST /api/documents/upload` (multipart form, returns a `Document` id)
  - `GET /api/documents/{id}/download`

- [ ] **Step 1: Write workflow contracts**

`API/API/Contracts/Workflow/WorkflowActionRequest.cs`:
```csharp
namespace API.Contracts.Workflow;

public record WorkflowActionRequest(string? Remarks, Guid? AssigneeUserId = null);
```

`API/API/Contracts/Workflow/WorkflowInstanceResponse.cs`:
```csharp
using API.Domain.Enums;

namespace API.Contracts.Workflow;

public record WorkflowInstanceResponse(
    Guid Id,
    RequestType RequestType,
    Guid RequestId,
    WorkflowPhase Phase,
    WorkflowStage CurrentStage,
    Guid? AssignedToUserId,
    IReadOnlyList<WorkflowStepResponse> Steps);

public record WorkflowStepResponse(
    WorkflowStage Stage,
    WorkflowAction Action,
    Guid ActorUserId,
    string? Remarks,
    DateTimeOffset Timestamp);
```

- [ ] **Step 2: Write `WorkflowController`**

`API/API/Controllers/WorkflowController.cs`:
```csharp
using API.Application.Workflow;
using API.Contracts.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/workflow")]
[Authorize]
public class WorkflowController(IWorkflowEngineService workflowEngine) : ControllerBase
{
    [HttpGet("{instanceId:guid}")]
    public async Task<ActionResult<WorkflowInstanceResponse>> Get(Guid instanceId)
    {
        var instance = await workflowEngine.GetAsync(instanceId);
        if (instance is null)
        {
            return NotFound();
        }

        return Ok(new WorkflowInstanceResponse(
            instance.Id,
            instance.RequestType,
            instance.RequestId,
            instance.Phase,
            instance.CurrentStage,
            instance.AssignedToUserId,
            instance.Steps
                .OrderBy(s => s.Timestamp)
                .Select(s => new WorkflowStepResponse(s.Stage, s.Action, s.ActorUserId, s.Remarks, s.Timestamp))
                .ToList()));
    }

    [HttpPost("{instanceId:guid}/assign")]
    [Authorize(Roles = "Dean")]
    public async Task<IActionResult> Assign(Guid instanceId, WorkflowActionRequest request)
    {
        if (request.AssigneeUserId is null)
        {
            return BadRequest("AssigneeUserId is required for Assign.");
        }

        await workflowEngine.AssignAsync(instanceId, request.AssigneeUserId.Value, CurrentUserId(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/forward")]
    [Authorize(Roles = "RegularStaff,Superintendent,DeputyRegistrar")]
    public async Task<IActionResult> Forward(Guid instanceId, WorkflowActionRequest request)
    {
        await workflowEngine.ForwardAsync(instanceId, CurrentUserId(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/approve")]
    [Authorize(Roles = "Dean")]
    public async Task<IActionResult> Approve(Guid instanceId, WorkflowActionRequest request)
    {
        await workflowEngine.ApproveAsync(instanceId, CurrentUserId(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/reject")]
    [Authorize(Roles = "Dean,Superintendent,DeputyRegistrar")]
    public async Task<IActionResult> Reject(Guid instanceId, WorkflowActionRequest request)
    {
        await workflowEngine.RejectAsync(instanceId, CurrentUserId(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/forward-to-director")]
    [Authorize(Roles = "Dean")]
    public async Task<IActionResult> ForwardToDirector(Guid instanceId, WorkflowActionRequest request)
    {
        await workflowEngine.ForwardToDirectorAsync(instanceId, CurrentUserId(), request.Remarks);
        return NoContent();
    }

    [HttpPost("{instanceId:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid instanceId, WorkflowActionRequest request)
    {
        await workflowEngine.CancelAsync(instanceId, CurrentUserId(), request.Remarks);
        return NoContent();
    }

    private Guid CurrentUserId()
    {
        var sub = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        return Guid.Parse(sub!);
    }
}
```

- [ ] **Step 3: Write `DocumentsController`**

`API/API/Controllers/DocumentsController.cs`:
```csharp
using API.Application.Common;
using API.Application.Documents;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
public class DocumentsController(
    IApplicationDbContext db,
    IDocumentStorageService storage) : ControllerBase
{
    [HttpPost("upload")]
    public async Task<ActionResult<Guid>> Upload(
        [FromForm] IFormFile file,
        [FromForm] string ownerType,
        [FromForm] Guid ownerId,
        [FromForm] DocumentKind kind)
    {
        var documentId = Guid.NewGuid();
        var userId = Guid.Parse(User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)!);

        await using var stream = file.OpenReadStream();
        var storagePath = await storage.SaveAsync(documentId, 1, stream, file.FileName);

        var document = new Document
        {
            Id = documentId,
            OwnerType = ownerType,
            OwnerId = ownerId,
            Kind = kind,
            Version = 1,
            Status = DocumentStatus.Uploaded,
            StoragePath = storagePath,
            UploadedByUserId = userId,
            UploadedAt = DateTimeOffset.UtcNow,
        };

        db.Documents.Add(document);
        await db.SaveChangesAsync(CancellationToken.None);

        return Ok(documentId);
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id)
    {
        var document = await db.Documents.FindAsync(id);
        if (document is null)
        {
            return NotFound();
        }

        var stream = await storage.OpenReadAsync(document.StoragePath);
        return File(stream, "application/octet-stream", Path.GetFileName(document.StoragePath));
    }
}
```

- [ ] **Step 4: Build**

Run: `cd D:/Projects/MNNITRNC/API && dotnet build`
Expected: Build succeeded.

- [ ] **Step 5: Commit**

```bash
git add API/API/Controllers/WorkflowController.cs API/API/Controllers/DocumentsController.cs API/API/Contracts/Workflow
git commit -m "Add generic Workflow and Documents API endpoints"
```

---

## Task 11: Full-solution verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `cd D:/Projects/MNNITRNC/API && dotnet test`
Expected: All tests pass (11 tests from Tasks 4–6 combined).

- [ ] **Step 2: Run a full clean build**

Run: `cd D:/Projects/MNNITRNC/API && dotnet clean && dotnet build`
Expected: Build succeeded, 0 warnings related to nullable reference type violations in new code.

- [ ] **Step 3: Confirm no plan step was skipped**

Check off any unchecked boxes above only after re-running the corresponding command and confirming the expected output.

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git status
```
If clean, no commit needed — Phase 1 is complete and ready for Phase 2 (Projects/Grants vertical slice) to build on `IWorkflowEngineService`, `IDocumentStorageService`, `ApplicationDbContext`, and the seeded roles.

---

## Self-Review Notes (for the plan author, not a task)

- **Spec coverage check**: workflow engine ✅ (Task 4), document management ✅ (Task 5), RBAC/auth ✅ (Tasks 3, 6, 8, 9), audit trail ✅ (`WorkflowStep` is append-only by construction), countdown timers — `ExpiresAt` field exists on `WorkflowInstance` (Task 2) but no scheduled job consumes it yet; that's deferred to whichever feature slice first needs a live countdown (e.g. the 7-working-day grant timer in Projects/Grants), not blocking Phase 1's own acceptance criteria. Seed data ✅ (Task 8). Email/SMTP is a Decision Locked In in the spec but has **no task in this plan** — deferred to the first feature slice that actually sends a notification (no Phase 1 endpoint triggers an email), documented here rather than adding a task with nothing to test yet.
- **Type consistency**: `IWorkflowEngineService` signatures introduced in Task 4 are reused verbatim in Task 10's controller; `IDocumentStorageService` from Task 5 reused verbatim in Task 10; `IJwtTokenService` from Task 6 reused verbatim in Task 9. `ApplicationUser.FullName` (Task 2) is read in Task 9's login response and Task 8's seeder — consistent throughout.
