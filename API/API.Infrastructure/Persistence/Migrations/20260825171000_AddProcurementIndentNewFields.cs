using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProcurementIndentNewFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            var tables = new[] { "ConsumableIndents", "ContingencyIndents", "EquipmentIndents" };

            foreach (var table in tables)
            {
                migrationBuilder.AddColumn<string>(
                    name: "PaymentRouting",
                    table: table,
                    type: "longtext",
                    nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4");

                migrationBuilder.AddColumn<decimal>(
                    name: "MiscellaneousExpenditure",
                    table: table,
                    type: "decimal(65,30)",
                    nullable: true);

                migrationBuilder.AddColumn<string>(
                    name: "BiddingNumber",
                    table: table,
                    type: "longtext",
                    nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4");

                migrationBuilder.AddColumn<DateOnly>(
                    name: "BidPublicationDate",
                    table: table,
                    type: "date",
                    nullable: true);

                migrationBuilder.AddColumn<string>(
                    name: "PurchaseOrderNumber",
                    table: table,
                    type: "longtext",
                    nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4");

                migrationBuilder.AddColumn<DateOnly>(
                    name: "PurchaseOrderDate",
                    table: table,
                    type: "date",
                    nullable: true);

                migrationBuilder.AddColumn<string>(
                    name: "BindingLocation",
                    table: table,
                    type: "longtext",
                    nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4");

                migrationBuilder.AddColumn<string>(
                    name: "ComparativeStatementNumber",
                    table: table,
                    type: "longtext",
                    nullable: true)
                    .Annotation("MySql:CharSet", "utf8mb4");

                migrationBuilder.AddColumn<bool>(
                    name: "ComparativeStatementSigned",
                    table: table,
                    type: "tinyint(1)",
                    nullable: false,
                    defaultValue: false);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            var tables = new[] { "ConsumableIndents", "ContingencyIndents", "EquipmentIndents" };

            foreach (var table in tables)
            {
                migrationBuilder.DropColumn(name: "PaymentRouting", table: table);
                migrationBuilder.DropColumn(name: "MiscellaneousExpenditure", table: table);
                migrationBuilder.DropColumn(name: "BiddingNumber", table: table);
                migrationBuilder.DropColumn(name: "BidPublicationDate", table: table);
                migrationBuilder.DropColumn(name: "PurchaseOrderNumber", table: table);
                migrationBuilder.DropColumn(name: "PurchaseOrderDate", table: table);
                migrationBuilder.DropColumn(name: "BindingLocation", table: table);
                migrationBuilder.DropColumn(name: "ComparativeStatementNumber", table: table);
                migrationBuilder.DropColumn(name: "ComparativeStatementSigned", table: table);
            }
        }
    }
}
