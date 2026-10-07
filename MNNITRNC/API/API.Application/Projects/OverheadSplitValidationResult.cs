namespace API.Application.Projects;

public record OverheadSplitValidationResult(bool IsValid, string? ErrorMessage)
{
    public static OverheadSplitValidationResult Success() => new(true, null);
    public static OverheadSplitValidationResult Failure(string message) => new(false, message);
}
