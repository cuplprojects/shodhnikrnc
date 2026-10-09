using API.Application.Dashboard;
using API.Application.Fellowship;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Proposals;
using API.Application.Recruitment;
using API.Application.Travel;
using API.Domain.Enums;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace API.Tests.Dashboard;

public class DashboardServiceTests
{
    [Fact]
    public async Task MergesAndSortsByAgeAscendingAcrossTypes()
    {
        var proposalService = new Mock<IResearchProposalService>();
        var indentQuery = new Mock<IIndentPendingQueryService>();
        var travelService = new Mock<ITravelRequestService>();
        var fellowshipService = new Mock<IFellowshipService>();
        var leaveService = new Mock<ILeaveService>();
        var recruitmentService = new Mock<IRecruitmentService>();
        var projectService = new Mock<IProjectService>();

        var oldest = DateTimeOffset.UtcNow.AddDays(-5);
        var middle = DateTimeOffset.UtcNow.AddDays(-2);
        var newest = DateTimeOffset.UtcNow.AddDays(-1);

        proposalService
            .Setup(s => s.ListPendingForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default))
            .ReturnsAsync([BuildProposalSummary(id: Guid.NewGuid(), createdAt: middle)]);
        indentQuery
            .Setup(s => s.ListPendingForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default))
            .ReturnsAsync([]);
        travelService
            .Setup(s => s.ListPendingForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default))
            .ReturnsAsync([BuildTravelSummary(id: Guid.NewGuid(), createdAt: oldest)]);
        fellowshipService
            .Setup(s => s.ListPendingClaimsForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default))
            .ReturnsAsync([]);
        leaveService
            .Setup(s => s.ListPendingForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default))
            .ReturnsAsync([BuildLeaveSummary(id: Guid.NewGuid(), createdAt: newest)]);
        recruitmentService
            .Setup(s => s.ListPendingForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default))
            .ReturnsAsync([]);
        projectService
            .Setup(s => s.ListPendingProjectsForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default))
            .ReturnsAsync([]);
        projectService
            .Setup(s => s.ListPendingGrantReceiptsForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default))
            .ReturnsAsync([]);

        var sut = new DashboardService(
            proposalService.Object, indentQuery.Object, travelService.Object,
            fellowshipService.Object, leaveService.Object, recruitmentService.Object,
            projectService.Object, NullLogger<DashboardService>.Instance);

        var result = await sut.ListPendingActionsAsync(Guid.NewGuid(), ["HOD"]);

        result.Should().HaveCount(3);
        result.Select(r => r.CreatedAt).Should().BeInAscendingOrder();
        result[0].RequestType.Should().Be("Travel");
        result[2].RequestType.Should().Be("LeaveRequest");
    }

    [Fact]
    public async Task OneTypesFailureDoesNotBlankTheWholePanel()
    {
        var proposalService = new Mock<IResearchProposalService>();
        var indentQuery = new Mock<IIndentPendingQueryService>();
        var travelService = new Mock<ITravelRequestService>();
        var fellowshipService = new Mock<IFellowshipService>();
        var leaveService = new Mock<ILeaveService>();
        var recruitmentService = new Mock<IRecruitmentService>();
        var projectService = new Mock<IProjectService>();

        proposalService
            .Setup(s => s.ListPendingForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default))
            .ThrowsAsync(new InvalidOperationException("simulated failure"));
        indentQuery.Setup(s => s.ListPendingForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default)).ReturnsAsync([]);
        travelService
            .Setup(s => s.ListPendingForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default))
            .ReturnsAsync([BuildTravelSummary(id: Guid.NewGuid(), createdAt: DateTimeOffset.UtcNow)]);
        fellowshipService.Setup(s => s.ListPendingClaimsForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default)).ReturnsAsync([]);
        leaveService.Setup(s => s.ListPendingForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default)).ReturnsAsync([]);
        recruitmentService.Setup(s => s.ListPendingForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default)).ReturnsAsync([]);
        projectService.Setup(s => s.ListPendingProjectsForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default)).ReturnsAsync([]);
        projectService.Setup(s => s.ListPendingGrantReceiptsForCallerAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<string>>(), default)).ReturnsAsync([]);

        var sut = new DashboardService(
            proposalService.Object, indentQuery.Object, travelService.Object,
            fellowshipService.Object, leaveService.Object, recruitmentService.Object,
            projectService.Object, NullLogger<DashboardService>.Instance);

        var result = await sut.ListPendingActionsAsync(Guid.NewGuid(), ["HOD"]);

        result.Should().ContainSingle(r => r.RequestType == "Travel");
    }

    private static ResearchProposalSummary BuildProposalSummary(Guid id, DateTimeOffset createdAt) =>
        new(
            Id: id,
            OwnerUserId: Guid.NewGuid(),
            DepartmentId: Guid.NewGuid(),
            Title: "Test Proposal",
            ProposalType: ProposalType.ResearchProject,
            Agency: "Test Agency",
            ProposedAmount: 1000m,
            OverheadAmount: 100m,
            OverheadPercent: 10m,
            DurationMonths: 12,
            Status: ProposalStatus.UnderApproval,
            WorkflowInstanceId: Guid.NewGuid(),
            CurrentStage: WorkflowStage.WithHOD,
            ExpiresAt: null,
            SubmittedToAgencyOn: null,
            AgencyDecisionOn: null,
            ProjectId: null,
            CreatedAt: createdAt,
            BudgetLines: [],
            Equipment: [],
            Manpower: [],
            TotalAmount: 1100m,
            CoPis: []);

    private static TravelSummary BuildTravelSummary(Guid id, DateTimeOffset createdAt) =>
        new(
            Id: id,
            ProjectId: Guid.NewGuid(),
            BudgetHeadIds: [Guid.NewGuid()],
            WorkflowInstanceId: Guid.NewGuid(),
            TravelerType: TravelerType.Self,
            Place: "Test Place",
            Purpose: "Test Purpose",
            OnwardDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ReturnDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            ExpectedCost: 500m,
            TaxiReimbursementOptedIn: false,
            CurrentStage: WorkflowStage.WithHOD,
            CreatedAt: createdAt);

    private static LeaveRequestSummary BuildLeaveSummary(Guid id, DateTimeOffset createdAt) =>
        new(
            Id: id,
            FellowAppointmentId: Guid.NewGuid(),
            WorkflowInstanceId: Guid.NewGuid(),
            LeaveType: LeaveType.Annual,
            Dates: [DateOnly.FromDateTime(DateTime.UtcNow), DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1))],
            OutOfStationDates: [],
            DayCount: 2,
            Purpose: "Test Purpose",
            CurrentStage: WorkflowStage.WithHOD,
            CreatedAt: createdAt);
}
