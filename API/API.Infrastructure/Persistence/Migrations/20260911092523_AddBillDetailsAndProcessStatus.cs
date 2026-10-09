using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBillDetailsAndProcessStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OtherPrimaryModeDetails",
                table: "TravelRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "OtherTravelerDetails",
                table: "TravelRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PrimaryModes",
                table: "TravelRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TravelerTypes",
                table: "TravelRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "BillAmount",
                table: "EquipmentIndents",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BillFileUrl",
                table: "EquipmentIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BillProcessStatus",
                table: "EquipmentIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EWayBillFileUrl",
                table: "EquipmentIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "GenerationDate",
                table: "EquipmentIndents",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ItemReceivingDate",
                table: "EquipmentIndents",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SatisfactoryCertificateFileUrl",
                table: "EquipmentIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "BillAmount",
                table: "ContingencyIndents",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BillFileUrl",
                table: "ContingencyIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BillProcessStatus",
                table: "ContingencyIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EWayBillFileUrl",
                table: "ContingencyIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "GenerationDate",
                table: "ContingencyIndents",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ItemReceivingDate",
                table: "ContingencyIndents",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SatisfactoryCertificateFileUrl",
                table: "ContingencyIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "BillAmount",
                table: "ConsumableIndents",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BillFileUrl",
                table: "ConsumableIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BillProcessStatus",
                table: "ConsumableIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EWayBillFileUrl",
                table: "ConsumableIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "GenerationDate",
                table: "ConsumableIndents",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ItemReceivingDate",
                table: "ConsumableIndents",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SatisfactoryCertificateFileUrl",
                table: "ConsumableIndents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OtherPrimaryModeDetails",
                table: "TravelRequests");

            migrationBuilder.DropColumn(
                name: "OtherTravelerDetails",
                table: "TravelRequests");

            migrationBuilder.DropColumn(
                name: "PrimaryModes",
                table: "TravelRequests");

            migrationBuilder.DropColumn(
                name: "TravelerTypes",
                table: "TravelRequests");

            migrationBuilder.DropColumn(
                name: "BillAmount",
                table: "EquipmentIndents");

            migrationBuilder.DropColumn(
                name: "BillFileUrl",
                table: "EquipmentIndents");

            migrationBuilder.DropColumn(
                name: "BillProcessStatus",
                table: "EquipmentIndents");

            migrationBuilder.DropColumn(
                name: "EWayBillFileUrl",
                table: "EquipmentIndents");

            migrationBuilder.DropColumn(
                name: "GenerationDate",
                table: "EquipmentIndents");

            migrationBuilder.DropColumn(
                name: "ItemReceivingDate",
                table: "EquipmentIndents");

            migrationBuilder.DropColumn(
                name: "SatisfactoryCertificateFileUrl",
                table: "EquipmentIndents");

            migrationBuilder.DropColumn(
                name: "BillAmount",
                table: "ContingencyIndents");

            migrationBuilder.DropColumn(
                name: "BillFileUrl",
                table: "ContingencyIndents");

            migrationBuilder.DropColumn(
                name: "BillProcessStatus",
                table: "ContingencyIndents");

            migrationBuilder.DropColumn(
                name: "EWayBillFileUrl",
                table: "ContingencyIndents");

            migrationBuilder.DropColumn(
                name: "GenerationDate",
                table: "ContingencyIndents");

            migrationBuilder.DropColumn(
                name: "ItemReceivingDate",
                table: "ContingencyIndents");

            migrationBuilder.DropColumn(
                name: "SatisfactoryCertificateFileUrl",
                table: "ContingencyIndents");

            migrationBuilder.DropColumn(
                name: "BillAmount",
                table: "ConsumableIndents");

            migrationBuilder.DropColumn(
                name: "BillFileUrl",
                table: "ConsumableIndents");

            migrationBuilder.DropColumn(
                name: "BillProcessStatus",
                table: "ConsumableIndents");

            migrationBuilder.DropColumn(
                name: "EWayBillFileUrl",
                table: "ConsumableIndents");

            migrationBuilder.DropColumn(
                name: "GenerationDate",
                table: "ConsumableIndents");

            migrationBuilder.DropColumn(
                name: "ItemReceivingDate",
                table: "ConsumableIndents");

            migrationBuilder.DropColumn(
                name: "SatisfactoryCertificateFileUrl",
                table: "ConsumableIndents");
        }
    }
}
