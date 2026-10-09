using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDynamicIndentTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Indents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    IndentNumber = table.Column<string>(type: "varchar(255)", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IndentType = table.Column<int>(type: "int", nullable: false),
                    ProjectId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    BudgetHeadId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    WorkflowInstanceId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    OwnerUserId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    GemAvailability = table.Column<int>(type: "int", nullable: false),
                    GemCategoryType = table.Column<int>(type: "int", nullable: true),
                    ProcurementRule = table.Column<int>(type: "int", nullable: false),
                    StockAvailability = table.Column<int>(type: "int", nullable: false),
                    StockBookSerialNo = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StockBookPage = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StockBookDate = table.Column<DateOnly>(type: "date", nullable: true),
                    StockDescription = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StockQuantity = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StockActualCost = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StockCondition = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Purpose = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PurposeOfAcquiring = table.Column<int>(type: "int", nullable: true),
                    InstallationRequired = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    TrainingRequired = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    QualificationCriterion = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MaxDeliveryPeriod = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    NumberOfEnclosures = table.Column<int>(type: "int", nullable: true),
                    NonAvailabilityCertificateNumber = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    NonAvailabilityCertificateIssueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    NonAvailabilityCertificateValidityDate = table.Column<DateOnly>(type: "date", nullable: true),
                    QuotationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CommitteeFacultyUserId = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BiddingNumber = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BidPublicationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    PaymentRouting = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PurchaseOrderNumber = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PurchaseOrderDate = table.Column<DateOnly>(type: "date", nullable: true),
                    BindingLocation = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ComparativeStatementNumber = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ComparativeStatementSigned = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    MiscellaneousExpenditure = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    OriginalBillReference = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StockEntryConfirmed = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    EWayBillNumber = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    EWayBillPartA = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    EWayBillPartB = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MeasurementBookNumber = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Indents", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "IndentItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    IndentId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SerialNumber = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsConsumable = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    TechnicalSpecs = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UnitOfMeasurement = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    EstimatedCostInclTax = table.Column<decimal>(type: "decimal(65,30)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IndentItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IndentItems_Indents_IndentId",
                        column: x => x.IndentId,
                        principalTable: "Indents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_IndentItems_IndentId",
                table: "IndentItems",
                column: "IndentId");

            migrationBuilder.CreateIndex(
                name: "IX_Indents_BudgetHeadId",
                table: "Indents",
                column: "BudgetHeadId");

            migrationBuilder.CreateIndex(
                name: "IX_Indents_IndentNumber",
                table: "Indents",
                column: "IndentNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Indents_OwnerUserId",
                table: "Indents",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Indents_ProjectId",
                table: "Indents",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Indents_WorkflowInstanceId",
                table: "Indents",
                column: "WorkflowInstanceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IndentItems");

            migrationBuilder.DropTable(
                name: "Indents");
        }
    }
}
