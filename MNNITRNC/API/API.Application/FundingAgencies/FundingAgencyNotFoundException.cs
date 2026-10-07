namespace API.Application.FundingAgencies;

public class FundingAgencyNotFoundException(Guid id)
    : Exception($"Funding agency '{id}' was not found.");
