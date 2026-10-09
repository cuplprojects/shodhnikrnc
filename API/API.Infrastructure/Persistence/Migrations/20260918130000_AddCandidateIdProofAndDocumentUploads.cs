using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateIdProofAndDocumentUploads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "IdProofType",
                table: "Candidates",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IdProofDocumentId",
                table: "Candidates",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "GateNetGpatCertificateDocumentId",
                table: "Candidates",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "PublicationsDocumentId",
                table: "Candidates",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "SignatureDocumentId",
                table: "Candidates",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IdProofType",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "IdProofDocumentId",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "GateNetGpatCertificateDocumentId",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "PublicationsDocumentId",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "SignatureDocumentId",
                table: "Candidates");
        }
    }
}
