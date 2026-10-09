namespace API.Application.Recruitment;

/// <summary>
/// Outcome of a registration attempt.
/// </summary>
/// <remarks>
/// <see cref="AlreadyRegistered"/> is not an error: the stakeholder flow requires
/// that someone reapplying is recognised rather than blocked. It deliberately
/// carries no detail about the existing account -- the caller is unauthenticated
/// at this point, so anything more would confirm an address to a stranger.
/// </remarks>
public enum RegistrationOutcome
{
    Created,
    AlreadyRegistered,
}

public record RegistrationResult(RegistrationOutcome Outcome, Guid? UserId);

/// <summary>A previous application offered as a prefill source.</summary>
public record PrefillCandidateOption(
    Guid CandidateId,
    Guid RecruitmentRequestId,
    string ProjectTitle,
    string Designation,
    DateTimeOffset AppliedAt,
    string Outcome);
