using Microsoft.AspNetCore.Http;

namespace RMS.Middleware
{
    /// <summary>
    /// Extension methods for HttpContext to access role-based information
    /// </summary>
    public static class HttpContextExtensions
    {
        /// <summary>
        /// Get the current user's role from the context
        /// </summary>
        public static string GetUserRole(this HttpContext context)
        {
            return context.Items.TryGetValue("UserRole", out var role) ? role?.ToString() : null;
        }

        /// <summary>
        /// Get the current user's role ID from the context
        /// </summary>
        public static int? GetRoleId(this HttpContext context)
        {
            if (context.Items.TryGetValue("RoleId", out var roleId) && int.TryParse(roleId?.ToString(), out int id))
            {
                return id;
            }
            return null;
        }

        /// <summary>
        /// Check if the current user has a specific role
        /// </summary>
        public static bool HasRole(this HttpContext context, string roleName)
        {
            var userRole = context.GetUserRole();
            return userRole?.Equals(roleName, StringComparison.OrdinalIgnoreCase) ?? false;
        }
    }
}
