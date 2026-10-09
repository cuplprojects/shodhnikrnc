namespace API.Application.Access;

public record AdminUserListItemResponse(
    Guid Id,
    string FullName,
    string? Email,
    string? EmployeeId,
    bool IsActive);

public record SetEmployeeIdRequest(string? EmployeeId);
