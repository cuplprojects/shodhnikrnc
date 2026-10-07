namespace API.Application.FundingAgencies;

public interface IFundingAgencyService
{
    /// <summary>Active agencies only -- what the New Proposal dropdown offers.</summary>
    Task<IReadOnlyList<FundingAgencyResponse>> ListActiveAsync(CancellationToken ct = default);

    /// <summary>Every agency, active or not -- what the admin page manages.</summary>
    Task<IReadOnlyList<FundingAgencyResponse>> ListAllAsync(CancellationToken ct = default);

    Task<FundingAgencyResponse> CreateAsync(CreateFundingAgencyRequest request, CancellationToken ct = default);

    Task<FundingAgencyResponse> UpdateAsync(Guid id, UpdateFundingAgencyRequest request, CancellationToken ct = default);
}
