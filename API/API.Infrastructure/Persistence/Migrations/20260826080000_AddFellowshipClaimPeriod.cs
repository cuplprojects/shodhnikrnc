using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFellowshipClaimPeriod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // FellowshipClaim.ClaimPeriod (API.Domain.Entities.FellowshipClaim)
            // shipped in the same merge as ConsumableIndentsController's phantom
            // columns, but on the missing side rather than the redundant side:
            // FellowshipService reads/writes it, yet no migration ever added it.
            // A server-side default backfills existing rows so this NOT NULL
            // column can be added without failing against data already present.
            migrationBuilder.AddColumn<string>(
                name: "ClaimPeriod",
                table: "FellowshipClaims",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "21st-20th")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ClaimPeriod",
                table: "FellowshipClaims");
        }
    }
}
