using API.Application.FundingAgencies;
using API.Tests.Projects;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.FundingAgencies;

public class FundingAgencyServiceTests
{
    private static (FundingAgencyService Service, TestProjectsDbContext Db) CreateService()
    {
        var options = new DbContextOptionsBuilder<TestProjectsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestProjectsDbContext(options);
        return (new FundingAgencyService(db), db);
    }

    [Fact]
    public async Task CreateAsync_AddsAnActiveAgency()
    {
        var (service, _) = CreateService();

        var result = await service.CreateAsync(new CreateFundingAgencyRequest("DST"));

        result.Name.Should().Be("DST");
        result.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_DuplicateNameCaseInsensitive_Throws()
    {
        var (service, _) = CreateService();
        await service.CreateAsync(new CreateFundingAgencyRequest("SERB"));

        var act = () => service.CreateAsync(new CreateFundingAgencyRequest("serb"));

        await act.Should().ThrowAsync<FundingAgencyNameAlreadyExistsException>();
    }

    [Fact]
    public async Task CreateAsync_BlankName_ThrowsArgumentException()
    {
        var (service, _) = CreateService();

        var act = () => service.CreateAsync(new CreateFundingAgencyRequest("   "));

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task ListActiveAsync_ExcludesDeactivatedAgencies()
    {
        var (service, _) = CreateService();
        var active = await service.CreateAsync(new CreateFundingAgencyRequest("AICTE"));
        var toDeactivate = await service.CreateAsync(new CreateFundingAgencyRequest("Old Agency"));
        await service.UpdateAsync(toDeactivate.Id, new UpdateFundingAgencyRequest("Old Agency", false));

        var result = await service.ListActiveAsync();

        result.Should().ContainSingle(a => a.Id == active.Id);
        result.Should().NotContain(a => a.Id == toDeactivate.Id);
    }

    [Fact]
    public async Task ListAllAsync_IncludesDeactivatedAgencies()
    {
        var (service, _) = CreateService();
        var agency = await service.CreateAsync(new CreateFundingAgencyRequest("ICMR"));
        await service.UpdateAsync(agency.Id, new UpdateFundingAgencyRequest("ICMR", false));

        var result = await service.ListAllAsync();

        result.Should().ContainSingle(a => a.Id == agency.Id && !a.IsActive);
    }

    [Fact]
    public async Task UpdateAsync_UnknownId_Throws()
    {
        var (service, _) = CreateService();

        var act = () => service.UpdateAsync(Guid.NewGuid(), new UpdateFundingAgencyRequest("X", true));

        await act.Should().ThrowAsync<FundingAgencyNotFoundException>();
    }

    [Fact]
    public async Task UpdateAsync_RenamingToAnotherAgencysExistingName_Throws()
    {
        var (service, _) = CreateService();
        await service.CreateAsync(new CreateFundingAgencyRequest("CSIR"));
        var other = await service.CreateAsync(new CreateFundingAgencyRequest("DBT"));

        var act = () => service.UpdateAsync(other.Id, new UpdateFundingAgencyRequest("CSIR", true));

        await act.Should().ThrowAsync<FundingAgencyNameAlreadyExistsException>();
    }

    [Fact]
    public async Task UpdateAsync_RenamingToItsOwnCurrentName_Succeeds()
    {
        var (service, _) = CreateService();
        var agency = await service.CreateAsync(new CreateFundingAgencyRequest("DRDO"));

        var result = await service.UpdateAsync(agency.Id, new UpdateFundingAgencyRequest("DRDO", true));

        result.Name.Should().Be("DRDO");
    }
}
