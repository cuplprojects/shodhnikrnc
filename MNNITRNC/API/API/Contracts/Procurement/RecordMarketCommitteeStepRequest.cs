using API.Application.Procurement;

namespace API.Contracts.Procurement;

/// <summary>
/// Request body for recording a Market Committee step, carrying both the step
/// identifier and its date. Maps to <see cref="MarketCommitteeStep"/> and the
/// <c>RecordMarketCommitteeStepAsync</c> service method.
/// </summary>
public record RecordMarketCommitteeStepRequest(MarketCommitteeStep Step, DateOnly RecordedOn);
