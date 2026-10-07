using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIndentBudgetHeadAllocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IndentBudgetHeadAllocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    IndentId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BudgetHeadId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SubHead = table.Column<int>(type: "int", nullable: true),
                    CommittedAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    OrderIndex = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IndentBudgetHeadAllocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IndentBudgetHeadAllocations_BudgetHeads_BudgetHeadId",
                        column: x => x.BudgetHeadId,
                        principalTable: "BudgetHeads",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_IndentBudgetHeadAllocations_Indents_IndentId",
                        column: x => x.IndentId,
                        principalTable: "Indents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_IndentBudgetHeadAllocations_BudgetHeadId",
                table: "IndentBudgetHeadAllocations",
                column: "BudgetHeadId");

            migrationBuilder.CreateIndex(
                name: "IX_IndentBudgetHeadAllocations_IndentId",
                table: "IndentBudgetHeadAllocations",
                column: "IndentId");

            migrationBuilder.CreateIndex(
                name: "IX_IndentBudgetHeadAllocations_IndentId_BudgetHeadId_SubHead",
                table: "IndentBudgetHeadAllocations",
                columns: new[] { "IndentId", "BudgetHeadId", "SubHead" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IndentBudgetHeadAllocations");
        }
    }
}
