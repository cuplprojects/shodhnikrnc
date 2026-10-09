using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceProposalBudgetLineAmountWithYears : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Add the new OverheadPercent column with a temporary default of 0 so
            //    existing rows (real production budget data) get a valid, explicit value
            //    rather than having their old Amount silently reinterpreted as a percentage.
            migrationBuilder.AddColumn<decimal>(
                name: "OverheadPercent",
                table: "ProposalBudgetLines",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "ProposalBudgetLineYears",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProposalBudgetLineId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Year = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(65,30)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProposalBudgetLineYears", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProposalBudgetLineYears_ProposalBudgetLines_ProposalBudgetLi~",
                        column: x => x.ProposalBudgetLineId,
                        principalTable: "ProposalBudgetLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ProposalBudgetLineYears_ProposalBudgetLineId_Year",
                table: "ProposalBudgetLineYears",
                columns: new[] { "ProposalBudgetLineId", "Year" },
                unique: true);

            // 2. Data migration: carry every existing ProposalBudgetLines row's Amount
            //    forward as a Year = 1 ProposalBudgetLineYears row, before Amount is dropped.
            //    UUID() is used for the new Id (matches the char(36) PK type used elsewhere).
            migrationBuilder.Sql(@"
                INSERT INTO ProposalBudgetLineYears (Id, ProposalBudgetLineId, Year, Amount)
                SELECT UUID(), Id, 1, Amount
                FROM ProposalBudgetLines;
            ");

            // 3. OverheadPercent has no real historical value for pre-existing rows;
            //    make that explicit (redundant with the column default above, kept for clarity
            //    and so this statement is correct even if the default ever changes).
            migrationBuilder.Sql(@"
                UPDATE ProposalBudgetLines SET OverheadPercent = 0;
            ");

            // 4. Only now that the data has been copied forward is it safe to drop Amount.
            migrationBuilder.DropColumn(
                name: "Amount",
                table: "ProposalBudgetLines");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "ProposalBudgetLines",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            // Best-effort reversal: restore Amount from each line's Year = 1 row, if present.
            // This is not a perfect inverse for lines with multiple years' data added after
            // the Up migration ran, but it recovers the original values for the common case.
            migrationBuilder.Sql(@"
                UPDATE ProposalBudgetLines pbl
                JOIN ProposalBudgetLineYears y
                    ON y.ProposalBudgetLineId = pbl.Id AND y.Year = 1
                SET pbl.Amount = y.Amount;
            ");

            migrationBuilder.DropTable(
                name: "ProposalBudgetLineYears");

            migrationBuilder.DropColumn(
                name: "OverheadPercent",
                table: "ProposalBudgetLines");
        }
    }
}
