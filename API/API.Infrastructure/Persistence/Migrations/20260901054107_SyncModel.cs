using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <remarks>
    /// Every Up() statement is guarded by an information_schema existence
    /// check rather than issued directly: this migration folds together
    /// several tables and columns (idcardrequests, notings, offer_letters,
    /// paymentvouchers, TravelRequests.TaxiReason, indent E-Way Bill /
    /// QuotationDate fields) that had accumulated in the C# model across
    /// several earlier, unrelated commits without a matching migration ever
    /// being generated for them. On at least one real environment part of
    /// that drift -- TravelRequests.TaxiReason -- turned out to already be
    /// physically present on the database (applied out-of-band, with EF
    /// never having recorded any migration for it), which made the original,
    /// unguarded version of this migration fail with "Duplicate column name"
    /// and block every later migration from ever applying. Guarding each
    /// statement makes Up() safe to run regardless of which subset of this
    /// migration's changes are already present on a given database.
    /// </remarks>
    public partial class SyncModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            AddColumnIfMissing(migrationBuilder, "TravelRequests", "TaxiReason",
                "ALTER TABLE `TravelRequests` ADD `TaxiReason` longtext CHARACTER SET utf8mb4 NULL;");

            AddColumnIfMissing(migrationBuilder, "EquipmentIndents", "EWayBillPartA",
                "ALTER TABLE `EquipmentIndents` ADD `EWayBillPartA` longtext CHARACTER SET utf8mb4 NULL;");
            AddColumnIfMissing(migrationBuilder, "EquipmentIndents", "EWayBillPartB",
                "ALTER TABLE `EquipmentIndents` ADD `EWayBillPartB` longtext CHARACTER SET utf8mb4 NULL;");
            AddColumnIfMissing(migrationBuilder, "EquipmentIndents", "QuotationDate",
                "ALTER TABLE `EquipmentIndents` ADD `QuotationDate` date NULL;");

            AddColumnIfMissing(migrationBuilder, "ConsumableIndents", "EWayBillPartA",
                "ALTER TABLE `ConsumableIndents` ADD `EWayBillPartA` longtext CHARACTER SET utf8mb4 NULL;");
            AddColumnIfMissing(migrationBuilder, "ConsumableIndents", "EWayBillPartB",
                "ALTER TABLE `ConsumableIndents` ADD `EWayBillPartB` longtext CHARACTER SET utf8mb4 NULL;");
            AddColumnIfMissing(migrationBuilder, "ConsumableIndents", "QuotationDate",
                "ALTER TABLE `ConsumableIndents` ADD `QuotationDate` date NULL;");

            CreateTableIfMissing(migrationBuilder, "idcardrequests", @"
                CREATE TABLE `idcardrequests` (
                    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
                    `StudentUserId` char(36) COLLATE ascii_general_ci NOT NULL,
                    `CreatedByUserId` char(36) COLLATE ascii_general_ci NOT NULL,
                    `StudentName` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `RollNumber` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `Designation` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `ProjectId` char(36) COLLATE ascii_general_ci NULL,
                    `ProjectNumber` longtext CHARACTER SET utf8mb4 NULL,
                    `DepartmentId` char(36) COLLATE ascii_general_ci NOT NULL,
                    `DepartmentName` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `Status` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `IdCardNumber` longtext CHARACTER SET utf8mb4 NULL,
                    `IssuedAt` datetime(6) NULL,
                    `RejectionReason` longtext CHARACTER SET utf8mb4 NULL,
                    `Remarks` longtext CHARACTER SET utf8mb4 NULL,
                    `UpdatedByUserId` char(36) COLLATE ascii_general_ci NULL,
                    `CreatedAt` datetime(6) NOT NULL,
                    `UpdatedAt` datetime(6) NOT NULL,
                    CONSTRAINT `PK_idcardrequests` PRIMARY KEY (`Id`)
                ) CHARACTER SET=utf8mb4;");
            AddIndexIfMissing(migrationBuilder, "idcardrequests", "IX_idcardrequests_DepartmentId",
                "CREATE INDEX `IX_idcardrequests_DepartmentId` ON `idcardrequests` (`DepartmentId`);");
            AddIndexIfMissing(migrationBuilder, "idcardrequests", "IX_idcardrequests_StudentUserId",
                "CREATE INDEX `IX_idcardrequests_StudentUserId` ON `idcardrequests` (`StudentUserId`);");

            CreateTableIfMissing(migrationBuilder, "notings", @"
                CREATE TABLE `notings` (
                    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
                    `FundedAgency` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `ProjectTitle` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
                    `ProjectNo` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `Date` date NOT NULL,
                    `Status` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
                    `CreatedAt` datetime(6) NOT NULL,
                    `UpdatedAt` datetime(6) NULL,
                    CONSTRAINT `PK_notings` PRIMARY KEY (`Id`)
                ) CHARACTER SET=utf8mb4;");

            CreateTableIfMissing(migrationBuilder, "offer_letters", @"
                CREATE TABLE `offer_letters` (
                    `id` char(36) COLLATE ascii_general_ci NOT NULL,
                    `project_id` char(36) COLLATE ascii_general_ci NOT NULL,
                    `manpower_id` char(36) COLLATE ascii_general_ci NOT NULL,
                    `candidate_name` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `gender` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
                    `parent_name` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `address` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `city` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    `state` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    `pincode` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
                    `fellowship_amount` decimal(18,2) NOT NULL,
                    `hra_percentage` decimal(5,2) NOT NULL,
                    `joining_date` date NOT NULL,
                    `file_path` varchar(500) CHARACTER SET utf8mb4 NULL,
                    `generated_by` char(36) COLLATE ascii_general_ci NULL,
                    `generated_at` datetime(6) NOT NULL,
                    CONSTRAINT `PK_offer_letters` PRIMARY KEY (`id`)
                ) CHARACTER SET=utf8mb4;");

            CreateTableIfMissing(migrationBuilder, "paymentvouchers", @"
                CREATE TABLE `paymentvouchers` (
                    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
                    `VoucherNo` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    `VoucherType` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
                    `Date` date NOT NULL,
                    `TaxableAmount` decimal(18,2) NOT NULL,
                    `PayableAmount` decimal(18,2) NOT NULL,
                    `Amount` decimal(18,2) NOT NULL,
                    `ShowTdsGst` tinyint(1) NOT NULL,
                    `TdsGstRate` decimal(5,2) NOT NULL,
                    `ShowTdsIt` tinyint(1) NOT NULL,
                    `TdsItRate` decimal(5,2) NOT NULL,
                    `BankAccountNo` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    `ChequeNo` longtext CHARACTER SET utf8mb4 NULL,
                    `ChequeDate` date NOT NULL,
                    `PayRs` decimal(18,2) NOT NULL,
                    `CoordinatorNameDept` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `ProjectSanctionNo` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `FundingAgency` longtext CHARACTER SET utf8mb4 NULL,
                    `PaymentTo` longtext CHARACTER SET utf8mb4 NOT NULL,
                    `Status` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
                    `CurrentStage` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
                    `CreatedAt` datetime(6) NOT NULL,
                    `UpdatedAt` datetime(6) NULL,
                    CONSTRAINT `PK_paymentvouchers` PRIMARY KEY (`Id`)
                ) CHARACTER SET=utf8mb4;");

            CreateTableIfMissing(migrationBuilder, "notingitems", @"
                CREATE TABLE `notingitems` (
                    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
                    `NotingId` char(36) COLLATE ascii_general_ci NOT NULL,
                    `SlNo` int NOT NULL,
                    `NameOfItem` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
                    `IndentNoAndDate` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `BudgetHeadAndBalance` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    `IndentAmount` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    `ModeOfPurchase` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
                    CONSTRAINT `PK_notingitems` PRIMARY KEY (`Id`),
                    CONSTRAINT `FK_notingitems_notings_NotingId` FOREIGN KEY (`NotingId`) REFERENCES `notings` (`Id`) ON DELETE CASCADE
                ) CHARACTER SET=utf8mb4;");
            AddIndexIfMissing(migrationBuilder, "notingitems", "IX_notingitems_NotingId",
                "CREATE INDEX `IX_notingitems_NotingId` ON `notingitems` (`NotingId`);");

            CreateTableIfMissing(migrationBuilder, "paymentvoucheritems", @"
                CREATE TABLE `paymentvoucheritems` (
                    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
                    `PaymentVoucherId` char(36) COLLATE ascii_general_ci NOT NULL,
                    `LetterNoDateMbNo` longtext CHARACTER SET utf8mb4 NULL,
                    `SupplierInvoiceGoods` varchar(1000) CHARACTER SET utf8mb4 NOT NULL,
                    `HeadCategory` varchar(100) CHARACTER SET utf8mb4 NOT NULL,
                    `CurrentHeadBalance` decimal(18,2) NOT NULL,
                    `BillAmount` decimal(18,2) NOT NULL,
                    `TdsGst` decimal(18,2) NOT NULL,
                    `TdsIt` decimal(18,2) NOT NULL,
                    `BalanceAfterPayment` decimal(18,2) NOT NULL,
                    CONSTRAINT `PK_paymentvoucheritems` PRIMARY KEY (`Id`),
                    CONSTRAINT `FK_paymentvoucheritems_paymentvouchers_PaymentVoucherId` FOREIGN KEY (`PaymentVoucherId`) REFERENCES `paymentvouchers` (`Id`) ON DELETE CASCADE
                ) CHARACTER SET=utf8mb4;");
            AddIndexIfMissing(migrationBuilder, "paymentvoucheritems", "IX_paymentvoucheritems_PaymentVoucherId",
                "CREATE INDEX `IX_paymentvoucheritems_PaymentVoucherId` ON `paymentvoucheritems` (`PaymentVoucherId`);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "idcardrequests");

            migrationBuilder.DropTable(
                name: "notingitems");

            migrationBuilder.DropTable(
                name: "offer_letters");

            migrationBuilder.DropTable(
                name: "paymentvoucheritems");

            migrationBuilder.DropTable(
                name: "notings");

            migrationBuilder.DropTable(
                name: "paymentvouchers");

            migrationBuilder.DropColumn(
                name: "TaxiReason",
                table: "TravelRequests");

            migrationBuilder.DropColumn(
                name: "EWayBillPartA",
                table: "EquipmentIndents");

            migrationBuilder.DropColumn(
                name: "EWayBillPartB",
                table: "EquipmentIndents");

            migrationBuilder.DropColumn(
                name: "QuotationDate",
                table: "EquipmentIndents");

            migrationBuilder.DropColumn(
                name: "EWayBillPartA",
                table: "ConsumableIndents");

            migrationBuilder.DropColumn(
                name: "EWayBillPartB",
                table: "ConsumableIndents");

            migrationBuilder.DropColumn(
                name: "QuotationDate",
                table: "ConsumableIndents");
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

        private static void AddIndexIfMissing(
            MigrationBuilder migrationBuilder, string table, string indexName, string createIndexSql)
        {
            migrationBuilder.Sql($@"
                SET @indexExists = (
                    SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}' AND INDEX_NAME = '{indexName}');
                SET @sql = IF(@indexExists = 0, '{createIndexSql.Replace("'", "''")}', 'SELECT 1;');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
        }

        private static void CreateTableIfMissing(
            MigrationBuilder migrationBuilder, string table, string createTableSql)
        {
            migrationBuilder.Sql($@"
                SET @tableExists = (
                    SELECT COUNT(*) FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}');
                SET @sql = IF(@tableExists = 0, '{createTableSql.Replace("'", "''")}', 'SELECT 1;');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;");
        }
    }
}
