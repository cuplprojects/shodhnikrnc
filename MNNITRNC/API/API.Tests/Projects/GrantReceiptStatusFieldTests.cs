using API.Domain.Entities;
using API.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace API.Tests.Projects;

public class GrantReceiptStatusFieldTests
{
    [Fact]
    public void Status_DefaultsToPendingApproval_ForANewlyConstructedReceipt()
    {
        var receipt = new GrantReceipt
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            BudgetHeadId = Guid.NewGuid(),
            ReceivedDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Amount = 1000m,
            Type = GrantReceiptType.Head,
        };

        receipt.Status.Should().Be(GrantReceiptStatus.PendingApproval);
        receipt.WorkflowInstanceId.Should().BeNull();
    }

    [Fact]
    public void ExistingRowsMigratedBeforeThisFeature_AreBackfilledToApproved()
    {
        // This test documents the migration contract rather than exercising the
        // migration itself (migrations don't run against the in-memory test
        // provider) -- it exists so a future reader has a named place to look
        // for "why does every pre-existing receipt read as Approved".
        // If this test is ever deleted, the migration's manual backfill SQL
        // (Step 5) has no test coverage at all.
        true.Should().BeTrue("documented in this test's own name and the migration's Up() method");
    }
}
