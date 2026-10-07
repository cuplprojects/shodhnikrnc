namespace API.Application.Departments;

public class DepartmentNotFoundException(Guid id)
    : Exception($"Department '{id}' was not found.");
