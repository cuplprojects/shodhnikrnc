namespace API.Domain.Entities;

/// <summary>
/// Insert-only history of a project's permanent Dealing Assistant (the
/// RegularStaff-role user routed all of that project's subsequent
/// requests to) over time. One row per AssignDaAsync call -- the very
/// first assignment has FromUserId/FromUserName null; every later
/// reassignment has both populated from the project's CurrentDaUserId at
/// the moment of the call. Never updated once inserted.
/// </summary>
public class ProjectDaAssignmentLog
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? FromUserId { get; set; }
    public string? FromUserName { get; set; }
    public Guid ToUserId { get; set; }
    public required string ToUserName { get; set; }
    public required string Reason { get; set; }
    public Guid PerformedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
