using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCommitteeFormationWorkflowFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ScreeningCommitteeWorkflowInstanceId",
                table: "RecruitmentRequests",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "SelectionCommitteeWorkflowInstanceId",
                table: "RecruitmentRequests",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<bool>(
                name: "IsSelectedByDean",
                table: "CommitteeMembers",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ScreeningCommitteeWorkflowInstanceId",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "SelectionCommitteeWorkflowInstanceId",
                table: "RecruitmentRequests");

            migrationBuilder.DropColumn(
                name: "IsSelectedByDean",
                table: "CommitteeMembers");
        }
    }
}
