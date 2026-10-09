using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCommitteeMemberIdentityAndSigningFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ApplicationUserId",
                table: "CommitteeMembers",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "CommitteeMembers",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SigningToken",
                table: "CommitteeMembers",
                type: "varchar(255)",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SigningTokenExpiresAt",
                table: "CommitteeMembers",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CommitteeMembers_SigningToken",
                table: "CommitteeMembers",
                column: "SigningToken");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CommitteeMembers_SigningToken",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "ApplicationUserId",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "SigningToken",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "SigningTokenExpiresAt",
                table: "CommitteeMembers");
        }
    }
}
