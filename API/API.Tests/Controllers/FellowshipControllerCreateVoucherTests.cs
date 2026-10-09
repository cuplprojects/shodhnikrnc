using System.Security.Claims;
using API.Application.Fellowship;
using API.Controllers;
using API.Domain.Enums;
using API.Middleware;
using API.Tests.Fellowship;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Controllers;

/// <summary>
/// FellowshipController.CreateVoucher. Constructed directly over a real
/// FellowshipService and in-memory db, as in FellowshipControllerBulkActionTests.
/// The claim-state exceptions (not found / already vouchered / not approved)
/// are mapped by ProcurementExceptionMiddleware and are not exercised here;
/// the budget-validation InvalidOperationException is caught in the
/// controller and must come back as 400, not an unhandled 500.
/// </summary>
public class FellowshipControllerCreateVoucherTests
{
    private static void SetUser(FellowshipController controller, Guid? userId)
    {
        var claims = new List<Claim>();
        if (userId is { } id)
        {
            claims.Add(new Claim(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, id.ToString()));
            claims.Add(new Claim(ClaimTypes.Role, "RegularStaff"));
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth", ClaimTypes.Name, ClaimTypes.Role)),
            },
        };
    }

    private static FellowshipController.CreateVoucherRequestBody Body(params Guid[] claimIds) =>
        new(claimIds, "R&C Office", "SANC/001", "Bank Transfer", null);

    [Fact]
    public async Task CreateVoucher_InsufficientManpowerBalance_ReturnsBadRequestWithDetail()
    {
        var (service, db, claim, _) =
            FellowshipVoucherTestHelpers.CreateApprovedClaimWithInsufficientBudget(
                claimAmount: 50000m, manpowerHeadAvailable: 10000m);
        var controller = new FellowshipController(service, db);
        SetUser(controller, Guid.NewGuid());

        var result = await controller.CreateVoucher(Body(claim.Id), CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        var detail = badRequest.Value!.GetType().GetProperty("detail")!.GetValue(badRequest.Value) as string;
        detail.Should().Contain("available manpower budget balance");
        (await db.PaymentVouchers.CountAsync()).Should().Be(0);
    }

    /// <summary>
    /// Runs CreateVoucher inside the real ProcurementExceptionMiddleware, so
    /// the status asserted is what an HTTP caller would actually get: either
    /// the action's own result status or the middleware's mapping of an
    /// exception that escaped the action.
    /// </summary>
    private static async Task<int> StatusThroughMiddlewareAsync(
        FellowshipController controller, FellowshipController.CreateVoucherRequestBody body)
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = new ProcurementExceptionMiddleware(async _ =>
        {
            var result = await controller.CreateVoucher(body, CancellationToken.None);
            context.Response.StatusCode = result.Result switch
            {
                IStatusCodeActionResult { StatusCode: { } code } => code,
                _ => StatusCodes.Status200OK,
            };
        });
        await middleware.InvokeAsync(context);
        return context.Response.StatusCode;
    }

    [Fact]
    public async Task CreateVoucher_AlreadyVouchered_Returns409ViaMiddleware()
    {
        var (service, db, claim1, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);
        var controller = new FellowshipController(service, db);
        SetUser(controller, Guid.NewGuid());

        (await StatusThroughMiddlewareAsync(controller, Body(claim1.Id))).Should().Be(StatusCodes.Status200OK);
        // Resubmitting the same claim.
        (await StatusThroughMiddlewareAsync(controller, Body(claim1.Id))).Should().Be(StatusCodes.Status409Conflict);
        (await db.PaymentVouchers.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task CreateVoucher_ClaimNotApproved_PropagatesToMiddleware()
    {
        var (service, db, _, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);
        var pending = await FellowshipVoucherTestHelpers.AddClaimAtStage(db, WorkflowStage.WithDAFellowship);
        var controller = new FellowshipController(service, db);
        SetUser(controller, Guid.NewGuid());

        // The middleware maps it to 400 too, but it must be the middleware's
        // "Claim not approved" problem, not the controller's budget catch.
        await Assert.ThrowsAsync<ClaimNotApprovedForVoucherException>(() =>
            controller.CreateVoucher(Body(pending.Id), CancellationToken.None));
        (await StatusThroughMiddlewareAsync(controller, Body(pending.Id))).Should().Be(StatusCodes.Status400BadRequest);
    }

    [Fact]
    public async Task CreateVoucher_UnrelatedInvalidOperation_IsNotTurnedIntoBadRequest()
    {
        // A data-integrity fault (claim whose workflow instance is missing) is
        // a server-side problem, not a client validation error; it must not
        // be caught and reported as a 400 with its internal message.
        var (service, db, claim1, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);
        db.WorkflowInstances.Remove(await db.WorkflowInstances.FirstAsync(w => w.Id == claim1.WorkflowInstanceId));
        await db.SaveChangesAsync();
        var controller = new FellowshipController(service, db);
        SetUser(controller, Guid.NewGuid());

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            controller.CreateVoucher(Body(claim1.Id), CancellationToken.None));
    }

    [Fact]
    public async Task CreateVoucher_ValidClaims_ReturnsOkWithVoucherId()
    {
        var (service, db, claim1, _, claim2, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 2000m);
        var controller = new FellowshipController(service, db);
        SetUser(controller, Guid.NewGuid());

        var result = await controller.CreateVoucher(Body(claim1.Id, claim2.Id), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var voucherId = Assert.IsType<Guid>(ok.Value);
        (await db.PaymentVouchers.AnyAsync(v => v.Id == voucherId)).Should().BeTrue();
    }

    [Fact]
    public async Task CreateVoucher_EmptyClaimIds_ReturnsBadRequest()
    {
        var (service, db, _, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);
        var controller = new FellowshipController(service, db);
        SetUser(controller, Guid.NewGuid());

        var result = await controller.CreateVoucher(Body(), CancellationToken.None);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task CreateVoucher_NoAuthenticatedUser_ReturnsUnauthorized()
    {
        var (service, db, claim1, _, _, _) =
            FellowshipVoucherTestHelpers.CreateTwoApprovedClaimsOnDifferentProjects(1000m, 1000m);
        var controller = new FellowshipController(service, db);
        SetUser(controller, null);

        var result = await controller.CreateVoucher(Body(claim1.Id), CancellationToken.None);

        result.Result.Should().BeOfType<UnauthorizedResult>();
    }
}
