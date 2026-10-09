using API.Domain.Enums;

namespace API.Application.Recruitment;

public interface IRecruitmentService
{
    // --- Task 6: advertisement and applications ---
    Task<Guid> CreateAsync(CreateRecruitmentInput input, Guid piUserId, CancellationToken ct = default);
    /// <summary>
    /// <paramref name="piUserId"/> may be a SUBSTITUTED id: the controller swaps
    /// in the project owner's id when a Dean/Office user acts on a PI's behalf,
    /// and that substituted id is what authorizes the recruitment/project itself.
    /// <paramref name="templateCallerUserId"/> is the REAL authenticated
    /// principal's id, used only to authorize the chosen advertisement template.
    /// The two must stay separate: a template is private to the account that
    /// owns it, and the impersonation shim must not hand one PI's private
    /// template to another. Null (service-level callers with no impersonation in
    /// play) falls back to <paramref name="piUserId"/>.
    /// </summary>
    Task AdvertiseAsync(
        AdvertiseInput input, Guid piUserId,
        Guid? templateCallerUserId = null, CancellationToken ct = default);

    /// <inheritdoc cref="AdvertiseAsync"/>
    Task ReadvertiseAsync(
        ReadvertiseInput input, Guid piUserId,
        Guid? templateCallerUserId = null, CancellationToken ct = default);

    /// <summary>
    /// The live entity-bound token values (project title, PI name, salary
    /// figures, etc.) for this recruitment, exactly as
    /// AdvertisementTokenCatalogue.ResolveEntityBoundTokens computes them --
    /// reachable without an existing saved template, unlike
    /// IAdvertisementTemplateService.ResolveAsync. Used by the advertise-time
    /// rich text editor to insert a live-resolved value at the cursor.
    /// </summary>
    Task<IReadOnlyDictionary<string, string>> GetAdvertisementTokenValuesAsync(
        Guid recruitmentRequestId, Guid piUserId, CancellationToken ct = default);

    /// <summary>
    /// Saves the PI's in-progress advertisement text so it survives closing
    /// the modal -- distinct from AdvertiseAsync: no workflow is raised, no
    /// approval routing happens, and nothing here is visible to anyone but
    /// the PI reopening this same modal. Never validates the text is
    /// complete or ready to submit.
    /// </summary>
    Task SaveAdvertisementDraftAsync(
        Guid recruitmentRequestId, Guid piUserId, string text, DateOnly? closingDate,
        string? requiredQualifications = null, bool? allowDiplomaFor12th = null,
        bool? requireExperience = null, int? minExperienceMonths = null,
        bool? requirePublications = null, bool? requireResume = null,
        CancellationToken ct = default);

    /// <summary>
    /// Renders <paramref name="text"/> through the same advertisement layout
    /// the real PDF uses, without persisting anything or requiring the text
    /// to already be a saved Advertisement/draft -- backs the editor's live
    /// "Preview" button. <paramref name="text"/> is sanitized the same way a
    /// real submission would be before rendering.
    /// </summary>
    Task<string> PreviewAdvertisementHtmlAsync(
        Guid recruitmentRequestId, Guid piUserId, string text, DateOnly? closingDate,
        CancellationToken ct = default);

    /// <summary>Blocked until the applicant has confirmed their email (spec D2a).</summary>
    Task<Guid> ApplyAsync(ApplyInput input, Guid applicantUserId, CancellationToken ct = default);

    Task<IReadOnlyList<CandidateSummary>> ListOwnApplicationsAsync(
        Guid applicantUserId, CancellationToken ct = default);

    // --- Application wizard: step-scoped draft save + full-copy prefill ---

    /// <summary>Resumes the applicant's own live Draft for this recruitment if
    /// one exists, else creates a new one. Blocked by an existing Submitted
    /// application to the same recruitment, same as <see cref="ApplyAsync"/>.</summary>
    Task<Guid> StartOrResumeDraftAsync(
        Guid recruitmentRequestId, Guid applicantUserId, CancellationToken ct = default);

