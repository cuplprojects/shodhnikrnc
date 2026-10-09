using API.Application.Recruitment;

namespace API.Tests.Recruitment;

/// <summary>
/// Drives a freshly advertised recruitment through the approval chain, so tests
/// about everything AFTER the ad goes live (applications, screening, selection,
/// offers) can still reach RecruitmentStage.Advertised in one line.
/// </summary>
/// <remarks>
/// Before this plan, AdvertiseAsync flipped Stage to Advertised on its own. It
/// now raises a workflow instance instead, so the pre-existing fixtures'
/// AdvertisedRequestAsync helpers call this to complete the RnC office ->
/// Computer Centre chain rather than being rewritten to assert the new
/// mid-chain state -- the point of those tests is what happens once the ad is
/// live, not how it got there.
/// </remarks>
public static class AdvertisementApprovalHarness
{
    /// <summary>Roles the route grants at WithRnCOfficeAdvertisement.</summary>
    public static readonly string[] RnCOfficeRoles = ["Superintendent"];

    /// <summary>Roles the route grants at WithComputerCentre.</summary>
    public static readonly string[] ComputerCentreRoles = ["ComputerCentre"];

    /// <summary>
    /// RnC office approves (-> WithComputerCentre), then the Computer Centre
    /// approves (-> Approved, which is what makes the ad live).
    /// </summary>
    public static async Task ApproveThroughChainAsync(
        IRecruitmentService service, Guid recruitmentRequestId)
    {
        await service.ApproveAdvertisementAsync(
            recruitmentRequestId, Guid.NewGuid(), RnCOfficeRoles, "RnC office approved");
        await service.ApproveAdvertisementAsync(
            recruitmentRequestId, Guid.NewGuid(), ComputerCentreRoles, "Computer Centre approved");
    }
}
