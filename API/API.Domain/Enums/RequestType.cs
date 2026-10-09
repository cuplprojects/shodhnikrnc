namespace API.Domain.Enums;

public enum RequestType
{
    Consumable,
    Contingency,
    Equipment,
    Travel,
    ManpowerDocument,

    // Appended, never inserted: these persist as ints, so reordering would
    // change what existing workflow rows mean.
    FellowshipClaim,
    LeaveRequest,

    // Phase 9: BRD Prompt 1's research proposal, which precedes a Project
    // rather than being a variant of any existing request type. Projects
    // themselves carry no RequestType because they do not run through the
    // workflow engine -- a proposal is what does, up to the point of sanction.
    ResearchProposal,

    // The advertisement approval chain (PI -> RnC office -> PI -> Computer
    // Centre) that a RecruitmentRequest routes through before it can go
    // live, tracked via RecruitmentRequest.AdvertisementWorkflowInstanceId --
    // separate from the merit-list approval chain that RecruitmentRequest
    // already routes through via WorkflowInstanceId.
    Advertisement,

    // A grant receipt goes through PI -> HOD -> RnC office -> Dean before it
    // counts as real money against the project's sanctioned budget --
    // tracked via GrantReceipt.WorkflowInstanceId. Reuses the same route
    // depth as ResearchProposal (the deepest chain in this codebase),
    // deliberately: the senior sign-off governing money going OUT via a
    // proposal should also govern money confirmed as having come IN.
    GrantReceipt,

    // The new unified Dynamic Indent — covers Consumable, Contingency and
    // Equipment in a single form. Backed by the Indents + IndentItems tables
    // rather than the three legacy parallel tables. All three legacy types
    // (Consumable, Contingency, Equipment) remain in use for historical
    // indents raised through the old form.
    DynamicIndent,

    // Was briefly inserted between LeaveRequest and ResearchProposal (commit
    // fc20e92, 2026-09-18), which silently shifted every later member's
    // stored ordinal by one and corrupted live WorkflowDefinition/
    // WorkflowInstance rows for ResearchProposal/Advertisement/GrantReceipt/
    // DynamicIndent -- exactly the failure mode this enum's own "appended,
    // never inserted" rule exists to prevent. Moved to the end and the
    // handful of WorkflowInstance rows seeded under the broken ordering
    // (2026-09-18, after that commit) were corrected by hand to match.
    // Never move this again; append only.
    LeaveCancellation,

    // Added by a collaborator's branch, appended after LeaveCancellation on
    // that branch. This repo's ScreeningCommittee/SelectionCommittee (below)
    // were seeded live under ordinals 12/13, colliding with Reappropriation's
    // ordinal 12 on that branch once both sets of migrations hit the same
    // shared database (see 2026-09-23 diagnosis: a WorkflowDefinition row
    // named "Reappropriation Approval" was found stored under RequestType=12
    // where this repo's code expected ScreeningCommittee, causing screening-
    // committee approval actions to fail against the wrong route). Resolved
    // by keeping Reappropriation at 12 (matching what's already deployed on
    // that branch) and moving ScreeningCommittee/SelectionCommittee down to
    // 13/14 -- this requires a corresponding live-data renumbering of any
    // already-seeded RequestType=12/13 WorkflowDefinition/WorkflowInstance
    // rows (12->13, 13->14) to match, tracked separately from this commit.
    Reappropriation,

    // Committee Formation Revamp: Screening and Selection Committee formation
    // each become a tracked PI<->Dean workflow instead of plain CRUD, reusing
    // WorkflowEngineService for Forward/Return/history exactly as Advertisement
    // and GrantReceipt already do.
    ScreeningCommittee,
    SelectionCommittee,

    // Project Module Enhancement: Re-approval workflow when PI updates project details.
    ProjectUpdate,
    ProjectEdit
}
