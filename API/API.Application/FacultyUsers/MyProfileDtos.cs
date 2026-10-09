namespace API.Application.FacultyUsers;

public record MyProfileResponse(
    bool IsComplete,
    string? Designation,
    string? Department,
    string? Gender,
    string? Qualification,
    DateOnly? JoiningDate,
    string? ResearchArea,
    string? Photo,
    string Email,
    string? EmployeeId,
    string? PrimaryBankName,
    string? PrimaryBankAccountNo,
    string? PrimaryBankIfsc,
    string? SecondaryBankName,
    string? SecondaryBankAccountNo,
    string? SecondaryBankIfsc
);

public record SaveMyProfileRequest(
    string Designation,
    string Department,
    string? Gender,
    string? Qualification,
    DateOnly? JoiningDate,
    string? ResearchArea,
    string? Photo,
    string? EmployeeId,
    string PrimaryBankName,
    string PrimaryBankAccountNo,
    string PrimaryBankIfsc,
    string? SecondaryBankName,
    string? SecondaryBankAccountNo,
    string? SecondaryBankIfsc,
    string? Email = null
);

public record MyProfilePhotoUploadResponse(string Url);
