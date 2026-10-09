namespace API.Application.Departments;

public interface IDepartmentService
{
    /// <summary>Active departments only -- dropdown sources (e.g. Create Faculty User).</summary>
    Task<IReadOnlyList<DepartmentResponse>> ListActiveAsync(CancellationToken ct = default);

    /// <summary>Every department, active or not -- the admin page manages both.</summary>
    Task<IReadOnlyList<DepartmentResponse>> ListAllAsync(CancellationToken ct = default);

    Task<DepartmentResponse> CreateAsync(CreateDepartmentRequest request, CancellationToken ct = default);

    /// <summary>
    /// No delete: a department is referenced by users, proposals, projects and
    /// page-access rows, so IsActive (already on the entity) is the only
    /// supported way to retire one.
    /// </summary>
    Task<DepartmentResponse> UpdateAsync(Guid id, UpdateDepartmentRequest request, CancellationToken ct = default);
}
