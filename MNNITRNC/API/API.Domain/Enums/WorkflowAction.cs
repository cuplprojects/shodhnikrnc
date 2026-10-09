namespace API.Domain.Enums;

public enum WorkflowAction
{
    Raise,
    UploadSignedCopy,
    Assign,
    Forward,
    Approve,
    Reject,
    ForwardToDirector,
    Cancel,

    // Appended for Phase 9's resubmission handling (BRD Prompt 0: "resubmission
    // behavior is configurable per workflow definition"), never inserted -- this
    // enum persists as an int on WorkflowStep.
    Return
}
