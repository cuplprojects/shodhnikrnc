using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProposalCoPis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The 22 idcardrequests.* AddColumn calls EF originally generated
            // here were removed: `dotnet ef migrations add` diffs the entire
            // model, not just ProposalCoPi, and IdCardRequest already carries
            // these columns on the shared database from an earlier
            // out-of-band change -- leaving them in would make
            // `dotnet ef database update` fail with "Duplicate column name"
            // on a fresh apply. The model-snapshot entry stays, since it
            // correctly reflects the real C# model; only this migration's own
            // Up/Down steps for those columns are removed. Same precedent as
            // commits 5eb56ab/797e76e (NotingFormateTextChanges).
            migrationBuilder.CreateTable(
                name: "ProposalCoPis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ResearchProposalId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Department = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Designation = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProposalCoPis", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProposalCoPis_ResearchProposals_ResearchProposalId",
                        column: x => x.ResearchProposalId,
                        principalTable: "ResearchProposals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ProposalCoPis_ResearchProposalId",
                table: "ProposalCoPis",
                column: "ResearchProposalId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProposalCoPis");
        }
    }
}
