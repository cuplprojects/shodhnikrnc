using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WidenBudgetHeadIndexesAndManpowerPerYear : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // CustomLabel must become varchar(255) BEFORE it's used in a key
            // (CreateIndex below) -- MySQL refuses "BLOB/TEXT column used in
            // key specification without a key length" while it's still
            // longtext. Hand-reordered after that exact failure was hit
            // applying this migration to the shared dev database.
            migrationBuilder.AlterColumn<string>(
                name: "CustomLabel",
                table: "ProposalBudgetLines",
                type: "varchar(255)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "longtext",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "CustomLabel",
                table: "BudgetHeads",
                type: "varchar(255)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "longtext",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            // Create the widened indexes BEFORE dropping the old narrow ones:
            // on the real MySQL dev DB, IX_ProposalBudgetLines_ResearchProposalId_HeadName
            // and IX_BudgetHeads_ProjectId_HeadName are each the sole index covering
            // the leading column of a foreign key (ResearchProposalId / ProjectId).
            // InnoDB refuses "DROP INDEX" on such an index until a replacement
            // index already exists to back the FK -- dropping first (EF's default
            // generation order) fails with "Cannot drop index ...: needed in a
            // foreign key constraint". Hand-reordered after that exact failure
            // was hit applying this migration to the shared dev database.
            migrationBuilder.CreateIndex(
                name: "IX_ProposalBudgetLines_ResearchProposalId_HeadName_CustomLabel",
                table: "ProposalBudgetLines",
                columns: new[] { "ResearchProposalId", "HeadName", "CustomLabel" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BudgetHeads_ProjectId_HeadName_CustomLabel",
                table: "BudgetHeads",
                columns: new[] { "ProjectId", "HeadName", "CustomLabel" },
                unique: true);

            migrationBuilder.DropIndex(
                name: "IX_ProposalBudgetLines_ResearchProposalId_HeadName",
                table: "ProposalBudgetLines");

            migrationBuilder.DropIndex(
                name: "IX_BudgetHeads_ProjectId_HeadName",
                table: "BudgetHeads");

            migrationBuilder.DropColumn(
                name: "Hra",
                table: "ProposalManpowerPositions");

            migrationBuilder.DropColumn(
                name: "Stipend",
                table: "ProposalManpowerPositions");

            migrationBuilder.AddColumn<decimal>(
                name: "HraPercent",
                table: "ProposalManpowerPositions",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "ProposalManpowerPositionYear",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProposalManpowerPositionId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Year = table.Column<int>(type: "int", nullable: false),
                    Stipend = table.Column<decimal>(type: "decimal(65,30)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProposalManpowerPositionYear", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProposalManpowerPositionYear_ProposalManpowerPositions_Propo~",
                        column: x => x.ProposalManpowerPositionId,
                        principalTable: "ProposalManpowerPositions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ProposalManpowerPositionYear_ProposalManpowerPositionId_Year",
                table: "ProposalManpowerPositionYear",
                columns: new[] { "ProposalManpowerPositionId", "Year" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProposalManpowerPositionYear");

            // Same FK-needs-a-covering-index ordering constraint as Up() --
            // create the narrow (original) indexes before dropping the wide
            // ones that currently back the FKs on ResearchProposalId/ProjectId.
            // The narrow indexes don't include CustomLabel, so no column-type
            // reordering is needed here the way Up() needs it.
            migrationBuilder.CreateIndex(
                name: "IX_ProposalBudgetLines_ResearchProposalId_HeadName",
                table: "ProposalBudgetLines",
                columns: new[] { "ResearchProposalId", "HeadName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BudgetHeads_ProjectId_HeadName",
                table: "BudgetHeads",
                columns: new[] { "ProjectId", "HeadName" },
                unique: true);

            migrationBuilder.DropIndex(
                name: "IX_ProposalBudgetLines_ResearchProposalId_HeadName_CustomLabel",
                table: "ProposalBudgetLines");

            migrationBuilder.DropIndex(
                name: "IX_BudgetHeads_ProjectId_HeadName_CustomLabel",
                table: "BudgetHeads");

            migrationBuilder.DropColumn(
                name: "HraPercent",
                table: "ProposalManpowerPositions");

            migrationBuilder.AddColumn<decimal>(
                name: "Hra",
                table: "ProposalManpowerPositions",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Stipend",
                table: "ProposalManpowerPositions",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<string>(
                name: "CustomLabel",
                table: "ProposalBudgetLines",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(255)",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "CustomLabel",
                table: "BudgetHeads",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(255)",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");
        }
    }
}
