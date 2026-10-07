using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCoPiInstituteFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InstituteName",
                table: "ProposalCoPis",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "IsInsideInstitute",
                table: "ProposalCoPis",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Department",
                table: "Collaborators",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Designation",
                table: "Collaborators",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "IsInsideInstitute",
                table: "Collaborators",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InstituteName",
                table: "ProposalCoPis");

            migrationBuilder.DropColumn(
                name: "IsInsideInstitute",
                table: "ProposalCoPis");

            migrationBuilder.DropColumn(
                name: "Department",
                table: "Collaborators");

            migrationBuilder.DropColumn(
                name: "Designation",
                table: "Collaborators");

            migrationBuilder.DropColumn(
                name: "IsInsideInstitute",
                table: "Collaborators");
        }
    }
}
