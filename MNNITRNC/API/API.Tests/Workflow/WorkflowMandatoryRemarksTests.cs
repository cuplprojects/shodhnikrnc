using API.Application.Workflow;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Workflow;

/// <summary>
/// ForwardAsync and ReturnAsync now require a non-blank remark under specific
/// conditions: Return always, and Forward whenever the actor is at a PI-owned
/// stage (empty AllowedRoles) or acting as HOD. Exercised against the seeded
/// research proposal route (Draft -> WithHOD -> WithRnCOffice -> ...).
/// </summary>
public class WorkflowMandatoryRemarksTests
{
    private static readonly Guid PiUserId = Guid.NewGuid();
    private static readonly Guid HodUserId = Guid.NewGuid();
    private static readonly Guid OfficeUserId = Guid.NewGuid();

    private static TestDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<WorkflowEngineService> SeededEngineAsync()
    {
        var db = CreateDb();
        await ResearchProposalWorkflowSeeder.SeedAsync(db);
        return new WorkflowEngineService(db);
    }

    [Fact]
    public async Task Return_WithNullRemarks_Throws()
    {
        var engine = await SeededEngineAsync();
        var instance = await engine.RaiseAsync(RequestType.ResearchProposal, Guid.NewGuid(), WorkflowPhase.Indent, PiUserId);
        await engine.ForwardAsync(instance.Id, PiUserId, ["Faculty"], "submitting");
        // instance is now at WithHOD, which has CanReturn = true

        var act = () => engine.ReturnAsync(instance.Id, HodUserId, ["HOD"], null);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*returning*");
    }

    [Fact]
    public async Task Return_WithWhitespaceRemarks_Throws()
    {
        var engine = await SeededEngineAsync();
        var instance = await engine.RaiseAsync(RequestType.ResearchProposal, Guid.NewGuid(), WorkflowPhase.Indent, PiUserId);
        await engine.ForwardAsync(instance.Id, PiUserId, ["Faculty"], "submitting");

        var act = () => engine.ReturnAsync(instance.Id, HodUserId, ["HOD"], "   ");

        await act.Should().ThrowAsync<WorkflowTransitionException>();
    }

    [Fact]
    public async Task Return_WithRemarks_Succeeds()
    {
        var engine = await SeededEngineAsync();
        var instance = await engine.RaiseAsync(RequestType.ResearchProposal, Guid.NewGuid(), WorkflowPhase.Indent, PiUserId);
        await engine.ForwardAsync(instance.Id, PiUserId, ["Faculty"], "submitting");

        await engine.ReturnAsync(instance.Id, HodUserId, ["HOD"], "Please fix the budget breakdown.");

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.Steps.Last().Remarks.Should().Be("Please fix the budget breakdown.");
    }

    [Fact]
    public async Task Forward_ByHOD_WithNullRemarks_Throws()
    {
        var engine = await SeededEngineAsync();
        var instance = await engine.RaiseAsync(RequestType.ResearchProposal, Guid.NewGuid(), WorkflowPhase.Indent, PiUserId);
        await engine.ForwardAsync(instance.Id, PiUserId, ["Faculty"], "submitting");
        // instance is now at WithHOD

        var act = () => engine.ForwardAsync(instance.Id, HodUserId, ["HOD"], null);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*remark*forwarding*");
    }

    [Fact]
    public async Task Forward_AtPiOwnedStage_WithNullRemarks_Throws()
    {
        // Draft (sequence 1) has AllowedRoles = "" -- PI-owned by ownership, not role.
        var engine = await SeededEngineAsync();
        var instance = await engine.RaiseAsync(RequestType.ResearchProposal, Guid.NewGuid(), WorkflowPhase.Indent, PiUserId);

        var act = () => engine.ForwardAsync(instance.Id, PiUserId, ["Faculty"], null);

        await act.Should().ThrowAsync<WorkflowTransitionException>();
    }

    /// <summary>
    /// WithDean (sequence 7) has CanApprove = true, so Forward has nowhere to
    /// advance it to (next is null). Forwarding from there with a blank remark,
    /// acting as HOD (which would also trigger the mandatory-remark check), must
    /// still report the dead end -- not the remark requirement -- matching the
    /// "is this action possible here" before "did they provide what's needed"
    /// precedence the dead-end check already established over the role check.
    /// </summary>
    [Fact]
    public async Task Forward_FromDeadEndStage_WithBlankRemarks_ReportsDeadEndNotRemark()
    {
        var engine = await SeededEngineAsync();
        var instance = await engine.RaiseAsync(RequestType.ResearchProposal, Guid.NewGuid(), WorkflowPhase.Indent, PiUserId);
        await engine.ForwardAsync(instance.Id, PiUserId, ["Faculty"], "submitting");
        await engine.ForwardAsync(instance.Id, HodUserId, ["HOD"], "looks good");
        await engine.ForwardAsync(instance.Id, OfficeUserId, ["RegularStaff"], "assigning"); // WithRnCOffice -> AssignedToDealingAssistant
        await engine.ForwardAsync(instance.Id, OfficeUserId, ["RegularStaff"], "assigned"); // AssignedToDealingAssistant -> WithSuperintendent
        await engine.ForwardAsync(instance.Id, OfficeUserId, ["Superintendent"], "checked"); // WithSuperintendent -> WithDeputyRegistrar
        await engine.ForwardAsync(instance.Id, OfficeUserId, ["DeputyRegistrar"], "checked"); // WithDeputyRegistrar -> WithDean
        // instance is now at WithDean (CanApprove = true, so Forward has no "next").

        var act = () => engine.ForwardAsync(instance.Id, HodUserId, ["HOD"], null);

        await act.Should().ThrowAsync<WorkflowTransitionException>()
            .WithMessage("*Cannot Forward*");
    }

    [Fact]
    public async Task Forward_ByNonPiNonHodRole_WithNullRemarks_Succeeds()
    {
        var engine = await SeededEngineAsync();
        var instance = await engine.RaiseAsync(RequestType.ResearchProposal, Guid.NewGuid(), WorkflowPhase.Indent, PiUserId);
        await engine.ForwardAsync(instance.Id, PiUserId, ["Faculty"], "submitting");
        await engine.ForwardAsync(instance.Id, HodUserId, ["HOD"], "looks good");
        // instance is now at WithRnCOffice, AllowedRoles = "RegularStaff,Superintendent,DeputyRegistrar,Dean"

        await engine.ForwardAsync(instance.Id, OfficeUserId, ["RegularStaff"], null);

        var reloaded = await engine.GetAsync(instance.Id);
        reloaded!.CurrentStage.Should().Be(WorkflowStage.AssignedToDealingAssistant);
    }
}
