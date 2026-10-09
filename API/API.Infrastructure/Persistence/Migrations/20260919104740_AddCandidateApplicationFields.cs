using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateApplicationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IdProofNumber",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PublicationName",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Remarks",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "ResumeDocumentId",
                table: "Candidates",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "OtherLevelName",
                table: "CandidateEducations",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IdProofNumber",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "PublicationName",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Remarks",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "ResumeDocumentId",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "OtherLevelName",
                table: "CandidateEducations");
        }
    }
}
