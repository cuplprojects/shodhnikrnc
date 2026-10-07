using API.Domain.Enums;

namespace API.Domain.Entities;

/// <summary>
/// One recruitment drive against a sanctioned manpower position.
/// </summary>
public class RecruitmentRequest
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid SanctionedManpowerPositionId { get; set; }

    /// <summary>
    /// Null until the merit list goes to the Dean. Only that approval step runs
    /// through the workflow engine; the earlier transitions have no office
    /// escalation chain, so they are this entity's own stage machine.
    /// </summary>
    public Guid? WorkflowInstanceId { get; set; }

    /// <summary>
    /// The advertisement approval chain's own instance (PI -> RnC office -> PI
    /// -> Computer Centre), separate from <see cref="WorkflowInstanceId"/>
    /// because that field is already committed to the later merit-list
    /// approval -- a RecruitmentRequest legitimately has both, at different
    /// points in its lifecycle, and each must remain independently
    /// addressable. Null until the first AdvertiseAsync call raises it.
    /// </summary>
    public Guid? AdvertisementWorkflowInstanceId { get; set; }

    /// <summary>
    /// The Screening Committee formation workflow instance (RequestType.
    /// ScreeningCommittee), separate from WorkflowInstanceId (merit-list
    /// approval) and AdvertisementWorkflowInstanceId (ad approval) -- a
    /// RecruitmentRequest can carry up to four independent workflow instances.
    /// </summary>
    public Guid? ScreeningCommitteeWorkflowInstanceId { get; set; }

    /// <summary>The Selection Committee formation workflow instance (RequestType.SelectionCommittee).</summary>
    public Guid? SelectionCommitteeWorkflowInstanceId { get; set; }

    /// <summary>
    /// The offer-release approval chain's own WorkflowInstance id --
    /// separate from WorkflowInstanceId (merit-list approval),
    /// AdvertisementWorkflowInstanceId (ad approval),
    /// ScreeningCommitteeWorkflowInstanceId, and
    /// SelectionCommitteeWorkflowInstanceId. A re-offer round (Part B of
    /// the 2026-09-23 design) raises a FRESH instance here each time,
    /// overwriting this field -- only the current round's instance is
    /// ever live at once.
    /// </summary>
    public Guid? OfferWorkflowInstanceId { get; set; }

    /// <summary>
    /// The Candidate the PI actually named in IssueOfferLetterAsync's
    /// IssueOfferInput, held here so ReleaseOfferLetterAsync releases the
    /// offer to that EXACT candidate rather than re-deriving one from
    /// Outcome/MeritRank at release time. Re-derivation is ambiguous: after
    /// a prior round's decline (Task 3's DeclineOfferAsync), an unrelated
    /// candidate can also be left CandidateOutcome.Pending, so "the pending
    /// candidate" is not guaranteed to be unique by the time the approval
    /// chain concludes. Set by IssueOfferLetterAsync when it raises the
    /// chain; cleared once ReleaseOfferLetterAsync consumes it.
    /// </summary>
    public Guid? PendingOfferCandidateId { get; set; }

    public RecruitmentStage Stage { get; set; } = RecruitmentStage.Draft;

    /// <summary>
    /// Starts at 1 and increments on each re-advertisement. The BRD asks for "a
    /// repeatable sub-state, not a one-time flag" -- a boolean could not answer
    /// how many rounds ran.
    /// </summary>
    public int AdvertisementRound { get; set; } = 1;

    public DateOnly? InterviewDate { get; set; }
    public TimeOnly? InterviewTime { get; set; }
    public string? InterviewVenue { get; set; }

    /// <summary>
    /// In-progress advertisement text saved via "Save as Draft" -- distinct
    /// from any real <see cref="Advertisement"/> row, which only exists once
    /// the PI actually submits. Never touched by the approval workflow, the
    /// PDF generator, or the applicant-facing listing. Null until the PI
    /// saves a draft at least once; cleared on a successful AdvertiseAsync/
    /// ReadvertiseAsync call, since the submission supersedes it.
    /// </summary>
    public string? DraftAdvertisementText { get; set; }
    public DateOnly? DraftClosingDate { get; set; }

    /// <summary>
    /// Candidate criteria requirements set during advertisement creation.
    /// Comma-separated list of required qualification levels (e.g., "10th,12th,UG,PG").
    /// </summary>
    public string? RequiredQualifications { get; set; }
    public bool AllowDiplomaFor12th { get; set; } = true;
    public bool RequireExperience { get; set; } = false;
    public int MinExperienceMonths { get; set; } = 0;
    public bool RequirePublications { get; set; } = false;
    public bool RequireResume { get; set; } = true;

    public string? DraftRequiredQualifications { get; set; }
    public bool? DraftAllowDiplomaFor12th { get; set; }
    public bool? DraftRequireExperience { get; set; }
    public int? DraftMinExperienceMonths { get; set; }
    public bool? DraftRequirePublications { get; set; }
    public bool? DraftRequireResume { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public List<Advertisement> Advertisements { get; set; } = [];
    public List<Candidate> Candidates { get; set; } = [];
    public List<CommitteeMember> CommitteeMembers { get; set; } = [];
}