    Task SaveStep1PersonalAsync(SaveStep1PersonalInput input, Guid applicantUserId, CancellationToken ct = default);
    Task SaveStep2QualificationsAsync(SaveStep2QualificationsInput input, Guid applicantUserId, CancellationToken ct = default);
    Task SaveStep3ExperienceAsync(SaveStep3ExperienceInput input, Guid applicantUserId, CancellationToken ct = default);
    Task SaveStep4PublicationsAsync(SaveStep4PublicationsInput input, Guid applicantUserId, CancellationToken ct = default);
    Task SaveStep5ResumeAsync(SaveStep5ResumeInput input, Guid applicantUserId, CancellationToken ct = default);

    /// <summary>Flips a Draft to Submitted. <paramref name="photoDocumentId"/> is
    /// the passport photo uploaded on the review step -- it is the only field
    /// captured at submit time rather than by a save-step call, and is applied
    /// only when non-null so omitting it never clears an already-set photo.</summary>
    Task SubmitDraftAsync(
        Guid candidateId,
        Guid applicantUserId,
        Guid? photoDocumentId = null,
        Guid? signatureDocumentId = null,
        CancellationToken ct = default);

    /// <summary>Full current state of one still-Draft application, for the
    /// wizard's review step. Same ownership rule as every other draft
    /// endpoint: only the applicant who owns it may read it.</summary>
    Task<CandidateDraftDetail> GetOwnDraftAsync(
        Guid candidateId, Guid applicantUserId, CancellationToken ct = default);

    /// <summary>Starts (or resumes) a Draft for <paramref name="recruitmentRequestId"/>
    /// and copies every field, Education row, and Experience row from
    /// <paramref name="sourceCandidateId"/> into it by value -- the new draft is
    /// fully independent of the source afterward.</summary>
    Task<Guid> PrefillFromPreviousApplicationAsync(
        Guid recruitmentRequestId, Guid sourceCandidateId, Guid applicantUserId, CancellationToken ct = default);

    // --- Task 7: committees and screening ---
    Task SubmitScreeningCommitteeAsync(
        Guid recruitmentRequestId, IReadOnlyList<CommitteeMemberInput> members,
        Guid piUserId, CancellationToken ct = default);

    Task SubmitScreeningCommitteeForApprovalAsync(
        Guid recruitmentRequestId, Guid piUserId, CancellationToken ct = default);

    Task AssignScreeningCommitteeMemberAsync(
        Guid recruitmentRequestId, CommitteeMemberInput nominee, Guid deanUserId, CancellationToken ct = default);

    Task SubmitSelectionCommitteeAsync(
        Guid recruitmentRequestId, IReadOnlyList<CommitteeMemberInput> members,
        Guid piUserId, CancellationToken ct = default);

    /// <summary>
    /// Raises the Selection Committee formation workflow: auto-adds PI and
    /// HOD, optionally one PI-chosen member, and 3-5 PI-recommended
    /// candidates, then forwards to the Dean. Also used to resubmit after a
    /// Dean return.
    /// </summary>
    Task SubmitSelectionCommitteeForApprovalAsync(
        Guid recruitmentRequestId, CommitteeMemberInput? optionalMember,
        IReadOnlyList<CommitteeMemberInput> recommendedMembers, Guid piUserId, CancellationToken ct = default);

    /// <summary>
    /// The Dean picks exactly one of the 3-5 recommended members to finalize
    /// the Selection Committee, and approves in the same action.
    /// </summary>
    Task SelectSelectionCommitteeMemberAsync(
        Guid recruitmentRequestId, Guid selectedCommitteeMemberId, Guid deanUserId, CancellationToken ct = default);

    /// <summary>The Dean returns the Selection Committee submission to the PI for edits.</summary>
    Task ReturnSelectionCommitteeAsync(
        Guid recruitmentRequestId, string remarks, Guid deanUserId, CancellationToken ct = default);

