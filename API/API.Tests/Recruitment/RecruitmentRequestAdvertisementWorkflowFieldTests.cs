using API.Domain.Entities;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

public class RecruitmentRequestAdvertisementWorkflowFieldTests
{
    [Fact]
    public async Task AdvertisementWorkflowInstanceId_IsIndependentOfWorkflowInstanceId()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProcurementDbContext(options);

        var requestId = Guid.NewGuid();
        var meritListInstanceId = Guid.NewGuid();
        var adInstanceId = Guid.NewGuid();

        db.RecruitmentRequests.Add(new RecruitmentRequest
        {
            Id = requestId,
            ProjectId = Guid.NewGuid(),
            SanctionedManpowerPositionId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
            WorkflowInstanceId = meritListInstanceId,
            AdvertisementWorkflowInstanceId = adInstanceId,
        });
        await db.SaveChangesAsync();

        var stored = await db.RecruitmentRequests.AsNoTracking().SingleAsync(r => r.Id == requestId);
        stored.WorkflowInstanceId.Should().Be(meritListInstanceId);
        stored.AdvertisementWorkflowInstanceId.Should().Be(adInstanceId);
        (stored.WorkflowInstanceId == stored.AdvertisementWorkflowInstanceId).Should().BeFalse();
    }
}
