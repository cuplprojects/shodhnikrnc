namespace API.Application.Departments;

public record DepartmentResponse(
    Guid Id, string Code, string Name, Guid? HeadUserId, bool IsInstituteWide, bool IsActive);

/// <summary>
/// The shape returned by the anonymous-accessible active-departments read
/// (DepartmentsController.ListActive), used by the Faculty self-registration
/// form's department dropdown before the registrant has an account.
/// </summary>
/// <remarks>
/// Deliberately narrower than <see cref="DepartmentResponse"/>: HeadUserId is
/// an internal ApplicationUser id with no reason to be readable by an
/// unauthenticated caller -- no dropdown consumer of this endpoint has ever
/// used it, it is only needed by the authenticated admin views that already
/// go through ListAll/Create/Update instead.
/// </remarks>
public record ActiveDepartmentResponse(Guid Id, string Code, string Name, bool IsInstituteWide, bool IsActive);

public record CreateDepartmentRequest(string Code, string Name, bool IsInstituteWide);

public record UpdateDepartmentRequest(
    string Code, string Name, Guid? HeadUserId, bool IsInstituteWide, bool IsActive);