    Task RecordScreeningResultAsync(RecordScreeningInput input, Guid piUserId, CancellationToken ct = default);

    /// <summary>
    /// Emails every candidate on this recruitment marked Not Eligible who
    /// has not yet been notified, including their ScreeningRemarks (the
    /// stated reason) in the body. Idempotent: a repeat call only emails
    /// candidates not already stamped NotEligibleEmailSentAt.
    /// </summary>
    Task<IReadOnlyList<Guid>> SendNotEligibleNotificationsAsync(
        Guid recruitmentRequestId, Guid piUserId, CancellationToken ct = default);

    Task SetNomineeAvailabilityAsync(
        Guid committeeMemberId, DateOnly availabilityDate, Guid piUserId, CancellationToken ct = default);

    // --- Task 8: interview, merit list, approval ---
    Task ScheduleInterviewAsync(ScheduleInterviewInput input, Guid piUserId, CancellationToken ct = default);

    /// <summary>Online mode requires <paramref name="deanApprovalUserId"/> (BRD A2).</summary>
    Task SetInterviewModeAsync(
        SetInterviewModeInput input, Guid piUserId, Guid? deanApprovalUserId, CancellationToken ct = default);

    Task SubmitMeritListAsync(
        Guid recruitmentRequestId, IReadOnlyList<MeritRankInput> ranks,
        Guid piUserId, CancellationToken ct = default);

    /// <summary>Throws unless the signed merit list, attendance sheet, and scanned
    /// Minutes of Selection have all been uploaded.</summary>
    Task ApproveMeritListAsync(Guid recruitmentRequestId, Guid deanUserId, CancellationToken ct = default);

    // --- Task 9: offer, joining, ID card ---
    /// <summary>
    /// Blocked until the project has a recorded grant receipt (spec D7). Raises
    /// the offer's own approval-chain workflow instance and moves the request to
    /// RecruitmentStage.OfferPendingApproval -- it no longer issues the offer
    /// immediately; ReleaseOfferLetterAsync does that once the chain approves.
    /// </summary>
    Task IssueOfferLetterAsync(IssueOfferInput input, Guid actorUserId, CancellationToken ct = default);

    /// <summary>
    /// The DA's (RegularStaff role) action once the offer's approval chain has
    /// reached WorkflowStage.Approved -- actually releases the offer to the
    /// candidate the PI named in IssueOfferLetterAsync, moves the request to
    /// RecruitmentStage.OfferIssued, closes the other candidates, and emails
    /// the offer.
    /// </summary>
    Task ReleaseOfferLetterAsync(Guid recruitmentRequestId, Guid actorUserId, CancellationToken ct = default);

    /// <summary>The candidate's own acceptance of an issued offer.</summary>
    Task AcceptOfferAsync(Guid candidateId, Guid applicantUserId, CancellationToken ct = default);

    /// <summary>
    /// The candidate's own decline of an issued offer -- reopens the other
    /// candidates from this round and returns the request to Approved for a
    /// manual re-offer.
    /// </summary>
    Task DeclineOfferAsync(Guid candidateId, Guid applicantUserId, CancellationToken ct = default);

    /// <summary>
    /// A PI/Dean's terminal declaration that this recruitment's candidate pool
    /// is exhausted with no one accepting.
    /// </summary>
    Task MarkNoCandidateAcceptedAsync(Guid recruitmentRequestId, Guid actorUserId, CancellationToken ct = default);

    /// <summary>Creates the fellow record and promotes the role Applicant -> Fellow.</summary>
    Task<Guid> RecordJoiningAsync(RecordJoiningInput input, Guid actorUserId, CancellationToken ct = default);

    /// <summary>Sets the gate Phase 6's leave module depends on (spec D4).</summary>
    Task IssueIdCardAsync(IssueIdCardInput input, Guid actorUserId, CancellationToken ct = default);

    // --- Queries ---
    Task<IReadOnlyList<RecruitmentSummary>> ListForProjectAsync(
        Guid projectId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default);

