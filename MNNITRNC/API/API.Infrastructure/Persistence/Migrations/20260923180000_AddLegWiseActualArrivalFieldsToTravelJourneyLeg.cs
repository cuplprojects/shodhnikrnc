using System;
using API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260923180000_AddLegWiseActualArrivalFieldsToTravelJourneyLeg")]
    public partial class AddLegWiseActualArrivalFieldsToTravelJourneyLeg : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "ActualArrivalDate",
                table: "TravelJourneyLegs",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActualArrivalTime",
                table: "TravelJourneyLegs",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ActualArrivalKm",
                table: "TravelJourneyLegs",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActualArrivalDate",
                table: "TravelJourneyLegs");

            migrationBuilder.DropColumn(
                name: "ActualArrivalTime",
                table: "TravelJourneyLegs");

            migrationBuilder.DropColumn(
                name: "ActualArrivalKm",
                table: "TravelJourneyLegs");
        }
    }
}
