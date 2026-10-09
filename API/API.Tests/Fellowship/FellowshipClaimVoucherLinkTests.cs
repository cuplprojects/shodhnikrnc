using API.Domain.Entities;
using Xunit;

namespace API.Tests.Fellowship;

public class FellowshipClaimVoucherLinkTests
{
    [Fact]
    public void FellowshipClaim_HasNullablePaymentVoucherItemId()
    {
        var claim = new FellowshipClaim { Id = Guid.NewGuid() };
        Assert.Null(claim.PaymentVoucherItemId);

        claim.PaymentVoucherItemId = Guid.NewGuid();
        Assert.NotNull(claim.PaymentVoucherItemId);
    }

    [Fact]
    public void PaymentVoucherItem_HasNullableFellowshipClaimId()
    {
        var item = new PaymentVoucherItem { Id = Guid.NewGuid() };
        Assert.Null(item.FellowshipClaimId);

        item.FellowshipClaimId = Guid.NewGuid();
        Assert.NotNull(item.FellowshipClaimId);
    }

    [Fact]
    public void NotingItem_HasNullableFellowshipClaimId()
    {
        var item = new NotingItem { Id = Guid.NewGuid() };
        Assert.Null(item.FellowshipClaimId);

        item.FellowshipClaimId = Guid.NewGuid();
        Assert.NotNull(item.FellowshipClaimId);
    }
}
