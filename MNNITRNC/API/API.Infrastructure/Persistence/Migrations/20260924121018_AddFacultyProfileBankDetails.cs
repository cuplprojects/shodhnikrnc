using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFacultyProfileBankDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PrimaryBankAccountNo",
                table: "faculty_profiles",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PrimaryBankIfsc",
                table: "faculty_profiles",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PrimaryBankName",
                table: "faculty_profiles",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SecondaryBankAccountNo",
                table: "faculty_profiles",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SecondaryBankIfsc",
                table: "faculty_profiles",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SecondaryBankName",
                table: "faculty_profiles",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PrimaryBankAccountNo",
                table: "faculty_profiles");

            migrationBuilder.DropColumn(
                name: "PrimaryBankIfsc",
                table: "faculty_profiles");

            migrationBuilder.DropColumn(
                name: "PrimaryBankName",
                table: "faculty_profiles");

            migrationBuilder.DropColumn(
                name: "SecondaryBankAccountNo",
                table: "faculty_profiles");

            migrationBuilder.DropColumn(
                name: "SecondaryBankIfsc",
                table: "faculty_profiles");

            migrationBuilder.DropColumn(
                name: "SecondaryBankName",
                table: "faculty_profiles");
        }
    }
}
