-- =============================================================================
-- full_seed_users_and_roles.sql
--
-- Standalone, idempotent SQL equivalent of DbSeeder.cs's role/user/department
-- seeding (EnsureUserAsync + AssignDepartmentAsync), for use when the .NET app
-- is not being run to perform the seed (e.g. right after
-- full_wipe_users_and_data.sql). Every statement is guarded so re-running this
-- script is always safe and never duplicates a role, user or grant.
--
-- Password hashes are real ASP.NET Core Identity V3 (PBKDF2-HMAC-SHA256,
-- 100,000 iterations) hashes generated with the framework's own
-- PasswordHasher<TUser> and confirmed with VerifyHashedPassword -- sign-in
-- with the passwords below works immediately, matching DbSeeder.cs exactly.
--
-- Requires: departments and the PageCatalogue-seeded Modules/Pages/
-- RolePageAccess to already exist (e.g. from a prior DbSeeder run) --
-- this script only creates roles, users, userroles and department links.
--
-- Usage:
--   mysql -h <host> -u <user> -p <database> < full_seed_users_and_roles.sql
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;
START TRANSACTION;

-- === ROLES ===
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT '298b22d5-f441-40f2-98ba-10abee3d7d13', 'Faculty', 'FACULTY', 'a8c18016-5728-4f90-bbbf-f2e7168b9cc6'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'Faculty');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT '98c5a621-af27-4dfb-8556-4d32f97684e2', 'RegularStaff', 'REGULARSTAFF', '89761c5f-c31a-4efa-b72e-054e2ec5e213'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'RegularStaff');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT '84f86eb6-065f-4057-8c9c-46e6f23abf4a', 'Superintendent', 'SUPERINTENDENT', 'c450a472-c07d-414b-866f-353e8f465df0'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'Superintendent');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT '9e131472-7d8d-4c15-9729-04f7848cf5c8', 'DeputyRegistrar', 'DEPUTYREGISTRAR', 'fdcb552d-7a51-49db-b0ee-92ce7490c07d'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'DeputyRegistrar');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT '01b9a338-3885-45bd-bc28-373d970174fd', 'Dean', 'DEAN', 'fc5b6d33-db27-4517-af65-e731090c8d6f'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'Dean');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT 'f9f8d401-43c1-4133-ad7d-af107e5f5691', 'Applicant', 'APPLICANT', '1ee5b99d-319a-40f6-8824-f1ee344d0657'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'Applicant');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT 'b3332cc1-c7cc-4e0d-bc60-36d6a9b4be4c', 'Fellow', 'FELLOW', 'a9ee8ebe-5529-4e62-86ef-fcdd509b931b'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'Fellow');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT 'ae0ecb39-f31b-479c-9004-efb29c3ae9a8', 'Director', 'DIRECTOR', '82b0e76c-f870-4da8-81c7-b74201a94aa1'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'Director');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT 'c71fd826-5bce-418a-a3c5-460a7ac794aa', 'SuperAdmin', 'SUPERADMIN', '98a04e3e-0b62-44d8-b04f-d01a2301b4dc'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'SuperAdmin');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT '5ce6eec7-910b-4581-9f39-66d3344ec991', 'HOD', 'HOD', '8ca7941d-f88b-4ff4-b570-6fe88da27f23'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'HOD');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT 'c9de7e41-c689-474f-80fa-9149a7d5afa3', 'Library', 'LIBRARY', 'ee933824-de86-4066-9fa0-54a3a4fbd63e'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'Library');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT '83d5828b-4cbd-45b5-ae79-dd418bb36deb', 'ComputerCentre', 'COMPUTERCENTRE', '27033fda-f745-4497-a5ad-4f570f020eb6'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'ComputerCentre');
INSERT INTO `roles` (`Id`, `Name`, `NormalizedName`, `ConcurrencyStamp`)
SELECT '82b75f87-a766-4864-acee-cab42c82083f', 'Pending', 'PENDING', '4c998462-8197-4e80-8fe9-a93708cb275d'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `Name` = 'Pending');

