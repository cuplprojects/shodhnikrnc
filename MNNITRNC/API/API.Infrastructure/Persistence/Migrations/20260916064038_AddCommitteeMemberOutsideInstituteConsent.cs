using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCommitteeMemberOutsideInstituteConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTE: the auto-generated diff also swept in an unrelated
            // paymentvouchers.SignedFilesJson column from live-DB drift
            // unconnected to this feature -- stripped per this repo's
            // established precedent (see commits 5eb56ab/797e76e), keeping
            // only the two CommitteeMember columns this migration is for.
            migrationBuilder.AddColumn<Guid>(
                name: "ConsentDocumentId",
                table: "CommitteeMembers",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<bool>(
                name: "IsOutsideInstitute",
                table: "CommitteeMembers",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConsentDocumentId",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "IsOutsideInstitute",
                table: "CommitteeMembers");
        }
    }
}
