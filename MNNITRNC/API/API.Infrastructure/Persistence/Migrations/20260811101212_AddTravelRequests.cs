using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTravelRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TravelRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProjectId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BudgetHeadId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    WorkflowInstanceId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    TravelerType = table.Column<int>(type: "int", nullable: false),
                    ManpowerId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    CoPiName = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CoPiDesignation = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Place = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Purpose = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OnwardDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ReturnDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PrimaryMode = table.Column<int>(type: "int", nullable: false),
                    TaxiReimbursementOptedIn = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    AccommodationDetails = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AccommodationCost = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    OtherExpensesDetails = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OtherExpensesCost = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    JourneyTotalCost = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    ExpectedCost = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    OriginalBillReference = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    TaxiCost = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    ActualCost = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TravelRequests_SanctionedManpowerPositions_ManpowerId",
                        column: x => x.ManpowerId,
                        principalTable: "SanctionedManpowerPositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "TravelJourneyLegs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    TravelRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    JourneyFrom = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    JourneyTo = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    JourneyDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Mode = table.Column<int>(type: "int", nullable: false),
                    BookingPlatform = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    Remarks = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SequenceOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TravelJourneyLegs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TravelJourneyLegs_TravelRequests_TravelRequestId",
                        column: x => x.TravelRequestId,
                        principalTable: "TravelRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_TravelJourneyLegs_TravelRequestId",
                table: "TravelJourneyLegs",
                column: "TravelRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelRequests_BudgetHeadId",
                table: "TravelRequests",
                column: "BudgetHeadId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelRequests_ManpowerId",
                table: "TravelRequests",
                column: "ManpowerId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelRequests_ProjectId",
                table: "TravelRequests",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_TravelRequests_WorkflowInstanceId",
                table: "TravelRequests",
                column: "WorkflowInstanceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TravelJourneyLegs");

            migrationBuilder.DropTable(
                name: "TravelRequests");
        }
    }
}
