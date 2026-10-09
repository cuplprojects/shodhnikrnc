-- =============================================================================
-- grant_superadmin_all_pages.sql
--
-- SQL equivalent of PageAccessSeeder.GrantSuperAdminEveryPageAsync: grants the
-- SuperAdmin role access to every page that exists, at Institute scope,
-- regardless of what each page's normal role list includes. Deliberately
-- separate from each page's own documented role list in PageCatalogue.cs, so
-- this blanket rule does not disturb that page-specific reasoning.
--
-- Idempotent: only inserts a (RoleId, PageId) pair that isn't already granted,
-- safe to re-run (e.g. after new pages are added to PageCatalogue.cs and
-- reconciled into the `pages` table).
--
-- Usage:
--   mysql -h <host> -u <user> -p <database> < grant_superadmin_all_pages.sql
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;
START TRANSACTION;

INSERT INTO `rolepageaccess` (`RoleId`, `PageId`, `Scope`)
SELECT r.`Id`, p.`Id`, 2 -- AccessScope.Institute
FROM `roles` r
CROSS JOIN `pages` p
WHERE r.`Name` = 'SuperAdmin'
  AND NOT EXISTS (
    SELECT 1 FROM `rolepageaccess` a WHERE a.`RoleId` = r.`Id` AND a.`PageId` = p.`Id`
  );

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;