    /// <summary>All of the PI's own recruitments across every project they
    /// own, newest first -- the landing list a PI sees before drilling into
    /// one project's recruitments via <see cref="ListForProjectAsync"/>.</summary>
    Task<IReadOnlyList<RecruitmentSummary>> ListOwnAsync(
        Guid piUserId, bool isDeanOrOffice = false, CancellationToken ct = default);

    Task<RecruitmentSummary> GetAsync(Guid recruitmentRequestId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default);

    /// <summary>
    /// The PI who owns <paramref name="recruitmentRequestId"/> (its project's
    /// OwnerUserId), or null if the recruitment does not exist. Mirrors
    /// <c>IResearchProposalService.GetOwnershipAsync</c>'s shape -- used by
    /// <c>WorkflowController.Get</c> to redact internal advertisement-workflow
    /// steps from the PI the same way proposal steps are already redacted from
    /// a proposal's owner.
    /// </summary>
    Task<Guid?> GetOwnershipAsync(Guid recruitmentRequestId, CancellationToken ct = default);

    Task<IReadOnlyList<CandidateSummary>> ListCandidatesAsync(
        Guid recruitmentRequestId, Guid piUserId, CancellationToken ct = default);

    Task<IReadOnlyList<CandidateFullDetail>> ListCandidateDetailsAsync(
        Guid recruitmentRequestId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default);

    Task<IReadOnlyList<CommitteeMemberSummary>> ListCommitteeAsync(
        Guid recruitmentRequestId, CommitteeKind kind, Guid piUserId, CancellationToken ct = default);

    // --- Documents ---

    /// <summary>
    /// Renders one of the recruitment documents on demand.
    /// </summary>
    /// <remarks>
    /// Generated per request rather than stored: these reflect the current state
    /// of the drive (candidates screened so far, who has signed), so a copy saved
    /// at generation time would go stale. The signed copy that matters is uploaded
    /// separately through the document store.
    /// </remarks>
    Task<GeneratedDocument> GenerateDocumentAsync(
        Guid recruitmentRequestId, RecruitmentDocumentKind kind,
        Guid piUserId, string? coPiName = null, OfferLetterManualOverrides? overrides = null, CancellationToken ct = default);

    // --- Advertisement approval chain (PI -> RnC office -> Computer Centre) ---

