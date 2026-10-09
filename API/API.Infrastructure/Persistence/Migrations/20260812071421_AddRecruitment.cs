using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRecruitment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RecruitmentRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProjectId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SanctionedManpowerPositionId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    WorkflowInstanceId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    Stage = table.Column<int>(type: "int", nullable: false),
                    AdvertisementRound = table.Column<int>(type: "int", nullable: false),
                    InterviewDate = table.Column<DateOnly>(type: "date", nullable: true),
                    InterviewVenue = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecruitmentRequests", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Advertisements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    RecruitmentRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Round = table.Column<int>(type: "int", nullable: false),
                    PublishedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    ClosingDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Text = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CandidateCountAtClose = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Advertisements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Advertisements_RecruitmentRequests_RecruitmentRequestId",
                        column: x => x.RecruitmentRequestId,
                        principalTable: "RecruitmentRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Candidates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    RecruitmentRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ApplicationUserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    FullName = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Mobile = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Qualification = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Experience = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ScreeningResult = table.Column<int>(type: "int", nullable: true),
                    InterviewMode = table.Column<int>(type: "int", nullable: false),
                    OnlineModeApprovedByUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    MeritRank = table.Column<int>(type: "int", nullable: true),
                    Outcome = table.Column<int>(type: "int", nullable: false),
                    PrefilledFromCandidateId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    AppliedAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Candidates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Candidates_RecruitmentRequests_RecruitmentRequestId",
                        column: x => x.RecruitmentRequestId,
                        principalTable: "RecruitmentRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "CommitteeMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    RecruitmentRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Department = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Position = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsExternal = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    AvailabilityDate = table.Column<DateOnly>(type: "date", nullable: true),
                    SignedMeritListAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommitteeMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CommitteeMembers_RecruitmentRequests_RecruitmentRequestId",
                        column: x => x.RecruitmentRequestId,
                        principalTable: "RecruitmentRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "FellowAppointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CandidateId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ApplicationUserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SanctionedManpowerPositionId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AadharNo = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PanNo = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BankAccountNo = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IfscCode = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Dob = table.Column<DateOnly>(type: "date", nullable: true),
                    Gender = table.Column<int>(type: "int", nullable: true),
                    JoinedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    ValidTill = table.Column<DateOnly>(type: "date", nullable: false),
                    RecommendedStipend = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    IdCardNumber = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IdCardIssuedAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FellowAppointments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FellowAppointments_Candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "Candidates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Advertisements_RecruitmentRequestId_Round",
                table: "Advertisements",
                columns: new[] { "RecruitmentRequestId", "Round" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Candidates_ApplicationUserId",
                table: "Candidates",
                column: "ApplicationUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Candidates_RecruitmentRequestId_ApplicationUserId",
                table: "Candidates",
                columns: new[] { "RecruitmentRequestId", "ApplicationUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_CommitteeMembers_RecruitmentRequestId_Kind",
                table: "CommitteeMembers",
                columns: new[] { "RecruitmentRequestId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_FellowAppointments_ApplicationUserId",
                table: "FellowAppointments",
                column: "ApplicationUserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FellowAppointments_CandidateId",
                table: "FellowAppointments",
                column: "CandidateId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FellowAppointments_SanctionedManpowerPositionId",
                table: "FellowAppointments",
                column: "SanctionedManpowerPositionId");

            migrationBuilder.CreateIndex(
                name: "IX_RecruitmentRequests_ProjectId",
                table: "RecruitmentRequests",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_RecruitmentRequests_SanctionedManpowerPositionId",
                table: "RecruitmentRequests",
                column: "SanctionedManpowerPositionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Advertisements");

            migrationBuilder.DropTable(
                name: "CommitteeMembers");

            migrationBuilder.DropTable(
                name: "FellowAppointments");

            migrationBuilder.DropTable(
                name: "Candidates");

            migrationBuilder.DropTable(
                name: "RecruitmentRequests");
        }
    }
}
