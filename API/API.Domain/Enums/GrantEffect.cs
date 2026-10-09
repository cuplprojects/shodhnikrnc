namespace API.Domain.Enums;

/// <summary>Whether a user grant adds access or takes it away.</summary>
/// <remarks>Persisted as an int; append only.</remarks>
public enum GrantEffect
{
    Grant = 0,
    Deny = 1,
}
