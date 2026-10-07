using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFellowshipClaimType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            AddColumnIfMissing(
                migrationBuilder, "FellowshipClaims", "ClaimType",
                "ALTER TABLE `FellowshipClaims` ADD COLUMN `ClaimType` varchar(100) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'Claim for Month';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ClaimType",
                table: "FellowshipClaims");
        }

        private static void AddColumnIfMissing(
            MigrationBuilder migrationBuilder, string table, string column, string addColumnSql)
        {
            migrationBuilder.Sql($@"
                SET @columnExists = (
                    SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}' AND COLUMN_NAME = '{column}');
                SET @sql = IF(@columnExists = 0, '{addColumnSql.Replace("'", "''")}', 'SELECT 1;');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
        }
    }
}
