using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// A fellow's leave request. Legacy had no equivalent table -- leave counts were
/// typed onto the stipend form by whoever prepared it -- so this is built from
/// BRD A6 alone.
/// </summary>
public class LeaveRequest
{
    public Guid Id { get; set; }
    public Guid FellowAppointmentId { get; set; }
    public Guid WorkflowInstanceId { get; set; }

    public LeaveType LeaveType { get; set; }

    public List<DateOnly> Dates { get; set; } = [];

    /// <summary>Optional dates when the student will be out of station (not counted as leave)</summary>
    public List<DateOnly> OutOfStationDates { get; set; } = [];

    /// <summary>Inclusive of both endpoints, derived at raise time.</summary>
    public int DayCount { get; set; }

    /// <summary>Required for <see cref="LeaveType.Special"/> (conference participation).</summary>
    public string? Purpose { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
