-- =============================================================================
-- seed_users_and_roles.sql
--
-- Reconciles the parts of DbSeeder.cs's SeedAsync that a prior run of the
-- .NET app did not fully complete against this database: department
-- assignments for the seeded staff accounts, and the "travel.requests" page/
-- role-access grant added to PageCatalogue.cs (leave module) as part of the
-- ProtectedRoute permission-bypass fix. Roles and users themselves are
-- already seeded (13 roles / 16 users) with correct real ASP.NET Core
-- Identity V3 password hashes -- this script only fills in what that run
-- left incomplete.
--
-- Fully idempotent: every statement below is a no-op on a database that
-- already has the row/assignment in place, so this is safe to re-run.
--
-- Usage:
--   mysql -h <host> -u <user> -p <database> < seed_users_and_roles.sql
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;
START TRANSACTION;

-- === DEPARTMENT ASSIGNMENTS ===
-- Matches DbSeeder.cs's AssignDepartmentAsync calls: faculty1/hod1 into CSED
-- (Computer Science & Engineering), the office-facing accounts into RNC
-- (Research & Consultancy) -- RNC is what PageAccessService widens
-- Department-scoped grants to Institute for, reproducing shipped behaviour.
-- Only fills a NULL DepartmentId, matching AssignDepartmentAsync's own guard.
UPDATE `users` u JOIN `departments` d ON d.`Code` = 'CSED'
  SET u.`DepartmentId` = d.`Id`
  WHERE u.`UserName` IN ('faculty1', 'hod1') AND u.`DepartmentId` IS NULL;

UPDATE `users` u JOIN `departments` d ON d.`Code` = 'RNC'
  SET u.`DepartmentId` = d.`Id`
  WHERE u.`UserName` IN (
    'clerk1', 'osrc', 'dyregrc', 'deanrc', 'directorrc',
    'harshit1', 'sadhvi1', 'ashok1', 'shyamu1', 'renu1', 'prateek1',
    'library1', 'computercentre1'
  ) AND u.`DepartmentId` IS NULL;

-- === NEW PAGE: travel.requests (PageCatalogue.cs "leave" module) ===
-- Added alongside the ProtectedRoute/AccessProvider permission-bypass fix:
-- /travels previously had no PageCatalogue entry at all and relied on a
-- hardcoded sidebar/route-guard bypass instead of a real per-role grant.
INSERT INTO `pages` (`Id`, `ModuleId`, `Key`, `Name`, `Route`, `IsNavigable`, `DisplayOrder`)
SELECT UUID(), m.`Id`, 'travel.requests', 'Travel Requests', '/travels', 1, 5
FROM `modules` m
WHERE m.`Key` = 'leave'
  AND NOT EXISTS (SELECT 1 FROM `pages` p WHERE p.`Key` = 'travel.requests');

INSERT INTO `rolepageaccess` (`RoleId`, `PageId`, `Scope`)
SELECT r.`Id`, p.`Id`, 0
FROM `roles` r
JOIN `pages` p ON p.`Key` = 'travel.requests'
WHERE r.`Name` = 'Fellow'
  AND NOT EXISTS (
    SELECT 1 FROM `rolepageaccess` a WHERE a.`RoleId` = r.`Id` AND a.`PageId` = p.`Id`
  );

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;
