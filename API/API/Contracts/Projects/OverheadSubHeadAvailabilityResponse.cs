namespace API.Contracts.Projects;

/// <summary>
/// Whether PDF/DDF can be offered as selectable Indent heads for a project.
/// Idf is deliberately never included -- it is not offered to any PI.
/// </summary>
public record OverheadSubHeadAvailabilityResponse(
    bool PdfAvailable,
    bool DdfAvailable,
    Guid? OverheadHeadId);
