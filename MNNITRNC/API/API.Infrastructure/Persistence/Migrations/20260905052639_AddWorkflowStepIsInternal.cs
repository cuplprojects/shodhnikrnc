using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowStepIsInternal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsInternal",
                table: "WorkflowSteps",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            // Backfill existing rows: EF's default column-add sets IsInternal = 0
            // (false) for every existing row, but the correct historical value is
            // false only for Reject (5) and Return (8); every other action is
            // internal (true). WorkflowAction has no HasConversion configured in
            // ApplicationDbContext, so it is stored as its ordinal int.
            migrationBuilder.Sql(
                "UPDATE `WorkflowSteps` SET `IsInternal` = 1 " +
                "WHERE `Action` NOT IN (5, 8);"); // 5 = Reject, 8 = Return
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsInternal",
                table: "WorkflowSteps");
        }
    }
}
