using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGrantReceiptStatusAndWorkflowInstanceId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "GrantReceipts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "WorkflowInstanceId",
                table: "GrantReceipts",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            // Backfill existing rows to Approved (status value 1) to preserve
            // existing grant receipts' implicit approval state pre-feature.
            migrationBuilder.Sql("UPDATE `GrantReceipts` SET `Status` = 1;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "GrantReceipts");

            migrationBuilder.DropColumn(
                name: "WorkflowInstanceId",
                table: "GrantReceipts");
        }
    }
}
