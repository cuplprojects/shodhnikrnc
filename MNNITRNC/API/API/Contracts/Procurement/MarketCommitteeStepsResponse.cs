namespace API.Contracts.Procurement;

/// <summary>
/// Response from the get-market-committee-steps endpoint, mirroring the service layer's
/// <see cref="API.Application.Procurement.MarketCommitteeStepsSummary"/>.
/// </summary>
public record MarketCommitteeStepsResponse(
    DateOnly? CommitteeFormedOn, DateOnly? NoticeIssuedOn, DateOnly? ComparativeStatementSignedOn, bool IsComplete);
