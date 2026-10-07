using System;
using API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260922125000_AddTravelBillInformationFields")]
    public partial class AddTravelBillInformationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BillNo",
                table: "TravelRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "GenerationDate",
                table: "TravelRequests",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Kilometer",
                table: "TravelRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "StartTime",
                table: "TravelRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EndTime",
                table: "TravelRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BillFileUrl",
                table: "TravelRequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BillNo",
                table: "TravelRequests");

            migrationBuilder.DropColumn(
                name: "GenerationDate",
                table: "TravelRequests");

            migrationBuilder.DropColumn(
                name: "Kilometer",
                table: "TravelRequests");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "TravelRequests");

            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "TravelRequests");

            migrationBuilder.DropColumn(
                name: "BillFileUrl",
                table: "TravelRequests");
        }
    }
}
