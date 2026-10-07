namespace API.Contracts.Projects;

public record CreateOfferLetterRequest(
    Guid ProjectId,
    Guid ManpowerId,
    string CandidateName,
    string Gender,
    string ParentName,
    string Address,
    string City,
    string State,
    string Pincode,
    decimal FellowshipAmount,
    decimal HraPercentage,
    DateOnly JoiningDate,
    string? FilePath = null);

public record OfferLetterResponse(
    Guid Id,
    Guid ProjectId,
    Guid ManpowerId,
    string CandidateName,
    string Gender,
    string ParentName,
    string Address,
    string City,
    string State,
    string Pincode,
    decimal FellowshipAmount,
    decimal HraPercentage,
    DateOnly JoiningDate,
    string? FilePath,
    Guid? GeneratedBy,
    DateTimeOffset GeneratedAt);
