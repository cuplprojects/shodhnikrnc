using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFellowshipClaimVoucherLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FellowshipClaimId",
                table: "paymentvoucheritems",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "FellowshipClaimId",
                table: "notingitems",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "PaymentVoucherItemId",
                table: "FellowshipClaims",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FellowshipClaimId",
                table: "paymentvoucheritems");

            migrationBuilder.DropColumn(
                name: "FellowshipClaimId",
                table: "notingitems");

            migrationBuilder.DropColumn(
                name: "PaymentVoucherItemId",
                table: "FellowshipClaims");
        }
    }
}
