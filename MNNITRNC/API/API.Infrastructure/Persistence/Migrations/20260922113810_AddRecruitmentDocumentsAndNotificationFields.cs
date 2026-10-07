using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRecruitmentDocumentsAndNotificationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CommitteeMembers_SigningToken",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "SignedMeritListAt",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "SigningToken",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "SigningTokenExpiresAt",
                table: "CommitteeMembers");

            migrationBuilder.AddColumn<TimeOnly>(
                name: "InterviewTime",
                table: "RecruitmentRequests",
                type: "time(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "NotEligibleEmailSentAt",
                table: "Candidates",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScreeningRemarks",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InterviewTime",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "NotEligibleEmailSentAt",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "ScreeningRemarks",
                table: "Candidates");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SignedMeritListAt",
                table: "CommitteeMembers",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SigningToken",
                table: "CommitteeMembers",
                type: "varchar(255)",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SigningTokenExpiresAt",
                table: "CommitteeMembers",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CommitteeMembers_SigningToken",
                table: "CommitteeMembers",
                column: "SigningToken");
        }
    }
}
