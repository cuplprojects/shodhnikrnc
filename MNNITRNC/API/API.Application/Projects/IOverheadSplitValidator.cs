using API.Domain.Enums;

namespace API.Application.Projects;

public interface IOverheadSplitValidator
{
    OverheadSplitValidationResult Validate(decimal overheadAmount, IReadOnlyDictionary<OverheadSubHead, decimal> submittedSplit);
}
