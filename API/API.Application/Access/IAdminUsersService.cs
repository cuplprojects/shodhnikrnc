namespace API.Application.Access;

public interface IAdminUsersService
{
    Task<IReadOnlyList<AdminUserListItemResponse>> GetAllAsync(CancellationToken ct = default);
    Task SetEmployeeIdAsync(Guid userId, string? employeeId, CancellationToken ct = default);
}
