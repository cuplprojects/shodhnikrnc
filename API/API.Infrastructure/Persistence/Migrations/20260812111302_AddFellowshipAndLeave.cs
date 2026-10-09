using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFellowshipAndLeave : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FellowshipClaims",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    FellowAppointmentId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    WorkflowInstanceId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ClaimYear = table.Column<int>(type: "int", nullable: false),
                    ClaimMonth = table.Column<int>(type: "int", nullable: false),
                    FellowshipAmount = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    HraAmount = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    HraClaimed = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    HraOverrideAmount = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    HraOverrideReason = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    HraOverriddenByUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    HraOverriddenAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: true),
                    LeaveDaysTakenThisMonth = table.Column<int>(type: "int", nullable: false),
                    UnauthorisedAbsenceDays = table.Column<int>(type: "int", nullable: false),
                    Remarks = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    RecommendedAmount = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FellowshipClaims", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "LeaveEntitlements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    FellowAppointmentId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    LeaveType = table.Column<int>(type: "int", nullable: false),
                    ProjectYear = table.Column<int>(type: "int", nullable: false),
                    EntitledDays = table.Column<int>(type: "int", nullable: false),
                    ConsumedDays = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaveEntitlements", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "LeaveRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    FellowAppointmentId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    WorkflowInstanceId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    LeaveType = table.Column<int>(type: "int", nullable: false),
                    FromDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ToDate = table.Column<DateOnly>(type: "date", nullable: false),
                    DayCount = table.Column<int>(type: "int", nullable: false),
                    Purpose = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaveRequests", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_FellowshipClaims_FellowAppointmentId_ClaimYear_ClaimMonth",
                table: "FellowshipClaims",
                columns: new[] { "FellowAppointmentId", "ClaimYear", "ClaimMonth" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FellowshipClaims_WorkflowInstanceId",
                table: "FellowshipClaims",
                column: "WorkflowInstanceId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveEntitlements_FellowAppointmentId_LeaveType_ProjectYear",
                table: "LeaveEntitlements",
                columns: new[] { "FellowAppointmentId", "LeaveType", "ProjectYear" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_FellowAppointmentId",
                table: "LeaveRequests",
                column: "FellowAppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_WorkflowInstanceId",
                table: "LeaveRequests",
                column: "WorkflowInstanceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FellowshipClaims");

            migrationBuilder.DropTable(
                name: "LeaveEntitlements");

            migrationBuilder.DropTable(
                name: "LeaveRequests");
        }
    }
}
