using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReappropriationWorkflowEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReappropriationRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProjectId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<int>(type: "int", nullable: false),
                    WorkflowInstanceId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    RequestedByUserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReappropriationRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReappropriationRequests_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ReappropriationDestinationLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ReappropriationRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BudgetHeadId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    HeadName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReappropriationDestinationLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReappropriationDestinationLines_ReappropriationRequests_Reap~",
                        column: x => x.ReappropriationRequestId,
                        principalTable: "ReappropriationRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ReappropriationSourceLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ReappropriationRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BudgetHeadId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    HeadName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReappropriationSourceLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReappropriationSourceLines_ReappropriationRequests_Reappropr~",
                        column: x => x.ReappropriationRequestId,
                        principalTable: "ReappropriationRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ReappropriationDestinationLines_BudgetHeadId",
                table: "ReappropriationDestinationLines",
                column: "BudgetHeadId");

            migrationBuilder.CreateIndex(
                name: "IX_ReappropriationDestinationLines_ReappropriationRequestId",
                table: "ReappropriationDestinationLines",
                column: "ReappropriationRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ReappropriationRequests_ProjectId",
                table: "ReappropriationRequests",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ReappropriationRequests_WorkflowInstanceId",
                table: "ReappropriationRequests",
                column: "WorkflowInstanceId");

            migrationBuilder.CreateIndex(
                name: "IX_ReappropriationSourceLines_BudgetHeadId",
                table: "ReappropriationSourceLines",
                column: "BudgetHeadId");

            migrationBuilder.CreateIndex(
                name: "IX_ReappropriationSourceLines_ReappropriationRequestId",
                table: "ReappropriationSourceLines",
                column: "ReappropriationRequestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReappropriationDestinationLines");

            migrationBuilder.DropTable(
                name: "ReappropriationSourceLines");

            migrationBuilder.DropTable(
                name: "ReappropriationRequests");
        }
    }
}
