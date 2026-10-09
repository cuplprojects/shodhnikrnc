using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using API.Application.Access;
using API.Controllers;
using API.Domain.Entities;
using API.Domain.Enums;
using API.Tests.Procurement;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace API.Tests.Fellowship;

public class IdCardRequestsControllerTests
{
    private static TestProcurementDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<TestProcurementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestProcurementDbContext(options);
    }

    private static Mock<UserManager<ApplicationUser>> CreateMockUserManager(ApplicationUser? defaultUser = null)
    {
        var store = new Mock<IUserStore<ApplicationUser>>();
        var mgr = new Mock<UserManager<ApplicationUser>>(store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
        mgr.Setup(m => m.FindByIdAsync(It.IsAny<string>()))
            .ReturnsAsync((string id) => defaultUser ?? new ApplicationUser { Id = Guid.Parse(id), FullName = "Test Scholar" });
        return mgr;
    }

    private static Mock<IInstituteWideScopeResolver> CreateMockInstituteWideResolver(bool isInstituteWide = false)
    {
        var mock = new Mock<IInstituteWideScopeResolver>();
        mock.Setup(m => m.IsInstituteWideAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(isInstituteWide);
        return mock;
    }

    private static IdCardRequestsController CreateController(
        TestProcurementDbContext db,
        Guid userId,
        string role,
        UserManager<ApplicationUser>? userManager = null,
        IInstituteWideScopeResolver? scopeResolver = null)
    {
        var um = userManager ?? CreateMockUserManager().Object;
        var scope = scopeResolver ?? CreateMockInstituteWideResolver().Object;

        var controller = new IdCardRequestsController(db, um, scope);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };

        return controller;
    }

    [Fact]
    public async Task Create_AsFellow_SetsStatusToPendingPiApproval()
    {
        var db = CreateDb();
        var studentUserId = Guid.NewGuid();
        var deptId = Guid.NewGuid();
        db.Departments.Add(new Department { Id = deptId, Name = "Computer Science & Engineering", Code = "CSED" });
        await db.SaveChangesAsync();

        var controller = CreateController(db, studentUserId, "Fellow");

        var dto = new CreateIdCardRequestDto(
            RollNumber: "2026RCS001",
            Designation: "JRF",
            ProjectId: Guid.NewGuid(),
            ProjectNumber: "MNNIT/CSED/2026/01",
            DepartmentId: deptId,
            Remarks: "First Issue",
            EmergencyPhone: "9876543210",
            MobilePhone: "9876543210"
        );

        var result = await controller.Create(dto, CancellationToken.None);

        var actionResult = result.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var createdId = (Guid)actionResult.Value!;

        var created = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == createdId);
        created.Should().NotBeNull();
        created!.StudentUserId.Should().Be(studentUserId);
        created.Status.Should().Be("Pending PI Approval");
        created.DepartmentName.Should().Be("Computer Science & Engineering");
    }

    [Fact]
    public async Task Stage1_PiApproval_ByFacultyUser_AdvancesToPendingHodApproval()
    {
        var db = CreateDb();
        var requestId = Guid.NewGuid();
        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = Guid.NewGuid(),
            StudentName = "John Doe",
            Status = "Pending PI Approval",
            DepartmentId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var facultyUserId = Guid.NewGuid();
        var controller = CreateController(db, facultyUserId, "Faculty");

        var actionDto = new IdCardActionDto("Approve", "PI Verified", null, null);
        var result = await controller.ProcessAction(requestId, actionDto, CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();

        var updated = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == requestId);
        updated!.Status.Should().Be("Pending HOD Approval");
        updated.UpdatedByUserId.Should().Be(facultyUserId);
    }

    [Fact]
    public async Task Stage1_PiApproval_ByNonFacultyUser_Returns403Forbidden()
    {
        var db = CreateDb();
        var requestId = Guid.NewGuid();
        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = Guid.NewGuid(),
            Status = "Pending PI Approval",
            DepartmentId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var fellowUserId = Guid.NewGuid();
        var controller = CreateController(db, fellowUserId, "Fellow"); // Fellow attempting PI stage

        var actionDto = new IdCardActionDto("Approve", "Unauthorized Attempt", null, null);
        var result = await controller.ProcessAction(requestId, actionDto, CancellationToken.None);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task Stage2_PiApproval_ByFacultyUser_AdvancesToPendingHodApproval()
    {
        var db = CreateDb();
        var requestId = Guid.NewGuid();
        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = Guid.NewGuid(),
            Status = "Pending PI Approval",
            DepartmentId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var piUserId = Guid.NewGuid();
        var controller = CreateController(db, piUserId, "Faculty");

        var actionDto = new IdCardActionDto("Approve", "PI Approved", null, null);
        var result = await controller.ProcessAction(requestId, actionDto, CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();

        var updated = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == requestId);
        updated!.Status.Should().Be("Pending HOD Approval");
    }

    [Fact]
    public async Task Stage2_PiApproval_ByNonFacultyUser_Returns403Forbidden()
    {
        var db = CreateDb();
        var requestId = Guid.NewGuid();
        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = Guid.NewGuid(),
            Status = "Pending PI Approval",
            DepartmentId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var hodUserId = Guid.NewGuid();
        var controller = CreateController(db, hodUserId, "HOD"); // HOD attempting PI stage prematurely

        var actionDto = new IdCardActionDto("Approve", "Premature Attempt", null, null);
        var result = await controller.ProcessAction(requestId, actionDto, CancellationToken.None);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task Stage3_HodApproval_ByHodUser_AdvancesToPendingDeanApproval()
    {
        var db = CreateDb();
        var requestId = Guid.NewGuid();
        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = Guid.NewGuid(),
            Status = "Pending HOD Approval",
            DepartmentId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var hodUserId = Guid.NewGuid();
        var controller = CreateController(db, hodUserId, "HOD");

        var actionDto = new IdCardActionDto("Approve", "HOD Endorsed", null, null);
        var result = await controller.ProcessAction(requestId, actionDto, CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();

        var updated = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == requestId);
        updated!.Status.Should().Be("Pending Dean Approval");
    }

    [Fact]
    public async Task Stage3_HodApproval_ByNonHodUser_Returns403Forbidden()
    {
        var db = CreateDb();
        var requestId = Guid.NewGuid();
        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = Guid.NewGuid(),
            Status = "Pending HOD Approval",
            DepartmentId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var libraryUserId = Guid.NewGuid();
        var controller = CreateController(db, libraryUserId, "Library"); // Library attempting HOD stage

        var actionDto = new IdCardActionDto("Approve", "Unauthorized Attempt", null, null);
        var result = await controller.ProcessAction(requestId, actionDto, CancellationToken.None);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task Stage4_DeanApproval_ByDeanUser_IssuesCard_AndUpdatesManpowerSelectionAppointment()
    {
        var db = CreateDb();
        var studentUserId = Guid.NewGuid();
        var requestId = Guid.NewGuid();

        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = studentUserId,
            StudentName = "Alice Fellow",
            Status = "Pending Dean Approval",
            DepartmentId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });

        // Add matching appointment in ManpowerSelections
        var appointmentId = Guid.NewGuid();
        db.ManpowerSelections.Add(new ManpowerSelection
        {
            Id = appointmentId,
            ApplicationUserId = studentUserId,
            SanctionedManpowerPositionId = Guid.NewGuid(),
            CandidateId = Guid.NewGuid(),
            Status = ManpowerSelectionStatus.Active,
            RecommendedStipend = 37000m,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var deanUserId = Guid.NewGuid();
        var controller = CreateController(db, deanUserId, "Dean");

        var customCardNumber = "MNNIT/JRF/2026/108";
        var actionDto = new IdCardActionDto("Approve", "Approved & Issued by Dean", customCardNumber, null);

        var result = await controller.ProcessAction(requestId, actionDto, CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();

        var updatedRequest = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == requestId);
        updatedRequest!.Status.Should().Be("Issued");
        updatedRequest.IdCardNumber.Should().Be(customCardNumber);
        updatedRequest.IssuedAt.Should().NotBeNull();

        // Check appointment link update (unlocking Fellowship claims & leaves)
        var updatedAppointment = await db.ManpowerSelections.FirstOrDefaultAsync(m => m.Id == appointmentId);
        updatedAppointment!.IdCardNumber.Should().Be(customCardNumber);
        updatedAppointment.IdCardIssuedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Stage4_DeanApproval_ByNonDeanUser_Returns403Forbidden()
    {
        var db = CreateDb();
        var requestId = Guid.NewGuid();
        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = Guid.NewGuid(),
            Status = "Pending Dean Approval",
            DepartmentId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var facultyUserId = Guid.NewGuid();
        var controller = CreateController(db, facultyUserId, "Faculty"); // Faculty attempting Dean stage

        var actionDto = new IdCardActionDto("Approve", "Unauthorized Dean Attempt", null, null);
        var result = await controller.ProcessAction(requestId, actionDto, CancellationToken.None);

        var objectResult = result.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task ProcessAction_RejectionAtPiStage_SetsStatusToRejectedWithReason()
    {
        var db = CreateDb();
        var requestId = Guid.NewGuid();
        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = Guid.NewGuid(),
            Status = "Pending PI Approval",
            DepartmentId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var facultyUserId = Guid.NewGuid();
        var controller = CreateController(db, facultyUserId, "Faculty");

        var actionDto = new IdCardActionDto("Reject", "Incomplete Dues Clearance", null, "Dues Unpaid");
        var result = await controller.ProcessAction(requestId, actionDto, CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();

        var updated = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == requestId);
        updated!.Status.Should().Be("Rejected");
        updated.RejectionReason.Should().Be("Dues Unpaid");
    }

    [Fact]
    public async Task ProcessAction_SuperAdmin_CanApproveAtAnyStage()
    {
        var db = CreateDb();
        var requestId = Guid.NewGuid();
        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = Guid.NewGuid(),
            Status = "Pending PI Approval",
            DepartmentId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var adminUserId = Guid.NewGuid();
        var controller = CreateController(db, adminUserId, "SuperAdmin");

        var actionDto = new IdCardActionDto("Approve", "SuperAdmin Override Approval", null, null);
        var result = await controller.ProcessAction(requestId, actionDto, CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();

        var updated = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == requestId);
        updated!.Status.Should().Be("Pending HOD Approval");
    }

    [Fact]
    public async Task GetAll_AsOfficeRole_ReturnsPendingAndHistoricalIssuedAndRejectedRequests()
    {
        var db = CreateDb();
        var student1 = Guid.NewGuid();
        var student2 = Guid.NewGuid();
        var student3 = Guid.NewGuid();

        db.IdCardRequests.AddRange(
            new IdCardRequest { Id = Guid.NewGuid(), StudentUserId = student1, Status = "Pending Library Approval", CreatedAt = DateTimeOffset.UtcNow },
            new IdCardRequest { Id = Guid.NewGuid(), StudentUserId = student2, Status = "Issued", IdCardNumber = "MNNIT/JRF/001", CreatedAt = DateTimeOffset.UtcNow },
            new IdCardRequest { Id = Guid.NewGuid(), StudentUserId = student3, Status = "Rejected", RejectionReason = "Invalid roll", CreatedAt = DateTimeOffset.UtcNow }
        );
        await db.SaveChangesAsync();

        var libraryUser = Guid.NewGuid();
        var controller = CreateController(db, libraryUser, "Library");

        var result = await controller.GetAll(CancellationToken.None);
        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var list = okResult.Value.Should().BeAssignableTo<IEnumerable<IdCardRequest>>().Subject.ToList();

        list.Should().HaveCount(3, "Office staff should see Pending Library Approval as well as historical Issued and Rejected cards");
    }

    [Fact]
    public async Task GetNextCode_ReturnsInitialSequence_AndIncrementsOnSubsequentCreations()
    {
        var db = CreateDb();
        var studentUserId = Guid.NewGuid();
        var deptId = Guid.NewGuid();
        db.Departments.Add(new Department { Id = deptId, Name = "Computer Science", Code = "CS" });
        await db.SaveChangesAsync();

        var controller = CreateController(db, studentUserId, "Fellow");
        var year = DateTime.UtcNow.Year;

        // 1. Initial next-code fetch
        var nextCodeResult = await controller.GetNextCode(CancellationToken.None);
        var okResult = nextCodeResult.Result.Should().BeOfType<OkObjectResult>().Subject;
        var initialCodeObj = okResult.Value;
        var initialNextCode = (string)initialCodeObj!.GetType().GetProperty("nextCode")!.GetValue(initialCodeObj)!;
        initialNextCode.Should().Be($"{year}PO001");

        // 2. Create first request using auto-generated code
        var dto1 = new CreateIdCardRequestDto(
            EmergencyPhone: "9876543210",
            MobilePhone: "9876543210",
            DepartmentId: deptId
        );
        var createResult1 = await controller.Create(dto1, CancellationToken.None);
        var actionResult1 = createResult1.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var req1Id = (Guid)actionResult1.Value!;

        var req1 = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == req1Id);
        req1.Should().NotBeNull();
        req1!.RollNumber.Should().Be($"{year}PO001");
        req1.IdentityCode.Should().Be($"{year}PO001");

        // 3. Verify next code increments to 002
        var nextCodeResult2 = await controller.GetNextCode(CancellationToken.None);
        var okResult2 = nextCodeResult2.Result.Should().BeOfType<OkObjectResult>().Subject;
        var codeObj2 = okResult2.Value;
        var nextCode2 = (string)codeObj2!.GetType().GetProperty("nextCode")!.GetValue(codeObj2)!;
        nextCode2.Should().Be($"{year}PO002");

        // 4. Create second request
        var dto2 = new CreateIdCardRequestDto(
            EmergencyPhone: "9876543210",
            MobilePhone: "9876543210",
            DepartmentId: deptId
        );
        var createResult2 = await controller.Create(dto2, CancellationToken.None);
        var actionResult2 = createResult2.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var req2Id = (Guid)actionResult2.Value!;

        var req2 = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == req2Id);
        req2.Should().NotBeNull();
        req2!.RollNumber.Should().Be($"{year}PO002");
        req2.IdentityCode.Should().Be($"{year}PO002");

        // 5. Verify next code increments to 003
        var nextCodeResult3 = await controller.GetNextCode(CancellationToken.None);
        var okResult3 = nextCodeResult3.Result.Should().BeOfType<OkObjectResult>().Subject;
        var codeObj3 = okResult3.Value;
        var nextCode3 = (string)codeObj3!.GetType().GetProperty("nextCode")!.GetValue(codeObj3)!;
        nextCode3.Should().Be($"{year}PO003");
    }

    [Fact]
    public async Task Update_WhenPendingPiApproval_ByOwner_UpdatesFieldsSuccessfully()
    {
        var db = CreateDb();
        var studentUserId = Guid.NewGuid();
        var requestId = Guid.NewGuid();
        var deptId = Guid.NewGuid();

        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = studentUserId,
            CreatedByUserId = studentUserId,
            Status = "Pending PI Approval",
            LocalAddress = "Old Address",
            EmergencyPhone = "9876543210",
            MobilePhone = "9876543210",
            DepartmentId = deptId,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, studentUserId, "Fellow");

        var updateDto = new UpdateIdCardRequestDto(
            LocalAddress: "New Prayagraj Address",
            EmergencyPhone: "9123456789",
            MobilePhone: "9876543210",
            DepartmentId: deptId
        );

        var result = await controller.Update(requestId, updateDto, CancellationToken.None);
        result.Should().BeOfType<OkObjectResult>();

        var updated = await db.IdCardRequests.FirstOrDefaultAsync(r => r.Id == requestId);
        updated!.LocalAddress.Should().Be("New Prayagraj Address");
        updated.EmergencyPhone.Should().Be("9123456789");
    }

    [Fact]
    public async Task Update_WhenAlreadyForwardedToHod_ReturnsBadRequest()
    {
        var db = CreateDb();
        var studentUserId = Guid.NewGuid();
        var requestId = Guid.NewGuid();

        db.IdCardRequests.Add(new IdCardRequest
        {
            Id = requestId,
            StudentUserId = studentUserId,
            CreatedByUserId = studentUserId,
            Status = "Pending HOD Approval", // Forwarded by PI already
            LocalAddress = "Old Address",
            EmergencyPhone = "9876543210",
            MobilePhone = "9876543210",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, studentUserId, "Fellow");

        var updateDto = new UpdateIdCardRequestDto(
            LocalAddress: "Attempted New Address",
            EmergencyPhone: "9876543210",
            MobilePhone: "9876543210"
        );

        var result = await controller.Update(requestId, updateDto, CancellationToken.None);
        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequest.Value.Should().NotBeNull();
    }
}
