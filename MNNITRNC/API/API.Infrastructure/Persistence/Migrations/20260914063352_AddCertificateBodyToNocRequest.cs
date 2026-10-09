using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCertificateBodyToNocRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // All columns (CertificateBody, BillAmount, BillFileUrl, etc.) 
            // already exist in the database schema from previous partial applications.
            // Leaving this empty so the migration can record successfully in __EFMigrationsHistory.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CertificateBody",
                table: "nocrequests");

            migrationBuilder.DropColumn(
                name: "BillAmount",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "BillFileUrl",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "BillNo",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "BillProcessStatus",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "EWayBillFileUrl",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "GenerationDate",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "ItemReceivingDate",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "SatisfactoryCertificateFileUrl",
                table: "Indents");
        }
    }
}
