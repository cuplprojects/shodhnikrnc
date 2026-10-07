using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProposalEquipmentAndManpower : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProposalEquipment",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ResearchProposalId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Unit = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Amount = table.Column<decimal>(type: "decimal(65,30)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProposalEquipment", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProposalEquipment_ResearchProposals_ResearchProposalId",
                        column: x => x.ResearchProposalId,
                        principalTable: "ResearchProposals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ProposalManpowerPositions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ResearchProposalId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Designation = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Positions = table.Column<int>(type: "int", nullable: false),
                    Stipend = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    Hra = table.Column<decimal>(type: "decimal(65,30)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProposalManpowerPositions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProposalManpowerPositions_ResearchProposals_ResearchProposal~",
                        column: x => x.ResearchProposalId,
                        principalTable: "ResearchProposals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ProposalEquipment_ResearchProposalId",
                table: "ProposalEquipment",
                column: "ResearchProposalId");

            migrationBuilder.CreateIndex(
                name: "IX_ProposalManpowerPositions_ResearchProposalId",
                table: "ProposalManpowerPositions",
                column: "ResearchProposalId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProposalEquipment");

            migrationBuilder.DropTable(
                name: "ProposalManpowerPositions");
        }
    }
}