    /// <summary>Advances the advertisement instance one stage along the route.</summary>
    Task ForwardAdvertisementAsync(
        Guid recruitmentRequestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    /// <summary>
    /// Approves at whichever stage the instance currently sits. Only the
    /// Computer Centre's approve -- the one that carries the instance to the
    /// route's terminal Approved stage -- flips
    /// <see cref="RecruitmentStage.Advertised"/>; the RnC office's approve
    /// merely advances to the Computer Centre.
    /// </summary>
    Task ApproveAdvertisementAsync(
        Guid recruitmentRequestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    /// <summary>Concludes the chain negatively; the ad never goes live.</summary>
    Task RejectAdvertisementAsync(
        Guid recruitmentRequestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    /// <summary>Sends the advertisement back to the PI to edit and resubmit
    /// (a further <see cref="AdvertiseAsync"/> call).</summary>
    Task ReturnAdvertisementAsync(
        Guid recruitmentRequestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default);

    // --- Gap Features: Dean Approvals & Joining Routing ---
    Task ApproveInterviewModeAsync(Guid candidateId, InterviewMode mode, Guid deanUserId, CancellationToken ct = default);
    Task NominateScreeningFacultyAsync(
        Guid recruitmentRequestId, string facultyName, string department, string position, Guid deanUserId,
        Guid? nomineeApplicationUserId = null, string? nomineeEmail = null, CancellationToken ct = default);

    Task SubmitJoiningReportAsync(RecordJoiningInput input, Guid piUserId, CancellationToken ct = default);

    /// <summary>The candidate-facing counterpart of SubmitJoiningReportAsync --
    /// same eligibility rule, ownership checked against the applicant instead of the PI.</summary>
    Task SubmitOwnJoiningReportAsync(RecordJoiningInput input, Guid applicantUserId, CancellationToken ct = default);

    /// <summary>The PI's own forward, from JoiningSubmitted (candidate's
    /// submission) to JoiningPendingHOD.</summary>
    Task ForwardJoiningReportToHodAsync(Guid candidateId, string? remarks, Guid piUserId, CancellationToken ct = default);
    Task ForwardJoiningReportAsync(Guid candidateId, string? remarks, Guid hodUserId, CancellationToken ct = default);
    Task ReturnJoiningReportAsync(Guid candidateId, string? remarks, Guid actorUserId, CancellationToken ct = default);
    Task ApproveJoiningReportAsync(Guid candidateId, string? remarks, Guid deanUserId, CancellationToken ct = default);
    Task<IReadOnlyList<JoiningQueueItemSummary>> ListJoiningQueueAsync(Guid actorUserId, CancellationToken ct = default);

    /// <summary>
    /// The joining details (Aadhar/PAN/bank/stipend/etc.) the PI submitted for
    /// one candidate, so HOD/Dean can actually see what they are verifying or
    /// approving -- null if the candidate has not submitted a joining report
    /// yet. Callers reached this candidate through recruitment.detail, so no
    /// separate ownership check gates the read.
    /// </summary>
    Task<JoiningReportDetail?> GetJoiningReportAsync(Guid candidateId, CancellationToken ct = default);

    Task<IReadOnlyList<RecruitmentSummary>> ListOpenAsync(CancellationToken ct = default);

    // --- Advertisement approval queues (discovery pages for the chain above) ---

    /// <summary>Recruitments whose advertisement is awaiting the RnC office's
    /// action -- <see cref="WorkflowStage.WithRnCOfficeAdvertisement"/>.</summary>
    Task<IReadOnlyList<RecruitmentSummary>> ListForRnCOfficeAdvertisementQueueAsync(
        Guid officeUserId, CancellationToken ct = default);

    /// <summary>Recruitments whose advertisement is awaiting the Computer
    /// Centre's action -- <see cref="WorkflowStage.WithComputerCentre"/>.</summary>
    Task<IReadOnlyList<RecruitmentSummary>> ListForComputerCentreQueueAsync(
        CancellationToken ct = default);

    /// <summary>Recruitments this Computer Centre user has already Published --
    /// the counterpart to <see cref="ListForComputerCentreQueueAsync"/>, since
    /// a recruitment leaves that queue the instant it is published, otherwise
    /// leaving no link back to it.</summary>
    Task<IReadOnlyList<RecruitmentSummary>> ListComputerCentreAdvertisementHistoryAsync(
        Guid actorUserId, CancellationToken ct = default);

    /// <summary>
    /// Recruitments whose advertisement instance currently sits at a stage
    /// <paramref name="roles"/> may act on -- the dashboard's "pending my
    /// action" panel. Built on <see cref="API.Application.Workflow.IWorkflowPendingQueryService"/>
    /// plus this service's own institute-wide/ComputerCentre gating, rather
    /// than delegating to <see cref="ListForRnCOfficeAdvertisementQueueAsync"/>
    /// or <see cref="ListForComputerCentreQueueAsync"/>.
    /// </summary>
    Task<IReadOnlyList<RecruitmentSummary>> ListPendingForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default);
}

public record OfferLetterManualOverrides(
    string? CandidateName,
    string? ParentName,
    string? Address,
    string? City,
    string? State,
    string? Pincode,
    decimal? FellowshipAmount,
    decimal? HraAmount,
    DateOnly? JoiningDate);

public enum RecruitmentDocumentKind
{
    Advertisement,
    ScreeningProforma,
    SelectionProforma,
    MinutesOfSelection,
    MeritList,
    OfferLetter,
    JoiningLetter,
}

public record GeneratedDocument(byte[] Content, string FileName);
