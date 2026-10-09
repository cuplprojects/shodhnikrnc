namespace API.Application.Procurement;

/// <summary>
/// Supplies the indenter's identity for the printed annexure header (Indenter's
/// Name / Designation / Department).
/// </summary>
public interface IFacultyProfileProvider
{
    Task<FacultyProfileInfo> GetAsync(Guid userId, CancellationToken ct = default);
}

public record FacultyProfileInfo(string Name, string Designation, string Department);
