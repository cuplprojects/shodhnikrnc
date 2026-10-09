using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReturnedFromStageAndForwardOverrideByReturnOrigin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ForwardOverrideSequenceByReturnOrigin",
                table: "WorkflowStageDefinitions",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "ReturnedFromStage",
                table: "WorkflowInstances",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ForwardOverrideSequenceByReturnOrigin",
                table: "WorkflowStageDefinitions");

            migrationBuilder.DropColumn(
                name: "ReturnedFromStage",
                table: "WorkflowInstances");
        }
    }
}
