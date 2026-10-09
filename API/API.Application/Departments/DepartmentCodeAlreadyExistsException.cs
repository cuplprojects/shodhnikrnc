namespace API.Application.Departments;

/// <summary>
/// DepartmentSeeder.SeedAsync and IUserDepartmentProvider both join on Code,
/// so a duplicate would make that join ambiguous -- rejected up front rather
/// than silently stored.
/// </summary>
public class DepartmentCodeAlreadyExistsException(string code)
    : InvalidOperationException($"A department with code '{code}' already exists.");
