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
                Name = "GeM Quotation / Estimate",
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

    private static Guid AddDocument(
        TestDbContext db, Guid ownerId, DocumentKind kind, string ownerType = OwnerType,
        DateTimeOffset? uploadedAt = null)
    {
        var id = Guid.NewGuid();
        db.Documents.Add(new Document
        {
            Id = id,
            OwnerType = ownerType,
            OwnerId = ownerId,
            Kind = kind,
            Version = 1,
            Status = DocumentStatus.Uploaded,
            StoragePath = "path.pdf",
            UploadedByUserId = Guid.NewGuid(),
            UploadedAt = uploadedAt ?? DateTimeOffset.UtcNow,
        });
        db.SaveChanges();
        return id;
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
            .Should().BeEquivalentTo(["Generated Indent Form", "GeM Quotation / Estimate"]);
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
    public async Task GetChecklistAsync_DocumentUnderADifferentOwnerType_DoesNotSatisfy()
    {
        // Document rows are keyed by (OwnerType, OwnerId). A contingency indent that
        // happened to share an id must not satisfy a consumable indent's checklist.
        var (service, db) = Create();
        SeedItems(db);
        var requestId = Guid.NewGuid();
        AddDocument(db, requestId, DocumentKind.Indent, ownerType: "ContingencyIndent");

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, requestId, OwnerType);

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
        result.Items.Single(i => i.Name == "GeM Quotation / Estimate").IsMandatory.Should().BeFalse();
    }

    [Fact]
    public async Task GetChecklistAsync_NoConfiguredItems_ReturnsEmptyList()
    {
        var (service, _) = Create();

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, Guid.NewGuid(), OwnerType);

        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetChecklistAsync_ItemsSharingADocumentKind_AreAllSatisfiedByOneUpload()
    {
        // A known limitation of the seed data rather than a bug in this service:
        // several Bill-phase items share DocumentKind.SignedCopy because the enum
        // has no finer-grained values, and satisfaction is evaluated per kind. One
        // signed copy therefore satisfies all of them. Pinned so that if
        // DocumentKind is later split, this test fails and forces the decision.
        var (service, db) = Create();
        var requestId = Guid.NewGuid();

        db.DocumentChecklistItems.AddRange(
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.Consumable,
                Phase = WorkflowPhase.Bill,
                DocumentKind = DocumentKind.SignedCopy,
                Name = "Original Bill",
                IsMandatory = true,
                DisplayOrder = 1,
            },
            new DocumentChecklistItem
            {
                Id = Guid.NewGuid(),
                RequestType = RequestType.Consumable,
                Phase = WorkflowPhase.Bill,
                DocumentKind = DocumentKind.SignedCopy,
                Name = "E-Way Bill",
                IsMandatory = false,
                DisplayOrder = 2,
            });
        db.SaveChanges();
        AddDocument(db, requestId, DocumentKind.SignedCopy);

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Bill, requestId, OwnerType);

        result.Items.Should().HaveCount(2);
        result.Items.Should().OnlyContain(i => i.IsSatisfied);
    }

    [Fact]
    public async Task GetChecklistAsync_UnsatisfiedItem_HasNullDocumentId()
    {
        var (service, db) = Create();
        SeedItems(db);

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, Guid.NewGuid(), OwnerType);

        result.Items.Should().OnlyContain(i => i.DocumentId == null);
    }

    [Fact]
    public async Task GetChecklistAsync_SatisfiedItem_CarriesTheUploadedDocumentId()
    {
        var (service, db) = Create();
        SeedItems(db);
        var requestId = Guid.NewGuid();
        var documentId = AddDocument(db, requestId, DocumentKind.Indent);

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, requestId, OwnerType);

        result.Items.Single(i => i.DocumentKind == DocumentKind.Indent).DocumentId.Should().Be(documentId);
    }

    [Fact]
    public async Task GetChecklistAsync_SameKindUploadedTwice_CarriesTheMostRecentDocumentId()
    {
        // A re-upload replaces what satisfies the checklist item in the reader's
        // mind, even though both rows persist -- linking to the stale first
        // upload would show reviewers an outdated file.
        var (service, db) = Create();
        SeedItems(db);
        var requestId = Guid.NewGuid();
        AddDocument(db, requestId, DocumentKind.Indent, uploadedAt: DateTimeOffset.UtcNow.AddMinutes(-10));
        var latestDocumentId = AddDocument(db, requestId, DocumentKind.Indent, uploadedAt: DateTimeOffset.UtcNow);

        var result = await service.GetChecklistAsync(
            RequestType.Consumable, WorkflowPhase.Indent, requestId, OwnerType);

        result.Items.Single(i => i.DocumentKind == DocumentKind.Indent).DocumentId.Should().Be(latestDocumentId);
    }
}
