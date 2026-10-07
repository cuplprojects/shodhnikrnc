using API.Application.Projects;
using Microsoft.AspNetCore.Mvc;

namespace API.Middleware;

/// <summary>
/// Catches Project/Grant domain exceptions (not found, access denied, validation) and translates
/// them into appropriate HTTP status codes instead of unhandled 500s.
/// </summary>
public class ProjectExceptionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ProjectNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, "Project not found", ex.Message);
        }
        catch (ProjectAccessDeniedException ex)
        {
            await WriteProblem(context, StatusCodes.Status403Forbidden, "Access denied", ex.Message);
        }
        catch (OwnerHasNoDepartmentException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, "Owner has no department", ex.Message);
        }
        catch (ArgumentException ex)
        {
            await WriteProblem(context, StatusCodes.Status400BadRequest, "Validation error", ex.Message);
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
