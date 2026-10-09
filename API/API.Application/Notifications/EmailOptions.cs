namespace API.Application.Notifications;

/// <summary>
/// SMTP settings, bound from the "Email" configuration section.
/// </summary>
/// <remarks>
/// Ships in appsettings.json with empty placeholders. Real host, credentials and
/// from-address are supplied by the operator in appsettings.Development.json or
/// environment variables, so no credential enters source control.
/// </remarks>
public class EmailOptions
{
    public const string SectionName = "Email";

    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool UseStartTls { get; set; } = true;
    public string User { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = "MNNIT R&C Portal";

    /// <summary>
    /// The portal's public base URL, used to build the verification link. Without
    /// it the mail would have to guess a host.
    /// </summary>
    public string PortalBaseUrl { get; set; } = string.Empty;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(FromAddress);
}
