using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using API.Application.Common;
using API.Application.Notifications;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace API.Application.Recruitment;

/// <summary>
/// The BRD A2 recruitment lifecycle: advertise, screen, select, interview, rank,
/// approve, offer, join.
/// </summary>
/// <remarks>
/// The merit-list approval and the offer-release approval each run through the
/// workflow engine -- those are the two steps with an office escalation chain
/// (tracked separately as WorkflowInstanceId and OfferWorkflowInstanceId, since
/// a request can have a concluded merit-list instance and a live offer instance
/// at once). The rest is this entity's own stage machine, because advertising
/// and screening have no such chain and modelling them as workflow instances
/// would invent approvals the BRD does not describe.
/// </remarks>
public class RecruitmentService(
    IApplicationDbContext db,
    IWorkflowEngineService workflowEngine,
    IApplicantRoleService applicantRoles,
    IRecruitmentDocumentGenerationService documents,
    IFacultyProfileProvider facultyProfiles,
    API.Application.Documents.IDocumentStorageService storage,
    IEmailSender emailSender,
    IOptions<EmailOptions> emailOptions,
    IAdvertisementTemplateService advertisementTemplates,
    API.Application.Access.IInstituteWideScopeResolver instituteWideScope,
    API.Application.Projects.IProjectService projectService,
    IWorkflowPendingQueryService pendingQuery) : IRecruitmentService
{
    /// <summary>
    /// The signed documents a Fellow must upload against their own Candidate
    /// row before they can submit their joining report -- checked again at
    /// ApproveJoiningReportAsync as a defense-in-depth safety net (e.g. a
    /// Document row deleted after submission), not because submission-time
    /// enforcement is expected to be bypassable through this service's own
    /// two entry points (SubmitJoiningReportAsync, SubmitOwnJoiningReportAsync).
    /// </summary>
    private static readonly DocumentKind[] RequiredJoiningDocumentKinds =
    [
        DocumentKind.SignedOfferLetter,
        DocumentKind.ContractOfEngagement,
    ];

    // ---------------------------------------------------------------- Task 6

    public async Task<Guid> CreateAsync(
        CreateRecruitmentInput input, Guid piUserId, CancellationToken ct = default)
    {
        var project = await LoadOwnedProjectAsync(input.ProjectId, piUserId, ct);

        var position = await db.SanctionedManpowerPositions
            .FirstOrDefaultAsync(p => p.Id == input.SanctionedManpowerPositionId, ct)
            ?? throw new ArgumentException(
                $"Sanctioned position '{input.SanctionedManpowerPositionId}' was not found.",
                nameof(input));

        if (position.ProjectId != project.Id)
        {
            throw new ArgumentException(
                "The sanctioned position does not belong to the specified project.", nameof(input));
        }

        var request = new RecruitmentRequest
        {
            Id = Guid.NewGuid(),
            ProjectId = input.ProjectId,
            SanctionedManpowerPositionId = input.SanctionedManpowerPositionId,
            Stage = RecruitmentStage.Draft,
            AdvertisementRound = 1,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.RecruitmentRequests.Add(request);
        await db.SaveChangesAsync(ct);

        return request.Id;
    }

    public async Task AdvertiseAsync(
        AdvertiseInput input, Guid piUserId,
        Guid? templateCallerUserId = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.Remarks))
        {
            throw new WorkflowTransitionException(
                "A remark is required when advertising this recruitment request.");
        }

        var request = await LoadOwnedRequestAsync(input.RecruitmentRequestId, piUserId, ct);

        // An advertisement instance already under RnC office or Computer Centre
        // review must not have its content silently overwritten out from under
        // the reviewer -- there would be no new approval cycle, no audit trail
        // entry, and no signal to whoever is looking at it. Only the stages the
        // re-forward branch below already trusts (the PI's own stage, and the
        // PI's post-Return correction stage) may call Advertise again; anything
        // else -- WithRnCOfficeAdvertisement, WithComputerCentre, or a terminal
        // stage -- throws instead of writing (final whole-branch review finding 2).
        if (request.AdvertisementWorkflowInstanceId is not null)
        {
            var inFlightInstance = await workflowEngine.GetAsync(request.AdvertisementWorkflowInstanceId.Value, ct);
            if (inFlightInstance is not null
                && inFlightInstance.CurrentStage is not (WorkflowStage.WithPIAdvertisement or WorkflowStage.ReturnedToPIAdvertisement))
            {
                throw new InvalidRecruitmentStageException(
                    RecruitmentStageDetail.For(
                        request.Id, inFlightInstance.CurrentStage,
                        $"{WorkflowStage.WithPIAdvertisement} or {WorkflowStage.ReturnedToPIAdvertisement}"));
            }
        }

        ValidateAdvertisementDates(input.PublishedOn, input.ClosingDate);

        // With no template chosen this is null and everything below stores the
        // caller's own Text exactly as it always did.
        var sections = await ResolveTemplateSectionsAsync(
            input.AdvertisementTemplateId, input.FreeTextTokenValues,
            request, templateCallerUserId ?? piUserId, input.PublishedOn, ct);
        var text = sections is null ? input.Text : SectionsAsPlainText(sections);
        text = AdvertisementTextSanitizer.Sanitize(text);

        var currentAd = await db.Advertisements
            .Where(a => a.RecruitmentRequestId == request.Id && a.Round == request.AdvertisementRound)
            .FirstOrDefaultAsync(ct);

        if (currentAd == null)
        {
            db.Advertisements.Add(new Advertisement
            {
                Id = Guid.NewGuid(),
                RecruitmentRequestId = request.Id,
                Round = request.AdvertisementRound,
                PublishedOn = input.PublishedOn,
                ClosingDate = input.ClosingDate,
                Text = text,
            });
        }
        else
        {
            currentAd.PublishedOn = input.PublishedOn;
            currentAd.ClosingDate = input.ClosingDate;
            currentAd.Text = text;
        }

        await StoreResolvedSectionsAsync(request.Id, request.AdvertisementRound, sections, ct);

        // The advertisement no longer goes live here. It is raised into the
        // approval chain (PI -> RnC office -> Computer Centre) and only becomes
        // Advertised when the Computer Centre's approve carries the instance to
        // the route's terminal Approved stage -- see ApproveAdvertisementAsync.
        if (request.AdvertisementWorkflowInstanceId is null)
        {
            var instance = await workflowEngine.RaiseAsync(
                RequestType.Advertisement, request.Id, WorkflowPhase.Indent, piUserId, ct);
            request.AdvertisementWorkflowInstanceId = instance.Id;

            // Raising lands on WithPIAdvertisement (sequence 1, roleless and
            // ownership-gated). The PI's "submit for approval" is this same call
            // immediately forwarding to the RnC office, mirroring
            // ResearchProposalService.SubmitForApprovalAsync's Raise-then-Forward
            // pair. The role array is inert at a roleless stage (RequireRoleAsync
            // returns early on an empty AllowedRoles) but is passed for symmetry
            // with the proposal chain.
            await workflowEngine.ForwardAsync(
                instance.Id, piUserId, ["Faculty"], input.Remarks, ct);
        }
        else
        {
            // A second Advertise call is the PI editing and resubmitting after a
            // Return: the instance already exists, so raising another would
            // orphan the first, but the edit must still travel back to the RnC
            // office. Gating on "is the id null" alone would silently swallow
            // the resubmit and strand the ad at ReturnedToPIAdvertisement.
            var instance = await workflowEngine.GetAsync(request.AdvertisementWorkflowInstanceId.Value, ct);
            if (instance is not null
                && instance.CurrentStage is WorkflowStage.ReturnedToPIAdvertisement or WorkflowStage.WithPIAdvertisement)
            {
                await workflowEngine.ForwardAsync(
                    instance.Id, piUserId, ["Faculty"], "Resubmitted for RnC office approval", ct);
            }
        }

        // Stage deliberately stops at AdvertisementRequested for the whole
        // chain; Advertised is set only by ApproveAdvertisementAsync's terminal
        // branch, which is the sole gate ApplyAsync checks.
        if (request.Stage == RecruitmentStage.Draft)
        {
            request.Stage = RecruitmentStage.AdvertisementRequested;
        }

        request.RequiredQualifications = input.RequiredQualifications;
        request.AllowDiplomaFor12th = input.AllowDiplomaFor12th;
        request.RequireExperience = input.RequireExperience;
        request.MinExperienceMonths = input.MinExperienceMonths;
        request.RequirePublications = input.RequirePublications;
        request.RequireResume = input.RequireResume;

        // The submission supersedes whatever was saved via "Save as Draft" --
        // clearing it here means the next time this modal opens, it loads the
        // real (just-submitted) advertisement text, not stale draft content.
        request.DraftAdvertisementText = null;
        request.DraftClosingDate = null;
        request.DraftRequiredQualifications = null;
        request.DraftAllowDiplomaFor12th = null;
        request.DraftRequireExperience = null;
        request.DraftMinExperienceMonths = null;
        request.DraftRequirePublications = null;
        request.DraftRequireResume = null;

        await db.SaveChangesAsync(ct);
    }

    // ------------------------------------------- advertisement approval chain

    /// <summary>
    /// Loads a recruitment that already has an advertisement workflow in flight.
    /// </summary>
    private async Task<RecruitmentRequest> RequireAdvertisementWorkflowAsync(
        Guid recruitmentRequestId, CancellationToken ct)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        if (request.AdvertisementWorkflowInstanceId is null)
        {
            throw new AdvertisementWorkflowNotStartedException(recruitmentRequestId);
        }

        return request;
    }

    public async Task ForwardAdvertisementAsync(
        Guid recruitmentRequestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var request = await RequireAdvertisementWorkflowAsync(recruitmentRequestId, ct);
        await workflowEngine.ForwardAsync(
            request.AdvertisementWorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);
    }

    public async Task RejectAdvertisementAsync(
        Guid recruitmentRequestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var request = await RequireAdvertisementWorkflowAsync(recruitmentRequestId, ct);
        await workflowEngine.RejectAsync(
            request.AdvertisementWorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);
    }

    public async Task ReturnAdvertisementAsync(
        Guid recruitmentRequestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var request = await RequireAdvertisementWorkflowAsync(recruitmentRequestId, ct);
        await workflowEngine.ReturnAsync(
            request.AdvertisementWorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);
    }

    /// <summary>
    /// The single entry point for both approving stages of the chain.
    /// </summary>
    /// <remarks>
    /// The RnC office (sequence 2) and the Computer Centre (sequence 3) both
    /// approve through this one method -- <c>WorkflowEngineService.ApproveAsync</c>
    /// makes no distinction between them. What separates them is where the
    /// instance lands afterward: the RnC office's approve advances to
    /// WithComputerCentre, while the Computer Centre's approve finds no further
    /// stage in its own right and the engine hardcodes the terminal
    /// <see cref="WorkflowStage.Approved"/> (sequence 4). So the instance is
    /// re-read after the engine call and the ad goes live only on Approved --
    /// keying off anything else would publish the ad the moment the RnC office
    /// signed off, before the Computer Centre had ever seen it.
    /// </remarks>
    public async Task ApproveAdvertisementAsync(
        Guid recruitmentRequestId, Guid actorUserId, IReadOnlyCollection<string> actorRoles,
        string? remarks, CancellationToken ct = default)
    {
        var request = await RequireAdvertisementWorkflowAsync(recruitmentRequestId, ct);
        await workflowEngine.ApproveAsync(
            request.AdvertisementWorkflowInstanceId!.Value, actorUserId, actorRoles, remarks, ct);

        var instance = await workflowEngine.GetAsync(request.AdvertisementWorkflowInstanceId!.Value, ct)
            ?? throw new AdvertisementWorkflowNotStartedException(recruitmentRequestId);

        if (instance.CurrentStage == WorkflowStage.Approved)
        {
            request.Stage = RecruitmentStage.Advertised;
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task ReadvertiseAsync(
        ReadvertiseInput input, Guid piUserId,
        Guid? templateCallerUserId = null, CancellationToken ct = default)
    {
        var request = await LoadOwnedRequestAsync(input.RecruitmentRequestId, piUserId, ct);

        // Only from Advertised: re-advertising a drive that has moved on to
        // screening or selection would strand candidates mid-process.
        if (request.Stage != RecruitmentStage.Advertised)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.Advertised));
        }

        ValidateAdvertisementDates(input.PublishedOn, input.ClosingDate);

        if (input.CandidateCountAtClose < 0)
        {
            throw new ArgumentException("Candidate count cannot be negative.", nameof(input));
        }

        // Close out the round that drew too few applicants; its count is the
        // record of why a further round was needed.
        var current = await db.Advertisements
            .Where(a => a.RecruitmentRequestId == request.Id && a.Round == request.AdvertisementRound)
            .FirstOrDefaultAsync(ct);

        if (current is not null)
        {
            current.CandidateCountAtClose = input.CandidateCountAtClose;
        }

        request.AdvertisementRound += 1;

        // Resolved after the increment so {{AdvertisementNo}} prints the new
        // round, not the one just closed.
        var sections = await ResolveTemplateSectionsAsync(
            input.AdvertisementTemplateId, input.FreeTextTokenValues,
            request, templateCallerUserId ?? piUserId, input.PublishedOn, ct);
        var text = sections is null ? input.Text : SectionsAsPlainText(sections);
        text = AdvertisementTextSanitizer.Sanitize(text);

        db.Advertisements.Add(new Advertisement
        {
            Id = Guid.NewGuid(),
            RecruitmentRequestId = request.Id,
            Round = request.AdvertisementRound,
            PublishedOn = input.PublishedOn,
            ClosingDate = input.ClosingDate,
            Text = text,
        });

        await StoreResolvedSectionsAsync(request.Id, request.AdvertisementRound, sections, ct);

        request.Stage = RecruitmentStage.Advertised;

        request.RequiredQualifications = input.RequiredQualifications;
        request.AllowDiplomaFor12th = input.AllowDiplomaFor12th;
        request.RequireExperience = input.RequireExperience;
        request.MinExperienceMonths = input.MinExperienceMonths;
        request.RequirePublications = input.RequirePublications;
        request.RequireResume = input.RequireResume;

        // The submission supersedes whatever was saved via "Save as Draft".
        request.DraftAdvertisementText = null;
        request.DraftClosingDate = null;
        request.DraftRequiredQualifications = null;
        request.DraftAllowDiplomaFor12th = null;
        request.DraftRequireExperience = null;
        request.DraftMinExperienceMonths = null;
        request.DraftRequirePublications = null;
        request.DraftRequireResume = null;

        await db.SaveChangesAsync(ct);
    }

    public async Task SaveAdvertisementDraftAsync(
        Guid recruitmentRequestId, Guid piUserId, string text, DateOnly? closingDate,
        string? requiredQualifications = null, bool? allowDiplomaFor12th = null,
        bool? requireExperience = null, int? minExperienceMonths = null,
        bool? requirePublications = null, bool? requireResume = null,
        CancellationToken ct = default)
    {
        var request = await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        request.DraftAdvertisementText = AdvertisementTextSanitizer.Sanitize(text);
        request.DraftClosingDate = closingDate;
        request.DraftRequiredQualifications = requiredQualifications;
        request.DraftAllowDiplomaFor12th = allowDiplomaFor12th;
        request.DraftRequireExperience = requireExperience;
        request.DraftMinExperienceMonths = minExperienceMonths;
        request.DraftRequirePublications = requirePublications;
        request.DraftRequireResume = requireResume;

        await db.SaveChangesAsync(ct);
    }

    public async Task<string> PreviewAdvertisementHtmlAsync(
        Guid recruitmentRequestId, Guid piUserId, string text, DateOnly? closingDate,
        CancellationToken ct = default)
    {
        var request = await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        var project = await db.Projects
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId, ct)
            ?? throw new ProjectNotFoundException(request.ProjectId);

        var position = await db.SanctionedManpowerPositions
            .FirstOrDefaultAsync(p => p.Id == request.SanctionedManpowerPositionId, ct)
            ?? throw new ArgumentException(
                $"Sanctioned position '{request.SanctionedManpowerPositionId}' was not found.",
                nameof(recruitmentRequestId));

        var pi = await facultyProfiles.GetAsync(project.OwnerUserId, ct);

        // Candidates/committee rows are never rendered by the fixed-table
        // advertisement layout -- only the header fields and AdvertisementText
        // are, so an empty list here matches what a real advertise-time
        // render would show regardless (those tables belong to other
        // document kinds, not this one).
        var model = new RecruitmentDocumentModel(
            project.ProjectTitle, project.Agency, project.SanctionNo,
            pi.Name, pi.Designation, pi.Department,
            position.Designation, position.Positions, position.Stipend, position.Hra,
            request.AdvertisementRound,
            PublishedOn: DateOnly.FromDateTime(DateTime.UtcNow),
            ClosingDate: closingDate,
            AdvertisementText: AdvertisementTextSanitizer.Sanitize(text),
            InterviewDate: request.InterviewDate,
            InterviewTime: request.InterviewTime,
            InterviewVenue: request.InterviewVenue,
            Candidates: [],
            ScreeningCommittee: [],
            SelectionCommittee: []);

        return await documents.RenderAdvertisementHtmlAsync(model, ct);
    }

    public async Task<IReadOnlyDictionary<string, string>> GetAdvertisementTokenValuesAsync(
        Guid recruitmentRequestId, Guid piUserId, CancellationToken ct = default)
    {
        var request = await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        var project = await db.Projects
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId, ct)
            ?? throw new ProjectNotFoundException(request.ProjectId);

        // There is no SanctionedManpowerPositionNotFoundException in this
        // codebase; mirrors AdvertisementTemplateService.ResolveAsync's own
        // fallback to ArgumentException for an unknown sanctioned position.
        var position = await db.SanctionedManpowerPositions
            .FirstOrDefaultAsync(p => p.Id == request.SanctionedManpowerPositionId, ct)
            ?? throw new ArgumentException(
                $"Sanctioned position '{request.SanctionedManpowerPositionId}' was not found.",
                nameof(recruitmentRequestId));

        var pi = await facultyProfiles.GetAsync(project.OwnerUserId, ct);

        // advertisementNo hardcoded to 1, advertisementDate to today: mirrors
        // GenerateAdvertisementModal.jsx's own existing resolve call exactly
        // (resolveAdvertisementTemplate(..., { advertisementNo: 1, advertisementDate: today })).
        // Not a real "which round" concept -- a pre-existing simplification,
        // not something this task fixes (see the plan's Global Constraints).
        return AdvertisementTokenCatalogue.ResolveEntityBoundTokens(
            request, project, position, pi, advertisementNo: 1,
            advertisementDate: DateOnly.FromDateTime(DateTime.UtcNow));
    }

    public async Task<Guid> ApplyAsync(
        ApplyInput input, Guid applicantUserId, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == input.RecruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(input.RecruitmentRequestId);

        if (request.Stage != RecruitmentStage.Advertised)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.Advertised));
        }

        // Verification gates applying, not signing in (spec D2a).
        if (!await applicantRoles.IsEmailConfirmedAsync(applicantUserId, ct))
        {
            throw new EmailNotVerifiedException(applicantUserId);
        }

        // Submitted-only: a half-finished Draft for this same recruitment must not
        // block the applicant. The stepwise wizard resumes its own Draft rather
        // than creating a second one, so "already applied" means a *finished*
        // application is already on file.
        var alreadyApplied = await db.Candidates.AnyAsync(
            c => c.RecruitmentRequestId == request.Id
              && c.ApplicationUserId == applicantUserId
              && c.ApplicationStatus == ApplicationStatus.Submitted
              && c.Outcome == CandidateOutcome.Pending,
            ct);

        if (alreadyApplied)
        {
            throw new DuplicateApplicationException(request.Id);
        }

        var candidate = new Candidate
        {
            Id = Guid.NewGuid(),
            RecruitmentRequestId = request.Id,
            ApplicationUserId = applicantUserId,
            FullName = input.FullName,
            Mobile = input.Mobile,
            Qualification = input.Qualification,
            Experience = input.Experience,
            Outcome = CandidateOutcome.Pending,
            AppliedAt = DateTimeOffset.UtcNow,

            // Explicit, and load-bearing: Candidate.ApplicationStatus defaults to
            // Draft (enum member 0), and Draft rows are invisible to every
            // PI-facing path below. This is the legacy single-shot apply -- the
            // applicant fills one form and is done -- so the row is Submitted the
            // moment it is created. Without this line every new application made
            // through this method would silently vanish from the PI's candidate
            // table, which is exactly the failure the ApplicationStatus migration's
            // backfill prevented for pre-existing rows.
            ApplicationStatus = ApplicationStatus.Submitted,
        };

        if (input.PrefillFromCandidateId is { } sourceId)
        {
            var source = await db.Candidates.FirstOrDefaultAsync(c => c.Id == sourceId, ct)
                ?? throw new CandidateNotFoundException(sourceId);

            // The security-relevant check: without it, passing any candidate id
            // would copy a stranger's details into this application.
            if (source.ApplicationUserId != applicantUserId)
            {
                throw new PrefillNotOwnedException(sourceId);
            }

            // Copied, not linked -- the source can later be deleted without
            // affecting this row.
            candidate.FullName = string.IsNullOrWhiteSpace(input.FullName) ? source.FullName : input.FullName;
            candidate.Mobile = string.IsNullOrWhiteSpace(input.Mobile) ? source.Mobile : input.Mobile;
            candidate.Qualification ??= source.Qualification;
            candidate.Experience ??= source.Experience;
            candidate.PrefilledFromCandidateId = sourceId;
        }

        db.Candidates.Add(candidate);
        await db.SaveChangesAsync(ct);

        // Reapplying revives an account soft-deleted after an earlier rejection.
        await applicantRoles.ReactivateAsync(applicantUserId, ct);

        return candidate.Id;
    }

    public async Task<IReadOnlyList<CandidateSummary>> ListOwnApplicationsAsync(
        Guid applicantUserId, CancellationToken ct = default)
    {
        var rows = await db.Candidates
            .Where(c => c.ApplicationUserId == applicantUserId)
            .OrderByDescending(c => c.AppliedAt)
            .Join(db.RecruitmentRequests, c => c.RecruitmentRequestId, r => r.Id, (c, r) => new { Candidate = c, r.Stage, r.SanctionedManpowerPositionId })
            .ToListAsync(ct);

        var positionIds = rows.Select(x => x.SanctionedManpowerPositionId).Distinct().ToList();
        var positions = await db.SanctionedManpowerPositions
            .Where(p => positionIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        return [.. rows.Select(x => {
            positions.TryGetValue(x.SanctionedManpowerPositionId, out var pos);
            return ToSummary(x.Candidate, x.Stage, pos?.Stipend);
        })];
    }

    // -------------------------------------------------------- Application wizard

    public async Task<Guid> StartOrResumeDraftAsync(
        Guid recruitmentRequestId, Guid applicantUserId, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        if (request.Stage != RecruitmentStage.Advertised)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.Advertised));
        }

        var existingDraft = await db.Candidates.FirstOrDefaultAsync(
            c => c.RecruitmentRequestId == recruitmentRequestId
              && c.ApplicationUserId == applicantUserId
              && c.ApplicationStatus == ApplicationStatus.Draft,
            ct);

        if (existingDraft is not null)
        {
            return existingDraft.Id;
        }

        // Mirrors ApplyAsync's own already-applied guard, scoped to Submitted
        // rows only -- a half-finished Draft elsewhere must not block starting
        // a new one here, matching ApplyAsync's own comment on the same point.
        var alreadySubmitted = await db.Candidates.AnyAsync(
            c => c.RecruitmentRequestId == recruitmentRequestId
              && c.ApplicationUserId == applicantUserId
              && c.ApplicationStatus == ApplicationStatus.Submitted
              && c.Outcome == CandidateOutcome.Pending,
            ct);
        if (alreadySubmitted)
        {
            throw new DuplicateApplicationException(recruitmentRequestId);
        }

        var candidate = new Candidate
        {
            Id = Guid.NewGuid(),
            RecruitmentRequestId = recruitmentRequestId,
            ApplicationUserId = applicantUserId,
            FullName = string.Empty,
            Mobile = string.Empty,
            Outcome = CandidateOutcome.Pending,
            ApplicationStatus = ApplicationStatus.Draft,
            AppliedAt = DateTimeOffset.UtcNow,
        };
        db.Candidates.Add(candidate);
        await db.SaveChangesAsync(ct);
        return candidate.Id;
    }

    public async Task SaveStep1PersonalAsync(
        SaveStep1PersonalInput input, Guid applicantUserId, CancellationToken ct = default)
    {
        var candidate = await LoadOwnDraftAsync(input.CandidateId, applicantUserId, ct);

        candidate.FullName = input.FullName;
        candidate.Mobile = input.Mobile;
        candidate.Gender = input.Gender;
        candidate.IsMarried = input.IsMarried;
        candidate.DateOfBirth = input.DateOfBirth;
        candidate.FatherOrHusbandName = input.FatherOrHusbandName;
        candidate.PresentAddress = input.PresentAddress;
        candidate.PermanentAddress = input.PermanentAddress;
        candidate.Email = input.Email;
        candidate.Nationality = input.Nationality;
        candidate.Category = input.Category;
        candidate.CategoryCertificateDocumentId = input.CategoryCertificateDocumentId;
        candidate.IdProofType = input.IdProofType;
        candidate.IdProofNumber = input.IdProofNumber;
        candidate.IdProofDocumentId = input.IdProofDocumentId;

        await db.SaveChangesAsync(ct);
    }

    public async Task SaveStep2QualificationsAsync(
        SaveStep2QualificationsInput input, Guid applicantUserId, CancellationToken ct = default)
    {
        var candidate = await LoadOwnDraftAsync(input.CandidateId, applicantUserId, ct, includeChildren: true);

        candidate.GateNetGpatQualified = input.GateNetGpatQualified;
        candidate.GateNetGpatRollNo = input.GateNetGpatRollNo;
        candidate.GateNetGpatYear = input.GateNetGpatYear;
        candidate.GateNetGpatScore = input.GateNetGpatScore;
        candidate.GateNetGpatCertificateDocumentId = input.GateNetGpatCertificateDocumentId;

        // Academic passing year timeline gap validation
        var y10 = input.Education.FirstOrDefault(e => e.Level == EducationLevel.Tenth && e.Year.HasValue)?.Year;
        var y12 = input.Education.FirstOrDefault(e => e.Level == EducationLevel.Twelfth && e.Year.HasValue)?.Year;
        var yDip = input.Education.FirstOrDefault(e => e.Level == EducationLevel.Diploma && e.Year.HasValue)?.Year;
        var yUg = input.Education.FirstOrDefault(e => e.Level == EducationLevel.Undergraduate && e.Year.HasValue)?.Year;
        var yPg = input.Education.FirstOrDefault(e => e.Level == EducationLevel.Postgraduate && e.Year.HasValue)?.Year;
        var yPhd = input.Education.FirstOrDefault(e => e.Level == EducationLevel.Doctorate && e.Year.HasValue)?.Year;

        if (y10.HasValue && y12.HasValue && y12.Value < y10.Value + 2)
        {
            throw new InvalidOperationException($"12th Standard passing year ({y12}) must be at least 2 years after 10th Standard passing year ({y10}).");
        }
        if (y10.HasValue && yDip.HasValue && yDip.Value < y10.Value + 2)
        {
            throw new InvalidOperationException($"Diploma passing year ({yDip}) must be at least 2 years after 10th Standard passing year ({y10}).");
        }
        if (y12.HasValue && yUg.HasValue && yUg.Value < y12.Value + 3)
        {
            throw new InvalidOperationException($"Undergraduate (UG) passing year ({yUg}) must be at least 3 years after 12th Standard passing year ({y12}).");
        }
        if (yDip.HasValue && yUg.HasValue && !y12.HasValue && yUg.Value < yDip.Value + 2)
        {
            throw new InvalidOperationException($"Undergraduate (UG) passing year ({yUg}) must be at least 2 years after Diploma passing year ({yDip}).");
        }
        if (yUg.HasValue && yPg.HasValue && yPg.Value < yUg.Value + 1)
        {
            throw new InvalidOperationException($"Postgraduate (PG) passing year ({yPg}) must be after Undergraduate (UG) passing year ({yUg}).");
        }
        if (yPg.HasValue && yPhd.HasValue && yPhd.Value < yPg.Value + 1)
        {
            throw new InvalidOperationException($"Ph.D. passing year ({yPhd}) must be after Postgraduate (PG) passing year ({yPg}).");
        }

        // Whole-collection replace, not a per-row diff -- the wizard step hands
        // back the complete education table every save, and rows carry no
        // identity the caller is expected to preserve across saves. Both the
        // removal and the insertion route through the DbSet directly (never
        // through candidate.Education) -- reassigning or clearing the loaded
        // navigation makes EF treat the old rows as severed orphans and try to
        // UPDATE their required CandidateId FK instead of honouring the delete,
        // which fails with DbUpdateConcurrencyException. Same pattern as
        // AdvertisementTemplateService.UpdateAsync's section replacement.
        db.CandidateEducations.RemoveRange(candidate.Education.ToList());

        foreach (var e in input.Education.OrderBy(e => e.Level))
        {
            db.CandidateEducations.Add(new CandidateEducation
            {
                Id = Guid.NewGuid(),
                CandidateId = candidate.Id,
                Level = e.Level,
                OtherLevelName = e.OtherLevelName,
                Subject = e.Subject,
                BoardInstituteUniv = e.BoardInstituteUniv,
                Year = e.Year,
                MarksOrCgpa = e.MarksOrCgpa,
                Division = e.Division,
                CertificateDocumentId = e.CertificateDocumentId,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task SaveStep3ExperienceAsync(
        SaveStep3ExperienceInput input, Guid applicantUserId, CancellationToken ct = default)
    {
        var candidate = await LoadOwnDraftAsync(input.CandidateId, applicantUserId, ct, includeChildren: true);

        // Same whole-collection replace via the DbSet as Step 2's education
        // rows -- see the comment there for why candidate.Experiences itself
        // is never touched.
        db.CandidateExperiences.RemoveRange(candidate.Experiences.ToList());

        foreach (var x in input.Experiences)
        {
            db.CandidateExperiences.Add(new CandidateExperience
            {
                Id = Guid.NewGuid(),
                CandidateId = candidate.Id,
                SortOrder = x.SortOrder,
                Organization = x.Organization,
                Position = x.Position,
                SalaryEmoluments = x.SalaryEmoluments,
                NatureOfDuties = x.NatureOfDuties,
                NatureOfAppointment = x.NatureOfAppointment,
                PeriodYears = x.PeriodYears,
                PeriodMonths = x.PeriodMonths,
                PeriodDays = x.PeriodDays,
                CertificateDocumentId = x.CertificateDocumentId,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task SaveStep4PublicationsAsync(
        SaveStep4PublicationsInput input, Guid applicantUserId, CancellationToken ct = default)
    {
        var candidate = await LoadOwnDraftAsync(input.CandidateId, applicantUserId, ct);

        candidate.SciJournalCount = input.SciJournalCount;
        candidate.ScopusJournalCount = input.ScopusJournalCount;
        candidate.NonSciJournalCount = input.NonSciJournalCount;
        candidate.InternationalConfCount = input.InternationalConfCount;
        candidate.NationalConfCount = input.NationalConfCount;
        candidate.PublicationName = input.PublicationName;
        candidate.OtherInformation = input.OtherInformation;
        candidate.WantsHigherDegreeRegistration = input.WantsHigherDegreeRegistration;
        candidate.PublicationsDocumentId = input.PublicationsDocumentId;

        await db.SaveChangesAsync(ct);
    }

    public async Task SaveStep5ResumeAsync(
        SaveStep5ResumeInput input, Guid applicantUserId, CancellationToken ct = default)
    {
        var candidate = await LoadOwnDraftAsync(input.CandidateId, applicantUserId, ct);

        candidate.ResumeDocumentId = input.ResumeDocumentId;
        candidate.Remarks = input.Remarks;

        await db.SaveChangesAsync(ct);
    }

    public async Task SubmitDraftAsync(
        Guid candidateId,
        Guid applicantUserId,
        Guid? photoDocumentId = null,
        Guid? signatureDocumentId = null,
        CancellationToken ct = default)
    {
        var candidate = await db.Candidates
            .Include(c => c.RecruitmentRequest)
            .Include(c => c.Education)
            .Include(c => c.Experiences)
            .FirstOrDefaultAsync(c => c.Id == candidateId, ct)
            ?? throw new CandidateDraftNotFoundException(candidateId);

        if (candidate.ApplicationUserId != applicantUserId)
        {
            throw new CandidateDraftNotOwnedException(candidateId);
        }

        if (candidate.ApplicationStatus != ApplicationStatus.Draft)
        {
            throw new CandidateAlreadySubmittedException(candidateId);
        }

        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(candidate.FullName)) missing.Add("full name");
        if (string.IsNullOrWhiteSpace(candidate.Mobile)) missing.Add("mobile number");
        if (candidate.IdProofType.HasValue && string.IsNullOrWhiteSpace(candidate.IdProofNumber)) missing.Add("ID proof number");

        if (photoDocumentId is not null)
        {
            candidate.PhotoDocumentId = photoDocumentId;
        }
        if (signatureDocumentId is not null)
        {
            candidate.SignatureDocumentId = signatureDocumentId;
        }

        if (candidate.SignatureDocumentId is null) missing.Add("candidate signature");

        var req = candidate.RecruitmentRequest;
        if (req != null)
        {
            if (!string.IsNullOrWhiteSpace(req.RequiredQualifications))
            {
                var reqList = req.RequiredQualifications
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

                if (reqList.Contains("GATE/NET") && !candidate.GateNetGpatQualified)
                {
                    missing.Add("GATE / CSIR-NET / GPAT qualification");
                }
                if (reqList.Contains("10th"))
                {
                    var has10th = candidate.Education.Any(e => e.Level == EducationLevel.Tenth && !string.IsNullOrWhiteSpace(e.BoardInstituteUniv) && e.Year.HasValue);
                    if (!has10th) missing.Add("10th Standard qualification details");
                }
                if (reqList.Contains("12th"))
                {
                    var has12th = candidate.Education.Any(e => e.Level == EducationLevel.Twelfth && !string.IsNullOrWhiteSpace(e.BoardInstituteUniv) && e.Year.HasValue);
                    var hasDiploma = req.AllowDiplomaFor12th && candidate.Education.Any(e => e.Level == EducationLevel.Diploma && !string.IsNullOrWhiteSpace(e.BoardInstituteUniv) && e.Year.HasValue);
                    if (!has12th && !hasDiploma)
                    {
                        missing.Add(req.AllowDiplomaFor12th ? "12th Standard (or Diploma) qualification details" : "12th Standard qualification details");
                    }
                }
                if (reqList.Contains("UG"))
                {
                    var hasUg = candidate.Education.Any(e => e.Level == EducationLevel.Undergraduate && !string.IsNullOrWhiteSpace(e.BoardInstituteUniv) && e.Year.HasValue);
                    if (!hasUg) missing.Add("Undergraduate (UG) qualification details");
                }
                if (reqList.Contains("PG"))
                {
                    var hasPg = candidate.Education.Any(e => e.Level == EducationLevel.Postgraduate && !string.IsNullOrWhiteSpace(e.BoardInstituteUniv) && e.Year.HasValue);
                    if (!hasPg) missing.Add("Postgraduate (PG) qualification details");
                }
                if (reqList.Contains("PhD"))
                {
                    var hasPhd = candidate.Education.Any(e => e.Level == EducationLevel.Doctorate && !string.IsNullOrWhiteSpace(e.BoardInstituteUniv) && e.Year.HasValue);
                    if (!hasPhd) missing.Add("Ph.D. qualification details");
                }
            }

            // Timeline validation check
            var y10 = candidate.Education.FirstOrDefault(e => e.Level == EducationLevel.Tenth && e.Year.HasValue)?.Year;
            var y12 = candidate.Education.FirstOrDefault(e => e.Level == EducationLevel.Twelfth && e.Year.HasValue)?.Year;
            var yDip = candidate.Education.FirstOrDefault(e => e.Level == EducationLevel.Diploma && e.Year.HasValue)?.Year;
            var yUg = candidate.Education.FirstOrDefault(e => e.Level == EducationLevel.Undergraduate && e.Year.HasValue)?.Year;
            var yPg = candidate.Education.FirstOrDefault(e => e.Level == EducationLevel.Postgraduate && e.Year.HasValue)?.Year;
            var yPhd = candidate.Education.FirstOrDefault(e => e.Level == EducationLevel.Doctorate && e.Year.HasValue)?.Year;

            if (y10.HasValue && y12.HasValue && y12.Value < y10.Value + 2)
            {
                missing.Add($"12th Standard passing year ({y12}) must be at least 2 years after 10th Standard passing year ({y10})");
            }
            if (y10.HasValue && yDip.HasValue && yDip.Value < y10.Value + 2)
            {
                missing.Add($"Diploma passing year ({yDip}) must be at least 2 years after 10th Standard passing year ({y10})");
            }
            if (y12.HasValue && yUg.HasValue && yUg.Value < y12.Value + 3)
            {
                missing.Add($"Undergraduate (UG) passing year ({yUg}) must be at least 3 years after 12th Standard passing year ({y12})");
            }
            if (yDip.HasValue && yUg.HasValue && !y12.HasValue && yUg.Value < yDip.Value + 2)
            {
                missing.Add($"Undergraduate (UG) passing year ({yUg}) must be at least 2 years after Diploma passing year ({yDip})");
            }
            if (yUg.HasValue && yPg.HasValue && yPg.Value < yUg.Value + 1)
            {
                missing.Add($"Postgraduate (PG) passing year ({yPg}) must be after Undergraduate (UG) passing year ({yUg})");
            }
            if (yPg.HasValue && yPhd.HasValue && yPhd.Value < yPg.Value + 1)
            {
                missing.Add($"Ph.D. passing year ({yPhd}) must be after Postgraduate (PG) passing year ({yPg})");
            }

            if (req.RequireExperience)
            {
                if (candidate.Experiences.Count == 0)
                {
                    missing.Add("Work / Research Experience details");
                }
                else if (req.MinExperienceMonths > 0)
                {
                    var totalMonths = candidate.Experiences.Sum(x => x.PeriodYears * 12 + x.PeriodMonths);
                    if (totalMonths < req.MinExperienceMonths)
                    {
                        missing.Add($"Minimum {req.MinExperienceMonths} months of experience (provided: {totalMonths} months)");
                    }
                }
            }

            if (req.RequirePublications)
            {
                var totalPubs = candidate.SciJournalCount + candidate.ScopusJournalCount + candidate.NonSciJournalCount + candidate.InternationalConfCount + candidate.NationalConfCount;
                if (totalPubs == 0 && string.IsNullOrWhiteSpace(candidate.PublicationName) && !candidate.PublicationsDocumentId.HasValue)
                {
                    missing.Add("Research publications record or document upload");
                }
            }

            if (req.RequireResume && !candidate.ResumeDocumentId.HasValue)
            {
                missing.Add("Resume / CV PDF document upload");
            }
        }

        if (missing.Count > 0)
        {
            throw new IncompleteApplicationException(candidateId, string.Join(", ", missing));
        }

        candidate.ApplicationStatus = ApplicationStatus.Submitted;
        candidate.DeclarationAcceptedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<CandidateDraftDetail> GetOwnDraftAsync(
        Guid candidateId, Guid applicantUserId, CancellationToken ct = default)
    {
        var candidate = await LoadOwnDraftAsync(candidateId, applicantUserId, ct, includeChildren: true, allowSubmitted: true);
        return ToDraftDetail(candidate);
    }

    public async Task<Guid> PrefillFromPreviousApplicationAsync(
        Guid recruitmentRequestId, Guid sourceCandidateId, Guid applicantUserId, CancellationToken ct = default)
    {
        var source = await db.Candidates
            .Include(c => c.Education)
            .Include(c => c.Experiences)
            .FirstOrDefaultAsync(c => c.Id == sourceCandidateId, ct)
            ?? throw new CandidateDraftNotFoundException(sourceCandidateId);

        // The security-relevant check: without it, passing any candidate id
        // would copy a stranger's details into this application.
        if (source.ApplicationUserId != applicantUserId)
        {
            throw new CandidateDraftNotOwnedException(sourceCandidateId);
        }

        var newDraftId = await StartOrResumeDraftAsync(recruitmentRequestId, applicantUserId, ct);

        // StartOrResumeDraftAsync resumes an existing Draft for this request/user
        // if one is already in progress. If that happens to be the same row the
        // caller picked as the prefill source (e.g. re-selecting the current
        // recruitment's own draft), EF Core's identity map hands back the SAME
        // tracked Candidate (and the same Education/Experiences collections) for
        // both `source` and `newDraft` below. Copying a draft onto itself is a
        // no-op by definition, so short-circuit before the RemoveRange/foreach
        // pair -- otherwise RemoveRange mutates the very collection `source`'s
        // loop enumerates, throwing "Collection was modified".
        if (newDraftId == source.Id)
        {
            return newDraftId;
        }

        var newDraft = await db.Candidates
            .Include(c => c.Education)
            .Include(c => c.Experiences)
            .FirstAsync(c => c.Id == newDraftId, ct);

        // Full, independent copy -- every field and file reference is copied by
        // value; nothing here is a live reference back to `source`, and editing
        // `newDraft` afterward (data or documents) never touches `source` or
        // its rows. Copying the *DocumentId fields by value means the new
        // draft points at the SAME underlying stored file as the source until
        // the candidate replaces it -- replacing a document always creates a
        // fresh Document row and only rewrites the new draft's reference, so
        // isolation holds without any extra code here.
        newDraft.FullName = source.FullName;
        newDraft.Mobile = source.Mobile;
        newDraft.Gender = source.Gender;
        newDraft.IsMarried = source.IsMarried;
        newDraft.DateOfBirth = source.DateOfBirth;
        newDraft.FatherOrHusbandName = source.FatherOrHusbandName;
        newDraft.PresentAddress = source.PresentAddress;
        newDraft.PermanentAddress = source.PermanentAddress;
        newDraft.Email = source.Email;
        newDraft.Nationality = source.Nationality;
        newDraft.Category = source.Category;
        newDraft.CategoryCertificateDocumentId = source.CategoryCertificateDocumentId;
        newDraft.IdProofType = source.IdProofType;
        newDraft.IdProofNumber = source.IdProofNumber;
        newDraft.IdProofDocumentId = source.IdProofDocumentId;
        newDraft.GateNetGpatQualified = source.GateNetGpatQualified;
        newDraft.GateNetGpatRollNo = source.GateNetGpatRollNo;
        newDraft.GateNetGpatYear = source.GateNetGpatYear;
        newDraft.GateNetGpatScore = source.GateNetGpatScore;
        newDraft.GateNetGpatCertificateDocumentId = source.GateNetGpatCertificateDocumentId;
        newDraft.SciJournalCount = source.SciJournalCount;
        newDraft.ScopusJournalCount = source.ScopusJournalCount;
        newDraft.NonSciJournalCount = source.NonSciJournalCount;
        newDraft.InternationalConfCount = source.InternationalConfCount;
        newDraft.NationalConfCount = source.NationalConfCount;
        newDraft.PublicationName = source.PublicationName;
        newDraft.OtherInformation = source.OtherInformation;
        newDraft.WantsHigherDegreeRegistration = source.WantsHigherDegreeRegistration;
        newDraft.PublicationsDocumentId = source.PublicationsDocumentId;
        newDraft.ResumeDocumentId = source.ResumeDocumentId;
        newDraft.Remarks = source.Remarks;
        newDraft.PhotoDocumentId = source.PhotoDocumentId;
        newDraft.SignatureDocumentId = source.SignatureDocumentId;
        newDraft.PrefilledFromCandidateId = source.Id;

        // Whole-collection replace via the DbSet, same as the Step 2/3 saves --
        // the new draft was just created by StartOrResumeDraftAsync so it has
        // no rows of its own yet, but routing through the DbSet keeps this
        // consistent with the rest of the file and safe even if this method is
        // ever called against a draft that already has rows (e.g. re-prefilling).
        db.CandidateEducations.RemoveRange(newDraft.Education.ToList());
        foreach (var e in source.Education)
        {
            db.CandidateEducations.Add(new CandidateEducation
            {
                Id = Guid.NewGuid(),
                CandidateId = newDraft.Id,
                Level = e.Level,
                OtherLevelName = e.OtherLevelName,
                Subject = e.Subject,
                BoardInstituteUniv = e.BoardInstituteUniv,
                Year = e.Year,
                MarksOrCgpa = e.MarksOrCgpa,
                Division = e.Division,
                CertificateDocumentId = e.CertificateDocumentId,
            });
        }

        db.CandidateExperiences.RemoveRange(newDraft.Experiences.ToList());
        foreach (var x in source.Experiences)
        {
            db.CandidateExperiences.Add(new CandidateExperience
            {
                Id = Guid.NewGuid(),
                CandidateId = newDraft.Id,
                SortOrder = x.SortOrder,
                Organization = x.Organization,
                Position = x.Position,
                SalaryEmoluments = x.SalaryEmoluments,
                NatureOfDuties = x.NatureOfDuties,
                NatureOfAppointment = x.NatureOfAppointment,
                PeriodYears = x.PeriodYears,
                PeriodMonths = x.PeriodMonths,
                PeriodDays = x.PeriodDays,
                CertificateDocumentId = x.CertificateDocumentId,
            });
        }

        await db.SaveChangesAsync(ct);
        return newDraftId;
    }

    // ---------------------------------------------------------------- Task 7

    public Task SubmitScreeningCommitteeAsync(
        Guid recruitmentRequestId, IReadOnlyList<CommitteeMemberInput> members,
        Guid piUserId, CancellationToken ct = default) =>
        SubmitCommitteeAsync(recruitmentRequestId, CommitteeKind.Screening, members, piUserId, ct);

    /// <summary>
    /// Raises the Screening Committee formation workflow: auto-adds the PI
    /// (Chairman) and, if the project has one, the Co-PI, as CommitteeMember
    /// rows via the existing SubmitScreeningCommitteeAsync, then forwards to
    /// the Dean to request the one additional member.
    /// </summary>
    public async Task SubmitScreeningCommitteeForApprovalAsync(
        Guid recruitmentRequestId, Guid piUserId, CancellationToken ct = default)
    {
        var request = await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        var piUser = await db.Users.FirstOrDefaultAsync(u => u.Id == piUserId, ct)
            ?? throw new ArgumentException($"PI user '{piUserId}' was not found.", nameof(piUserId));

        var members = new List<CommitteeMemberInput>
        {
            new(CommitteeRole.Chairman, piUser.FullName ?? piUser.Email ?? "PI", "", "Principal Investigator", false, piUserId),
        };

        var proposal = await db.ResearchProposals
            .Include(p => p.CoPis)
            .FirstOrDefaultAsync(p => p.ProjectId == request.ProjectId, ct);
        var coPi = proposal?.CoPis.FirstOrDefault();
        if (coPi is not null)
        {
            members.Add(new CommitteeMemberInput(
                CommitteeRole.CoPrincipalInvestigator, coPi.Name, coPi.Department, coPi.Designation, false));
        }

        await SubmitScreeningCommitteeAsync(recruitmentRequestId, members, piUserId, ct);

        // Screening has no return/resubmit path (no CanReturn stage on its
        // route), so there is no legitimate reason for this method to be
        // called a second time with an instance already in flight. A repeat
        // call (double-click, retry) must not Raise a second instance --
        // that would orphan the first at WithDeanScreeningCommittee,
        // unreachable, with the FK repointed to the new one. The committee
        // row write above is upsert-style (SubmitCommitteeAsync deletes and
        // re-adds rows for the submitted roles) so it is safe to no-op just
        // the raise+forward here rather than throw (final whole-branch
        // review finding 2).
        if (request.ScreeningCommitteeWorkflowInstanceId is null)
        {
            var instance = await workflowEngine.RaiseAsync(
                RequestType.ScreeningCommittee, recruitmentRequestId, WorkflowPhase.Indent, piUserId, ct);
            request.ScreeningCommitteeWorkflowInstanceId = instance.Id;
            await db.SaveChangesAsync(ct);

            await workflowEngine.ForwardAsync(
                instance.Id, piUserId, ["Faculty"], "Requesting one additional member from the Dean.", ct);
        }
    }

    /// <summary>
    /// The Dean assigns the one additional Screening Committee member and
    /// approves in the same action -- Screening has no separate reject/return
    /// step, unlike Selection.
    /// </summary>
    public async Task AssignScreeningCommitteeMemberAsync(
        Guid recruitmentRequestId, CommitteeMemberInput nominee, Guid deanUserId, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        if (request.ScreeningCommitteeWorkflowInstanceId is not { } instanceId)
        {
            throw new InvalidCommitteeCompositionException(
                "The Screening Committee has not been submitted for approval yet.");
        }

        await NominateScreeningFacultyAsync(
            recruitmentRequestId, nominee.Name, nominee.Department, nominee.Position, deanUserId,
            nominee.ApplicationUserId, nominee.Email, ct);

        await workflowEngine.ApproveAsync(instanceId, deanUserId, ["Dean"], "Member assigned.", ct);
    }

    public Task SubmitSelectionCommitteeAsync(
        Guid recruitmentRequestId, IReadOnlyList<CommitteeMemberInput> members,
        Guid piUserId, CancellationToken ct = default) =>
        SubmitCommitteeAsync(recruitmentRequestId, CommitteeKind.Selection, members, piUserId, ct);

    /// <summary>
    /// Raises the Selection Committee formation workflow: auto-adds PI and
    /// HOD, optionally one PI-chosen member, and 3-5 PI-recommended
    /// candidates, then forwards to the Dean.
    /// </summary>
    public async Task SubmitSelectionCommitteeForApprovalAsync(
        Guid recruitmentRequestId, CommitteeMemberInput? optionalMember,
        IReadOnlyList<CommitteeMemberInput> recommendedMembers, Guid piUserId, CancellationToken ct = default)
    {
        if (recommendedMembers.Count is < 3 or > 5)
        {
            throw new InvalidCommitteeCompositionException(
                $"A selection committee needs 3 to 5 recommended members; {recommendedMembers.Count} were supplied.");
        }

        var request = await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        // An instance already under Dean review (or already terminal) must not
        // have its committee rows silently overwritten out from under the
        // Dean -- there would be no new approval cycle, no audit trail entry,
        // and no signal to whoever is looking at it. Only the stage-less case
        // (first submission) and the two stages the re-forward branch below
        // already trusts (the PI's own stage, and the PI's post-Return
        // correction stage) may call this again; anything else --
        // WithDeanSelectionCommittee or SelectionCommitteeApproved -- throws
        // instead of writing (final whole-branch review finding 1).
        if (request.SelectionCommitteeWorkflowInstanceId is not null)
        {
            var inFlightInstance = await workflowEngine.GetAsync(request.SelectionCommitteeWorkflowInstanceId.Value, ct);
            if (inFlightInstance is not null
                && inFlightInstance.CurrentStage is not (WorkflowStage.WithPISelectionCommittee or WorkflowStage.ReturnedToPISelectionCommittee))
            {
                throw new InvalidRecruitmentStageException(
                    RecruitmentStageDetail.For(
                        request.Id, inFlightInstance.CurrentStage,
                        $"{WorkflowStage.WithPISelectionCommittee} or {WorkflowStage.ReturnedToPISelectionCommittee}"));
            }
        }

        var piUser = await db.Users.FirstOrDefaultAsync(u => u.Id == piUserId, ct)
            ?? throw new ArgumentException($"PI user '{piUserId}' was not found.", nameof(piUserId));

        var hodUser = await ResolveHodForRequestAsync(request, ct);

        var members = new List<CommitteeMemberInput>
        {
            new(CommitteeRole.PrincipalInvestigator, piUser.FullName ?? piUser.Email ?? "PI", "", "Principal Investigator", false, piUserId),
            new(CommitteeRole.Chairman, hodUser.Name, hodUser.Department, "Head of Department", false, hodUser.ApplicationUserId),
        };
        if (optionalMember is not null)
        {
            members.Add(optionalMember with { Role = CommitteeRole.OptionalMember });
        }
        members.AddRange(recommendedMembers.Select(m => m with
        {
            Role = m.IsOutsideInstitute ? CommitteeRole.ExternalNominee : CommitteeRole.InternalNominee
        }));

        ValidateOutsideInstituteConsent(members);

        await SubmitCommitteeAsync(recruitmentRequestId, CommitteeKind.Selection, members, piUserId, ct);

        WorkflowInstance instance;
        if (request.SelectionCommitteeWorkflowInstanceId is { } existingInstanceId)
        {
            // Resubmission after a Dean return.
            instance = await workflowEngine.GetAsync(existingInstanceId)
                ?? throw new InvalidOperationException($"Selection Committee workflow instance '{existingInstanceId}' was not found.");
            await workflowEngine.ForwardAsync(instance.Id, piUserId, ["Faculty"], "Resubmitted with updated committee members.", ct);
        }
        else
        {
            instance = await workflowEngine.RaiseAsync(
                RequestType.SelectionCommittee, recruitmentRequestId, WorkflowPhase.Indent, piUserId, ct);
            request.SelectionCommitteeWorkflowInstanceId = instance.Id;
            await db.SaveChangesAsync(ct);

            await workflowEngine.ForwardAsync(
                instance.Id, piUserId, ["Faculty"], "Submitting 3-5 recommended members for Dean selection.", ct);
        }
    }

    /// <summary>
    /// The Dean picks exactly one of the 3-5 recommended members to finalize
    /// the Selection Committee, and approves in the same action.
    /// </summary>
    public async Task SelectSelectionCommitteeMemberAsync(
        Guid recruitmentRequestId, Guid selectedCommitteeMemberId, Guid deanUserId, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        if (request.SelectionCommitteeWorkflowInstanceId is not { } instanceId)
        {
            throw new InvalidCommitteeCompositionException(
                "The Selection Committee has not been submitted for approval yet.");
        }

        var recommended = await db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == recruitmentRequestId && m.Kind == CommitteeKind.Selection
                && (m.Role == CommitteeRole.InternalNominee || m.Role == CommitteeRole.ExternalNominee))
            .ToListAsync(ct);

        var chosen = recommended.FirstOrDefault(m => m.Id == selectedCommitteeMemberId)
            ?? throw new InvalidCommitteeCompositionException(
                $"'{selectedCommitteeMemberId}' is not one of this committee's recommended members.");

        foreach (var member in recommended)
        {
            member.IsSelectedByDean = member.Id == chosen.Id;
        }
        await db.SaveChangesAsync(ct);

        await workflowEngine.ApproveAsync(instanceId, deanUserId, ["Dean"], "Member selected.", ct);
    }

    /// <summary>The Dean returns the Selection Committee submission to the PI for edits.</summary>
    public async Task ReturnSelectionCommitteeAsync(
        Guid recruitmentRequestId, string remarks, Guid deanUserId, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        if (request.SelectionCommitteeWorkflowInstanceId is not { } instanceId)
        {
            throw new InvalidCommitteeCompositionException(
                "The Selection Committee has not been submitted for approval yet.");
        }

        await workflowEngine.ReturnAsync(instanceId, deanUserId, ["Dean"], remarks, ct);
    }

    /// <summary>
    /// Finds the Head of Department for a recruitment request: the request's
    /// project carries a DepartmentId snapshot (Project.DepartmentId, set at
    /// project-creation time -- see that field's own remarks), and
    /// Department.HeadUserId is the schema's single source of truth for "who
    /// heads this department" (a pointer on the row, not a role scan -- see
    /// that field's own remarks). Resolving through it, rather than scanning
    /// for whichever user holds the HOD role in this department (the
    /// IStaffDirectory/UserManager.GetUsersInRoleAsync pattern used elsewhere
    /// for HOD-gated actions like FacultyRegistrationService's reviewer
    /// check), avoids ambiguity if more than one user ever holds the HOD role
    /// for the same department, and avoids adding a UserManager dependency to
    /// this service purely for a role scan.
    /// </summary>
    private async Task<(string Name, string Department, Guid ApplicationUserId)> ResolveHodForRequestAsync(
        RecruitmentRequest request, CancellationToken ct)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId, ct)
            ?? throw new ArgumentException($"Project '{request.ProjectId}' was not found.", nameof(request));

        var department = await db.Departments.FirstOrDefaultAsync(d => d.Id == project.DepartmentId, ct)
            ?? throw new InvalidCommitteeCompositionException(
                $"Department '{project.DepartmentId}' was not found.");

        if (department.HeadUserId is not { } headUserId)
        {
            throw new InvalidCommitteeCompositionException(
                $"Department '{department.Name}' has no Head of Department assigned.");
        }

        var hodUser = await db.Users.FirstOrDefaultAsync(u => u.Id == headUserId, ct);

        // Fallback: If HeadUserId was set from a legacy FacultyProfile.UserId,
        // we need to resolve it through the profile to get the real ApplicationUserId.
        if (hodUser == null)
        {
            var strId = headUserId.ToString();
            var profile = await db.FacultyProfiles.FirstOrDefaultAsync(p => p.UserId == strId, ct);
            if (profile?.ApplicationUserId != null)
            {
                hodUser = await db.Users.FirstOrDefaultAsync(u => u.Id == profile.ApplicationUserId, ct);
            }
        }

        if (hodUser == null)
        {
            throw new InvalidCommitteeCompositionException(
                $"The Head of Department for '{department.Name}' ('{headUserId}') was not found. Please ensure the HOD has registered an account.");
        }

        return (hodUser.FullName ?? hodUser.Email ?? "HOD", department.Name, hodUser.Id);
    }

    private async Task SubmitCommitteeAsync(
        Guid recruitmentRequestId, CommitteeKind kind, IReadOnlyList<CommitteeMemberInput> members,
        Guid piUserId, CancellationToken ct)
    {
        var request = await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        // The Dean's screening nominee (NominatedFaculty) is owned by a
        // separate, independent action (AssignScreeningCommitteeMemberAsync)
        // -- this submission's own required roles (Chairman/Co-PI for
        // Screening, PI/HOD/recommended members for Selection) never depend
        // on it, and since `existing` below only removes rows whose role is
        // present in `members`, a NominatedFaculty row this call did not
        // itself submit is never deleted.
        if (kind == CommitteeKind.Screening)
        {
            ValidateScreeningChairAndCoPi(members);
        }
        // Selection Committee composition is now validated in
        // SubmitSelectionCommitteeForApprovalAsync (PI+HOD auto-add, 3-5
        // recommended members) rather than here -- SubmitCommitteeAsync
        // remains the low-level row-writer both flows share.

        ValidateOutsideInstituteConsent(members);

        var submittedRoles = members.Select(m => m.Role).ToHashSet();
        var existing = await db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == request.Id && m.Kind == kind
                && submittedRoles.Contains(m.Role))
            .ToListAsync(ct);

        foreach (var member in existing)
        {
            db.CommitteeMembers.Remove(member);
        }

        foreach (var member in members)
        {
            db.CommitteeMembers.Add(new CommitteeMember
            {
                Id = Guid.NewGuid(),
                RecruitmentRequestId = request.Id,
                Kind = kind,
                Role = member.Role,
                Name = member.Name,
                Department = member.Department,
                Position = member.Position,
                IsExternal = member.IsExternal,
                ApplicationUserId = member.ApplicationUserId,
                Email = member.Email,
                IsOutsideInstitute = member.IsOutsideInstitute,
                ConsentDocumentId = member.ConsentDocumentId,
            });
        }

        if (kind == CommitteeKind.Screening && request.Stage == RecruitmentStage.Advertised)
        {
            request.Stage = RecruitmentStage.ScreeningInProgress;
        }

        await db.SaveChangesAsync(ct);

        if (kind == CommitteeKind.Selection)
        {
            // The committee is already saved above -- an unconfigured or
            // unreachable mailer (SmtpEmailSender deliberately throws
            // rather than dropping the message silently) must not turn
            // this already-successful submission into an apparent failure
            // for the PI. Best-effort notification, not a precondition.
            try
            {
                var piUser = await db.Users.FirstOrDefaultAsync(u => u.Id == piUserId, ct);
                var piEmail = piUser?.Email;

                foreach (var member in members)
                {
                    if (member.Role is CommitteeRole.InternalNominee or CommitteeRole.ExternalNominee)
                    {
                        var nomineeEmail = await ResolveMemberEmailAsync(member.Name, member.Department, member.IsExternal, ct);

                        var subject = $"Invitation to serve on Selection Committee - MNNIT Allahabad";
                        var body = $"""
                            <p>Dear {member.Name},</p>
                            <p>You have been nominated as an {(member.IsExternal ? "External" : "Internal")} Nominee to serve on the Selection Committee for recruitment of research positions.</p>
                            <p><strong>Department:</strong> {member.Department}</p>
                            <p><strong>Position:</strong> {member.Position}</p>
                            <p>Please log in to the portal to specify your availability dates so that the interviews can be scheduled.</p>
                            <p>Best regards,<br/>Dean (Research &amp; Consultancy), MNNIT Allahabad</p>
                            """;

                        await emailSender.SendAsync(nomineeEmail, subject, body, piEmail, ct);
                    }
                }
            }
            catch
            {
                // Non-fatal -- see comment above.
            }
        }
    }

    public async Task RecordScreeningResultAsync(
        RecordScreeningInput input, Guid piUserId, CancellationToken ct = default)
    {
        if (input.Result == Domain.Enums.ScreeningResult.Ineligible
            && string.IsNullOrWhiteSpace(input.Remarks))
        {
            throw new WorkflowTransitionException(
                "A remark is required when marking a candidate Not Eligible.");
        }

        var candidate = await LoadCandidateForPiAsync(input.CandidateId, piUserId, ct);

        candidate.ScreeningResult = input.Result;

        // Screening out ends the application; the account may then be
        // deactivated if the applicant holds nothing else live.
        if (input.Result == Domain.Enums.ScreeningResult.Ineligible)
        {
            candidate.ScreeningRemarks = input.Remarks;
            candidate.Outcome = CandidateOutcome.NotSelected;
        }

        await db.SaveChangesAsync(ct);

        if (input.Result == Domain.Enums.ScreeningResult.Ineligible)
        {
            await DeactivateIfNoLiveApplicationsAsync(candidate.ApplicationUserId, ct);
        }
    }

    /// <summary>
    /// Emails every candidate on this recruitment marked Not Eligible who
    /// has not yet been notified, including their ScreeningRemarks (the
    /// stated reason) in the body. Idempotent: a repeat call only emails
    /// candidates not already stamped NotEligibleEmailSentAt.
    /// </summary>
    public async Task<IReadOnlyList<Guid>> SendNotEligibleNotificationsAsync(
        Guid recruitmentRequestId, Guid piUserId, CancellationToken ct = default)
    {
        var request = await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        var toNotify = await db.Candidates
            .Where(c => c.RecruitmentRequestId == request.Id
                && c.ScreeningResult == Domain.Enums.ScreeningResult.Ineligible
                && c.NotEligibleEmailSentAt == null)
            .ToListAsync(ct);

        var notifiedIds = new List<Guid>();

        foreach (var candidate in toNotify)
        {
            var candidateUser = await db.Users.FirstOrDefaultAsync(u => u.Id == candidate.ApplicationUserId, ct);
            if (candidateUser?.Email is not { } candidateEmail)
            {
                continue; // no resolvable account email -- skip, do not stamp, so a later retry can pick it up once fixed
            }

            var subject = "Application Status Update - MNNIT Allahabad";
            var body = $"""
                <p>Dear {candidate.FullName},</p>
                <p>Thank you for your application. After screening, your application has not been found eligible for this recruitment.</p>
                <p><strong>Reason:</strong> {candidate.ScreeningRemarks}</p>
                <p>Best regards,<br/>MNNIT Allahabad</p>
                """;

            await emailSender.SendAsync(candidateEmail, subject, body, null, ct);

            candidate.NotEligibleEmailSentAt = DateTimeOffset.UtcNow;
            notifiedIds.Add(candidate.Id);
        }

        await db.SaveChangesAsync(ct);
        return notifiedIds;
    }

    public async Task SetNomineeAvailabilityAsync(
        Guid committeeMemberId, DateOnly availabilityDate, Guid piUserId, CancellationToken ct = default)
    {
        var member = await db.CommitteeMembers
            .FirstOrDefaultAsync(m => m.Id == committeeMemberId, ct)
            ?? throw new ArgumentException(
                $"Committee member '{committeeMemberId}' was not found.", nameof(committeeMemberId));

        await LoadOwnedRequestAsync(member.RecruitmentRequestId, piUserId, ct);

        member.AvailabilityDate = availabilityDate;
        await db.SaveChangesAsync(ct);
    }

    // ---------------------------------------------------------------- Task 8

    public async Task ScheduleInterviewAsync(
        ScheduleInterviewInput input, Guid piUserId, CancellationToken ct = default)
    {
        var request = await LoadOwnedRequestAsync(input.RecruitmentRequestId, piUserId, ct);

        // BRD A2: Interview may be allowed once payment has been received (spec D7).
        // Only an Approved receipt counts as confirmed -- a merely-submitted,
        // still-pending row must not unlock this gate.
        var hasConfirmedPayment = await db.GrantReceipts.AnyAsync(
            g => g.ProjectId == request.ProjectId && g.Amount > 0 && g.Status == GrantReceiptStatus.Approved,
            ct);

        if (!hasConfirmedPayment)
        {
            throw new PaymentNotReceivedException(request.ProjectId);
        }

        request.InterviewDate = input.InterviewDate;
        request.InterviewTime = input.InterviewTime;
        request.InterviewVenue = input.InterviewVenue;
        request.Stage = RecruitmentStage.SelectionScheduled;

        await db.SaveChangesAsync(ct);

        var eligibleCandidates = await db.Candidates
            .Where(c => c.RecruitmentRequestId == request.Id
                && c.ScreeningResult == Domain.Enums.ScreeningResult.Eligible)
            .ToListAsync(ct);

        foreach (var candidate in eligibleCandidates)
        {
            var candidateUser = await db.Users.FirstOrDefaultAsync(u => u.Id == candidate.ApplicationUserId, ct);
            if (candidateUser?.Email is not { } candidateEmail)
            {
                continue; // no resolvable account email -- skip silently, mirroring SendNotEligibleNotificationsAsync
            }

            var subject = "Interview Scheduled - MNNIT Allahabad";
            var body = $"""
                <p>Dear {candidate.FullName},</p>
                <p>Your interview has been scheduled. Details below:</p>
                <p><strong>Date:</strong> {input.InterviewDate:dd MMM yyyy}<br/>
                <strong>Time:</strong> {input.InterviewTime:hh\\:mm tt}<br/>
                <strong>Venue:</strong> {input.InterviewVenue}</p>
                <p>Best regards,<br/>MNNIT Allahabad</p>
                """;

            await emailSender.SendAsync(candidateEmail, subject, body, null, ct);
        }
    }

    public async Task SetInterviewModeAsync(
        SetInterviewModeInput input, Guid piUserId, Guid? deanApprovalUserId, CancellationToken ct = default)
    {
        var candidate = await LoadCandidateForPiAsync(input.CandidateId, piUserId, ct);

        // BRD A2: offline is the default; online needs the Dean to have approved
        // it first, and we record who did.
        if (input.Mode == InterviewMode.Online && deanApprovalUserId is null)
        {
            throw new OnlineInterviewNotApprovedException(input.CandidateId);
        }

        candidate.InterviewMode = input.Mode;
        candidate.OnlineModeApprovedByUserId =
            input.Mode == InterviewMode.Online ? deanApprovalUserId : null;

        await db.SaveChangesAsync(ct);

        // The mode change is already saved -- see SubmitCommitteeAsync's
        // identical reasoning for why a notification failure here must not
        // propagate and mask an already-successful update.
        try
        {
            var piUser = await db.Users.FirstOrDefaultAsync(u => u.Id == piUserId, ct);
            var piEmail = piUser?.Email;

            var candidateUser = await db.Users.FirstOrDefaultAsync(u => u.Id == candidate.ApplicationUserId, ct);
            var candidateEmail = candidateUser?.Email;

            if (piEmail is not null)
            {
                var subject = $"Interview Mode Approved for Candidate {candidate.FullName}";
                var body = $"""
                    <p>Dear Dr. {piUser?.FullName ?? "PI"},</p>
                    <p>The interview mode for the candidate listed below has been updated and approved.</p>
                    <p><strong>Candidate Name:</strong> {candidate.FullName}</p>
                    <p><strong>Interview Mode:</strong> {input.Mode}</p>
                    <p>Please note that online participation is permitted only with prior Dean approval.</p>
                    <p>Best regards,<br/>Dean (Research &amp; Consultancy), MNNIT Allahabad</p>
                    """;
                await emailSender.SendAsync(piEmail, subject, body, candidateEmail, ct);
            }
        }
        catch
        {
            // Non-fatal -- see comment above.
        }
    }

    public async Task ApproveInterviewModeAsync(
        Guid candidateId, InterviewMode mode, Guid deanUserId, CancellationToken ct = default)
    {
        var candidate = await db.Candidates.FirstOrDefaultAsync(c => c.Id == candidateId, ct)
            ?? throw new CandidateNotFoundException(candidateId);

        if (candidate.ApplicationStatus != ApplicationStatus.Submitted)
        {
            throw new CandidateApplicationNotSubmittedException(candidateId);
        }

        candidate.InterviewMode = mode;
        candidate.OnlineModeApprovedByUserId = mode == InterviewMode.Online ? deanUserId : null;
        await db.SaveChangesAsync(ct);
    }

    public async Task NominateScreeningFacultyAsync(
        Guid recruitmentRequestId, string facultyName, string department, string position, Guid deanUserId,
        Guid? nomineeApplicationUserId = null, string? nomineeEmail = null, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        var existingNominee = await db.CommitteeMembers
            .FirstOrDefaultAsync(m => m.RecruitmentRequestId == request.Id && m.Kind == CommitteeKind.Screening && m.Role == CommitteeRole.NominatedFaculty, ct);

        if (existingNominee != null)
        {
            existingNominee.Name = facultyName;
            existingNominee.Department = department;
            existingNominee.Position = position;
            existingNominee.ApplicationUserId = nomineeApplicationUserId;
            existingNominee.Email = nomineeEmail;
        }
        else
        {
            db.CommitteeMembers.Add(new CommitteeMember
            {
                Id = Guid.NewGuid(),
                RecruitmentRequestId = request.Id,
                Kind = CommitteeKind.Screening,
                Role = CommitteeRole.NominatedFaculty,
                Name = facultyName,
                Department = department,
                Position = position,
                IsExternal = false,
                ApplicationUserId = nomineeApplicationUserId,
                Email = nomineeEmail,
            });
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task SubmitJoiningReportAsync(
        RecordJoiningInput input, Guid piUserId, CancellationToken ct = default)
    {
        var candidate = await LoadCandidateForPiAsync(input.CandidateId, piUserId, ct);
        await SaveJoiningReportAsync(candidate, input, ct);
    }

    /// <summary>
    /// The candidate-facing counterpart of <see cref="SubmitJoiningReportAsync"/>
    /// (client request, 2026-09-15: joining-report submission moves from the
    /// PI's recruitment detail page to the candidate's own portal). Same
    /// eligibility rule and same persisted shape -- only the authorization
    /// differs: the caller must be the applicant who owns this Candidate row,
    /// not its PI.
    /// </summary>
    public async Task SubmitOwnJoiningReportAsync(
        RecordJoiningInput input, Guid applicantUserId, CancellationToken ct = default)
    {
        var candidate = await db.Candidates.FirstOrDefaultAsync(c => c.Id == input.CandidateId, ct)
            ?? throw new CandidateNotFoundException(input.CandidateId);

        if (candidate.ApplicationUserId != applicantUserId)
        {
            throw new CandidateApplicationNotOwnedException(input.CandidateId);
        }

        await SaveJoiningReportAsync(candidate, input, ct);
    }

    private async Task SaveJoiningReportAsync(Candidate candidate, RecordJoiningInput input, CancellationToken ct)
    {
        if (candidate.Outcome != CandidateOutcome.Selected)
        {
            throw new CandidateNotEligibleToJoinException($"Candidate '{candidate.Id}' has not been selected and cannot submit joining.");
        }

        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == candidate.RecruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(candidate.RecruitmentRequestId);

        if (request.Stage != RecruitmentStage.OfferIssued)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.OfferIssued));
        }

        // The Fellow must upload their signed Offer Letter and Contract of
        // Engagement -- owned by their own Candidate row, not the
        // RecruitmentRequest -- before they can submit their joining report
        // at all. "At the time of joining" is read literally: this is the
        // earliest point in the flow, not deferred to the Dean's approval.
        var uploadedKinds = await db.Documents
            .Where(d => d.OwnerType == "Candidate" && d.OwnerId == candidate.Id
                && RequiredJoiningDocumentKinds.Contains(d.Kind))
            .Select(d => d.Kind)
            .Distinct()
            .ToListAsync(ct);
        var missingKinds = RequiredJoiningDocumentKinds.Except(uploadedKinds).ToList();
        if (missingKinds.Count > 0)
        {
            throw new JoiningDocumentsMissingException(missingKinds);
        }

        var existingSelection = await db.ManpowerSelections
            .FirstOrDefaultAsync(s => s.CandidateId == candidate.Id || (candidate.ApplicationUserId != null && s.ApplicationUserId == candidate.ApplicationUserId), ct);

        if (existingSelection != null)
        {
            existingSelection.CandidateId = candidate.Id;
            existingSelection.ApplicationUserId = candidate.ApplicationUserId;
            existingSelection.SanctionedManpowerPositionId = request.SanctionedManpowerPositionId;
            existingSelection.AadharNo = input.AadharNo;
            existingSelection.PanNo = input.PanNo;
            existingSelection.BankAccountNo = input.BankAccountNo;
            existingSelection.IfscCode = input.IfscCode;
            existingSelection.Dob = input.Dob;
            existingSelection.Gender = input.Gender;
            existingSelection.JoinedOn = input.JoinedOn;
            existingSelection.ValidTill = input.ValidTill;
            existingSelection.RecommendedStipend = input.RecommendedStipend;
            existingSelection.Status = ManpowerSelectionStatus.Active;
        }
        else
        {
            db.ManpowerSelections.Add(new ManpowerSelection
            {
                Id = Guid.NewGuid(),
                CandidateId = candidate.Id,
                ApplicationUserId = candidate.ApplicationUserId,
                SanctionedManpowerPositionId = request.SanctionedManpowerPositionId,
                AadharNo = input.AadharNo,
                PanNo = input.PanNo,
                BankAccountNo = input.BankAccountNo,
                IfscCode = input.IfscCode,
                Dob = input.Dob,
                Gender = input.Gender,
                JoinedOn = input.JoinedOn,
                ValidTill = input.ValidTill,
                RecommendedStipend = input.RecommendedStipend,
                Status = ManpowerSelectionStatus.Active,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        request.Stage = RecruitmentStage.JoiningSubmitted;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// The PI's own review of the candidate's joining report before it goes
    /// to HOD -- added because the candidate now submits it directly (client
    /// request, 2026-09-15), so the PI who used to be the one filling it in
    /// needs an explicit forwarding step instead, mirroring the fellowship
    /// claim's Fellow-submits -&gt; PI-forwards -&gt; HOD... route
    /// (<see cref="FellowshipWorkflowSeeder"/>).
    /// </summary>
    public async Task ForwardJoiningReportToHodAsync(
        Guid candidateId, string? remarks, Guid piUserId, CancellationToken ct = default)
    {
        var candidate = await LoadCandidateForPiAsync(candidateId, piUserId, ct);

        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == candidate.RecruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(candidate.RecruitmentRequestId);

        if (request.Stage != RecruitmentStage.JoiningSubmitted)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.JoiningSubmitted));
        }

        request.Stage = RecruitmentStage.JoiningPendingHOD;
        await db.SaveChangesAsync(ct);
    }

    public async Task<JoiningReportDetail?> GetJoiningReportAsync(Guid candidateId, CancellationToken ct = default)
    {
        var selection = await db.ManpowerSelections
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.CandidateId == candidateId, ct);

        if (selection is null)
        {
            return null;
        }

        var documentIds = await db.Documents
            .Where(d => d.OwnerType == "Candidate" && d.OwnerId == candidateId
                && (d.Kind == DocumentKind.SignedOfferLetter || d.Kind == DocumentKind.ContractOfEngagement))
            .Select(d => new { d.Kind, d.Id })
            .ToListAsync(ct);
        var signedOfferLetterId = documentIds.FirstOrDefault(d => d.Kind == DocumentKind.SignedOfferLetter)?.Id;
        var contractOfEngagementId = documentIds.FirstOrDefault(d => d.Kind == DocumentKind.ContractOfEngagement)?.Id;

        return new JoiningReportDetail(
            candidateId, selection.JoinedOn, selection.ValidTill, selection.RecommendedStipend,
            selection.AadharNo, selection.PanNo, selection.BankAccountNo, selection.IfscCode,
            selection.Dob, selection.Gender, signedOfferLetterId, contractOfEngagementId);
    }

    public async Task ForwardJoiningReportAsync(
        Guid candidateId, string? remarks, Guid hodUserId, CancellationToken ct = default)
    {
        var candidate = await LoadSubmittedCandidateAsync(candidateId, ct);

        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == candidate.RecruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(candidate.RecruitmentRequestId);

        if (request.Stage != RecruitmentStage.JoiningPendingHOD)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.JoiningPendingHOD));
        }

        request.Stage = RecruitmentStage.JoiningPendingDean;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// PI, HOD, or Dean bouncing the joining report back to the candidate for
    /// revision -- always lands back at OfferIssued, where the candidate's own
    /// "Submit Joining Report" prompt reappears on their My Applications page.
    /// </summary>
    public async Task ReturnJoiningReportAsync(
        Guid candidateId, string? remarks, Guid actorUserId, CancellationToken ct = default)
    {
        var candidate = await LoadSubmittedCandidateAsync(candidateId, ct);

        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == candidate.RecruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(candidate.RecruitmentRequestId);

        if (request.Stage is not (RecruitmentStage.JoiningSubmitted or RecruitmentStage.JoiningPendingHOD or RecruitmentStage.JoiningPendingDean))
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.JoiningPendingHOD));
        }

        request.Stage = RecruitmentStage.OfferIssued;
        await db.SaveChangesAsync(ct);
    }

    public async Task ApproveJoiningReportAsync(
        Guid candidateId, string? remarks, Guid deanUserId, CancellationToken ct = default)
    {
        var candidate = await LoadSubmittedCandidateAsync(candidateId, ct);

        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == candidate.RecruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(candidate.RecruitmentRequestId);

        if (request.Stage != RecruitmentStage.JoiningPendingDean)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.JoiningPendingDean));
        }

        // Defense-in-depth re-check of the same gate SaveJoiningReportAsync
        // already enforced at submission time -- owned by the Candidate row,
        // not RecruitmentRequest, since these are the Fellow's own documents.
        // Not expected to ever actually fire through this service's own
        // entry points; guards against a Document row being deleted (or a
        // pre-existing joining record from before this gate existed)
        // reaching the Dean's approval regardless.
        var uploadedKinds = await db.Documents
            .Where(d => d.OwnerType == "Candidate" && d.OwnerId == candidate.Id
                && RequiredJoiningDocumentKinds.Contains(d.Kind))
            .Select(d => d.Kind)
            .Distinct()
            .ToListAsync(ct);
        var missingKinds = RequiredJoiningDocumentKinds.Except(uploadedKinds).ToList();
        if (missingKinds.Count > 0)
        {
            throw new JoiningDocumentsMissingException(missingKinds);
        }

        request.Stage = RecruitmentStage.Joined;
        await db.SaveChangesAsync(ct);

        await applicantRoles.PromoteToFellowAsync(candidate.ApplicationUserId, ct);
    }

    public async Task<IReadOnlyList<JoiningQueueItemSummary>> ListJoiningQueueAsync(
        Guid actorUserId, CancellationToken ct = default)
    {
        var pendingRequests = await db.RecruitmentRequests
            .Where(r => r.Stage == RecruitmentStage.JoiningPendingHOD || r.Stage == RecruitmentStage.JoiningPendingDean || r.Stage == RecruitmentStage.Joined)
            .ToListAsync(ct);

        if (pendingRequests.Count == 0) return [];

        var requestIds = pendingRequests.Select(r => r.Id).ToList();
        var projectIds = pendingRequests.Select(r => r.ProjectId).Distinct().ToList();
        var positionIds = pendingRequests.Select(r => r.SanctionedManpowerPositionId).Distinct().ToList();

        var projects = await db.Projects.Where(p => projectIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        var positions = await db.SanctionedManpowerPositions.Where(p => positionIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        // The queue picks a request's selected (or, failing that, first) candidate
        // to display; a Draft must never be the row a HOD/Dean sees or acts on.
        var candidates = await db.Candidates
            .Where(c => requestIds.Contains(c.RecruitmentRequestId)
                     && c.ApplicationStatus == ApplicationStatus.Submitted)
            .ToListAsync(ct);

        var userIds = projects.Values.Select(p => p.OwnerUserId).Distinct().ToList();
        var users = await db.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        var committee = await db.CommitteeMembers
            .Where(m => requestIds.Contains(m.RecruitmentRequestId) && m.Kind == CommitteeKind.Selection && m.Role == CommitteeRole.Chairman)
            .ToDictionaryAsync(m => m.RecruitmentRequestId, m => m.Name, ct);

        var result = new List<JoiningQueueItemSummary>();

        foreach (var req in pendingRequests)
        {
            projects.TryGetValue(req.ProjectId, out var proj);
            positions.TryGetValue(req.SanctionedManpowerPositionId, out var pos);
            var reqCandidates = candidates.Where(c => c.RecruitmentRequestId == req.Id).ToList();
            var selectedCand = reqCandidates.FirstOrDefault(c => c.Outcome == CandidateOutcome.Selected) ?? reqCandidates.FirstOrDefault();

            if (selectedCand == null) continue;

            users.TryGetValue(proj?.OwnerUserId ?? Guid.Empty, out var piName);
            committee.TryGetValue(req.Id, out var chairName);

            var selection = await db.ManpowerSelections.FirstOrDefaultAsync(s => s.CandidateId == selectedCand.Id, ct);

            var statusStr = req.Stage switch
            {
                RecruitmentStage.JoiningPendingHOD => "PENDING_HOD",
                RecruitmentStage.JoiningPendingDean => "FORWARDED_TO_DEAN",
                RecruitmentStage.Joined => "JOINED",
                _ => req.Stage.ToString()
            };

            result.Add(new JoiningQueueItemSummary(
                selectedCand.Id,
                req.Id,
                $"JNR-{req.CreatedAt.Year}-{req.Id.ToString()[..5].ToUpper()}",
                selectedCand.FullName,
                pos?.Designation ?? "Research Fellow",
                selection?.RecommendedStipend ?? pos?.Stipend ?? 0m,
                pos?.Hra ?? 0m,
                proj?.DepartmentId.ToString() ?? "CSED",
                proj?.ProjectTitle ?? "Research Project",
                piName ?? "Dr. PI",
                selectedCand.MeritRank ?? 1,
                req.InterviewDate,
                selection?.JoinedOn ?? DateOnly.FromDateTime(DateTime.UtcNow),
                chairName ?? "Prof. HOD",
                statusStr,
                selectedCand.AppliedAt
            ));
        }

        return result;
    }

    public async Task SubmitMeritListAsync(
        Guid recruitmentRequestId, IReadOnlyList<MeritRankInput> ranks,
        Guid piUserId, CancellationToken ct = default)
    {
        var request = await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        if (ranks.Count == 0)
        {
            throw new ArgumentException("A merit list must rank at least one candidate.", nameof(ranks));
        }

        var duplicateRanks = ranks.GroupBy(r => r.Rank).Any(g => g.Count() > 1);
        if (duplicateRanks)
        {
            throw new ArgumentException("Merit ranks must be unique within a recruitment.", nameof(ranks));
        }

        if (ranks.Any(r => r.Rank < 1))
        {
            throw new ArgumentException("Merit ranks start at 1.", nameof(ranks));
        }

        var candidates = await db.Candidates
            .Where(c => c.RecruitmentRequestId == request.Id)
            .ToListAsync(ct);

        var byId = candidates.ToDictionary(c => c.Id);

        foreach (var rank in ranks)
        {
            if (!byId.TryGetValue(rank.CandidateId, out var candidate))
            {
                throw new CandidateNotFoundException(rank.CandidateId);
            }

            // Loaded unfiltered above so a Draft id fails loudly and specifically
            // here rather than masquerading as a non-existent candidate.
            if (candidate.ApplicationStatus != ApplicationStatus.Submitted)
            {
                throw new CandidateApplicationNotSubmittedException(rank.CandidateId);
            }

            // Ranking someone screened out would contradict the screening result.
            if (candidate.ScreeningResult == Domain.Enums.ScreeningResult.Ineligible)
            {
                throw new ArgumentException(
                    $"Candidate '{rank.CandidateId}' was screened out and cannot be ranked.",
                    nameof(ranks));
            }

            candidate.MeritRank = rank.Rank;
        }

        request.Stage = RecruitmentStage.MeritListPrepared;
        await db.SaveChangesAsync(ct);
    }

    public async Task ApproveMeritListAsync(
        Guid recruitmentRequestId, Guid deanUserId, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        if (request.Stage != RecruitmentStage.MeritListPrepared)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(
                    request.Id, request.Stage, RecruitmentStage.MeritListPrepared));
        }

        var selection = await db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == request.Id && m.Kind == CommitteeKind.Selection)
            .ToListAsync(ct);

        if (selection.Count == 0)
        {
            throw new InvalidCommitteeCompositionException(
                "No selection committee has been submitted for this recruitment.");
        }

        // Replaces the earlier per-member e-signing requirement: the signed
        // merit list, attendance sheet, and scanned minutes must all be
        // uploaded before the Dean can approve.
        var requiredKinds = new[]
        {
            DocumentKind.SignedMeritList,
            DocumentKind.AttendanceSheet,
            DocumentKind.MinutesOfSelectionScanned,
        };
        var uploadedKinds = await db.Documents
            .Where(d => d.OwnerType == "RecruitmentRequest" && d.OwnerId == request.Id
                && requiredKinds.Contains(d.Kind))
            .Select(d => d.Kind)
            .Distinct()
            .ToListAsync(ct);
        var missing = requiredKinds.Except(uploadedKinds).ToList();
        if (missing.Count > 0)
        {
            throw new MeritListDocumentsMissingException(missing);
        }

        // The one step with an office escalation chain, so the one that uses the
        // workflow engine.
        var instance = await workflowEngine.RaiseAsync(
            RequestType.ManpowerDocument, request.Id, WorkflowPhase.Indent, deanUserId, ct);

        request.WorkflowInstanceId = instance.Id;
        request.Stage = RecruitmentStage.Approved;
        await db.SaveChangesAsync(ct);
    }

    // ---------------------------------------------------------------- Task 9

    public async Task IssueOfferLetterAsync(
        IssueOfferInput input, Guid actorUserId, CancellationToken ct = default)
    {
        var candidate = await db.Candidates
            .FirstOrDefaultAsync(c => c.Id == input.CandidateId, ct)
            ?? throw new CandidateNotFoundException(input.CandidateId);

        if (candidate.ApplicationStatus != ApplicationStatus.Submitted)
        {
            throw new CandidateApplicationNotSubmittedException(input.CandidateId);
        }

        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == candidate.RecruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(candidate.RecruitmentRequestId);

        if (request.Stage != RecruitmentStage.Approved)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.Approved));
        }

        // BRD A2's payment precondition (spec D7). Payment is an offline NEFT or
        // RTGS transfer, so the evidence is the bank's transaction reference --
        // not merely that someone created a receipt row. The receipt must also
        // have cleared the approval chain (Status == Approved) -- a pending,
        // unapproved row must not unlock this gate even with a reference on it.
        var hasConfirmedPayment = await db.GrantReceipts.AnyAsync(
            g => g.ProjectId == request.ProjectId && g.Amount > 0
              && !string.IsNullOrWhiteSpace(g.TransactionReference)
              && g.Status == GrantReceiptStatus.Approved,
            ct);

        if (!hasConfirmedPayment)
        {
            throw new PaymentNotReceivedException(request.ProjectId);
        }

        if (input.RecommendedStipend < 0m)
        {
            throw new ArgumentException("Stipend cannot be negative.", nameof(input));
        }

        // The one step with an office escalation chain, so the one that uses
        // the workflow engine -- same RequestType/route ApproveMeritListAsync
        // already raises an instance of, tracked in a SEPARATE field
        // (OfferWorkflowInstanceId, not WorkflowInstanceId) since a
        // RecruitmentRequest may have both a concluded merit-list instance
        // and a live offer instance at once.
        var instance = await workflowEngine.RaiseAsync(
            RequestType.ManpowerDocument, request.Id, WorkflowPhase.Indent, actorUserId, ct);

        // The PI named this exact candidate; ReleaseOfferLetterAsync has no
        // IssueOfferInput of its own, so this is where that choice is kept
        // for release time. Re-deriving "the pending candidate" at release
        // time would be ambiguous once a prior round's decline can leave a
        // second, unrelated candidate Pending too.
        request.PendingOfferCandidateId = candidate.Id;
        request.OfferWorkflowInstanceId = instance.Id;
        request.Stage = RecruitmentStage.OfferPendingApproval;

        // Persist the recommended stipend into document overrides cache so getOfferLetterData returns it
        try
        {
            var cacheFolder = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "generated_documents");
            Directory.CreateDirectory(cacheFolder);
            var dataFilePath = Path.Combine(cacheFolder, $"{request.Id}-OfferLetter.json");
            var overrides = new OfferLetterManualOverrides(
                candidate.FullName, null, null, null, null, null,
                input.RecommendedStipend, null, input.JoiningDate);
            var jsonData = System.Text.Json.JsonSerializer.Serialize(overrides);
            await System.IO.File.WriteAllTextAsync(dataFilePath, jsonData, ct);
        }
        catch
        {
            // Non-fatal
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// The DA's (RegularStaff role) action once the offer's approval chain
    /// (raised by IssueOfferLetterAsync) has reached WorkflowStage.Approved --
    /// this is the point the offer is actually released to the candidate.
    /// The workflow engine itself has no concept of "release the offer";
    /// that is this recruitment entity's own reaction to its instance
    /// concluding, exactly as AdvertisementWorkflowSeeder's own doc comment
    /// describes for the advertisement chain's "make the ad live" step.
    /// </summary>
    public async Task ReleaseOfferLetterAsync(
        Guid recruitmentRequestId, Guid actorUserId, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        if (request.Stage != RecruitmentStage.OfferPendingApproval)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.OfferPendingApproval));
        }

        if (request.OfferWorkflowInstanceId is not { } instanceId)
        {
            throw new OfferNotApprovedException(request.Id);
        }

        var instance = await workflowEngine.GetAsync(instanceId, ct);
        if (instance is null || instance.CurrentStage != WorkflowStage.Approved)
        {
            throw new OfferNotApprovedException(request.Id);
        }

        // The exact candidate the PI named in IssueOfferLetterAsync -- not a
        // re-derived guess. See PendingOfferCandidateId's own doc comment.
        if (request.PendingOfferCandidateId is not { } pendingCandidateId)
        {
            throw new NoCandidateSelectedException(
                $"No candidate is on record as awaiting this offer for recruitment '{request.Id}'.");
        }

        var candidate = await db.Candidates
            .FirstOrDefaultAsync(c => c.Id == pendingCandidateId, ct)
            ?? throw new CandidateNotFoundException(pendingCandidateId);

        candidate.Outcome = CandidateOutcome.Selected;
        request.Stage = RecruitmentStage.OfferIssued;
        request.PendingOfferCandidateId = null;
        await db.SaveChangesAsync(ct);

        // Everyone else in this drive is now out; their accounts deactivate
        // unless they hold a live application elsewhere.
        await CloseUnsuccessfulCandidatesAsync(request.Id, candidate.Id, ct);

        var candidateUser = await db.Users.FirstOrDefaultAsync(u => u.Id == candidate.ApplicationUserId, ct);
        if (candidateUser?.Email is not { } candidateEmail)
        {
            return; // no resolvable account email -- offer is issued, but no email to send
        }

        var subject = "Offer of Appointment - MNNIT Allahabad";
        var body = $"""
            <p>Dear {candidate.FullName},</p>
            <p>We are pleased to offer you the position for which you applied. Please log in to the portal to accept or decline this offer.</p>
            <p>Best regards,<br/>MNNIT Allahabad</p>
            """;

        await emailSender.SendAsync(candidateEmail, subject, body, null, ct);
    }

    /// <summary>
    /// The candidate's own acceptance of an issued offer -- the self-service
    /// counterpart pattern SubmitOwnJoiningReportAsync already establishes
    /// (candidate acts on their own row via ApplicationUserId, not PI-facing).
    /// Deliberately does not touch Outcome (stays Selected) or
    /// RecruitmentRequest.Stage (stays OfferIssued) -- joining submission is
    /// the next real transition, unchanged by this design.
    /// </summary>
    public async Task AcceptOfferAsync(
        Guid candidateId, Guid applicantUserId, CancellationToken ct = default)
    {
        var candidate = await db.Candidates.FirstOrDefaultAsync(c => c.Id == candidateId, ct)
            ?? throw new CandidateNotFoundException(candidateId);

        if (candidate.ApplicationUserId != applicantUserId)
        {
            throw new CandidateApplicationNotOwnedException(candidateId);
        }

        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == candidate.RecruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(candidate.RecruitmentRequestId);

        if (request.Stage != RecruitmentStage.OfferIssued)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.OfferIssued));
        }

        if (candidate.Outcome != CandidateOutcome.Selected)
        {
            throw new NoCandidateSelectedException(
                $"Candidate '{candidateId}' has not been offered this position and cannot accept.");
        }

        candidate.OfferResponse = CandidateOfferResponse.Accepted;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// The candidate's own decline of an issued offer. Reopens every other
    /// candidate this specific offer round closed via
    /// CloseUnsuccessfulCandidatesAsync (mirroring that method's own
    /// selection query, restricted to this request), reactivating their
    /// accounts and returning the request to Approved so a PI/Dean can
    /// manually pick the next candidate and re-run IssueOfferLetterAsync.
    /// No automatic ranking-based re-selection -- always a manual pick, per
    /// the 2026-09-23 design. Does not need to touch
    /// RecruitmentRequest.PendingOfferCandidateId (Task 2's field): every
    /// stage writer that can reach OfferIssued traces back (by induction --
    /// JoiningSubmitted/JoiningPendingHOD/JoiningPendingDean/ReturnJoiningReport
    /// all require having already been at OfferIssued) to
    /// ReleaseOfferLetterAsync, which clears the field to null in the same
    /// SaveChanges that first sets OfferIssued -- so it is guaranteed null by
    /// the time this method can run. IssueOfferLetterAsync then unconditionally
    /// assigns PendingOfferCandidateId = candidate.Id on every call (no guard),
    /// so no stale value can leak into a new round either.
    /// </summary>
    public async Task DeclineOfferAsync(
        Guid candidateId, Guid applicantUserId, CancellationToken ct = default)
    {
        var candidate = await db.Candidates.FirstOrDefaultAsync(c => c.Id == candidateId, ct)
            ?? throw new CandidateNotFoundException(candidateId);

        if (candidate.ApplicationUserId != applicantUserId)
        {
            throw new CandidateApplicationNotOwnedException(candidateId);
        }

        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == candidate.RecruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(candidate.RecruitmentRequestId);

        if (request.Stage != RecruitmentStage.OfferIssued)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.OfferIssued));
        }

        if (candidate.Outcome != CandidateOutcome.Selected)
        {
            throw new NoCandidateSelectedException(
                $"Candidate '{candidateId}' has not been offered this position and cannot decline.");
        }

        candidate.OfferResponse = CandidateOfferResponse.Declined;
        candidate.Outcome = CandidateOutcome.NotSelected;
        request.Stage = RecruitmentStage.Approved;
        await db.SaveChangesAsync(ct);

        await DeactivateIfNoLiveApplicationsAsync(candidate.ApplicationUserId, ct);

        var reopened = await db.Candidates
            .Where(c => c.RecruitmentRequestId == request.Id
                     && c.Id != candidate.Id
                     && c.ApplicationStatus == ApplicationStatus.Submitted
                     && c.Outcome == CandidateOutcome.NotSelected
                     // NotSelected has two producers: losing this offer round
                     // (CloseUnsuccessfulCandidatesAsync) and being screened
                     // out as Ineligible (RecordScreeningResultAsync). Only
                     // the former should ever be reopened -- a screened-out
                     // candidate must never become re-selectable.
                     && c.ScreeningResult != Domain.Enums.ScreeningResult.Ineligible)
            .ToListAsync(ct);

        foreach (var other in reopened)
        {
            other.Outcome = CandidateOutcome.Pending;
        }
        await db.SaveChangesAsync(ct);

        foreach (var other in reopened)
        {
            await applicantRoles.ReactivateAsync(other.ApplicationUserId, ct);
        }
    }

    /// <summary>
    /// A PI/Dean's explicit declaration that this recruitment's ranked
    /// candidate pool is exhausted -- no automatic transition sets this
    /// (DeclineOfferAsync always returns to Approved, since the system
    /// cannot know in advance whether a re-offer is intended); this is the
    /// deliberate terminal action once no eligible candidate remains.
    /// </summary>
    public async Task MarkNoCandidateAcceptedAsync(
        Guid recruitmentRequestId, Guid actorUserId, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        if (request.Stage != RecruitmentStage.Approved)
        {
            throw new InvalidRecruitmentStageException(
                RecruitmentStageDetail.For(request.Id, request.Stage, RecruitmentStage.Approved));
        }

        request.Stage = RecruitmentStage.NoCandidateAccepted;
        await db.SaveChangesAsync(ct);
    }

    public async Task<Guid> RecordJoiningAsync(
        RecordJoiningInput input, Guid actorUserId, CancellationToken ct = default)
    {
        var candidate = await db.Candidates
            .FirstOrDefaultAsync(c => c.Id == input.CandidateId, ct)
            ?? throw new CandidateNotFoundException(input.CandidateId);

        if (candidate.ApplicationStatus != ApplicationStatus.Submitted)
        {
            throw new CandidateApplicationNotSubmittedException(input.CandidateId);
        }

        if (candidate.Outcome != CandidateOutcome.Selected)
        {
            throw new CandidateNotEligibleToJoinException(
                $"Candidate '{input.CandidateId}' has not been selected and cannot join.");
        }

        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == candidate.RecruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(candidate.RecruitmentRequestId);

        if (input.ValidTill < input.JoinedOn)
        {
            throw new ArgumentException(
                "The tenure end date cannot precede the joining date.", nameof(input));
        }

        var alreadyJoined = await db.ManpowerSelections
            .AnyAsync(s => s.CandidateId == candidate.Id, ct);

        if (alreadyJoined)
        {
            throw new CandidateNotEligibleToJoinException(
                $"Candidate '{input.CandidateId}' has already joined.");
        }

        var selection = new ManpowerSelection
        {
            Id = Guid.NewGuid(),
            CandidateId = candidate.Id,
            ApplicationUserId = candidate.ApplicationUserId,
            SanctionedManpowerPositionId = request.SanctionedManpowerPositionId,
            AadharNo = input.AadharNo,
            PanNo = input.PanNo,
            BankAccountNo = input.BankAccountNo,
            IfscCode = input.IfscCode,
            Dob = input.Dob,
            Gender = input.Gender,
            JoinedOn = input.JoinedOn,
            ValidTill = input.ValidTill,
            RecommendedStipend = input.RecommendedStipend,
            Status = ManpowerSelectionStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.ManpowerSelections.Add(selection);
        request.Stage = RecruitmentStage.Joined;
        await db.SaveChangesAsync(ct);

        // The applicant becomes a fellow. Everything a fellow can later do is
        // scoped through this selection row.
        await applicantRoles.PromoteToFellowAsync(candidate.ApplicationUserId, ct);

        return selection.Id;
    }

    public async Task IssueIdCardAsync(
        IssueIdCardInput input, Guid actorUserId, CancellationToken ct = default)
    {
        var selection = await db.ManpowerSelections
            .FirstOrDefaultAsync(s => s.Id == input.ManpowerSelectionId, ct)
            ?? throw new ArgumentException(
                $"Fellow appointment '{input.ManpowerSelectionId}' was not found.", nameof(input));

        if (string.IsNullOrWhiteSpace(input.IdCardNumber))
        {
            throw new ArgumentException("An ID card number is required.", nameof(input));
        }

        selection.IdCardNumber = input.IdCardNumber;
        selection.IdCardIssuedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    // ---------------------------------------------------------------- Queries

    public async Task<IReadOnlyList<RecruitmentSummary>> ListForProjectAsync(
        Guid projectId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default)
    {
        var project = await projectService.GetAsync(projectId, requestingUserId, requestingUserRoles, ct);
        if (project == null) throw new ProjectAccessDeniedException(projectId);

        var requests = await db.RecruitmentRequests
            .Where(r => r.ProjectId == projectId)
            .ToListAsync(ct);

        return await ToSummariesAsync(requests, ct);
    }

    public async Task<IReadOnlyList<RecruitmentSummary>> ListOwnAsync(
        Guid piUserId, bool isDeanOrOffice = false, CancellationToken ct = default)
    {
        List<RecruitmentRequest> requests;
        if (isDeanOrOffice)
        {
            requests = await db.RecruitmentRequests
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync(ct);
        }
        else
        {
            var ownProjectIds = await db.Projects
                .Where(p => p.OwnerUserId == piUserId && !p.IsDeleted)
                .Select(p => p.Id)
                .ToListAsync(ct);

            requests = await db.RecruitmentRequests
                .Where(r => ownProjectIds.Contains(r.ProjectId))
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync(ct);
        }

        return await ToSummariesAsync(requests, ct);
    }

    public async Task<IReadOnlyList<RecruitmentSummary>> ListOpenAsync(CancellationToken ct = default)
    {
        var requests = await db.RecruitmentRequests
            .Where(r => r.Stage == RecruitmentStage.Advertised)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        return await ToSummariesAsync(requests, ct, stripAdvertisementHtml: true);
    }

    /// <summary>
    /// Recruitments whose advertisement is currently sitting at the RnC
    /// office's stage of the approval chain -- the queue an RnC office
    /// reviewer needs to discover work without already knowing a recruitment
    /// id.
    /// </summary>
    /// <remarks>
    /// Mirrors <c>ResearchProposalService.ListForRnCOfficeAsync</c>'s full
    /// shape, self-defense included: <c>[PageAccess("recruitment.advertisement-rnc-queue")]</c>
    /// on the controller only checks that the caller holds SOME grant for
    /// this page key (<c>PageAccessService.CanAccessAsync</c> is a pure
    /// page-key membership check). It does not inspect scope or department --
    /// <c>AccessScope.Department</c> on the seeded page only changes what
    /// scope value <c>GetScopeAsync</c> reports back if asked, it never
    /// blocks access for a non-R&amp;C department holder. A Dean of, say,
    /// Mechanical Engineering legitimately holds this page grant (the RnC
    /// office stage's AllowedRoles is the whole Office group, not just R&amp;C
    /// staff) and would otherwise see every other department's
    /// advertisement-queue rows. <see cref="instituteWideScope"/> is the
    /// actual gate: only a caller whose own department is flagged
    /// <c>Department.IsInstituteWide</c> (R&amp;C membership, not role rank)
    /// gets the real queue; everyone else gets an empty one, the same "safe
    /// default, not an error" shape <c>ListForRnCOfficeAsync</c> uses.
    /// </remarks>
    public async Task<IReadOnlyList<RecruitmentSummary>> ListForRnCOfficeAdvertisementQueueAsync(
        Guid officeUserId, CancellationToken ct = default)
    {
        if (!await instituteWideScope.IsInstituteWideAsync(officeUserId, ct))
        {
            return [];
        }

        var candidates = await db.RecruitmentRequests
            .Where(r => r.AdvertisementWorkflowInstanceId != null
                     && r.Stage == RecruitmentStage.AdvertisementRequested)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        var atOfficeStage = new List<RecruitmentRequest>();
        foreach (var request in candidates)
        {
            var instance = await workflowEngine.GetAsync(request.AdvertisementWorkflowInstanceId!.Value, ct);
            if (instance is not null && instance.CurrentStage == WorkflowStage.WithRnCOfficeAdvertisement)
            {
                atOfficeStage.Add(request);
            }
        }

        return await ToSummariesAsync(atOfficeStage, ct);
    }

    /// <summary>
    /// Recruitments this Computer Centre user has already acted on (Published
    /// or otherwise) -- the queue's own counterpart, since
    /// <see cref="ListForComputerCentreQueueAsync"/> filters strictly on
    /// CurrentStage == WithComputerCentre, so a recruitment disappears from
    /// that list the instant this user publishes it, leaving no link back to
    /// the recruitment's own detail page/timeline. Scoped to WorkflowSteps
    /// this specific user recorded (not "every advertisement ever approved
    /// by anyone"), since a Computer Centre user asking "what did I publish"
    /// means their own actions specifically.
    /// </summary>
    public async Task<IReadOnlyList<RecruitmentSummary>> ListComputerCentreAdvertisementHistoryAsync(
        Guid actorUserId, CancellationToken ct = default)
    {
        var actedInstanceIds = await db.WorkflowSteps
            .Where(s => s.ActorUserId == actorUserId && s.Action == WorkflowAction.Approve)
            .Select(s => s.WorkflowInstanceId)
            .Distinct()
            .ToListAsync(ct);

        if (actedInstanceIds.Count == 0)
        {
            return [];
        }

        var requests = await db.RecruitmentRequests
            .Where(r => r.AdvertisementWorkflowInstanceId != null
                     && actedInstanceIds.Contains(r.AdvertisementWorkflowInstanceId.Value))
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        return await ToSummariesAsync(requests, ct);
    }

    /// <summary>
    /// Recruitments whose advertisement is currently sitting at the Computer
    /// Centre's stage of the approval chain.
    /// </summary>
    /// <remarks>
    /// No caller-scoped filtering: the Computer Centre role is institute-wide
    /// (there is no departmental Computer Centre), matching how
    /// <c>recruitment.advertisement-cc-queue</c> is seeded at
    /// <c>AccessScope.Institute</c> in <see cref="PageCatalogue"/>.
    /// </remarks>
    public async Task<IReadOnlyList<RecruitmentSummary>> ListForComputerCentreQueueAsync(
        CancellationToken ct = default)
    {
        var candidates = await db.RecruitmentRequests
            .Where(r => r.AdvertisementWorkflowInstanceId != null
                     && r.Stage == RecruitmentStage.AdvertisementRequested)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        var atCcStage = new List<RecruitmentRequest>();
        foreach (var request in candidates)
        {
            var instance = await workflowEngine.GetAsync(request.AdvertisementWorkflowInstanceId!.Value, ct);
            if (instance is not null && instance.CurrentStage == WorkflowStage.WithComputerCentre)
            {
                atCcStage.Add(request);
            }
        }

        return await ToSummariesAsync(atCcStage, ct);
    }

    /// <summary>
    /// The dashboard's "pending my action" panel for the advertisement chain.
    /// </summary>
    /// <remarks>
    /// Mirrors <see cref="ListForRnCOfficeAdvertisementQueueAsync"/>'s own
    /// gate rather than delegating to it: an Office-group role outside R&amp;C
    /// (<see cref="instituteWideScope"/> false) sees nothing here either,
    /// since the RnC-office advertisement stage's AllowedRoles is the whole
    /// Office group, not just R&amp;C staff. ComputerCentre is exempted from
    /// that gate, matching <see cref="ListForComputerCentreQueueAsync"/>'s
    /// own lack of a department check -- there is no departmental Computer
    /// Centre.
    /// </remarks>
    public async Task<IReadOnlyList<RecruitmentSummary>> ListPendingForCallerAsync(
        Guid userId, IReadOnlyCollection<string> roles, CancellationToken ct = default)
    {
        var pending = await pendingQuery.ListPendingInstancesAsync(
            RequestType.Advertisement, WorkflowPhase.Indent, roles, userId, ct);
        if (pending.Count == 0)
        {
            return [];
        }

        var isInstituteWide = await instituteWideScope.IsInstituteWideAsync(userId, ct);
        if (!isInstituteWide && !roles.Contains("ComputerCentre", StringComparer.OrdinalIgnoreCase))
        {
            // Mirrors ListForRnCOfficeAdvertisementQueueAsync's own gate
            // (line 1840): an Office-group role outside R&C sees nothing.
            // ComputerCentre is not department-scoped at all (matching
            // ListForComputerCentreQueueAsync's own lack of a department
            // check), so it is exempted from this particular gate.
            return [];
        }

        // pending.Keys.Contains(...), not pending.ContainsKey(...): the real
        // MySQL provider cannot translate IReadOnlyDictionary.ContainsKey to
        // SQL (only the InMemory test provider tolerates it), so this threw
        // InvalidOperationException on every call -- silently swallowed by
        // DashboardService's per-type catch.
        var pendingIds = pending.Keys;
        var candidates = await db.RecruitmentRequests
            .Where(r => r.AdvertisementWorkflowInstanceId != null
                     && pendingIds.Contains(r.AdvertisementWorkflowInstanceId.Value))
            .ToListAsync(ct);

        return await ToSummariesAsync(candidates, ct);
    }

    public async Task<RecruitmentSummary> GetAsync(
        Guid recruitmentRequestId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        var hasAccess = false;
        try
        {
            var project = await projectService.GetAsync(request.ProjectId, requestingUserId, requestingUserRoles, ct);
            hasAccess = (project != null);
        }
        catch (ProjectAccessDeniedException)
        {
            // Non-project users (e.g. candidate applicants) fall through to public/applicant access check
        }

        if (!hasAccess)
        {
            var isPublicOrApplicant = request.Stage >= RecruitmentStage.Advertised ||
                await db.Candidates.AnyAsync(c => c.RecruitmentRequestId == recruitmentRequestId && c.ApplicationUserId == requestingUserId, ct);

            if (!isPublicOrApplicant)
            {
                throw new ProjectAccessDeniedException(request.ProjectId);
            }
        }

        return (await ToSummariesAsync([request], ct)).Single();
    }

    public async Task<Guid?> GetOwnershipAsync(Guid recruitmentRequestId, CancellationToken ct = default)
    {
        var projectOwnerUserId = await db.RecruitmentRequests
            .Where(r => r.Id == recruitmentRequestId)
            .Join(db.Projects, r => r.ProjectId, p => p.Id, (r, p) => p.OwnerUserId)
            .FirstOrDefaultAsync(ct);

        return projectOwnerUserId == default ? null : projectOwnerUserId;
    }

    public async Task<IReadOnlyList<CandidateSummary>> ListCandidatesAsync(
        Guid recruitmentRequestId, Guid piUserId, CancellationToken ct = default)
    {
        await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        var candidates = await db.Candidates
            .Where(c => c.RecruitmentRequestId == recruitmentRequestId
                        && c.ApplicationStatus == ApplicationStatus.Submitted)
            .ToListAsync(ct);

        return candidates.Select(c => ToSummary(c, null, null)).ToList();
    }

    public async Task<IReadOnlyList<CandidateFullDetail>> ListCandidateDetailsAsync(
        Guid recruitmentRequestId, Guid requestingUserId, IReadOnlyCollection<string>? requestingUserRoles = null, CancellationToken ct = default)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        var project = await projectService.GetAsync(request.ProjectId, requestingUserId, requestingUserRoles, ct);
        if (project == null) throw new ProjectAccessDeniedException(request.ProjectId);

        var candidates = await db.Candidates
            .Include(c => c.Education)
            .Include(c => c.Experiences)
            .Where(c => c.RecruitmentRequestId == recruitmentRequestId
                        && c.ApplicationStatus == ApplicationStatus.Submitted)
            .ToListAsync(ct);

        return candidates.Select(c => new CandidateFullDetail(ToSummary(c, null, null), ToDraftDetail(c))).ToList();
    }

    public async Task<IReadOnlyList<CommitteeMemberSummary>> ListCommitteeAsync(
        Guid recruitmentRequestId, CommitteeKind kind, Guid piUserId, CancellationToken ct = default)
    {
        await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        var members = await db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == recruitmentRequestId && m.Kind == kind)
            .ToListAsync(ct);

        if (kind == CommitteeKind.Selection && members.Any(m => m.IsSelectedByDean))
        {
            members = members.Where(m => m.IsSelectedByDean || m.Role is not (CommitteeRole.InternalNominee or CommitteeRole.ExternalNominee)).ToList();
        }

        return
        [
            .. members.Select(m => new CommitteeMemberSummary(
                m.Id, m.Kind, m.Role, m.Name, m.Department, m.Position,
                m.IsExternal, m.AvailabilityDate,
                m.ApplicationUserId, m.Email, m.IsOutsideInstitute, m.ConsentDocumentId, m.IsSelectedByDean))
        ];
    }

    // -------------------------------------------------------------- Documents

    private static Guid GenerateDeterministicGuid(Guid namespaceId, string name)
    {
        using var algorithm = System.Security.Cryptography.MD5.Create();
        var namespaceBytes = namespaceId.ToByteArray();
        var nameBytes = System.Text.Encoding.UTF8.GetBytes(name);
        var input = new byte[namespaceBytes.Length + nameBytes.Length];
        Buffer.BlockCopy(namespaceBytes, 0, input, 0, namespaceBytes.Length);
        Buffer.BlockCopy(nameBytes, 0, input, namespaceBytes.Length, nameBytes.Length);
        var hash = algorithm.ComputeHash(input);
        return new Guid(hash);
    }

    private static DocumentKind MapToDocumentKind(RecruitmentDocumentKind kind) => kind switch
    {
        RecruitmentDocumentKind.Advertisement => DocumentKind.Advertisement,
        RecruitmentDocumentKind.ScreeningProforma => DocumentKind.Proforma,
        RecruitmentDocumentKind.SelectionProforma => DocumentKind.Proforma,
        RecruitmentDocumentKind.MinutesOfSelection => DocumentKind.MinutesOfSelection,
        RecruitmentDocumentKind.MeritList => DocumentKind.MeritList,
        RecruitmentDocumentKind.OfferLetter => DocumentKind.OfferLetter,
        RecruitmentDocumentKind.JoiningLetter => DocumentKind.JoiningLetter,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null)
    };

    public async Task<GeneratedDocument> GenerateDocumentAsync(
        Guid recruitmentRequestId, RecruitmentDocumentKind kind,
        Guid piUserId, string? coPiName = null, OfferLetterManualOverrides? overrides = null, CancellationToken ct = default)
    {
        var request = await LoadOwnedRequestAsync(recruitmentRequestId, piUserId, ct);

        var mappedKind = MapToDocumentKind(kind);
        var docId = GenerateDeterministicGuid(request.Id, kind.ToString());

        var existingDoc = await db.Documents.FirstOrDefaultAsync(d => d.Id == docId, ct);

        if (existingDoc != null && overrides == null && string.IsNullOrEmpty(coPiName))
        {
            try
            {
                using var stream = await storage.OpenReadAsync(existingDoc.StoragePath, ct);
                using var ms = new MemoryStream();
                await stream.CopyToAsync(ms, ct);
                return new GeneratedDocument(ms.ToArray(), FileName(kind, request.Id));
            }
            catch
            {
                // Non-fatal
            }
        }

        var project = await db.Projects.FirstAsync(p => p.Id == request.ProjectId, ct);
        var position = await db.SanctionedManpowerPositions
            .FirstAsync(p => p.Id == request.SanctionedManpowerPositionId, ct);
        var pi = await facultyProfiles.GetAsync(project.OwnerUserId, ct);

        // Screening/selection proformas and merit lists are official records --
        // a half-finished draft application must never be printed on one.
        var candidates = await db.Candidates
            .Where(c => c.RecruitmentRequestId == request.Id
                     && c.ApplicationStatus == ApplicationStatus.Submitted)
            .ToListAsync(ct);

        var committee = await db.CommitteeMembers
            .Where(m => m.RecruitmentRequestId == request.Id)
            .ToListAsync(ct);

        if (committee.Any(m => m.Kind == CommitteeKind.Selection && m.IsSelectedByDean))
        {
            committee = committee.Where(m => m.Kind != CommitteeKind.Selection || m.IsSelectedByDean || m.Role is not (CommitteeRole.InternalNominee or CommitteeRole.ExternalNominee)).ToList();
        }

        var advertisement = await db.Advertisements
            .Where(a => a.RecruitmentRequestId == request.Id && a.Round == request.AdvertisementRound)
            .FirstOrDefaultAsync(ct);

        var finalCoPi = coPiName;
        if (string.IsNullOrEmpty(finalCoPi))
        {
            var cacheFolder = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "generated_documents");
            var dataFilePath = Path.Combine(cacheFolder, $"{recruitmentRequestId}-{kind}.json");
            if (File.Exists(dataFilePath))
            {
                try
                {
                    var json = await File.ReadAllTextAsync(dataFilePath, ct);
                    using var docJson = System.Text.Json.JsonDocument.Parse(json);
                    if (docJson.RootElement.TryGetProperty("coPi", out var coPiProp))
                    {
                        finalCoPi = coPiProp.GetString();
                    }
                    else if (docJson.RootElement.TryGetProperty("coPiName", out var coPiNameProp))
                    {
                        finalCoPi = coPiNameProp.GetString();
                    }
                }
                catch { }
            }
        }

        // Only the advertisement is section-driven. Every other kind gets null
        // here, so ScreeningProforma/SelectionProforma/MinutesOfSelection/
        // MeritList/OfferLetter/JoiningLetter render exactly as before.
        var resolvedSections = kind == RecruitmentDocumentKind.Advertisement
            ? await LoadResolvedSectionsAsync(request.Id, request.AdvertisementRound, ct)
            : null;

        var model = RecruitmentDocumentModelFactory.Build(
            request, project, position, pi, advertisement, candidates, committee, finalCoPi,
            resolvedSections);

        byte[] pdfBytes;

        if (kind is RecruitmentDocumentKind.OfferLetter or RecruitmentDocumentKind.JoiningLetter)
        {
            // Manual overrides (candidate name/amount typed into the
            // download form) only correct display details on a real offer
            // -- they must never let this endpoint conjure one. A selected
            // candidate is required either way, which is what actually
            // proves IssueOfferLetterAsync's payment-received check (BRD
            // A2 spec D7) has already run.
            var selected = candidates.FirstOrDefault(c => c.Outcome == CandidateOutcome.Selected)
                ?? throw new NoCandidateSelectedException(
                    "No candidate has been selected for this recruitment yet, so an " +
                    "offer or joining letter cannot be produced.");

            var appointment = await db.ManpowerSelections
                .FirstOrDefaultAsync(s => s.CandidateId == selected.Id, ct);

            OfferLetterModel offerModel;

            if (kind == RecruitmentDocumentKind.OfferLetter && overrides != null)
            {
                offerModel = RecruitmentDocumentModelFactory.BuildOffer(
                    selected,
                    project,
                    position,
                    pi,
                    overrides.FellowshipAmount ?? appointment?.RecommendedStipend ?? position.Stipend,
                    overrides.JoiningDate ?? appointment?.JoinedOn ?? DateOnly.FromDateTime(DateTime.UtcNow),
                    (overrides.JoiningDate ?? appointment?.JoinedOn ?? DateOnly.FromDateTime(DateTime.UtcNow)).AddYears(1),
                    candidateNameOverride: overrides.CandidateName,
                    parentName: overrides.ParentName,
                    address: overrides.Address,
                    city: overrides.City,
                    state: overrides.State,
                    pincode: overrides.Pincode,
                    hraAmountOverride: overrides.HraAmount);
            }
            else
            {
                offerModel = RecruitmentDocumentModelFactory.BuildOffer(
                    selected, project, position, pi,
                    appointment?.RecommendedStipend ?? position.Stipend,
                    appointment?.JoinedOn ?? DateOnly.FromDateTime(DateTime.UtcNow),
                    appointment?.ValidTill ?? DateOnly.FromDateTime(DateTime.UtcNow).AddYears(1));
            }

            pdfBytes = kind == RecruitmentDocumentKind.OfferLetter
                ? await documents.GenerateOfferLetterAsync(offerModel, ct)
                : await documents.GenerateJoiningLetterAsync(offerModel, ct);
        }
        else
        {
            pdfBytes = kind switch
            {
                RecruitmentDocumentKind.Advertisement =>
                    await documents.GenerateAdvertisementAsync(model, ct),
                RecruitmentDocumentKind.ScreeningProforma =>
                    await documents.GenerateScreeningProformaAsync(model, ct),
                RecruitmentDocumentKind.SelectionProforma =>
                    await documents.GenerateSelectionProformaAsync(model, ct),
                RecruitmentDocumentKind.MinutesOfSelection =>
                    await documents.GenerateMinutesOfSelectionAsync(model, ct),
                RecruitmentDocumentKind.MeritList =>
                    await documents.GenerateMeritListAsync(model, ct),
                _ => throw new ArgumentOutOfRangeException(
                    nameof(kind), kind, "Unknown recruitment document."),
            };
        }

        using (var stream = new MemoryStream(pdfBytes))
        {
            var storagePath = await storage.SaveAsync(docId, 1, stream, FileName(kind, request.Id), ct);

            if (existingDoc == null)
            {
                var document = new Document
                {
                    Id = docId,
                    OwnerType = "RecruitmentRequest",
                    OwnerId = request.Id,
                    Kind = mappedKind,
                    Version = 1,
                    Status = DocumentStatus.Sealed,
                    StoragePath = storagePath,
                    UploadedByUserId = piUserId,
                    UploadedAt = DateTimeOffset.UtcNow
                };
                db.Documents.Add(document);
            }
            else
            {
                existingDoc.StoragePath = storagePath;
                existingDoc.Version += 1;
                existingDoc.Status = DocumentStatus.Sealed;
                existingDoc.UploadedAt = DateTimeOffset.UtcNow;
                db.Documents.Update(existingDoc);
            }
        }

        if (kind == RecruitmentDocumentKind.ScreeningProforma && request.Stage < RecruitmentStage.ScreeningInProgress)
        {
            request.Stage = RecruitmentStage.ScreeningInProgress;
        }
        else if (kind == RecruitmentDocumentKind.SelectionProforma && request.Stage < RecruitmentStage.SelectionScheduled)
        {
            request.Stage = RecruitmentStage.SelectionScheduled;
        }
        if (kind == RecruitmentDocumentKind.MinutesOfSelection && request.Stage < RecruitmentStage.MeritListPrepared)
        {
            request.Stage = RecruitmentStage.MeritListPrepared;
        }
        // Deliberately no case for OfferLetter here: OfferIssued is a
        // consequence of IssueOfferLetterAsync actually running (which
        // checks for a grant receipt with a transaction reference, BRD A2
        // spec D7), never of merely generating/downloading the PDF. A
        // regression once advanced the stage here too, letting a PI reach
        // OfferIssued -- and the "Offer letter generated" status
        // ProjectsController shows from it -- with no payment on record.

        await db.SaveChangesAsync(ct);

        return new GeneratedDocument(pdfBytes, FileName(kind, request.Id));
    }

    private static string FileName(RecruitmentDocumentKind kind, Guid requestId) =>
        $"{kind.ToString().ToLowerInvariant()}-{requestId}.pdf";

    // ---------------------------------------------------------------- Helpers

    /// <summary>
    /// BRD A2: PI as Chairman, the Co-PI. The Dean's nominated faculty member
    /// is a separate, independent action (NominateScreeningFacultyAsync) --
    /// not required here, so the PI can save their own two roles without
    /// already knowing (or waiting on) who the Dean will pick.
    /// </summary>
    private static void ValidateScreeningChairAndCoPi(IReadOnlyList<CommitteeMemberInput> members)
    {
        if (members.Count(m => m.Role == CommitteeRole.Chairman) != 1)
        {
            throw new InvalidCommitteeCompositionException(
                "A screening committee needs exactly one Chairman (the Principal Investigator).");
        }

        if (!members.Any(m => m.Role == CommitteeRole.CoPrincipalInvestigator))
        {
            throw new InvalidCommitteeCompositionException(
                "A screening committee must include the Co-Principal Investigator.");
        }
    }

    /// <summary>
    /// A member nominated from outside MNNIT entirely (client request,
    /// 2026-09-16) must have their consent on file before the committee can
    /// be saved with them on it -- there is no ApplicationUserId to fall back
    /// on for this person, so their own uploaded consent is the only record
    /// that they agreed to serve.
    /// </summary>
    private static void ValidateOutsideInstituteConsent(IReadOnlyList<CommitteeMemberInput> members)
    {
        var missingConsent = members.FirstOrDefault(m => m.IsOutsideInstitute && m.ConsentDocumentId is null);
        if (missingConsent is not null)
        {
            throw new InvalidCommitteeCompositionException(
                $"'{missingConsent.Name}' is nominated from outside the institute and needs their signed consent uploaded before the committee can be saved.");
        }
    }

    private static void ValidateAdvertisementDates(DateOnly publishedOn, DateOnly closingDate)
    {
        if (closingDate < publishedOn)
        {
            throw new ArgumentException(
                "The closing date cannot precede the publication date.", nameof(closingDate));
        }
    }

    private async Task CloseUnsuccessfulCandidatesAsync(
        Guid recruitmentRequestId, Guid selectedCandidateId, CancellationToken ct)
    {
        // A Draft was never in the running, so it is not "unsuccessful" -- marking
        // it NotSelected would reject an application nobody ever submitted.
        var others = await db.Candidates
            .Where(c => c.RecruitmentRequestId == recruitmentRequestId
                     && c.Id != selectedCandidateId
                     && c.ApplicationStatus == ApplicationStatus.Submitted
                     && c.Outcome == CandidateOutcome.Pending)
            .ToListAsync(ct);

        foreach (var other in others)
        {
            other.Outcome = CandidateOutcome.NotSelected;
        }

        await db.SaveChangesAsync(ct);

        foreach (var other in others)
        {
            await DeactivateIfNoLiveApplicationsAsync(other.ApplicationUserId, ct);
        }
    }

    /// <summary>
    /// Soft delete, but only when nothing else is in flight: an applicant
    /// rejected here may still be waiting on another project.
    /// </summary>
    private async Task DeactivateIfNoLiveApplicationsAsync(Guid applicationUserId, CancellationToken ct)
    {
        // "Live" means a real application still awaiting an outcome. An abandoned
        // Draft is not one -- counting it would keep a rejected applicant's
        // account active forever on the strength of a form they never finished.
        var hasLive = await db.Candidates.AnyAsync(
            c => c.ApplicationUserId == applicationUserId
              && c.ApplicationStatus == ApplicationStatus.Submitted
              && c.Outcome == CandidateOutcome.Pending,
            ct);

        if (!hasLive)
        {
            await applicantRoles.DeactivateAsync(applicationUserId, ct);
        }
    }

    // ------------------------------------------- advertisement templates

    /// <summary>
    /// The side-file an advertise/readvertise call leaves behind so
    /// <see cref="GenerateDocumentAsync"/> can print the same resolved sections
    /// later without re-resolving (a template may have been edited or deleted
    /// in between; the advertisement as issued must not change underneath it).
    /// </summary>
    /// <remarks>
    /// Deliberately the codebase's existing <c>uploads/generated_documents</c>
    /// JSON convention rather than a new table: this is regenerable
    /// presentation data, not the authoritative record. The authoritative record
    /// remains <see cref="Advertisement.Text"/>, which every existing path
    /// (candidate lists, history, CandidateCountAtClose) already reads.
    /// </remarks>
    private static string ResolvedSectionsPath(Guid recruitmentRequestId, int round) =>
        Path.Combine(
            Directory.GetCurrentDirectory(), "uploads", "generated_documents",
            $"{recruitmentRequestId}-AdvertisementSections-{round}.json");

    private sealed record StoredSection(int Key, string Content, bool IsIncluded);

    private async Task<IReadOnlyList<ResolvedAdvertisementSectionModel>?> ResolveTemplateSectionsAsync(
        Guid? templateId,
        IReadOnlyDictionary<string, string>? freeTextTokenValues,
        RecruitmentRequest request,
        Guid templateOwnerCheckUserId,
        DateOnly publishedOn,
        CancellationToken ct)
    {
        if (templateId is not { } id)
        {
            return null;
        }

        // Two distinct authorizations, deliberately keyed off two distinct ids.
        // LoadOwnedRequestAsync already proved the caller may act on this
        // RECRUITMENT -- but it did so against the possibly SUBSTITUTED piUserId
        // (the controller swaps in the project owner's id for a Dean/Office user
        // acting on a PI's behalf), which says nothing about who may read the
        // chosen TEMPLATE. So the id handed to ResolveAsync here is the real
        // authenticated caller's own, never the substituted one: otherwise the
        // substitution would make ResolveAsync's "OwnerUserId != piUserId" guard
        // match by construction and leak another PI's private template wording
        // into Advertisement.Text.
        var resolved = await advertisementTemplates.ResolveAsync(
            id, request.Id, templateOwnerCheckUserId, request.AdvertisementRound, publishedOn, ct);

        var freeText = freeTextTokenValues is { Count: > 0 }
            ? freeTextTokenValues
            : null;

        return
        [
            .. resolved.Sections
                .OrderBy(s => s.SortOrder)
                .Select(s => new ResolvedAdvertisementSectionModel(
                    s.Key,
                    freeText is null
                        ? s.Content
                        : AdvertisementTokenCatalogue.Substitute(s.Content, freeText),
                    s.IsIncluded))
        ];
    }

    /// <summary>
    /// The plain-text form stored in <see cref="Advertisement.Text"/> when a
    /// template was used, so every existing reader of that field keeps seeing
    /// the advertisement's actual wording.
    /// </summary>
    private static string SectionsAsPlainText(
        IReadOnlyList<ResolvedAdvertisementSectionModel> sections) =>
        string.Join(
            "\n\n",
            sections.Where(s => s.IsIncluded && !string.IsNullOrWhiteSpace(s.Content))
                .Select(s => $"{SectionPlainLabel(s.Key)}:\n{s.Content.Trim()}"));

    private static string SectionPlainLabel(AdvertisementSectionKey key) => key switch
    {
        AdvertisementSectionKey.EssentialQualifications => "Essential Qualifications",
        AdvertisementSectionKey.Salary => "Salary",
        AdvertisementSectionKey.OtherBenefits => "Other Benefits",
        AdvertisementSectionKey.AgeLimit => "Age Limit",
        AdvertisementSectionKey.TenureOfAppointment => "Tenure of Appointment",
        AdvertisementSectionKey.DesirableQualifications => "Desirable Qualifications (Not Mandatory)",
        AdvertisementSectionKey.HowToApply => "How to Apply",
        AdvertisementSectionKey.Notes => "Note",
        _ => key.ToString(),
    };

    private static async Task StoreResolvedSectionsAsync(
        Guid recruitmentRequestId, int round,
        IReadOnlyList<ResolvedAdvertisementSectionModel>? sections,
        CancellationToken ct)
    {
        var path = ResolvedSectionsPath(recruitmentRequestId, round);

        try
        {
            if (sections is null)
            {
                // A round re-advertised (or re-issued) without a template must
                // not keep printing an earlier round's sections.
                if (File.Exists(path))
                {
                    File.Delete(path);
                }

                return;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var payload = sections
                .Select(s => new StoredSection((int)s.Key, s.Content, s.IsIncluded))
                .ToList();
            await File.WriteAllTextAsync(
                path, System.Text.Json.JsonSerializer.Serialize(payload), ct);
        }
        catch
        {
            // Non-fatal, matching every other side-file write in this module:
            // the advertisement itself is already saved, and a missing cache
            // only falls the PDF back to Advertisement.Text.
        }
    }

    private static async Task<IReadOnlyList<ResolvedAdvertisementSectionModel>?>
        LoadResolvedSectionsAsync(Guid recruitmentRequestId, int round, CancellationToken ct)
    {
        var path = ResolvedSectionsPath(recruitmentRequestId, round);

        if (!File.Exists(path))
        {
            return null;
        }

        try
        {
            var json = await File.ReadAllTextAsync(path, ct);
            var stored = System.Text.Json.JsonSerializer.Deserialize<List<StoredSection>>(json);

            return stored is null or { Count: 0 }
                ? null
                :
                [
                    .. stored.Select(s => new ResolvedAdvertisementSectionModel(
                        (AdvertisementSectionKey)s.Key, s.Content ?? string.Empty, s.IsIncluded))
                ];
        }
        catch
        {
            return null;
        }
    }

    private async Task<Project> LoadOwnedProjectAsync(Guid projectId, Guid piUserId, CancellationToken ct)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, ct)
            ?? throw new ProjectAccessDeniedException(projectId);

        if (project.OwnerUserId != piUserId)
        {
            throw new ProjectAccessDeniedException(projectId);
        }

        return project;
    }

    private async Task<RecruitmentRequest> LoadOwnedRequestAsync(
        Guid recruitmentRequestId, Guid piUserId, CancellationToken ct)
    {
        var request = await db.RecruitmentRequests
            .FirstOrDefaultAsync(r => r.Id == recruitmentRequestId, ct)
            ?? throw new RecruitmentRequestNotFoundException(recruitmentRequestId);

        await LoadOwnedProjectAsync(request.ProjectId, piUserId, ct);
        return request;
    }

    /// <summary>
    /// Loads a candidate by id for a recruitment-lifecycle action taken by
    /// someone other than the owning PI (the HOD and Dean joining-report
    /// transitions), rejecting Draft rows. Ownership is not checked here because
    /// these actors are deliberately not the request's owner.
    /// </summary>
    private async Task<Candidate> LoadSubmittedCandidateAsync(
        Guid candidateId, CancellationToken ct)
    {
        var candidate = await db.Candidates.FirstOrDefaultAsync(c => c.Id == candidateId, ct)
            ?? throw new CandidateNotFoundException(candidateId);

        if (candidate.ApplicationStatus != ApplicationStatus.Submitted)
        {
            throw new CandidateApplicationNotSubmittedException(candidateId);
        }

        return candidate;
    }

    /// <summary>
    /// Loads a Candidate for the application wizard's own step-save, submit,
    /// and prefill actions -- deliberately separate from
    /// <see cref="LoadCandidateForPiAsync"/> and <see cref="LoadSubmittedCandidateAsync"/>,
    /// which both reject Draft rows by design for the PI-facing lifecycle.
    /// This loader does the opposite: it PERMITS Draft rows (that is the whole
    /// point of a wizard the applicant fills in over multiple visits) and
    /// checks applicant ownership (<c>ApplicationUserId == applicantUserId</c>)
    /// rather than PI ownership of the parent request, because the caller here
    /// is the applicant, not the PI. <paramref name="includeChildren"/> is set
    /// by the Step 2/3 saves, which need <c>Education</c>/<c>Experiences</c>
    /// loaded to replace them.
    /// </summary>
    private async Task<Candidate> LoadOwnDraftAsync(
        Guid candidateId, Guid applicantUserId, CancellationToken ct, bool includeChildren = false, bool allowSubmitted = false)
    {
        IQueryable<Candidate> query = db.Candidates;
        if (includeChildren)
        {
            query = query.Include(c => c.Education).Include(c => c.Experiences);
        }

        var candidate = await query.FirstOrDefaultAsync(c => c.Id == candidateId, ct)
            ?? throw new CandidateDraftNotFoundException(candidateId);

        if (candidate.ApplicationUserId != applicantUserId)
        {
            throw new CandidateDraftNotOwnedException(candidateId);
        }

        if (!allowSubmitted && candidate.ApplicationStatus != ApplicationStatus.Draft)
        {
            throw new CandidateAlreadySubmittedException(candidateId);
        }

        return candidate;
    }

    private async Task<Candidate> LoadCandidateForPiAsync(
        Guid candidateId, Guid piUserId, CancellationToken ct)
    {
        var candidate = await db.Candidates.FirstOrDefaultAsync(c => c.Id == candidateId, ct)
            ?? throw new CandidateNotFoundException(candidateId);

        // Every caller of this helper mutates recruitment-lifecycle state
        // (screening, interview mode, joining) on behalf of the PI, and the PI
        // can only have learned of this candidate through a list that already
        // excludes Drafts. A Draft id arriving here is therefore a stray or
        // forged call: fail loudly rather than silently screening an
        // application its own author has not finished writing.
        if (candidate.ApplicationStatus != ApplicationStatus.Submitted)
        {
            throw new CandidateApplicationNotSubmittedException(candidateId);
        }

        await LoadOwnedRequestAsync(candidate.RecruitmentRequestId, piUserId, ct);
        return candidate;
    }

    /// <param name="stripAdvertisementHtml">
    /// True only for the applicant-facing open-recruitments listing, whose
    /// preview card renders Text as plain text. Every other caller (the PI's
    /// own recruitment detail, the RnC/Computer Centre queues, GenerateAdvertisementModal's
    /// reopen-to-edit prefill) needs the original sanitized HTML intact --
    /// stripping it there would silently discard formatting the PI already
    /// submitted.
    /// </param>
    private async Task<IReadOnlyList<RecruitmentSummary>> ToSummariesAsync(
        IReadOnlyList<RecruitmentRequest> requests, CancellationToken ct,
        bool stripAdvertisementHtml = false)
    {
        if (requests.Count == 0)
        {
            return [];
        }

        var ids = requests.Select(r => r.Id).ToList();
        
        var projectIds = requests.Select(r => r.ProjectId).Distinct().ToList();
        var projects = await db.Projects
            .Where(p => projectIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.ProjectTitle, ct);

        var positionIds = requests.Select(r => r.SanctionedManpowerPositionId).Distinct().ToList();
        var positions = await db.SanctionedManpowerPositions
            .Where(p => positionIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var ads = await db.Advertisements
            .Where(a => ids.Contains(a.RecruitmentRequestId))
            .ToListAsync(ct);
            
        var latestAds = ads
            .GroupBy(a => a.RecruitmentRequestId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(a => a.Round).FirstOrDefault());

        // Must agree with ListCandidatesAsync: this count is the badge on the
        // recruitment card the PI clicks into, so counting Drafts here would
        // promise applicants the candidate table then refuses to show.
        var counts = await db.Candidates
            .Where(c => ids.Contains(c.RecruitmentRequestId)
                     && c.ApplicationStatus == ApplicationStatus.Submitted)
            .GroupBy(c => c.RecruitmentRequestId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        return
        [
            .. requests.Select(r => {
                projects.TryGetValue(r.ProjectId, out var projectTitle);
                positions.TryGetValue(r.SanctionedManpowerPositionId, out var pos);
                latestAds.TryGetValue(r.Id, out var latestAd);

                return new RecruitmentSummary(
                    r.Id, r.ProjectId, r.SanctionedManpowerPositionId, r.Stage,
                    r.AdvertisementRound, r.InterviewDate, r.InterviewTime, r.InterviewVenue,
                    counts.TryGetValue(r.Id, out var n) ? n : 0,
                    r.CreatedAt,
                    pos?.Designation,
                    projectTitle,
                    stripAdvertisementHtml ? StripHtmlForPreview(latestAd?.Text) : latestAd?.Text,
                    latestAd?.ClosingDate,
                    r.AdvertisementWorkflowInstanceId,
                    r.ScreeningCommitteeWorkflowInstanceId,
                    r.SelectionCommitteeWorkflowInstanceId,
                    r.DraftAdvertisementText,
                    r.DraftClosingDate,
                    r.OfferWorkflowInstanceId,
                    r.PendingOfferCandidateId,
                    r.RequiredQualifications,
                    r.AllowDiplomaFor12th,
                    r.RequireExperience,
                    r.MinExperienceMonths,
                    r.RequirePublications,
                    r.RequireResume,
                    r.DraftRequiredQualifications,
                    r.DraftAllowDiplomaFor12th,
                    r.DraftRequireExperience,
                    r.DraftMinExperienceMonths,
                    r.DraftRequirePublications,
                    r.DraftRequireResume,
                    pos?.Stipend,
                    pos?.Stipend);
            })
        ];
    }

    // Advertisement.Text is sanitized HTML (bold, lists, headings -- see the
    // rich text editor), but this summary is used for plain-text previews
    // (e.g. the applicant-facing open-recruitments listing card). The
    // sanitizer already guarantees only safe allow-listed tags are present,
    // so a simple tag-stripping regex is sufficient here -- no need for a
    // full HTML parser.
    private static readonly Regex HtmlTagPattern = new("<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex WhitespacePattern = new(@"\s+", RegexOptions.Compiled);

    private static string? StripHtmlForPreview(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return html;
        }

        var withoutTags = HtmlTagPattern.Replace(html, " ");
        var decoded = System.Net.WebUtility.HtmlDecode(withoutTags);
        return WhitespacePattern.Replace(decoded, " ").Trim();
    }

    private static CandidateSummary ToSummary(Candidate c, RecruitmentStage? stage = null, decimal? stipend = null) =>
        new(c.Id, c.RecruitmentRequestId, c.ApplicationUserId, c.FullName, c.Mobile,
            c.Qualification, c.Experience, c.ScreeningResult, c.ScreeningRemarks, c.InterviewMode,
            c.MeritRank, c.Outcome, c.OfferResponse, c.AppliedAt, c.ApplicationStatus, stage, stipend, stipend);

    private static CandidateDraftDetail ToDraftDetail(Candidate candidate) =>
        new CandidateDraftDetail(
            candidate.Id,
            candidate.RecruitmentRequestId,
            candidate.ApplicationStatus,
            candidate.FullName,
            candidate.Mobile,
            candidate.Gender,
            candidate.IsMarried,
            candidate.DateOfBirth,
            candidate.FatherOrHusbandName,
            candidate.PresentAddress,
            candidate.PermanentAddress,
            candidate.Email,
            candidate.Nationality,
            candidate.Category,
            candidate.CategoryCertificateDocumentId,
            candidate.GateNetGpatQualified,
            candidate.GateNetGpatRollNo,
            candidate.GateNetGpatYear,
            candidate.GateNetGpatScore,
            [.. candidate.Education.Select(e => new CandidateEducationDetail(
                e.Id, e.Level, e.OtherLevelName, e.Subject, e.BoardInstituteUniv, e.Year,
                e.MarksOrCgpa, e.Division, e.CertificateDocumentId))],
            [.. candidate.Experiences
                .OrderBy(x => x.SortOrder)
                .Select(x => new CandidateExperienceDetail(
                    x.Id, x.SortOrder, x.Organization, x.Position, x.SalaryEmoluments,
                    x.NatureOfDuties, x.NatureOfAppointment, x.PeriodYears, x.PeriodMonths,
                    x.PeriodDays, x.CertificateDocumentId))],
            candidate.SciJournalCount,
            candidate.ScopusJournalCount,
            candidate.NonSciJournalCount,
            candidate.InternationalConfCount,
            candidate.NationalConfCount,
            candidate.OtherInformation,
            candidate.WantsHigherDegreeRegistration,
            candidate.PhotoDocumentId,
            candidate.DeclarationAcceptedAt,
            candidate.IdProofType,
            candidate.IdProofNumber,
            candidate.IdProofDocumentId,
            candidate.GateNetGpatCertificateDocumentId,
            candidate.PublicationsDocumentId,
            candidate.ResumeDocumentId,
            candidate.Remarks,
            candidate.SignatureDocumentId,
            candidate.PublicationName);

    private async Task<string> ResolveMemberEmailAsync(string name, string department, bool isExternal, CancellationToken ct)
    {
        // Try locating in FacultyProfiles
        var profile = await db.FacultyProfiles
            .FirstOrDefaultAsync(p => p.Name == name, ct);
        if (profile?.Email is { } email && !string.IsNullOrWhiteSpace(email))
        {
            return email;
        }

        // Try locating in Users
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.FullName == name, ct);
        if (user?.Email is { } userEmail && !string.IsNullOrWhiteSpace(userEmail))
        {
            return userEmail;
        }

        // Fallback email generation
        var cleanName = name.Replace(" ", "").ToLower();
        return isExternal 
            ? $"{cleanName}@external-node.edu.in" 
            : $"{cleanName}@mnnit.ac.in";
    }
}
