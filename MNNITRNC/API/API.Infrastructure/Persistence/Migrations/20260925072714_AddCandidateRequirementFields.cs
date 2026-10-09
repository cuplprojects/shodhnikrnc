using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateRequirementFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowDiplomaFor12th",
                table: "RecruitmentRequests",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "DraftAllowDiplomaFor12th",
                table: "RecruitmentRequests",
                type: "tinyint(1)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DraftMinExperienceMonths",
                table: "RecruitmentRequests",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "DraftRequireExperience",
                table: "RecruitmentRequests",
                type: "tinyint(1)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "DraftRequirePublications",
                table: "RecruitmentRequests",
                type: "tinyint(1)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "DraftRequireResume",
                table: "RecruitmentRequests",
                type: "tinyint(1)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DraftRequiredQualifications",
                table: "RecruitmentRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "MinExperienceMonths",
                table: "RecruitmentRequests",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "RequireExperience",
                table: "RecruitmentRequests",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequirePublications",
                table: "RecruitmentRequests",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequireResume",
                table: "RecruitmentRequests",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "RequiredQualifications",
                table: "RecruitmentRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowDiplomaFor12th",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "DraftAllowDiplomaFor12th",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "DraftMinExperienceMonths",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "DraftRequireExperience",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "DraftRequirePublications",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "DraftRequireResume",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "DraftRequiredQualifications",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "MinExperienceMonths",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "RequireExperience",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "RequirePublications",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "RequireResume",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "RequiredQualifications",
                table: "RecruitmentRequests");
        }
    }
}
