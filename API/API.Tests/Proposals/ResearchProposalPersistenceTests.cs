using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Workflow;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Proposals;

/// <summary>
/// The mapping for ResearchProposal, ProposalBudgetLine and
/// ProposalBudgetLineYear, and the rule that matters most about the entity:
/// ProjectId stays null until sanction, because internal approval does not
/// fund anything.
/// </summary>
public class ResearchProposalPersistenceTests
{
    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static ResearchProposal Draft() => new()
    {
        Id = Guid.NewGuid(),
        OwnerUserId = Guid.NewGuid(),
        DepartmentId = Guid.NewGuid(),
        Title = "A proposal",
        Agency = "DST",
        ProposedAmount = 1_000_000m,
        OverheadAmount = 200_000m,
        DurationMonths = 24,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    [Fact]
    public async Task ADraftProposalHasNoProjectAndNoWorkflowInstance()
    {
        // Draft means the PI has not even submitted it internally yet.
        var db = CreateDb();
        db.ResearchProposals.Add(Draft());
        await db.SaveChangesAsync();

        var reloaded = await db.ResearchProposals.SingleAsync();

        reloaded.Status.Should().Be(ProposalStatus.Draft);
        reloaded.WorkflowInstanceId.Should().BeNull();
        reloaded.ProjectId.Should().BeNull();
    }

    [Fact]
    public async Task ApprovedDoesNotImplyAProject()
    {
        // The central rule of the whole phase: internal endorsement is not
        // funding. Only RecordSanctionAsync may ever set ProjectId.
        var db = CreateDb();
        var proposal = Draft();
        proposal.Status = ProposalStatus.Approved;
        proposal.WorkflowInstanceId = Guid.NewGuid();
        db.ResearchProposals.Add(proposal);
        await db.SaveChangesAsync();

        var reloaded = await db.ResearchProposals.SingleAsync();

        reloaded.Status.Should().Be(ProposalStatus.Approved);
        reloaded.ProjectId.Should().BeNull("approval endorses submission, it does not fund anything");
    }

    [Fact]
    public async Task BudgetLinesAndYearsRoundTripWithTheProposal()
    {
        var db = CreateDb();
        var proposal = Draft();
        var lineId = Guid.NewGuid();
        var line = new ProposalBudgetLine
        {
            Id = lineId,
            ResearchProposalId = proposal.Id,
            HeadName = BudgetHeadName.RecurringConsumable,
            IncludeInOverhead = true,
        };
        line.Years.Add(new ProposalBudgetLineYear { Id = Guid.NewGuid(), ProposalBudgetLineId = lineId, Year = 1, Amount = 25_000m });
        line.Years.Add(new ProposalBudgetLineYear { Id = Guid.NewGuid(), ProposalBudgetLineId = lineId, Year = 2, Amount = 25_000m });
        proposal.BudgetLines.Add(line);
        db.ResearchProposals.Add(proposal);
        await db.SaveChangesAsync();

        var reloaded = await db.ResearchProposals
            .Include(p => p.BudgetLines).ThenInclude(l => l.Years)
            .SingleAsync();

        reloaded.BudgetLines.Should().HaveCount(1);
        var reloadedLine = reloaded.BudgetLines.Single();
        reloadedLine.IncludeInOverhead.Should().BeTrue();
        reloadedLine.Years.Should().HaveCount(2);
        reloadedLine.Years.Should().Contain(y => y.Year == 1 && y.Amount == 25_000m);
        reloadedLine.Years.Should().Contain(y => y.Year == 2 && y.Amount == 25_000m);
    }

    [Fact]
    public async Task DeletingAProposalCascadesToItsBudgetLinesAndTheirYears()
    {
        var db = CreateDb();
        var proposal = Draft();
        var lineId = Guid.NewGuid();
        var line = new ProposalBudgetLine
        {
            Id = lineId, ResearchProposalId = proposal.Id,
            HeadName = BudgetHeadName.RecurringTravel, IncludeInOverhead = false,
        };
        line.Years.Add(new ProposalBudgetLineYear { Id = Guid.NewGuid(), ProposalBudgetLineId = lineId, Year = 1, Amount = 10_000m });
        proposal.BudgetLines.Add(line);
        db.ResearchProposals.Add(proposal);
        await db.SaveChangesAsync();

        db.ResearchProposals.Remove(proposal);
        await db.SaveChangesAsync();

        db.ProposalBudgetLines.Should().BeEmpty();
        db.ProposalBudgetLineYears.Should().BeEmpty();
    }

    [Fact]
    public void OneRolePageRouteAndKeyAreUniqueByModel()
    {
        // Mirrors the Phase 7 pattern: the in-memory provider does not enforce
        // unique indexes, so uniqueness is asserted against model metadata, not
        // a round trip that would pass regardless of the mapping.
        //
        // Widened to include CustomLabel (Task 1): two "Other" rows with
        // distinct labels are now valid, so the unique index covers
        // (ResearchProposalId, HeadName, CustomLabel), not just the first two.
        using var db = new API.Infrastructure.Persistence.ApplicationDbContext(
            new DbContextOptionsBuilder<API.Infrastructure.Persistence.ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        var index = db.Model
            .FindEntityType(typeof(ProposalBudgetLine))!
            .GetIndexes()
            .Single(i => i.Properties.Select(p => p.Name)
                .SequenceEqual(new[]
                {
                    nameof(ProposalBudgetLine.ResearchProposalId),
                    nameof(ProposalBudgetLine.HeadName),
                    nameof(ProposalBudgetLine.CustomLabel),
                }));

        index.IsUnique.Should().BeTrue();
    }

    [Fact]
    public void BudgetLineYears_AreUniquePerLineAndYear_ByModel()
    {
        using var db = new API.Infrastructure.Persistence.ApplicationDbContext(
            new DbContextOptionsBuilder<API.Infrastructure.Persistence.ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        var index = db.Model
            .FindEntityType(typeof(ProposalBudgetLineYear))!
            .GetIndexes()
            .Single(i => i.Properties.Select(p => p.Name)
                .SequenceEqual(new[] { nameof(ProposalBudgetLineYear.ProposalBudgetLineId), nameof(ProposalBudgetLineYear.Year) }));

        index.IsUnique.Should().BeTrue();
    }

    [Fact]
    public void BudgetLinesCascadeDeleteWithTheirProposal_ByModel()
    {
        using var db = new API.Infrastructure.Persistence.ApplicationDbContext(
            new DbContextOptionsBuilder<API.Infrastructure.Persistence.ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        var foreignKey = db.Model
            .FindEntityType(typeof(ProposalBudgetLine))!
            .GetForeignKeys()
            .Single(fk => fk.PrincipalEntityType.ClrType == typeof(ResearchProposal));

        foreignKey.DeleteBehavior.Should().Be(DeleteBehavior.Cascade);
    }

    [Fact]
    public void BudgetLineYearsCascadeDeleteWithTheirLine_ByModel()
    {
        using var db = new API.Infrastructure.Persistence.ApplicationDbContext(
            new DbContextOptionsBuilder<API.Infrastructure.Persistence.ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        var foreignKey = db.Model
            .FindEntityType(typeof(ProposalBudgetLineYear))!
            .GetForeignKeys()
            .Single(fk => fk.PrincipalEntityType.ClrType == typeof(ProposalBudgetLine));

        foreignKey.DeleteBehavior.Should().Be(DeleteBehavior.Cascade);
    }

    [Fact]
    public async Task EquipmentAndManpowerRoundTripWithTheProposal()
    {
        var db = CreateDb();
        var proposal = Draft();
        proposal.Equipment.Add(new ProposalEquipment
        {
            Id = Guid.NewGuid(), ResearchProposalId = proposal.Id,
            Name = "Spectrometer", Unit = "1", Amount = 500_000m,
        });
        proposal.Manpower.Add(new ProposalManpowerPosition
        {
            Id = Guid.NewGuid(), ResearchProposalId = proposal.Id,
            Designation = "JRF", Positions = 2, HraPercent = 20m,
        });
        db.ResearchProposals.Add(proposal);
        await db.SaveChangesAsync();

        var reloaded = await db.ResearchProposals
            .Include(p => p.Equipment)
            .Include(p => p.Manpower)
            .SingleAsync();

        reloaded.Equipment.Should().ContainSingle(e => e.Name == "Spectrometer" && e.Amount == 500_000m);
        reloaded.Manpower.Should().ContainSingle(m => m.Designation == "JRF" && m.Positions == 2);
    }

    [Fact]
    public async Task DeletingAProposalCascadesToItsEquipmentAndManpower()
    {
        var db = CreateDb();
        var proposal = Draft();
        proposal.Equipment.Add(new ProposalEquipment
        {
            Id = Guid.NewGuid(), ResearchProposalId = proposal.Id,
            Name = "Centrifuge", Unit = "1", Amount = 200_000m,
        });
        proposal.Manpower.Add(new ProposalManpowerPosition
        {
            Id = Guid.NewGuid(), ResearchProposalId = proposal.Id,
            Designation = "SRF", Positions = 1, HraPercent = 20m,
        });
        db.ResearchProposals.Add(proposal);
        await db.SaveChangesAsync();

        db.ResearchProposals.Remove(proposal);
        await db.SaveChangesAsync();

        db.Set<ProposalEquipment>().Should().BeEmpty();
        db.Set<ProposalManpowerPosition>().Should().BeEmpty();
    }
}
