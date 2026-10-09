using API.Application.Access;
using Microsoft.AspNetCore.Authorization;

namespace API.Authorization;

/// <summary>
/// Requires that the caller holds a named page.
/// </summary>
/// <remarks>
/// Replaces <c>[Authorize(Roles = "Faculty")]</c>. A compile-time role list
/// cannot be reconfigured: a SuperAdmin granting Projects to another role would
/// be refused by the attribute before the policy ever ran, and the admin UI
/// would appear to do nothing.
/// </remarks>
public class PageAccessRequirement(string pageKey) : IAuthorizationRequirement
{
    public string PageKey { get; } = pageKey;
}

/// <summary>
/// The ASP.NET adapter over <see cref="PageAccessDecision"/>.
/// </summary>
/// <remarks>
/// Deliberately thin. The decision lives in the application layer, which
/// carries no ASP.NET reference, so it stays unit-testable without a web host;
/// this type only pulls the subject claim out of the principal.
/// </remarks>
public class PageAccessHandler(PageAccessDecision decision)
    : AuthorizationHandler<PageAccessRequirement>
{
    /// <summary>
    /// The JWT subject. Read by raw name rather than through
    /// <c>ClaimTypes.NameIdentifier</c> because the API sets
    /// <c>MapInboundClaims = false</c>, so "sub" arrives unmapped.
    /// </summary>
    private const string SubjectClaim = "sub";

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PageAccessRequirement requirement)
    {
        var sub = context.User.FindFirst(SubjectClaim)?.Value;

        if (await decision.IsAllowedAsync(sub, requirement.PageKey))
        {
            context.Succeed(requirement);
        }
    }
}

/// <summary>
/// Gates an endpoint on a page permission, e.g. <c>[PageAccess("projects.list")]</c>.
/// </summary>
/// <remarks>
/// Policies are named "page:{key}" and registered on demand, so adding a page
/// needs no change to <c>Program.cs</c>.
/// </remarks>
public class PageAccessAttribute : AuthorizeAttribute
{
    public const string PolicyPrefix = "page:";

    public PageAccessAttribute(string pageKey) => Policy = PolicyPrefix + pageKey;
}

/// <summary>
/// Builds a policy for any "page:{key}" name the moment it is first asked for.
/// </summary>
/// <remarks>
/// Without this, every page would need registering in Program.cs by hand, and
/// a page added through the admin UI could never be gated at all.
/// </remarks>
public class PageAccessPolicyProvider(
    Microsoft.Extensions.Options.IOptions<AuthorizationOptions> options)
    : DefaultAuthorizationPolicyProvider(options)
{
    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (!policyName.StartsWith(PageAccessAttribute.PolicyPrefix, StringComparison.Ordinal))
        {
            return await base.GetPolicyAsync(policyName);
        }

        var pageKey = policyName[PageAccessAttribute.PolicyPrefix.Length..];

        return new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddRequirements(new PageAccessRequirement(pageKey))
            .Build();
    }
}
