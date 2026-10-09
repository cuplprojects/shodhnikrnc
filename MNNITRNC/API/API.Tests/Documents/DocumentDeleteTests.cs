using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Documents;

/// <summary>
/// DocumentsController.CanDeleteAsync is the authorization rule behind
/// DELETE /api/documents/{id}: the proposal's own owner, or an Office role,
/// may delete a ResearchProposal document; nobody else may, and an unknown
/// owner type is refused rather than silently allowed.
/// </summary>
public class DocumentDeleteTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static ResearchProposal Proposal(Guid ownerId) => new()
    {
        Id = Guid.NewGuid(),
        OwnerUserId = ownerId,
        DepartmentId = Guid.NewGuid(),
        Title = "A proposal",
        Agency = "DST",
        DurationMonths = 12,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static Document ProposalDocument(Guid proposalId) => new()
    {
        Id = Guid.NewGuid(),
        OwnerType = "ResearchProposal",
        OwnerId = proposalId,
        Kind = DocumentKind.SignedCopy,
        Version = 1,
        Status = DocumentStatus.Uploaded,
        StoragePath = "some/path.pdf",
        UploadedByUserId = Guid.NewGuid(),
        UploadedAt = DateTimeOffset.UtcNow,
    };

    [Fact]
    public async Task CanDeleteAsync_ByTheProposalsOwnOwner_ReturnsTrue()
    {
        var db = CreateDb();
        var ownerId = Guid.NewGuid();
        var proposal = Proposal(ownerId);
        db.ResearchProposals.Add(proposal);
        var document = ProposalDocument(proposal.Id);
        db.Documents.Add(document);
        await db.SaveChangesAsync();

        var canDelete = await DocumentsController.CanDeleteAsync(document, ownerId, [], db);

        canDelete.Should().BeTrue();
    }

    [Fact]
    public async Task CanDeleteAsync_ByAnOfficeRole_ReturnsTrue()
    {
        var db = CreateDb();
        var proposal = Proposal(Guid.NewGuid());
        db.ResearchProposals.Add(proposal);
        var document = ProposalDocument(proposal.Id);
        db.Documents.Add(document);
        await db.SaveChangesAsync();

        var canDelete = await DocumentsController.CanDeleteAsync(document, Guid.NewGuid(), ["RegularStaff"], db);

        canDelete.Should().BeTrue();
    }

    [Fact]
    public async Task CanDeleteAsync_ByAnUnrelatedFacultyAccount_ReturnsFalse()
    {
        var db = CreateDb();
        var proposal = Proposal(Guid.NewGuid());
        db.ResearchProposals.Add(proposal);
        var document = ProposalDocument(proposal.Id);
        db.Documents.Add(document);
        await db.SaveChangesAsync();

        var canDelete = await DocumentsController.CanDeleteAsync(document, Guid.NewGuid(), [], db);

        canDelete.Should().BeFalse();
    }

    [Fact]
    public async Task CanDeleteAsync_ForAnUnrecognizedOwnerType_ReturnsFalse()
    {
        var db = CreateDb();
        var document = new Document
        {
            Id = Guid.NewGuid(),
            OwnerType = "SomeFutureOwnerType",
            OwnerId = Guid.NewGuid(),
            Kind = DocumentKind.SignedCopy,
            Version = 1,
            Status = DocumentStatus.Uploaded,
            StoragePath = "some/path.pdf",
            UploadedByUserId = Guid.NewGuid(),
            UploadedAt = DateTimeOffset.UtcNow,
        };
        db.Documents.Add(document);
        await db.SaveChangesAsync();

        var canDelete = await DocumentsController.CanDeleteAsync(document, Guid.NewGuid(), ["RegularStaff"], db);

        canDelete.Should().BeFalse();
    }
}
