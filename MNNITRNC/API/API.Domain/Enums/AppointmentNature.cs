namespace API.Domain.Enums;

/// <summary>
/// Nature of employment appointment for candidate work/research experience.
/// Stored in CandidateExperience.NatureOfAppointment.
/// </summary>
public enum AppointmentNature
{
    RegularPermanent,
    Contractual,
    TemporaryAdhoc,
    ProjectStaff,
    GuestVisitingFaculty,
    IndustryCorporate,
    Other
}
