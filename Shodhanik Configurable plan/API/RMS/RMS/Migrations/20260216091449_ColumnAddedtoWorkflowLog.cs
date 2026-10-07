using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RMS.Migrations
{
    /// <inheritdoc />
    public partial class ColumnAddedtoWorkflowLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FilePath",
                table: "WorkflowLogs",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "AttemptNumber",
                table: "SynopsisRDCs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DecisionFilePath",
                table: "SynopsisRDCs",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "FeeAmount",
                table: "SynopsisRDCs",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "FilePath",
                table: "SynopsisRDCs",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ProceedingFilePath",
                table: "SynopsisRDCs",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "RDCDate",
                table: "SynopsisRDCs",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RDCRemark",
                table: "SynopsisRDCs",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ReceiptNumber",
                table: "SynopsisRDCs",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmissionDate",
                table: "SynopsisRDCs",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "SynopsisRDCs",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_SynopsisRDCs_SID",
                table: "SynopsisRDCs",
                column: "SID");

            migrationBuilder.AddForeignKey(
                name: "FK_SynopsisRDCs_Scholars_SID",
                table: "SynopsisRDCs",
                column: "SID",
                principalTable: "Scholars",
                principalColumn: "SID",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SynopsisRDCs_Scholars_SID",
                table: "SynopsisRDCs");

            migrationBuilder.DropIndex(
                name: "IX_SynopsisRDCs_SID",
                table: "SynopsisRDCs");

            migrationBuilder.DropColumn(
                name: "FilePath",
                table: "WorkflowLogs");

            migrationBuilder.DropColumn(
                name: "AttemptNumber",
                table: "SynopsisRDCs");

            migrationBuilder.DropColumn(
                name: "DecisionFilePath",
                table: "SynopsisRDCs");

            migrationBuilder.DropColumn(
                name: "FeeAmount",
                table: "SynopsisRDCs");

            migrationBuilder.DropColumn(
                name: "FilePath",
                table: "SynopsisRDCs");

            migrationBuilder.DropColumn(
                name: "ProceedingFilePath",
                table: "SynopsisRDCs");

            migrationBuilder.DropColumn(
                name: "RDCDate",
                table: "SynopsisRDCs");

            migrationBuilder.DropColumn(
                name: "RDCRemark",
                table: "SynopsisRDCs");

            migrationBuilder.DropColumn(
                name: "ReceiptNumber",
                table: "SynopsisRDCs");

            migrationBuilder.DropColumn(
                name: "SubmissionDate",
                table: "SynopsisRDCs");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "SynopsisRDCs");
        }
    }
}
