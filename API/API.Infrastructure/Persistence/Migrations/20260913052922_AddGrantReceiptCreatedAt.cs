using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGrantReceiptCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "GrantReceipts",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE GrantReceipts gr
                JOIN WorkflowInstances wi ON wi.Id = gr.WorkflowInstanceId
                SET gr.CreatedAt = wi.CreatedAt
                WHERE gr.WorkflowInstanceId IS NOT NULL;");

            migrationBuilder.Sql(@"
                UPDATE GrantReceipts
                SET CreatedAt = UTC_TIMESTAMP()
                WHERE CreatedAt IS NULL;");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "GrantReceipts",
                type: "datetime(6)",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "datetime(6)",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "GrantReceipts");
        }
    }
}
