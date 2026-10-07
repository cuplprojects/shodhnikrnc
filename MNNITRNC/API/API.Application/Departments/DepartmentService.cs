using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Departments;

public class DepartmentService(IApplicationDbContext db) : IDepartmentService
{
    public async Task<IReadOnlyList<DepartmentResponse>> ListActiveAsync(CancellationToken ct = default) =>
        await db.Departments
            .AsNoTracking()
            .Where(d => d.IsActive)
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentResponse(d.Id, d.Code, d.Name, d.HeadUserId, d.IsInstituteWide, d.IsActive))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<DepartmentResponse>> ListAllAsync(CancellationToken ct = default) =>
        await db.Departments
            .AsNoTracking()
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentResponse(d.Id, d.Code, d.Name, d.HeadUserId, d.IsInstituteWide, d.IsActive))
            .ToListAsync(ct);

    public async Task<DepartmentResponse> CreateAsync(
        CreateDepartmentRequest request, CancellationToken ct = default)
    {
        var code = RequireCode(request.Code);
        var name = RequireName(request.Name);
        await EnsureCodeIsUniqueAsync(code, excludingId: null, ct);

        var department = new Department
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            IsInstituteWide = request.IsInstituteWide,
            IsActive = true,
        };
        db.Departments.Add(department);
        await db.SaveChangesAsync(ct);

        return ToResponse(department);
    }

    public async Task<DepartmentResponse> UpdateAsync(
        Guid id, UpdateDepartmentRequest request, CancellationToken ct = default)
    {
        var department = await db.Departments.FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw new DepartmentNotFoundException(id);

        var code = RequireCode(request.Code);
        var name = RequireName(request.Name);
        await EnsureCodeIsUniqueAsync(code, excludingId: id, ct);

        department.Code = code;
        department.Name = name;
        department.HeadUserId = request.HeadUserId;
        department.IsInstituteWide = request.IsInstituteWide;
        department.IsActive = request.IsActive;
        await db.SaveChangesAsync(ct);

        return ToResponse(department);
    }

    private static DepartmentResponse ToResponse(Department d) =>
        new(d.Id, d.Code, d.Name, d.HeadUserId, d.IsInstituteWide, d.IsActive);

    private static string RequireCode(string code)
    {
        var trimmed = code?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            throw new ArgumentException("A department code is required.", nameof(code));
        }

        return trimmed;
    }

    private static string RequireName(string name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            throw new ArgumentException("A department name is required.", nameof(name));
        }

        return trimmed;
    }

    private async Task EnsureCodeIsUniqueAsync(string code, Guid? excludingId, CancellationToken ct)
    {
        var exists = await db.Departments
            .Where(d => d.Id != excludingId)
            .AnyAsync(d => d.Code.ToLower() == code.ToLower(), ct);

        if (exists)
        {
            throw new DepartmentCodeAlreadyExistsException(code);
        }
    }
}