-- === USERS ===
SET @exists_deanrc := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'deanrc');
SET @uid := IF(@exists_deanrc = 0, 'c28012bb-598b-4671-a80e-af5404d0556f', (SELECT `Id` FROM `users` WHERE `UserName` = 'deanrc'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'deanrc', 'DEANRC', 'deanrc@mnnit.ac.in', 'DEANRC@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAENEaq1944cD0eRtsvfp8iq6sLypmYGJv7eOcWWuxLndwSDeHrt28GA0WxzhlYLV3MA==', 'f5bf9eb4-41d4-4263-8875-fb8e3fe1815d', 'd251aa54-0209-4544-88d2-762b5dbc1e29', 0, 0, 1, 0, 1, 'Dean R&C', UTC_TIMESTAMP(6)
WHERE @exists_deanrc = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'Dean'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'Dean');

SET @exists_dyregrc := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'dyregrc');
SET @uid := IF(@exists_dyregrc = 0, '29d3d7b7-a8c6-4c6a-b032-d7a2f4b94a24', (SELECT `Id` FROM `users` WHERE `UserName` = 'dyregrc'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'dyregrc', 'DYREGRC', 'dyregrc@mnnit.ac.in', 'DYREGRC@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEBA2Uh2XL4uNSmC/+ZwJl8X2ddrhIB/+uhZSQzpusMB5g7glYau9kz7XFWlQqmCD0A==', 'dba63ff0-9c8b-4760-bc07-61e8f807d1bd', 'daf1312f-67d3-4533-922c-d4be6d2e328c', 0, 0, 1, 0, 1, 'Deputy Registrar', UTC_TIMESTAMP(6)
WHERE @exists_dyregrc = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'DeputyRegistrar'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'DeputyRegistrar');

SET @exists_osrc := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'osrc');
SET @uid := IF(@exists_osrc = 0, 'e07e290f-d0e3-492c-864f-27a1444015bd', (SELECT `Id` FROM `users` WHERE `UserName` = 'osrc'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'osrc', 'OSRC', 'osrc@mnnit.ac.in', 'OSRC@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEMtMKveZZThQ9YgeReU55fxOEpKQ0hGQ1BWWiVhDxZhUqUfooor8VlvZ07GCGK4dXQ==', '2ffe1778-d4be-4ea5-a2cf-36eb86ddd1fa', '5eba8e29-fb9c-495f-b04d-c0f9b2d41839', 0, 0, 1, 0, 1, 'Superintendent R&C', UTC_TIMESTAMP(6)
WHERE @exists_osrc = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'Superintendent'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'Superintendent');

SET @exists_clerk1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'clerk1');
SET @uid := IF(@exists_clerk1 = 0, '92652f05-5abf-40a9-b1ad-6d542b8a1cb9', (SELECT `Id` FROM `users` WHERE `UserName` = 'clerk1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'clerk1', 'CLERK1', 'clerk1@mnnit.ac.in', 'CLERK1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEOq6zQ8cUX1jNZnlKAbsGbWTprRIFuJHpN1E/wZNP0962ZvwvsB2D4i6OByalV2jCQ==', '451988a0-1246-40c6-876c-f0c60bf0372d', '3820397e-3f20-4413-8ac6-c46414eab0fd', 0, 0, 1, 0, 1, 'Office Clerk One', UTC_TIMESTAMP(6)
WHERE @exists_clerk1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'RegularStaff'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'RegularStaff');

SET @exists_faculty1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'faculty1');
SET @uid := IF(@exists_faculty1 = 0, '3390cd66-b608-4d47-9847-d3eec5ebc509', (SELECT `Id` FROM `users` WHERE `UserName` = 'faculty1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'faculty1', 'FACULTY1', 'faculty1@mnnit.ac.in', 'FACULTY1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEBPd56HfF/FWXSSMWMCi4z1polVqTcMdU0PFx1xvTbve+SnPJnsgoNa528vB+wxcWQ==', 'c28a7a66-e14c-4ae4-be97-6853d047c0db', '6e06d87a-0321-4155-b34a-72ec85b85c35', 0, 0, 1, 0, 1, 'Faculty Member One', UTC_TIMESTAMP(6)
WHERE @exists_faculty1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'Faculty'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'Faculty');

SET @exists_directorrc := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'directorrc');
SET @uid := IF(@exists_directorrc = 0, 'fd47cb8a-386c-46e1-98ff-d4fbb79746d5', (SELECT `Id` FROM `users` WHERE `UserName` = 'directorrc'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'directorrc', 'DIRECTORRC', 'directorrc@mnnit.ac.in', 'DIRECTORRC@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEMj3NmVflh2REbtUbu5S1/kW73ul0ehrJpT+oGEIsB+OOqkcI+wfUJCaSXPTOCLgpA==', '30b803f5-67d9-438d-a057-2cb123e03d48', 'e035cd20-a426-4971-b9d0-1a9acde105d5', 0, 0, 1, 0, 1, 'Director', UTC_TIMESTAMP(6)
WHERE @exists_directorrc = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'Director'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'Director');

SET @exists_superadmin := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'superadmin');
SET @uid := IF(@exists_superadmin = 0, '3c5d9225-9013-48a3-8e22-3203b72d9320', (SELECT `Id` FROM `users` WHERE `UserName` = 'superadmin'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'superadmin', 'SUPERADMIN', 'superadmin@mnnit.ac.in', 'SUPERADMIN@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEGGEvYXW78pPwA67iHdqOGeg9kfh+PFbpvQhDEGXBE9i0c9GvW+Fhq4J4A4yh2CeqA==', '78f014a3-e6af-4e45-8ab0-8126ddc6116b', '6a56c92d-fed2-4d1d-aebe-a80f03adb3d1', 0, 0, 1, 0, 1, 'Workflow Administrator', UTC_TIMESTAMP(6)
WHERE @exists_superadmin = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'SuperAdmin'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'SuperAdmin');

SET @exists_hod1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'hod1');
SET @uid := IF(@exists_hod1 = 0, '59369b1e-b463-4703-bf3d-a4d6ac416ef5', (SELECT `Id` FROM `users` WHERE `UserName` = 'hod1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'hod1', 'HOD1', 'hod1@mnnit.ac.in', 'HOD1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEBi8g3piPbsEe1YWomIc77F2eG2I5v1KXQotnIOEddfg+JDfmIKR0quU08YNEx/4lQ==', '3d9496b4-f34f-4940-8796-60c599a3461b', '0274c786-0b75-4e9f-aeab-6670258132bf', 0, 0, 1, 0, 1, 'HOD Computer Science', UTC_TIMESTAMP(6)
WHERE @exists_hod1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'HOD'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'HOD');

SET @exists_library1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'library1');
SET @uid := IF(@exists_library1 = 0, '67a91fc2-cb31-43c0-8071-6892f7fb30ce', (SELECT `Id` FROM `users` WHERE `UserName` = 'library1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'library1', 'LIBRARY1', 'library1@mnnit.ac.in', 'LIBRARY1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEJvEevOFs+wg/XJh+gz9gmVO3KJ/A4fwGQJQcrJ2L5zhRYS2eI5Ljbam8yiN4MOQAQ==', 'b542cb9f-deba-4a7e-84d2-30d073544b71', '1f7dee0e-79ec-4f5a-bbfd-c36ab9842b61', 0, 0, 1, 0, 1, 'Library Desk One', UTC_TIMESTAMP(6)
WHERE @exists_library1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'Library'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'Library');

SET @exists_computercentre1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'computercentre1');
SET @uid := IF(@exists_computercentre1 = 0, 'f9409225-10bf-4c8d-8994-562568c388a7', (SELECT `Id` FROM `users` WHERE `UserName` = 'computercentre1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'computercentre1', 'COMPUTERCENTRE1', 'computercentre1@mnnit.ac.in', 'COMPUTERCENTRE1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEP5GvViIVFkjR2tofjOAthlrpU/ga1YuHprczDjUCqreJN6FWfBlOuqQDo3tvmpryw==', 'fd126714-9c42-438e-bd56-14a3ed610a71', '6fc9d443-1f50-4a5e-a739-4e965f3f2131', 0, 0, 1, 0, 1, 'Computer Centre Admin', UTC_TIMESTAMP(6)
WHERE @exists_computercentre1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'ComputerCentre'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'ComputerCentre');

SET @exists_harshit1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'harshit1');
SET @uid := IF(@exists_harshit1 = 0, '1584f7e1-1998-4b9c-8c6c-abe9ea45493a', (SELECT `Id` FROM `users` WHERE `UserName` = 'harshit1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'harshit1', 'HARSHIT1', 'harshit1@mnnit.ac.in', 'HARSHIT1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEG6Ql8todC3PAce5XzAFewCm0pkhuSExD+js5MnC2ZDSbFQhIBqX+Mezjve99IQiSg==', '98500bf4-20bd-43d0-a77f-39faf8205ab3', 'a905b80b-ba56-47b8-9c24-b0a3831bb32f', 0, 0, 1, 0, 1, 'Harshit', UTC_TIMESTAMP(6)
WHERE @exists_harshit1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'RegularStaff'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'RegularStaff');

SET @exists_sadhvi1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'sadhvi1');
SET @uid := IF(@exists_sadhvi1 = 0, '42be4835-c1d5-4597-9fd0-78872e7367e2', (SELECT `Id` FROM `users` WHERE `UserName` = 'sadhvi1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'sadhvi1', 'SADHVI1', 'sadhvi1@mnnit.ac.in', 'SADHVI1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEOGNd7+Zj+4P7KC+Df1J/p6hjVUscXmzAqOppAi2hdUzofNOddlgxjgFVk1CcFNJFA==', '9c63429c-4101-41ac-b1b2-fb6b9f9a2df0', '71d6a35b-9ec5-462f-bdf2-1e3a431d5271', 0, 0, 1, 0, 1, 'Sadhvi', UTC_TIMESTAMP(6)
WHERE @exists_sadhvi1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'RegularStaff'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'RegularStaff');

SET @exists_ashok1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'ashok1');
SET @uid := IF(@exists_ashok1 = 0, '3dd1bb3f-42c8-4f11-a51e-e9a03078d3cd', (SELECT `Id` FROM `users` WHERE `UserName` = 'ashok1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'ashok1', 'ASHOK1', 'ashok1@mnnit.ac.in', 'ASHOK1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEMxLwMX4GqBKv6vth0dQJVQm/4lgTaaxgYg0TsSTDKMaKjKLriQsAjsigIeoiOAs/w==', '2225d01c-e8ef-43cd-93e1-3db80ab2fe6d', '571385c2-10e2-42f8-95dc-d893ea6a38b2', 0, 0, 1, 0, 1, 'Ashok', UTC_TIMESTAMP(6)
WHERE @exists_ashok1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'RegularStaff'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'RegularStaff');

SET @exists_shyamu1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'shyamu1');
SET @uid := IF(@exists_shyamu1 = 0, '2dbcb419-8284-421d-ba6e-3b9d4ee1832f', (SELECT `Id` FROM `users` WHERE `UserName` = 'shyamu1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'shyamu1', 'SHYAMU1', 'shyamu1@mnnit.ac.in', 'SHYAMU1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEEvlwMpANYebV69eW4ODogN+x9GZYokWfXBKgJYhQWoCVzDwlZJqo4psGNB0pVOCrQ==', 'd70900aa-7484-4fcc-bc4f-8b77e9816214', 'ad7c035b-f5c0-48c1-a752-0d20cbb842ba', 0, 0, 1, 0, 1, 'Shyamu', UTC_TIMESTAMP(6)
WHERE @exists_shyamu1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'RegularStaff'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'RegularStaff');

SET @exists_renu1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'renu1');
SET @uid := IF(@exists_renu1 = 0, 'c3ed472f-181f-4844-a247-306852b7822e', (SELECT `Id` FROM `users` WHERE `UserName` = 'renu1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'renu1', 'RENU1', 'renu1@mnnit.ac.in', 'RENU1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEODTpi8VjOT1lTHQ3jUYUFvM3/P8oqv46q2QHktDge1fMwJ/WSYRPbsSfBdUgQHG2g==', '65e636e8-b2f4-4752-af4c-4e6d27589b73', '632af1ac-dcbd-42f3-a775-5a5d5677dd54', 0, 0, 1, 0, 1, 'Renu', UTC_TIMESTAMP(6)
WHERE @exists_renu1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'RegularStaff'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'RegularStaff');

SET @exists_prateek1 := (SELECT COUNT(*) FROM `users` WHERE `UserName` = 'prateek1');
SET @uid := IF(@exists_prateek1 = 0, 'e6687017-3713-4000-b2fa-b1bf9fb7aefd', (SELECT `Id` FROM `users` WHERE `UserName` = 'prateek1'));
INSERT INTO `users` (`Id`, `UserName`, `NormalizedUserName`, `Email`, `NormalizedEmail`, `EmailConfirmed`, `PasswordHash`, `SecurityStamp`, `ConcurrencyStamp`, `PhoneNumberConfirmed`, `TwoFactorEnabled`, `LockoutEnabled`, `AccessFailedCount`, `IsActive`, `FullName`, `CreatedAt`)
SELECT @uid, 'prateek1', 'PRATEEK1', 'prateek1@mnnit.ac.in', 'PRATEEK1@MNNIT.AC.IN', 1, 'AQAAAAIAAYagAAAAEEbDjKM5XO2UziE7lXrpLEBGUZtkVpnqZk7WHNSjZsHHRXQdbs1oMAWGf/t80DxgiQ==', '38444534-d776-49b0-a7f8-d7c0ade16ca3', '28ffde2e-630f-4bbd-b51c-56e919400306', 0, 0, 1, 0, 1, 'Prateek', UTC_TIMESTAMP(6)
WHERE @exists_prateek1 = 0;
INSERT INTO `userroles` (`UserId`, `RoleId`)
SELECT @uid, `Id` FROM `roles` WHERE `Name` = 'RegularStaff'
AND NOT EXISTS (SELECT 1 FROM `userroles` ur JOIN `roles` r2 ON r2.`Id` = ur.`RoleId` WHERE ur.`UserId` = @uid AND r2.`Name` = 'RegularStaff');

-- === DEPARTMENT ASSIGNMENTS (only fills a NULL DepartmentId) ===
UPDATE `users` u JOIN `departments` d ON d.`Code` = 'CSED'
  SET u.`DepartmentId` = d.`Id`
  WHERE u.`UserName` IN ('faculty1', 'hod1') AND u.`DepartmentId` IS NULL;

UPDATE `users` u JOIN `departments` d ON d.`Code` = 'RNC'
  SET u.`DepartmentId` = d.`Id`
  WHERE u.`UserName` IN ('clerk1', 'osrc', 'dyregrc', 'deanrc', 'directorrc', 'harshit1', 'sadhvi1', 'ashok1', 'shyamu1', 'renu1', 'prateek1', 'library1', 'computercentre1') AND u.`DepartmentId` IS NULL;

-- === travel.requests PAGE (PageCatalogue.cs "leave" module) ===
-- Added alongside the ProtectedRoute/AccessProvider permission-bypass fix:
-- /travels previously had no PageCatalogue entry and relied on a hardcoded
-- sidebar/route-guard bypass instead of a real per-role grant.
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
