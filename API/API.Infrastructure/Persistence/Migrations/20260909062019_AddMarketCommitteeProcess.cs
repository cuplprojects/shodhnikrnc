using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMarketCommitteeProcess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MarketCommitteeProcesses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    IndentType = table.Column<int>(type: "int", nullable: false),
                    IndentId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CommitteeFormedOn = table.Column<DateOnly>(type: "date", nullable: true),
                    NoticeIssuedOn = table.Column<DateOnly>(type: "date", nullable: true),
                    ComparativeStatementSignedOn = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MarketCommitteeProcesses", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_MarketCommitteeProcesses_IndentType_IndentId",
                table: "MarketCommitteeProcesses",
                columns: new[] { "IndentType", "IndentId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MarketCommitteeProcesses");
        }
    }
}
