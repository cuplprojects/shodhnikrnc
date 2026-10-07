using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddApplicationUserExternalIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalSourceSystem",
                table: "Users",
                type: "varchar(32)",
                maxLength: 32,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ExternalUserId",
                table: "Users",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Users_ExternalSourceSystem_ExternalUserId",
                table: "Users",
                columns: new[] { "ExternalSourceSystem", "ExternalUserId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_ExternalSourceSystem_ExternalUserId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ExternalSourceSystem",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ExternalUserId",
                table: "Users");
        }
    }
}
