using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// A fellow's leave allowance for one type in one project year.
/// </summary>
/// <remarks>
/// Created on first use rather than seeded at joining: a fellow who never takes
/// leave needs no row.
///
/// <see cref="ProjectYear"/> is the year of the fellow's own tenure, computed
/// from their JoinedOn -- not the calendar year. A fellow joining in October
/// should not have their annual allowance reset the following January.
/// </remarks>
public class LeaveEntitlement
{
    public Guid Id { get; set; }
    public Guid FellowAppointmentId { get; set; }

    public LeaveType LeaveType { get; set; }
    public int ProjectYear { get; set; }

    public int EntitledDays { get; set; }

    /// <summary>
    /// Advanced only when a request is approved. Consuming at raise would let a
    /// rejected request permanently reduce the balance.
    /// </summary>
    public int ConsumedDays { get; set; }
}
