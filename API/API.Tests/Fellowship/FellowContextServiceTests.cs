using API.Application.Fellowship;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Fellowship;

/// <summary>
/// Fellow scoping is the security foundation for the whole slice: this is the
/// first place a non-PI role reads project-linked data, and a mistake here leaks
/// one fellow's financial and leave records to another.
/// </summary>
public class FellowContextServiceTests
{
    private static (TestProcurementDbContext Db, FellowContextService Service) Create()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);
        return (db, new FellowContextService(db));
    }

    private static Guid AddFellow(
        TestProcurementDbContext db, Guid userId, bool withIdCard = true)
    {
        var id = Guid.NewGuid();
        db.ManpowerSelections.Add(new ManpowerSelection
        {
            Id = id,
            CandidateId = Guid.NewGuid(),
            ApplicationUserId = userId,
            SanctionedManpowerPositionId = Guid.NewGuid(),
            JoinedOn = new DateOnly(2026, 1, 1),
            ValidTill = new DateOnly(2026, 12, 31),
            RecommendedStipend = 37_000m,
            IdCardNumber = withIdCard ? "MNNIT/JRF/001" : null,
            IdCardIssuedAt = withIdCard ? DateTimeOffset.UtcNow : null,
            Status = ManpowerSelectionStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        db.SaveChanges();
        return id;
    }

    [Fact]
    public async Task RequireActiveFellow_WithIdCard_ReturnsTheAppointment()
    {
        var (db, service) = Create();
        var userId = Guid.NewGuid();
        var appointmentId = AddFellow(db, userId);

        var appointment = await service.RequireActiveFellowAsync(userId);

        appointment.Id.Should().Be(appointmentId);
    }

    /// <summary>The gate Phase 5 promised and this slice enforces.</summary>
    [Fact]
    public async Task RequireActiveFellow_WithoutIdCard_Throws()
    {
        var (db, service) = Create();
        var userId = Guid.NewGuid();
        AddFellow(db, userId, withIdCard: false);

        var act = () => service.RequireActiveFellowAsync(userId);

        await act.Should().ThrowAsync<IdCardNotIssuedException>();
    }

    [Fact]
    public async Task RequireActiveFellow_ForANonFellow_Throws()
    {
        var (_, service) = Create();

        var act = () => service.RequireActiveFellowAsync(Guid.NewGuid());

        await act.Should().ThrowAsync<FellowAppointmentNotFoundException>();
    }

    /// <summary>
    /// The isolation guarantee: resolution is by ApplicationUserId, so one
    /// fellow can never reach another's appointment.
    /// </summary>
    [Fact]
    public async Task OneFellowCannotResolveAnothersAppointment()
    {
        var (db, service) = Create();
        var alice = Guid.NewGuid();
        var bob = Guid.NewGuid();
        var aliceAppointment = AddFellow(db, alice);
        var bobAppointment = AddFellow(db, bob);

        var resolvedForAlice = await service.RequireActiveFellowAsync(alice);
        var resolvedForBob = await service.RequireActiveFellowAsync(bob);

        resolvedForAlice.Id.Should().Be(aliceAppointment);
        resolvedForBob.Id.Should().Be(bobAppointment);
        resolvedForAlice.Id.Should().NotBe(resolvedForBob.Id);
    }

    /// <summary>
    /// Reads that must work before the card is issued, so a fellow sees "pending"
    /// rather than an error.
    /// </summary>
    [Fact]
    public async Task FindAppointment_WithoutIdCard_StillResolves()
    {
        var (db, service) = Create();
        var userId = Guid.NewGuid();
        AddFellow(db, userId, withIdCard: false);

        var appointment = await service.FindAppointmentAsync(userId);

        appointment.Should().NotBeNull();
        appointment!.IdCardIssuedAt.Should().BeNull();
    }

    [Fact]
    public async Task FindAppointment_ForANonFellow_ReturnsNull()
    {
        var (_, service) = Create();

        (await service.FindAppointmentAsync(Guid.NewGuid())).Should().BeNull();
    }
}
