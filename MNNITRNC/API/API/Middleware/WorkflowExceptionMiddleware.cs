using API.Application.Workflow;
using Microsoft.AspNetCore.Mvc;

namespace API.Middleware;

/// <summary>
/// Catches <see cref="WorkflowTransitionException"/> thrown by any controller/service in the
/// request pipeline (e.g. IWorkflowEngineService implementations) and translates it into a
/// 400 Bad Request response instead of an unhandled 500. Applies globally so future
/// workflow-driven controllers get this behavior automatically.
/// </summary>
public class WorkflowExceptionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (WorkflowTransitionException ex)
        {
            var problemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Workflow transition error",
                Detail = ex.Message,
            };

            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsJsonAsync(problemDetails);
        }
        // The action is legitimate at this stage, but this actor may not perform
        // it -- 403 rather than 400. Distinct from a transition error, which
        // means nobody could perform it from here.
        catch (WorkflowAuthorizationException ex)
        {
            var problemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "Not permitted at this stage",
                Detail = ex.Message,
            };

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsJsonAsync(problemDetails);
        }
        // A misconfigured route is an operator error, not a caller error: the
        // request was legitimate and the deployment cannot answer it. Reporting
        // it as 400 would tell the user to fix something that is not theirs to
        // fix, so it surfaces as 500 with the detail preserved.
        catch (WorkflowConfigurationException ex)
        {
            var problemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Workflow configuration error",
                Detail = ex.Message,
            };

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsJsonAsync(problemDetails);
        }
    }
}
