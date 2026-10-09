namespace API.Domain.Enums;

/// <summary>
/// Where a recruitment has reached. Legacy tracked this implicitly through rows
/// in manpower_process with a document_type -- meaning "what stage is this at"
/// was a query over documents. This makes it a stated fact.
/// </summary>
public enum RecruitmentStage
{
    Draft,
    AdvertisementRequested,
    Advertised,
    ScreeningInProgress,
    SelectionScheduled,
    MeritListPrepared,
    Approved,
    OfferIssued,
    JoiningSubmitted,
    JoiningPendingHOD,
    JoiningPendingDean,
    Joined,
    Closed,

    // Phase 3 (2026-09-23): the offer-release approval chain and the
    // re-offer loop's exhaustion state. Appended, never inserted -- see
    // this enum's own doc comment and DocumentKind's identical convention.
    OfferPendingApproval,
    NoCandidateAccepted
}

public enum ScreeningResult
{
    Eligible,
    Ineligible
}

/// <summary>
/// BRD A2: offline by default, online only with prior Dean approval.
/// </summary>
public enum InterviewMode
{
    Offline,
    Online
}

public enum CandidateOutcome
{
    Pending,
    NotSelected,
    Selected
}

/// <summary>
/// A candidate's response to an issued offer. Null on Candidate.OfferResponse
/// means no response yet. Deliberately separate from CandidateOutcome, which
/// already means "this is our pick" and is load-bearing in RecruitmentService
/// at the joining-eligibility gate and two document/PDF-generation lookups --
/// see Candidate.OfferResponse's own doc comment.
/// </summary>
public enum CandidateOfferResponse
{
    Accepted,
    Declined
}

public enum CommitteeKind
{
    Screening,
    Selection
}

/// <summary>
/// Screening: PI (Chairman) + Co-PI (if the project has one) + one
/// Dean-nominated faculty member. Selection (revamped, 2026-09-22): PI +
/// HOD auto-selected, one PI-chosen OptionalMember, 3-5 PI-recommended
/// candidates (InternalNominee/ExternalNominee roles, meaning Inside/
/// Outside Institute -- not department-internal/external as the roles'
/// names might suggest from the old rule), of which the Dean marks exactly
/// one CommitteeMember.IsSelectedByDean = true to finalize the committee.
/// </summary>
public enum CommitteeRole
{
    Chairman,
    PrincipalInvestigator,
    CoPrincipalInvestigator,
    NominatedFaculty,
    InternalNominee,
    ExternalNominee,
    OptionalMember,
}

public enum ManpowerSelectionStatus
{
    Active,
    Inactive
}

public enum Gender
{
    Male,
    Female,
    Other
}
