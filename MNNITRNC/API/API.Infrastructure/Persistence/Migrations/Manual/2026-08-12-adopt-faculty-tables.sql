-- Adopting the faculty and news tables into EF migration history.
--
-- WHY THIS EXISTS
-- faculty_profiles, faculty_users, news_events and news_images were originally
-- created by raw CREATE TABLE statements in DbSeeder rather than by a migration.
-- The entities were mapped correctly in ApplicationDbContext, so EF knew their
-- shape -- it simply had no migration that owned them.
--
-- AddPaymentReferenceAndFacultyTables now generates those four CREATE TABLEs
-- (plus the two GrantReceipts columns for the NEFT/RTGS payment reference).
-- Running it as-is against a database where the tables already exist fails with
-- "Table 'faculty_profiles' already exists".
--
-- This script closes that gap: it adds the two genuinely new columns by hand,
-- then records the migration as applied so EF stops trying to create tables that
-- are already there.
--
-- WHEN TO USE WHICH
--   Existing database (dev/prod already carrying the raw-SQL tables):
--       run THIS script. Do not run `dotnet ef database update` first.
--   Fresh database (no tables yet):
--       do NOT run this script. Run `dotnet ef database update`, which creates
--       everything including the four tables, in the right order.
--
-- Safe to run more than once: every statement is guarded.
--
-- NOTE ON PARTIAL APPLICATION (development database, 2026-08-12)
-- `dotnet ef database update` was attempted and failed on faculty_profiles, as
-- expected. MySQL does not roll back DDL, and the two AddColumn statements run
-- BEFORE the first CreateTable -- so the GrantReceipts columns landed while the
-- migration stayed unrecorded. GrantReceipts was confirmed to carry both
-- PaymentMode and TransactionReference afterwards.
--
-- On that database the schema is therefore ALREADY CORRECT and only the history
-- row is missing. Step 1 below becomes a no-op (guarded by IF NOT EXISTS) and
-- step 2 does the real work. Running the whole script is still correct; so is
-- running step 2 alone.

START TRANSACTION;

-- 1. The two genuinely new columns. IF NOT EXISTS keeps a re-run harmless.
ALTER TABLE `GrantReceipts`
    ADD COLUMN IF NOT EXISTS `TransactionReference` varchar(100) NULL;

ALTER TABLE `GrantReceipts`
    ADD COLUMN IF NOT EXISTS `PaymentMode` int NULL;

-- 2. Record the migration as applied, so EF does not try to CREATE TABLE over
--    the four tables that already exist. INSERT IGNORE makes a second run a
--    no-op rather than a duplicate-key error.
INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260812090606_AddPaymentReferenceAndFacultyTables', '8.0.10');

COMMIT;

-- Verify:
--   SELECT `MigrationId` FROM `__EFMigrationsHistory` ORDER BY `MigrationId` DESC LIMIT 3;
--   SHOW COLUMNS FROM `GrantReceipts` LIKE 'TransactionReference';
--
-- Then `dotnet ef migrations list` should show no pending migrations.
