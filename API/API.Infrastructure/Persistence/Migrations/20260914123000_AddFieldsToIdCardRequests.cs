using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFieldsToIdCardRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IdentityCode",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LocalAddress",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyPhone",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "MobilePhone",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PermanentAddress",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PermanentDistrict",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PermanentPin",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AdditionalCategory",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PiName",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BloodGroup",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DateOfBirth",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DateOfJoining",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PeriodFrom",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PeriodTo",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AadharNumber",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AppointmentLetterNo",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SignatureUrl",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DocumentName",
                table: "idcardrequests",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "IdentityCode", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "LocalAddress", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "EmergencyPhone", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "MobilePhone", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "Email", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "PermanentAddress", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "PermanentDistrict", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "PermanentPin", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "Category", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "AdditionalCategory", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "PiName", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "BloodGroup", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "DateOfBirth", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "DateOfJoining", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "PeriodFrom", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "PeriodTo", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "Gender", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "AadharNumber", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "AppointmentLetterNo", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "PhotoUrl", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "SignatureUrl", table: "idcardrequests");
            migrationBuilder.DropColumn(name: "DocumentName", table: "idcardrequests");
        }
    }
}
