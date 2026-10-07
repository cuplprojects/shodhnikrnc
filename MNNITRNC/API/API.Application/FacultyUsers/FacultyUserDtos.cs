namespace API.Application.FacultyUsers;

public record CreateFacultyUserRequest(
    string EmployeeId,
    string FullName,
    string Department,
    string Designation,
    string Gender,
    string Email,
    string Qualification,
    string Password,
    DateOnly? JoiningDate,
    string? ResearchArea,
    string? Photo
);

public record FacultyProfileResponse(
    string UserId,
    string Name,
    string? Department,
    string? Designation,
    string? Gender,
    string? Qualification,
    DateOnly? JoiningDate,
    string? ResearchArea,
    string? Photo,
    string? Email
);
