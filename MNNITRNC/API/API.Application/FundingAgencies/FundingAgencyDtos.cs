namespace API.Application.FundingAgencies;

public record FundingAgencyResponse(Guid Id, string Name, bool IsActive);

public record CreateFundingAgencyRequest(string Name);

public record UpdateFundingAgencyRequest(string Name, bool IsActive);
