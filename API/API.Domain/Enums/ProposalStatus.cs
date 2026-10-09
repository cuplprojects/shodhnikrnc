namespace API.Domain.Enums;

/// <summary>
/// Where a research proposal is in its lifecycle -- BRD Prompt 1.
/// </summary>
/// <remarks>
/// Deliberately distinct from <see cref="WorkflowStage"/>. WorkflowStage tracks
/// position within the internal approval chain (Draft, WithHOD, ...); this
/// tracks the broader lifecycle that chain sits inside, including the part
/// after internal approval ends and the workflow instance concludes --
/// submission to the funding agency and its decision, which the workflow
/// engine has no view into.
///
/// <see cref="Approved"/> means endorsed internally, not funded: the institute
/// has signed off on submitting the proposal, and the money is not committed.
/// Only <see cref="Sanctioned"/> means a Project exists. Some approved
/// proposals will never reach it, and that is a normal outcome, not an error
/// state -- see ResearchProposal.ProjectId, which stays null until then.
///
/// Persisted as an int; append only.
/// </remarks>
public enum ProposalStatus
{
    /// <summary>The PI is still editing. Not yet raised as a workflow instance.</summary>
    Draft,

    /// <summary>In the internal approval chain.</summary>
    UnderApproval,

    /// <summary>Endorsed internally, ready to submit to the funding agency.</summary>
    Approved,

    /// <summary>Sent to the agency; awaiting its decision.</summary>
    SubmittedToAgency,

    /// <summary>The agency funded it. A Project now exists.</summary>
    Sanctioned,

    /// <summary>The agency declined, or did not respond.</summary>
    NotFunded,

    /// <summary>Refused internally, by Superintendent, DR or Dean.</summary>
    Rejected,

    /// <summary>The PI withdrew it.</summary>
    Withdrawn
}
