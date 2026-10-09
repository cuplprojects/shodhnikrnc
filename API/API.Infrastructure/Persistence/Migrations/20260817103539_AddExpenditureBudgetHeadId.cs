using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenditureBudgetHeadId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BudgetHeadId",
                table: "Expenditure",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_Expenditure_BudgetHeadId",
                table: "Expenditure",
                column: "BudgetHeadId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Expenditure_BudgetHeadId",
                table: "Expenditure");

            migrationBuilder.DropColumn(
                name: "BudgetHeadId",
                table: "Expenditure");
        }
    }
}
