using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateApplicationDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ApplicationStatus",
                table: "Candidates",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Backfill, and do not remove: the AddColumn above lands every
            // pre-existing row on 0 (ApplicationStatus.Draft), but each of
            // those rows is a completed application submitted through the old
            // single-shot form. Left as Draft they would silently disappear
            // from the PI's candidate table, the screening flow and the merit
            // list the moment Draft rows start being filtered out -- a data
            // loss no test against a fresh database can catch, because a fresh
            // database has no pre-existing rows to mis-classify.
            // 1 is ApplicationStatus.Submitted.
            migrationBuilder.Sql("UPDATE Candidates SET ApplicationStatus = 1 WHERE ApplicationStatus = 0;");

            migrationBuilder.AddColumn<int>(
                name: "Category",
                table: "Candidates",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CategoryCertificateDocumentId",
                table: "Candidates",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<DateOnly>(
                name: "DateOfBirth",
                table: "Candidates",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeclarationAcceptedAt",
                table: "Candidates",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "FatherOrHusbandName",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "GateNetGpatQualified",
                table: "Candidates",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "GateNetGpatRollNo",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "GateNetGpatScore",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "GateNetGpatYear",
                table: "Candidates",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Gender",
                table: "Candidates",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InternationalConfCount",
                table: "Candidates",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsMarried",
                table: "Candidates",
                type: "tinyint(1)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NationalConfCount",
                table: "Candidates",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Nationality",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "NonSciJournalCount",
                table: "Candidates",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "OtherInformation",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PermanentAddress",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "PhotoDocumentId",
                table: "Candidates",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "PresentAddress",
                table: "Candidates",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "SciJournalCount",
                table: "Candidates",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ScopusJournalCount",
                table: "Candidates",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "WantsHigherDegreeRegistration",
                table: "Candidates",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "CandidateEducations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CandidateId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Level = table.Column<int>(type: "int", nullable: false),
                    Subject = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BoardInstituteUniv = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Year = table.Column<int>(type: "int", nullable: true),
                    MarksOrCgpa = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Division = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CertificateDocumentId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateEducations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateEducations_Candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "Candidates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "CandidateExperiences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CandidateId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Organization = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Position = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SalaryEmoluments = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    NatureOfDuties = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    NatureOfAppointment = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PeriodYears = table.Column<int>(type: "int", nullable: false),
                    PeriodMonths = table.Column<int>(type: "int", nullable: false),
                    PeriodDays = table.Column<int>(type: "int", nullable: false),
                    CertificateDocumentId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateExperiences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateExperiences_Candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "Candidates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateEducations_CandidateId",
                table: "CandidateEducations",
                column: "CandidateId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateExperiences_CandidateId",
                table: "CandidateExperiences",
                column: "CandidateId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidateEducations");

            migrationBuilder.DropTable(
                name: "CandidateExperiences");

            migrationBuilder.DropColumn(
                name: "ApplicationStatus",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "CategoryCertificateDocumentId",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "DeclarationAcceptedAt",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "FatherOrHusbandName",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "GateNetGpatQualified",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "GateNetGpatRollNo",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "GateNetGpatScore",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "GateNetGpatYear",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "InternationalConfCount",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "IsMarried",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "NationalConfCount",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Nationality",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "NonSciJournalCount",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "OtherInformation",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "PermanentAddress",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "PhotoDocumentId",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "PresentAddress",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "SciJournalCount",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "ScopusJournalCount",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "WantsHigherDegreeRegistration",
                table: "Candidates");
        }
    }
}
