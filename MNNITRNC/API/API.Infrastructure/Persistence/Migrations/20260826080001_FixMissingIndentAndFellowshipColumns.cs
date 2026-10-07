using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <remarks>
    /// Backfills the real DDL for two migrations that were committed without
    /// their required .Designer.cs companion file
    /// (20260825171000_AddProcurementIndentNewFields,
    /// 20260826080000_AddFellowshipClaimPeriod) -- without that file, EF Core
    /// cannot see either migration at all, so a fresh database's migration
    /// chain skips their columns entirely while a database that was already
    /// migrated before this gap existed has them. Follows
    /// 20260901054107_SyncModel's own established IF-MISSING pattern for
    /// exactly this situation, so this is safe to run on either kind of
    /// database. The current model snapshot already accounts for these
    /// columns (confirmed: `dotnet ef migrations add` against current HEAD
    /// finds no model/migration drift for them) -- only the missing DDL is
    /// added here, no snapshot changes.
    /// </remarks>
    public partial class FixMissingIndentAndFellowshipColumns : Migration
    {
        private static readonly (string Column, string AddColumnSql)[] IndentColumns =
        [
            ("PaymentRouting", "ALTER TABLE `{0}` ADD COLUMN `PaymentRouting` longtext CHARACTER SET utf8mb4 NULL;"),
            ("MiscellaneousExpenditure", "ALTER TABLE `{0}` ADD COLUMN `MiscellaneousExpenditure` decimal(65,30) NULL;"),
            ("BiddingNumber", "ALTER TABLE `{0}` ADD COLUMN `BiddingNumber` longtext CHARACTER SET utf8mb4 NULL;"),
            ("BidPublicationDate", "ALTER TABLE `{0}` ADD COLUMN `BidPublicationDate` date NULL;"),
            ("PurchaseOrderNumber", "ALTER TABLE `{0}` ADD COLUMN `PurchaseOrderNumber` longtext CHARACTER SET utf8mb4 NULL;"),
            ("PurchaseOrderDate", "ALTER TABLE `{0}` ADD COLUMN `PurchaseOrderDate` date NULL;"),
            ("BindingLocation", "ALTER TABLE `{0}` ADD COLUMN `BindingLocation` longtext CHARACTER SET utf8mb4 NULL;"),
            ("ComparativeStatementNumber", "ALTER TABLE `{0}` ADD COLUMN `ComparativeStatementNumber` longtext CHARACTER SET utf8mb4 NULL;"),
            ("ComparativeStatementSigned", "ALTER TABLE `{0}` ADD COLUMN `ComparativeStatementSigned` tinyint(1) NOT NULL DEFAULT 0;"),
        ];

        private static readonly string[] IndentTables = ["ConsumableIndents", "ContingencyIndents", "EquipmentIndents"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in IndentTables)
            {
                foreach (var (column, addColumnSql) in IndentColumns)
                {
                    AddColumnIfMissing(migrationBuilder, table, column, string.Format(addColumnSql, table));
                }
            }

            AddColumnIfMissing(
                migrationBuilder, "FellowshipClaims", "ClaimPeriod",
                "ALTER TABLE `FellowshipClaims` ADD COLUMN `ClaimPeriod` varchar(50) CHARACTER SET utf8mb4 NOT NULL DEFAULT '21st-20th';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally a no-op: this migration only backfills DDL for
            // columns the model already expects to exist unconditionally.
            // Dropping them on Down would break every other migration/model
            // state that assumes they are present.
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
