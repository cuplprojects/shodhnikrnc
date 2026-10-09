using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTravelRequestBudgetAllocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TravelRequestBudgetHeadAllocations",
                columns: table => new
                {
                    TravelRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BudgetHeadId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CommittedAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    OrderIndex = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelRequestBudgetHeadAllocations", x => new { x.TravelRequestId, x.BudgetHeadId });
                    table.ForeignKey(
                        name: "FK_TravelRequestBudgetHeadAllocations_TravelRequests_TravelRequ~",
                        column: x => x.TravelRequestId,
                        principalTable: "TravelRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_TravelRequestBudgetHeadAllocations_BudgetHeadId",
                table: "TravelRequestBudgetHeadAllocations",
                column: "BudgetHeadId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelRequestBudgetHeadAllocations_TravelRequestId",
                table: "TravelRequestBudgetHeadAllocations",
                column: "TravelRequestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TravelRequestBudgetHeadAllocations");
        }
    }
}
