using API.Domain.Enums;

namespace API.Application.Recruitment;

/// <summary>
/// Applying is blocked until the applicant confirms their email address
/// (stakeholder direction, spec D2a). The account exists; only applying is held.
/// </summary>
public class EmailNotVerifiedException(Guid userId)
    : InvalidOperationException(
        "Please verify your email address before applying. Check your inbox for a verification link.");

/// <summary>
/// Prefill may only copy from an application the caller themselves made.
/// Without this, passing another applicant's candidate id would disclose their
/// personal details.
/// </summary>
public class PrefillNotOwnedException(Guid candidateId)
    : InvalidOperationException(
        "You can only prefill from your own previous applications.");

public class DuplicateApplicationException(Guid recruitmentRequestId)
    : InvalidOperationException(
        "You have already submitted an application for this position. Only one application per position is allowed.");

public class RecruitmentRequestNotFoundException(Guid recruitmentRequestId)
    : Exception("This recruitment could not be found. It may have been removed or the link is incorrect.");

public class CandidateNotFoundException(Guid candidateId)
    : Exception("The selected applicant could not be found. Please refresh the page and try again.");

/// <summary>
/// A recruitment-lifecycle action (screening, merit ranking, interview mode,
/// offer, joining) was aimed at a Candidate row still in Draft.
/// </summary>
public class CandidateApplicationNotSubmittedException(Guid candidateId)
    : InvalidOperationException(
        "This applicant has not yet submitted their application and cannot be processed.");

/// <summary>
/// RecordJoiningAsync's eligibility checks: the candidate must be Selected and
/// must not already have a FellowAppointments row.
/// </summary>
public class CandidateNotEligibleToJoinException(string detail)
    : InvalidOperationException(detail);

/// <summary>
/// An offer or joining letter needs a Selected candidate to render.
/// </summary>
public class NoCandidateSelectedException(string detail)
    : InvalidOperationException(detail);

/// <summary>
/// BRD A2 states the composition of both committees, so a malformed roster is rejected.
/// </summary>
public class InvalidCommitteeCompositionException(string detail)
    : InvalidOperationException(detail);

/// <summary>
/// BRD A2: interviews are offline by default and online only with prior Dean approval.
/// </summary>
public class OnlineInterviewNotApprovedException(Guid candidateId)
    : InvalidOperationException(
        "An online interview requires prior approval from the Dean. Please request approval before setting the mode to Online.");

/// <summary>
/// The Dean's approval requires the signed merit list, attendance sheet,
/// and scanned Minutes of Selection to all be uploaded first -- this
/// replaces the earlier per-member e-signing requirement (BRD A2's
/// original mechanism), per 2026-09-22 direction: uploading the signed
/// merit list stands in for "all members signed."
/// </summary>
public class MeritListDocumentsMissingException(IReadOnlyList<DocumentKind> missingKinds)
    : InvalidOperationException(
        $"The following documents must be uploaded before the merit list can be approved: {string.Join(", ", missingKinds)}.");

/// <summary>
/// The Dean's final joining approval requires the signed Contract of
/// Engagement to be uploaded first -- same document-gate pattern as
/// MeritListDocumentsMissingException (Phase 2), single-kind instead of 3.
/// </summary>
public class JoiningDocumentsMissingException(IReadOnlyList<DocumentKind> missingKinds)
    : InvalidOperationException(
        $"The following documents must be uploaded before joining can proceed: {string.Join(", ", missingKinds)}.");

/// <summary>
/// BRD A2: the offer letter issues only once payment has been received.
/// </summary>
/// <remarks>
/// Payment is an offline NEFT/RTGS transfer, so the gate keys off a recorded
/// bank transaction reference rather than the mere existence of a receipt row.
/// </remarks>
public class PaymentNotReceivedException(Guid projectId)
    : InvalidOperationException(
        "The offer letter cannot be issued until a grant payment has been received and the bank transaction reference has been recorded for this project. Please add the grant receipt first.");

public class InvalidRecruitmentStageException(RecruitmentStageDetail detail)
    : InvalidOperationException(detail.Message);

/// <summary>
/// ReleaseOfferLetterAsync's gate: the offer's approval-chain workflow
/// instance has not yet reached WorkflowStage.Approved, or no such instance
/// exists on this request.
/// </summary>
public class OfferNotApprovedException(Guid recruitmentRequestId)
    : InvalidOperationException(
        "The offer's approval chain has not yet been fully approved. It cannot be released to the candidate until the Dean approves it.");

/// <summary>
/// A Forward/Approve/Reject/Return was aimed at a recruitment whose
/// advertisement has never been submitted for approval.
/// </summary>
public class AdvertisementWorkflowNotStartedException(Guid recruitmentRequestId)
    : InvalidOperationException(
        "No advertisement approval is currently in progress for this recruitment. Please generate and submit an advertisement first.");

/// <summary>
/// A step-save, submit, or prefill call in the application wizard named a
/// Candidate id that does not exist at all.
/// </summary>
public class CandidateDraftNotFoundException(Guid candidateId)
    : Exception("Your application draft could not be found. It may have expired. Please start a new application.");

/// <summary>
/// The wizard's own applicant-scoped loader's ownership check.
/// </summary>
public class CandidateDraftNotOwnedException(Guid candidateId)
    : InvalidOperationException(
        "You do not have access to this application draft.");

/// <summary>
/// SubmitOwnJoiningReportAsync's applicant-scoped ownership check -- the
/// caller's ApplicationUserId does not match the Candidate row's.
/// </summary>
public class CandidateApplicationNotOwnedException(Guid candidateId)
    : InvalidOperationException(
        "You do not have access to this application.");

/// <summary>
/// A step-save call (or a second SubmitDraftAsync) targeted a Candidate whose
/// ApplicationStatus is already Submitted.
/// </summary>
public class CandidateAlreadySubmittedException(Guid candidateId)
    : InvalidOperationException(
        "This application has already been submitted and can no longer be edited.");

/// <summary>
/// SubmitDraftAsync's minimum-completeness gate.
/// </summary>
public class IncompleteApplicationException(Guid candidateId, string missing)
    : InvalidOperationException(
        $"Your application is incomplete and cannot be submitted. The following information is missing: {missing}. Please complete all required sections.");

/// <summary>Carries the message so the exception stays a one-liner at call sites.</summary>
public record RecruitmentStageDetail(string Message)
{
    public static RecruitmentStageDetail For(Guid id, object actual, object required) =>
        new($"This action cannot be performed right now because the recruitment is in the '{actual}' stage. It requires the '{required}' stage.");
}
