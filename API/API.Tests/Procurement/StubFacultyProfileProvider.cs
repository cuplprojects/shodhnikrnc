using API.Application.Procurement;

namespace API.Tests.Procurement;

public class StubFacultyProfileProvider : IFacultyProfileProvider
{
    public Task<FacultyProfileInfo> GetAsync(Guid userId, CancellationToken ct = default)
        => Task.FromResult(new FacultyProfileInfo("Dr. A Sharma", "Professor", "Computer Science and Engineering"));
}
