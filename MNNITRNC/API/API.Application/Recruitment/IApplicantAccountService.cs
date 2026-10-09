namespace API.Application.Recruitment;

public interface IApplicantAccountService
{
    /// <summary>
    /// Registers an applicant and sends the verification mail. An address that is
    /// already registered returns <see cref="RegistrationOutcome.AlreadyRegistered"/>
    /// rather than throwing, and creates no second account.
    /// </summary>
    Task<RegistrationResult> RegisterAsync(
        string email, string fullName, string password, CancellationToken ct = default);

    /// <summary>Idempotent: confirming an already-confirmed address succeeds.</summary>
    Task<bool> ConfirmEmailAsync(Guid userId, string token, CancellationToken ct = default);

    /// <summary>
    /// Silent for unknown or already-confirmed addresses, so it cannot be used to
    /// probe which addresses exist.
    /// </summary>
    Task ResendVerificationAsync(string email, CancellationToken ct = default);
}
