namespace API.Application.Notifications;

/// <summary>
/// The fixed set of email templates this app sends, and for each, the exact
/// placeholder names its body/subject may use. This is the single source of
/// truth both the admin editor's "insert variable" list and
/// ApprovalNotificationService's save-time/send-time validation read from --
/// they can never drift apart because there is only one list.
/// </summary>
public static class EmailTemplateCatalogue
{
    public record TemplateSeed(
        string Key, string Name, string[] Placeholders, string DefaultSubject, string DefaultHtmlBody);

    public static readonly TemplateSeed[] Templates =
    [
        new("proposal.approved", "Proposal Approved",
            ["RequesterName", "ProposalTitle", "PortalLink"],
            "Your proposal \"{{ProposalTitle}}\" has been approved",
            "<p>Dear {{RequesterName}},</p><p>Your research proposal <strong>{{ProposalTitle}}</strong> has been approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("proposal.rejected", "Proposal Rejected",
            ["RequesterName", "ProposalTitle", "PortalLink"],
            "Your proposal \"{{ProposalTitle}}\" was not approved",
            "<p>Dear {{RequesterName}},</p><p>Your research proposal <strong>{{ProposalTitle}}</strong> was not approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("indent.approved", "Indent Approved",
            ["RequesterName", "IndentNumber", "PortalLink"],
            "Your indent {{IndentNumber}} has been approved",
            "<p>Dear {{RequesterName}},</p><p>Your indent <strong>{{IndentNumber}}</strong> has been approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("indent.rejected", "Indent Rejected",
            ["RequesterName", "IndentNumber", "PortalLink"],
            "Your indent {{IndentNumber}} was not approved",
            "<p>Dear {{RequesterName}},</p><p>Your indent <strong>{{IndentNumber}}</strong> was not approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("travel.approved", "Travel Request Approved",
            ["RequesterName", "Purpose", "PortalLink"],
            "Your travel request has been approved",
            "<p>Dear {{RequesterName}},</p><p>Your travel request (<strong>{{Purpose}}</strong>) has been approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("travel.rejected", "Travel Request Rejected",
            ["RequesterName", "Purpose", "PortalLink"],
            "Your travel request was not approved",
            "<p>Dear {{RequesterName}},</p><p>Your travel request (<strong>{{Purpose}}</strong>) was not approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("fellowship-claim.approved", "Fellowship Claim Approved",
            ["RequesterName", "ClaimPeriod", "PortalLink"],
            "Your fellowship claim for {{ClaimPeriod}} has been approved",
            "<p>Dear {{RequesterName}},</p><p>Your fellowship claim for <strong>{{ClaimPeriod}}</strong> has been approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("fellowship-claim.rejected", "Fellowship Claim Rejected",
            ["RequesterName", "ClaimPeriod", "PortalLink"],
            "Your fellowship claim for {{ClaimPeriod}} was not approved",
            "<p>Dear {{RequesterName}},</p><p>Your fellowship claim for <strong>{{ClaimPeriod}}</strong> was not approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("leave-request.approved", "Leave Request Approved",
            ["RequesterName", "LeaveType", "PortalLink"],
            "Your {{LeaveType}} leave request has been approved",
            "<p>Dear {{RequesterName}},</p><p>Your <strong>{{LeaveType}}</strong> leave request has been approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("leave-request.rejected", "Leave Request Rejected",
            ["RequesterName", "LeaveType", "PortalLink"],
            "Your {{LeaveType}} leave request was not approved",
            "<p>Dear {{RequesterName}},</p><p>Your <strong>{{LeaveType}}</strong> leave request was not approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("grant-receipt.approved", "Grant Receipt Approved",
            ["RequesterName", "ProjectTitle", "PortalLink"],
            "A grant receipt for \"{{ProjectTitle}}\" has been approved",
            "<p>Dear {{RequesterName}},</p><p>A grant receipt for your project <strong>{{ProjectTitle}}</strong> has been approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("grant-receipt.rejected", "Grant Receipt Rejected",
            ["RequesterName", "ProjectTitle", "PortalLink"],
            "A grant receipt for \"{{ProjectTitle}}\" was not approved",
            "<p>Dear {{RequesterName}},</p><p>A grant receipt for your project <strong>{{ProjectTitle}}</strong> was not approved.</p><p><a href=\"{{PortalLink}}\">View it in the portal</a></p>"),

        new("faculty-registration.approved", "Faculty Registration Approved",
            ["RegistrantName", "PortalLink"],
            "Your faculty registration has been approved",
            "<p>Dear {{RegistrantName}},</p><p>Your faculty registration has been approved. You now have full access to the portal.</p><p><a href=\"{{PortalLink}}\">Sign in</a></p>"),

        new("faculty-registration.rejected", "Faculty Registration Rejected",
            ["RegistrantName", "PortalLink"],
            "Your faculty registration was not approved",
            "<p>Dear {{RegistrantName}},</p><p>Your faculty registration was not approved. Contact the R&amp;C office for details.</p><p><a href=\"{{PortalLink}}\">View the portal</a></p>"),
    ];

    public static TemplateSeed? Find(string key) =>
        Templates.FirstOrDefault(t => t.Key == key);
}
