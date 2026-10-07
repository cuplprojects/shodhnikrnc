using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOverheadPercentAndIncludeInOverhead : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OverheadPercent",
                table: "ProposalBudgetLines");

            migrationBuilder.AddColumn<decimal>(
                name: "OverheadPercent",
                table: "ResearchProposals",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IncludeInOverhead",
                table: "ProposalBudgetLines",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OverheadPercent",
                table: "ResearchProposals");

            migrationBuilder.DropColumn(
                name: "IncludeInOverhead",
                table: "ProposalBudgetLines");

            migrationBuilder.AddColumn<decimal>(
                name: "OverheadPercent",
                table: "ProposalBudgetLines",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);
        }
    }
}
