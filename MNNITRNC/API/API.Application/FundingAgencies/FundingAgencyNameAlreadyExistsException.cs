namespace API.Application.FundingAgencies;

public class FundingAgencyNameAlreadyExistsException(string name)
    : InvalidOperationException($"A funding agency named '{name}' already exists.");
