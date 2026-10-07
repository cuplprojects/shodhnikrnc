namespace RMS.Models
{
    public enum DecisionStatus
    {
        ApplicationScreeningPending = 0,
        ApplicationScreeningHold = 1,
        ApplicationScreeningRejected = 2,
        ApplicationScreeningPassed = 3,

        InterviewScheduled = 4,
        InterviewRejected = 5,
        InterviewApproved = 6,

        CounsellingScheduled = 7,
        CounsellingUnderReview = 8,
        CounsellingRejectedFinal = 9,
        CounsellingApprovedFinal = 10,

        CourseworkRejected = 11,
        CourseworkApproved = 12,

        SysnopsisSubmitted = 13,
        SysnopsisApproved = 14,
        SysnopsisRejected = 15,

    }
}
