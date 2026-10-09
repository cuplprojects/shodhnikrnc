using API.Application.Common;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API.Application.FacultyUsers;

public class FacultyUserService(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager) : IFacultyUserService
{
    public async Task<FacultyProfileResponse> CreateFacultyUserAsync(CreateFacultyUserRequest request, CancellationToken cancellationToken = default)
    {
        var userId = request.EmployeeId.Trim();
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new ArgumentException("Employee ID is required.", nameof(request.EmployeeId));
        }

        var exists = await db.FacultyUsers.AnyAsync(u => u.UserId == userId, cancellationToken) ||
                     await db.FacultyProfiles.AnyAsync(p => p.UserId == userId, cancellationToken);

        if (exists)
        {
            throw new InvalidOperationException($"Faculty user with Employee ID '{userId}' already exists.");
        }

        var facultyUser = new FacultyUser
        {
            UserId = userId,
            Password = HashPasswordSha256Base64(request.Password),
            Name = request.FullName.Trim()
        };

        var facultyProfile = new API.Domain.Entities.FacultyProfile
        {
            UserId = userId,
            Name = request.FullName.Trim(),
            Department = request.Department?.Trim(),
            Designation = request.Designation?.Trim(),
            Gender = request.Gender?.Trim(),
            Qualification = request.Qualification?.Trim(),
            JoiningDate = request.JoiningDate,
            ResearchArea = request.ResearchArea?.Trim(),
            Photo = request.Photo?.Trim(),
            Email = request.Email?.Trim()
        };

        db.FacultyUsers.Add(facultyUser);
        db.FacultyProfiles.Add(facultyProfile);

        await db.SaveChangesAsync(cancellationToken);

        return MapToResponse(facultyProfile);
    }

    public async Task<IReadOnlyList<FacultyProfileResponse>> GetAllFacultyProfilesAsync(CancellationToken cancellationToken = default)
    {
        var profiles = await db.FacultyProfiles
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var response = profiles.Select(MapToResponse).ToList();

        var facultyUsers = await userManager.GetUsersInRoleAsync("Faculty");
        var hodUsers = await userManager.GetUsersInRoleAsync("HOD");
        
        var combinedAppUsers = facultyUsers.Concat(hodUsers).DistinctBy(u => u.Id).Where(u => u.IsActive).ToList();
        
        if (combinedAppUsers.Any())
        {
            var deptIds = combinedAppUsers.Where(u => u.DepartmentId.HasValue).Select(u => u.DepartmentId!.Value).Distinct().ToList();
            var departments = await db.Departments.Where(d => deptIds.Contains(d.Id)).ToDictionaryAsync(d => d.Id, d => d.Name, cancellationToken);
            
            foreach (var u in combinedAppUsers)
            {
                var existsInProfiles = response.Any(r => r.UserId == u.Id.ToString() || (!string.IsNullOrEmpty(r.Email) && string.Equals(r.Email, u.Email, StringComparison.OrdinalIgnoreCase)));
                if (!existsInProfiles)
                {
                    var deptName = u.DepartmentId.HasValue && departments.TryGetValue(u.DepartmentId.Value, out var name) ? name : null;
                    if (deptName != null)
                    {
                        response.Add(new FacultyProfileResponse(
                            u.Id.ToString(),
                            u.FullName,
                            deptName,
                            "Faculty",
                            null, null, null, null, null,
                            u.Email
                        ));
                    }
                }
            }
        }

        return response;
    }

    public async Task<FacultyProfileResponse?> GetFacultyProfileByUserIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        var profile = await db.FacultyProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

        return profile is null ? null : MapToResponse(profile);
    }

    private static FacultyProfileResponse MapToResponse(API.Domain.Entities.FacultyProfile p) =>
        new(
            p.UserId,
            p.Name ?? string.Empty,
            p.Department,
            p.Designation,
            p.Gender,
            p.Qualification,
            p.JoiningDate,
            p.ResearchArea,
            p.Photo,
            p.Email
        );

    private static string HashPasswordSha256Base64(string password)
    {
        if (string.IsNullOrEmpty(password))
        {
            return string.Empty;
        }

        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }
}
