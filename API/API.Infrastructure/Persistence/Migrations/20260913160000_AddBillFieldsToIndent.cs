using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBillFieldsToIndent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BillNo",
                table: "Indents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "BillAmount",
                table: "Indents",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "GenerationDate",
                table: "Indents",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ItemReceivingDate",
                table: "Indents",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BillProcessStatus",
                table: "Indents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BillFileUrl",
                table: "Indents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EWayBillFileUrl",
                table: "Indents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SatisfactoryCertificateFileUrl",
                table: "Indents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BillNo",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "BillAmount",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "GenerationDate",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "ItemReceivingDate",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "BillProcessStatus",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "BillFileUrl",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "EWayBillFileUrl",
                table: "Indents");

            migrationBuilder.DropColumn(
                name: "SatisfactoryCertificateFileUrl",
                table: "Indents");
        }
    }
}
