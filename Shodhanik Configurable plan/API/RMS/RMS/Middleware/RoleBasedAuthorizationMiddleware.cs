using Microsoft.AspNetCore.Http;
using RMS.Data;
using System.Security.Claims;
using System.Threading.Tasks;

namespace RMS.Middleware
{
    public class RoleBasedAuthorizationMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RoleBasedAuthorizationMiddleware> _logger;

        public RoleBasedAuthorizationMiddleware(RequestDelegate next, ILogger<RoleBasedAuthorizationMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, RMSDbContext dbContext)
        {
            var path = context.Request.Path.Value;

            // Only apply to OfficeDashboard endpoints
            if (path != null && path.Contains("/api/OfficeDashboard", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    // Extract user ID from JWT token claims
                    var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier);
                    
                    if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                    {
                        _logger.LogWarning("User ID not found in JWT token");
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        await context.Response.WriteAsJsonAsync(new { message = "Unauthorized: User ID not found" });
                        return;
                    }

                    // Fetch admin and role from database
                    var admin = await dbContext.Admins.FindAsync(userId);
                    if (admin == null)
                    {
                        _logger.LogWarning($"Admin with ID {userId} not found");
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        await context.Response.WriteAsJsonAsync(new { message = "Unauthorized: Admin not found" });
                        return;
                    }

                    // Fetch role from database
                    var role = await dbContext.Roles.FindAsync(admin.RoleId);
                    if (role == null)
                    {
                        _logger.LogWarning($"Role with ID {admin.RoleId} not found");
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        await context.Response.WriteAsJsonAsync(new { message = "Forbidden: Role not found" });
                        return;
                    }

                    // Check if the endpoint is allowed for this role
                    if (!IsEndpointAllowedForRole(path, role.RoleName))
                    {
                        _logger.LogWarning($"Role '{role.RoleName}' is not authorized to access {path}");
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        await context.Response.WriteAsJsonAsync(new { message = $"Forbidden: Your role '{role.RoleName}' does not have access to this endpoint" });
                        return;
                    }

                    // Add role to context for use in controller
                    context.Items["UserRole"] = role.RoleName;
                    context.Items["RoleId"] = role.RoleID;

                    _logger.LogInformation($"User {userId} with role '{role.RoleName}' accessing {path}");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error in RoleBasedAuthorizationMiddleware: {ex.Message}");
                    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    await context.Response.WriteAsJsonAsync(new { message = "Internal server error" });
                    return;
                }
            }

            await _next(context);
        }

        private bool IsEndpointAllowedForRole(string path, string roleName)
        {
            return RoleEndpointConfig.CanAccessEndpoint(roleName, path);
        }
    }
}
