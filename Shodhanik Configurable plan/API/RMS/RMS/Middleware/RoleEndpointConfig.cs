namespace RMS.Middleware
{
    /// <summary>
    /// Configuration for role-based endpoint access control
    /// Centralized place to manage which roles can access which endpoints
    /// </summary>
    public static class RoleEndpointConfig
    {
        public static Dictionary<string, List<string>> GetRoleEndpointMap()
        {
            return new Dictionary<string, List<string>>
            {
                // Admin role - full access to all OfficeDashboard endpoints
                { "Admin", new List<string>
                    {
                        "PHD Admission-Dashboard",
                        "list-of-admission-qualified-students",
                        "list-of-pending-document-verification",
                        "list-of-document-verified",
                        "list-of-document-rejected",
                        "list-of-admission-cancelled-students",
                        "list-of-Admitted-Students",
                        "list-of-Not-Applied-For-Counselling-Students",
                        "GetResearchEntranceTestApplication",
                        "GetRetCounts",
                        "list-of-RET-Application-Received-Students",
                        "list-of-RET-Unscreened-Students",
                        "list-of-RET-Eligible-Students",
                        "list-of-RET-NotEligible-Students",
                        "list-of-RET-Review-Students",
                        "GetRetExemptionCounts",
                        "list-of-RET-Exempted-Application-Received-Students",
                        "list-of-RET-Exempted-Unscreened-Students",
                        "list-of-RET-Exempted-Eligible-Students",
                        "list-of-RET-Exempted-NotEligible-Students",
                        "list-of-RET-Exampted-Review-Students",
                        "PhdForForeignExemptionCounts",
                        "list-of-RET-Foreign-Exempted-Application-Received-Students"
                    }
                },

                // Officer role - can view admission and RET data
                { "Officer", new List<string>
                    {
                        "PHD Admission-Dashboard",
                        "list-of-admission-qualified-students",
                        "list-of-pending-document-verification",
                        "list-of-document-verified",
                        "GetRetCounts",
                        "list-of-RET-Application-Received-Students",
                        "list-of-RET-Unscreened-Students"
                    }
                },

                // Coordinator role - limited view access
                { "Coordinator", new List<string>
                    {
                        "PHD Admission-Dashboard",
                        "GetRetCounts"
                    }
                },

                // Viewer role - read-only access to dashboard counts
                { "Viewer", new List<string>
                    {
                        "PHD Admission-Dashboard"
                    }
                }
            };
        }

        /// <summary>
        /// Check if a specific role can access an endpoint
        /// </summary>
        public static bool CanAccessEndpoint(string roleName, string endpoint)
        {
            var roleMap = GetRoleEndpointMap();
            
            if (!roleMap.ContainsKey(roleName))
                return false;

            return roleMap[roleName].Any(e => endpoint.Contains(e, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Get all accessible endpoints for a role
        /// </summary>
        public static List<string> GetAccessibleEndpoints(string roleName)
        {
            var roleMap = GetRoleEndpointMap();
            return roleMap.ContainsKey(roleName) ? roleMap[roleName] : new List<string>();
        }
    }
}
