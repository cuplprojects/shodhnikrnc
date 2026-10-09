using API.Application.Departments;
using API.Application.Documents;
using API.Application.Fellowship;
using API.Application.FundingAgencies;
using API.Application.Procurement;
using API.Application.Projects;
using API.Application.Proposals;
using API.Application.Recruitment;
using API.Application.Travel;
using API.Application.Workflow;
using API.Infrastructure.Notifications;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Middleware;

/// <summary>
/// Translates procurement domain exceptions into HTTP status codes instead of
/// unhandled 500s. Registered outside <see cref="ProjectExceptionMiddleware"/> so
/// these types are matched before its broad <c>ArgumentException</c> catch;
/// <c>ProjectAccessDeniedException</c> and plain <c>ArgumentException</c> are left
/// to that middleware rather than duplicated here.
/// </summary>
public class ProcurementExceptionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (IndentNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Indent not found", ex.Message);
        }
        catch (MarketCommitteeProcessIncompleteException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Market Committee process incomplete", ex.Message);
        }
        catch (ProposalNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Proposal not found", ex.Message);
        }
        catch (InvalidBudgetYearCountException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Invalid budget year count", ex.Message);
        }
        catch (PiHasNoDepartmentException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "No department", ex.Message);
        }
        catch (InvalidProposalStatusException ex)
        {
            // Matches InvalidRecruitmentStageException's precedent: the request
            // is well-formed, but the proposal is not in the status this action
            // requires.
            await WriteProblem(context, StatusCodes.Status409Conflict, "Invalid proposal status", ex.Message);
        }
        catch (NotTheProposalOwnerException ex)
        {
            await WriteProblem(context, StatusCodes.Status403Forbidden, "Not the proposal owner", ex.Message);
        }
        catch (CannotUndoException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Cannot undo", ex.Message);
        }
        catch (NotTheQueryRecipientException ex)
        {
            await WriteProblem(context, StatusCodes.Status403Forbidden, "Not the query recipient", ex.Message);
        }
        catch (QueryTargetNotAnActorException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Invalid query target", ex.Message);
        }
        catch (MandatoryDocumentMissingException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Mandatory document missing", ex.Message);
        }
        // A second request (a double-click, a retried call) raced this one on
        // the same proposal and saved first -- ResearchProposal.ConcurrencyVersion
        // caught the stale write rather than letting it silently overwrite the
        // winner's WorkflowInstanceId/Status. The caller already lost the race;
        // telling them to reload rather than blindly retrying the same stale
        // request is the correct recovery, matching InvalidProposalStatusException's
        // 409 for the same underlying reason (the resource moved out from under
        // the request).
        catch (DbUpdateConcurrencyException ex)
        {
            // Logged with entity/state detail rather than swallowed: this
            // exception fires for two very different reasons -- a genuine
            // race (the documented case above) and a change-tracker bug
            // where a legitimately new row gets tracked as Modified instead
            // of Added. The two are indistinguishable from the 409 response
            // alone, and the latter (unlike a real race) reproduces on every
            // request, not just concurrent ones -- worth knowing which one
            // hit without re-deriving it from scratch next time.
            var logger = context.RequestServices.GetRequiredService<ILogger<ProcurementExceptionMiddleware>>();
            var details = string.Join("; ", ex.Entries.Select(e => $"{e.Entity.GetType().Name}[{e.State}]"));
            logger.LogError(ex, "DbUpdateConcurrencyException on {Path}: {Details}", context.Request.Path, details);
            await WriteProblem(
                context, StatusCodes.Status409Conflict, "Changed by someone else",
                $"This proposal was updated by another request just now. Reload the page and try again. Details: {details}");
        }
        catch (InsufficientBudgetException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Insufficient budget", ex.Message);
        }
        catch (GrantReceiptExceedsSanctionException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Exceeds sanctioned budget", ex.Message);
        }
        catch (GrantReceiptBudgetHeadNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Budget head not found", ex.Message);
        }
        catch (GrantReceivedBeforeSubmissionException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Received before submission", ex.Message);
        }
        catch (GrantReceiptNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Grant receipt not found", ex.Message);
        }
        catch (GrantReceiptWorkflowNotStartedException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Grant receipt approval not in progress", ex.Message);
        }
        catch (ReappropriationExceedsReceivedException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Exceeds received amount", ex.Message);
        }
        catch (ReappropriationExceedsSanctionException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Exceeds sanctioned budget", ex.Message);
        }
        catch (FundingAgencyNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Funding agency not found", ex.Message);
        }
        catch (FundingAgencyNameAlreadyExistsException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Funding agency already exists", ex.Message);
        }
        catch (DepartmentNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Department not found", ex.Message);
        }
        catch (DepartmentCodeAlreadyExistsException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Department code already exists", ex.Message);
        }
        catch (DocumentNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Document not found", ex.Message);
        }
        catch (NotAuthorizedToDeleteDocumentException ex)
        {
            await WriteProblem(context, StatusCodes.Status403Forbidden, "Not authorized", ex.Message);
        }
        catch (BiddingTierNotSupportedException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Bidding tier not supported", ex.Message);
        }
        catch (TravelRequestNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Travel request not found", ex.Message);
        }
        catch (TaxiNotOptedInException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "Taxi reimbursement not opted in", ex.Message);
        }
        catch (RecruitmentRequestNotFoundException)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Recruitment not found",
                "This recruitment could not be found. It may have been removed or the link is incorrect.");
        }
        catch (AdvertisementTemplateNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Advertisement template not found", ex.Message);
        }
        catch (TemplateNotOwnedException ex)
        {
            await WriteProblem(context, StatusCodes.Status403Forbidden, "Template not owned", ex.Message);
        }
        catch (CannotEditSystemDefaultTemplateException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Cannot edit system default template", ex.Message);
        }
        catch (AdvertisementBodyTemplateNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Advertisement body template not found", ex.Message);
        }
        catch (AdvertisementBodyTemplateNotOwnedException ex)
        {
            await WriteProblem(context, StatusCodes.Status403Forbidden, "Advertisement body template not owned", ex.Message);
        }
        catch (CandidateNotFoundException)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Candidate not found",
                "The selected applicant could not be found. Please refresh the page and try again.");
        }
        catch (CandidateApplicationNotSubmittedException)
        {
            await WriteProblem(
                context, StatusCodes.Status409Conflict, "Application not submitted",
                "This applicant has not yet submitted their application and cannot be processed.");
        }
        catch (CandidateNotEligibleToJoinException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Candidate not eligible to join", ex.Message);
        }
        catch (NoCandidateSelectedException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "No candidate selected", ex.Message);
        }
        catch (EmailNotVerifiedException)
        {
            await WriteProblem(
                context, StatusCodes.Status403Forbidden, "Email not verified",
                "Please verify your email address before applying. Check your inbox for a verification link.");
        }
        catch (PrefillNotOwnedException)
        {
            // 403, not 404: the candidate exists, the caller simply may not read
            // it. A 404 here would let someone probe which ids are real.
            await WriteProblem(
                context, StatusCodes.Status403Forbidden, "Prefill source not permitted",
                "You can only prefill from your own previous applications.");
        }
        catch (DuplicateApplicationException)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Already applied",
                "You have already submitted an application for this position. Only one application per position is allowed.");
        }
        catch (CandidateDraftNotFoundException)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Application draft not found",
                "Your application draft could not be found. It may have expired. Please start a new application.");
        }
        catch (CandidateDraftNotOwnedException)
        {
            await WriteProblem(context, StatusCodes.Status403Forbidden, "Access denied",
                "You do not have access to this application draft.");
        }
        catch (CandidateApplicationNotOwnedException)
        {
            await WriteProblem(context, StatusCodes.Status403Forbidden, "Access denied",
                "You do not have access to this application.");
        }
        catch (CandidateAlreadySubmittedException)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Already submitted",
                "This application has already been submitted and can no longer be edited.");
        }
        catch (IncompleteApplicationException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Application incomplete", ex.Message);
        }
        catch (InvalidCommitteeCompositionException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "Invalid committee composition", ex.Message);
        }
        catch (OnlineInterviewNotApprovedException)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "Dean approval required",
                "An online interview requires prior approval from the Dean. Please request approval before setting the mode to Online.");
        }
        catch (MeritListDocumentsMissingException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "Merit list documents missing", ex.Message);
        }
        catch (PaymentNotReceivedException)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "Grant payment required",
                "The offer letter cannot be issued until a grant payment has been received and the bank transaction reference has been recorded for this project. Please add the grant receipt first.");
        }
        catch (InvalidRecruitmentStageException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status409Conflict, "Invalid recruitment stage", ex.Message);
        }
        catch (AdvertisementWorkflowNotStartedException)
        {
            await WriteProblem(
                context, StatusCodes.Status409Conflict,
                "Advertisement not submitted",
                "No advertisement approval is currently in progress for this recruitment. Please generate and submit an advertisement first.");
        }
        catch (IdCardNotIssuedException ex)
        {
            // 403, not 401: the fellow is authenticated, simply not yet
            // permitted to use these modules.
            await WriteProblem(
                context, StatusCodes.Status403Forbidden, "ID card not issued", ex.Message);
        }
        catch (FellowAppointmentNotFoundException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status403Forbidden, "Not a fellow", ex.Message);
        }
        catch (HraOverrideNotPermittedException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status403Forbidden, "HRA override not permitted", ex.Message);
        }
        catch (HraOverrideAfterApprovalException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status409Conflict, "Claim already approved", ex.Message);
        }
        catch (DuplicateClaimException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status409Conflict, "Claim already exists", ex.Message);
        }
        catch (HraSlipRequiredException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "HRA slip required", ex.Message);
        }
        catch (ClaimOutsideTenureException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "Claim outside tenure", ex.Message);
        }
        catch (FellowshipClaimNotFoundException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status404NotFound, "Fellowship claim not found", ex.Message);
        }
        catch (ClaimAlreadyVoucheredException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status409Conflict, "Claim already vouchered", ex.Message);
        }
        catch (ClaimNotApprovedForVoucherException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "Claim not approved", ex.Message);
        }
        catch (InsufficientLeaveBalanceException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "Insufficient leave balance", ex.Message);
        }
        catch (LeaveOutsideTenureException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "Leave outside tenure", ex.Message);
        }
        catch (SpecialLeavePurposeRequiredException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status400BadRequest, "Purpose required", ex.Message);
        }
        catch (LeaveRequestNotFoundException ex)
        {
            await WriteProblem(
                context, StatusCodes.Status404NotFound, "Leave request not found", ex.Message);
        }
        catch (EmailNotConfiguredException ex)
        {
            // 503, not 500: the request was valid and the server is simply not
            // provisioned to send mail yet. The detail names the settings to fill.
            await WriteProblem(
                context, StatusCodes.Status503ServiceUnavailable, "Email is not configured", ex.Message);
        }
    }

    private static async Task WriteProblem(HttpContext context, int statusCode, string title, string detail)
    {
        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(problemDetails);
    }
}
