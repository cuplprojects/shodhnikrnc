using API.Application.Access;

namespace API.Tests.Procurement;

/// <summary>
/// Always resolves no department (null). Fine for every test fixture that
/// wires it in purely to satisfy <see cref="API.Application.Recruitment.RecruitmentService"/>'s
/// constructor but never exercises department-scoped queue behaviour --
/// <see cref="InstituteWideScopeResolver.IsInstituteWideAsync"/> already
/// treats "no department" as a safe false, the same default every other
/// caller relies on. Tests that DO need to prove the department gate use
/// their own department-aware fixture instead of this stub.
/// </summary>
public class StubUserDepartmentProvider : IUserDepartmentProvider
{
    public Task<Guid?> GetDepartmentIdAsync(Guid userId, CancellationToken ct = default) =>
        Task.FromResult<Guid?>(null);
}
