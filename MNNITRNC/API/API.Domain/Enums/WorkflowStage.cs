namespace API.Domain.Enums;

public enum WorkflowStage
{
    Raised,
    SignedCopyUploaded,
    Assigned,
    Forwarded,
    ForwardedOSRC,
    ForwardedDR,
    Approved,
    Rejected,
    Director,
    Cancelled,

    // Appended for Phase 9's research proposal chain (BRD Prompt 1), never
    // inserted: this enum persists as an int on WorkflowStageDefinition and
    // WorkflowStep, so reordering would repoint every stored route and every
    // recorded step at the wrong stage.
    Draft,
    WithHOD,
    WithRnCOffice,
    AssignedToDealingAssistant,
    WithSuperintendent,
    WithDeputyRegistrar,
    WithDean,

    // Appended when Return was found to skip the PI entirely: it landed
    // directly on AssignedToDealingAssistant, a stage the PI (role Faculty)
    // has no permission to act at, so a returned proposal could never
    // actually be revised by the person who owns it. This is the PI's own
    // stage to fix the proposal and forward it back into the office chain --
    // ResubmitEntrySequence now points here instead.
    ReturnedToPI,

    // Fellowship claim approval stages (Phase 6): PI → HOD → Dean
    WithPIFellowship,
    WithHODFellowship,
    WithDeanFellowship,
    ReturnedByHODToPI,
    ReturnedByDeanToPI,

    // Advertisement approval chain (recruitment): PI raises -> RnC office
    // approves/rejects/returns -> PI forwards -> Computer Centre approves,
    // which is the moment the advertisement goes live. Distinct names from
    // the ResearchProposal route's WithHOD/WithRnCOffice/ReturnedToPI are
    // used deliberately, even though a WorkflowStage value is only ever
    // scoped per-definition by its WorkflowStageDefinition row: keeping the
    // names distinct keeps the audit trail (WorkflowStep.Stage) unambiguous
    // when read outside the context of its owning WorkflowInstance.RequestType.
    WithPIAdvertisement,
    WithRnCOfficeAdvertisement,
    ReturnedToPIAdvertisement,
    WithComputerCentre,

    // Grant receipt approval stages: PI -> HOD -> DA -> Superintendent ->
    // DeputyRegistrar -> Dean. Distinct names from the ResearchProposal
    // route's WithHOD/WithRnCOffice/WithDean/ReturnedToPI (and from its own
    // AssignedToDealingAssistant/WithSuperintendent/WithDeputyRegistrar) are
    // used deliberately, even though a WorkflowStage value is only ever
    // scoped per-definition by its WorkflowStageDefinition row: keeping the
    // names distinct keeps the audit trail (WorkflowStep.Stage) unambiguous
    // when read outside the context of its owning WorkflowInstance.RequestType.
    WithHODGrantReceipt,
    WithRnCOfficeGrantReceipt,
    WithDeanGrantReceipt,
    ReturnedToPIGrantReceipt,

    // Dynamic Indent approval chain: PI -> HOD -> R&C Office -> Dealing
    // Assistant -> Superintendent -> Deputy Registrar -> Dean/Director.
    // Distinct names keep the WorkflowStep audit trail readable without
    // loading the owning WorkflowInstance -- same convention as above.
    IndentRaised,
    IndentWithHOD,
    IndentWithRnCOffice,
    IndentAssignedToDA,
    IndentWithSuperintendent,
    IndentWithDeputyRegistrar,
    IndentWithDean,
    IndentApproved,
    IndentReturnedToPI,
    
    // Fellowship claim extension stages
    WithDAFellowship,
    WithSuperintendentFellowship,
    WithDRFellowship,
    ReturnedByDAToPI,
    ReturnedBySuperintendentToPI,
    ReturnedByDRToPI,

    // Travel request raised by a Fellow: sits with the PI first so they
    // can review and forward to HOD before it enters the office chain.
    WithPITravel,

    // Reappropriation approval stages
    ReappropriationWithHOD,
    ReappropriationWithDA,
    ReappropriationWithSuperintendent,
    ReappropriationWithDR,
    ReappropriationWithDean,
    ReappropriationReturnedToPI,
    // Committee Formation Revamp
    WithPIScreeningCommittee,
    WithDeanScreeningCommittee,
    ScreeningCommitteeApproved,
    WithPISelectionCommittee,
    WithDeanSelectionCommittee,
    SelectionCommitteeApproved,
    ReturnedToPISelectionCommittee,

    // Grant receipt chain expansion: PI -> HOD -> DA -> Superintendent ->
    // DeputyRegistrar -> Dean, splitting the old combined
    // WithRnCOfficeGrantReceipt stage into three separate single-role
    // stages, matching ResearchProposal's chain depth (AssignedToDealingAssistant/
    // WithSuperintendent/WithDeputyRegistrar) in shape but not in enum value --
    // distinct type-suffixed names keep the WorkflowStep audit trail
    // unambiguous without loading the owning WorkflowInstance.RequestType,
    // same convention as every other request type's own office stages.
    AssignedToDAGrantReceipt,
    WithSuperintendentGrantReceipt,
    WithDeputyRegistrarGrantReceipt,
}
