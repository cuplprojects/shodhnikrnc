-- =============================================================================
-- full_wipe_users_and_data.sql
--
-- Wipes ALL users (ASP.NET Identity tables) and ALL business/transactional
-- data. Leaves reference/config data in place because DbSeeder.SeedAsync
-- reconciles it idempotently on next app startup:
--   modules, pages, rolepageaccess, userpagegrants, workflowdefinitions,
--   workflowstagedefinitions, documentchecklistitems, departments,
--   fundingagencies, advertisementtemplates, advertisementtemplatesections,
--   advertisementbodytemplates, emailtemplates.
--
-- Destructive and irreversible. Run only against a database you intend to
-- fully reset.
--
-- Usage:
--   mysql -h <host> -u <user> -p <database> < full_wipe_users_and_data.sql
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;
START TRANSACTION;

-- ---------------------------------------------------------------------------
-- Research Proposals and their child rows
-- ---------------------------------------------------------------------------
TRUNCATE TABLE proposalbudgetlineyears;
TRUNCATE TABLE proposalbudgetlines;
TRUNCATE TABLE proposalequipment;
TRUNCATE TABLE proposalmanpowerpositionyear;
TRUNCATE TABLE proposalmanpowerpositions;
TRUNCATE TABLE proposalcopis;
TRUNCATE TABLE researchproposals;

-- ---------------------------------------------------------------------------
-- Projects and their direct child rows
-- ---------------------------------------------------------------------------
TRUNCATE TABLE collaborators;
TRUNCATE TABLE grantreceipts;
TRUNCATE TABLE historicalgrantreceipts;
TRUNCATE TABLE historicalexpenditures;
TRUNCATE TABLE sanctionedequipment;
TRUNCATE TABLE sanctionedmanpowerpositions;
TRUNCATE TABLE budgetreappropriationlogs;
TRUNCATE TABLE projectdaassignmentlogs;
TRUNCATE TABLE reappropriationsourcelines;
TRUNCATE TABLE reappropriationdestinationlines;
TRUNCATE TABLE reappropriationrequests;
TRUNCATE TABLE refunds;
TRUNCATE TABLE expenditure;
TRUNCATE TABLE budgetheads;

-- ---------------------------------------------------------------------------
-- Indents (legacy per-type tables + unified dynamic indent tables)
-- ---------------------------------------------------------------------------
TRUNCATE TABLE consumableindents;
TRUNCATE TABLE contingencyindents;
TRUNCATE TABLE equipmentindents;
TRUNCATE TABLE indentitems;
TRUNCATE TABLE indentbudgetheadallocations;
TRUNCATE TABLE indents;

-- Procurement committee rows keyed against indents above.
TRUNCATE TABLE procurementcommitteemembers;
TRUNCATE TABLE procurementcommittees;
TRUNCATE TABLE marketcommitteeprocesses;

-- ---------------------------------------------------------------------------
-- Travel
-- ---------------------------------------------------------------------------
TRUNCATE TABLE traveljourneylegs;
TRUNCATE TABLE travelrequestbudgetheadallocations;
TRUNCATE TABLE travelrequests;

-- ---------------------------------------------------------------------------
-- Recruitment / Candidates / Fellowship / Leave / Office requests
-- ---------------------------------------------------------------------------
TRUNCATE TABLE candidateeducations;
TRUNCATE TABLE candidateexperiences;
TRUNCATE TABLE committeemembers;
TRUNCATE TABLE advertisements;
TRUNCATE TABLE candidates;
TRUNCATE TABLE recruitmentrequests;

TRUNCATE TABLE leavecancellationrequests;
TRUNCATE TABLE leaveentitlements;
TRUNCATE TABLE leaverequests;
TRUNCATE TABLE fellowshipclaims;
TRUNCATE TABLE fellowappointments;

TRUNCATE TABLE offer_letters;

TRUNCATE TABLE fellow_experience_certificates;
TRUNCATE TABLE medicalfacilityrequests;
TRUNCATE TABLE idcardrequests;
TRUNCATE TABLE nocrequests;

-- ---------------------------------------------------------------------------
-- Payment vouchers / notings tied to projects
-- ---------------------------------------------------------------------------
TRUNCATE TABLE paymentvoucheraccountdetails;
TRUNCATE TABLE paymentvoucheritems;
TRUNCATE TABLE paymentvouchers;
TRUNCATE TABLE notingitems;
TRUNCATE TABLE notings;

-- ---------------------------------------------------------------------------
-- Workflow engine rows
-- ---------------------------------------------------------------------------
TRUNCATE TABLE workflowqueries;
TRUNCATE TABLE workflowsteps;
TRUNCATE TABLE workflowinstances;

-- ---------------------------------------------------------------------------
-- Now the parent tables
-- ---------------------------------------------------------------------------
TRUNCATE TABLE projects;

-- ---------------------------------------------------------------------------
-- Cross-cutting logs (polymorphic OwnerType/OwnerId, EntityType/EntityId --
-- cannot be scoped by FK; clearing fully since everything they reference is
-- wiped above or is a user being wiped below).
-- ---------------------------------------------------------------------------
TRUNCATE TABLE documents;
TRUNCATE TABLE auditlogs;

-- ---------------------------------------------------------------------------
-- Faculty-specific profile/account data (FK'd to users)
-- ---------------------------------------------------------------------------
TRUNCATE TABLE faculty_profiles;
TRUNCATE TABLE faculty_users;

-- ---------------------------------------------------------------------------
-- Per-user page overrides (FK'd to users; rolepageaccess/pages/modules
-- themselves are config, left in place)
-- ---------------------------------------------------------------------------
TRUNCATE TABLE userpagegrants;

-- ---------------------------------------------------------------------------
-- ASP.NET Identity: users, roles, and every join/claim/token table
-- ---------------------------------------------------------------------------
TRUNCATE TABLE userclaims;
TRUNCATE TABLE userlogins;
TRUNCATE TABLE usertokens;
TRUNCATE TABLE userroles;
TRUNCATE TABLE roleclaims;
TRUNCATE TABLE users;
TRUNCATE TABLE roles;

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;
