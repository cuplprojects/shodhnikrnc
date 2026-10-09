-- =============================================================================
-- clean_proposals_projects_data.sql
--
-- Wipes ALL Proposals, Projects, and everything transactionally attached to
-- them: indents, travel, recruitment, fellowship, leave, payment vouchers,
-- notings, reappropriation, workflow instances/steps/queries, documents and
-- audit logs.
--
-- Left untouched (master/reference data, not "proposals/projects data"):
--   Users, Roles and other ASP.NET Identity tables, Departments, Modules,
--   Pages, RolePageAccess, UserPageGrant, FundingAgency, WorkflowDefinition,
--   WorkflowStageDefinition, DocumentChecklistItem, AdvertisementTemplate(s),
--   AdvertisementBodyTemplate, EmailTemplate, EmailLog, NewsEvent/NewsImage,
--   Announcement, FacultyProfile, FacultyUser, ProcurementCommittee(Member),
--   MarketCommitteeProcess.
--
-- Usage:
--   mysql -u <user> -p <database> < clean_proposals_projects_data.sql
-- or, from a MySQL client already connected to the right schema:
--   SOURCE clean_proposals_projects_data.sql;
--
-- This is destructive and irreversible. Take a backup/dump first if there is
-- any doubt:
--   mysqldump -u <user> -p <database> > backup_before_clean.sql
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET AUTOCOMMIT = 0;
START TRANSACTION;

-- ---------------------------------------------------------------------------
-- Research Proposals and their child rows
-- ---------------------------------------------------------------------------
TRUNCATE TABLE ProposalBudgetLineYears;
TRUNCATE TABLE ProposalBudgetLines;
TRUNCATE TABLE ProposalEquipment;
TRUNCATE TABLE ProposalManpowerPositionYear;
TRUNCATE TABLE ProposalManpowerPositions;
TRUNCATE TABLE ProposalCoPis;
TRUNCATE TABLE ResearchProposals;

-- ---------------------------------------------------------------------------
-- Projects and their direct child rows
-- ---------------------------------------------------------------------------
TRUNCATE TABLE Collaborators;
TRUNCATE TABLE GrantReceipts;
TRUNCATE TABLE SanctionedEquipment;
TRUNCATE TABLE SanctionedManpowerPositions;
TRUNCATE TABLE budgetreappropriationlogs;
TRUNCATE TABLE projectdaassignmentlogs;
TRUNCATE TABLE ReappropriationSourceLines;
TRUNCATE TABLE ReappropriationDestinationLines;
TRUNCATE TABLE ReappropriationRequests;
TRUNCATE TABLE Refunds;
TRUNCATE TABLE Expenditure;
TRUNCATE TABLE BudgetHeads;

-- ---------------------------------------------------------------------------
-- Indents (legacy per-type tables + unified dynamic indent tables)
-- ---------------------------------------------------------------------------
TRUNCATE TABLE ConsumableIndents;
TRUNCATE TABLE ContingencyIndents;
TRUNCATE TABLE EquipmentIndents;
TRUNCATE TABLE IndentItems;
TRUNCATE TABLE IndentBudgetHeadAllocations;
TRUNCATE TABLE Indents;

-- Procurement committee rows keyed against indents above.
TRUNCATE TABLE ProcurementCommitteeMembers;
TRUNCATE TABLE ProcurementCommittees;
TRUNCATE TABLE MarketCommitteeProcesses;

-- ---------------------------------------------------------------------------
-- Travel
-- ---------------------------------------------------------------------------
TRUNCATE TABLE TravelJourneyLegs;
TRUNCATE TABLE TravelRequestBudgetHeadAllocations;
TRUNCATE TABLE TravelRequests;

-- ---------------------------------------------------------------------------
-- Recruitment / Candidates / Fellowship / Leave
-- ---------------------------------------------------------------------------
TRUNCATE TABLE CandidateEducations;
TRUNCATE TABLE CandidateExperiences;
TRUNCATE TABLE CommitteeMembers;
TRUNCATE TABLE Advertisements;
TRUNCATE TABLE Candidates;
TRUNCATE TABLE RecruitmentRequests;

TRUNCATE TABLE LeaveCancellationRequests;
TRUNCATE TABLE LeaveEntitlements;
TRUNCATE TABLE LeaveRequests;
TRUNCATE TABLE FellowshipClaims;
TRUNCATE TABLE FellowAppointments;

TRUNCATE TABLE offer_letters;

-- ---------------------------------------------------------------------------
-- Payment vouchers / notings tied to projects
-- ---------------------------------------------------------------------------
TRUNCATE TABLE paymentvoucheritems;
TRUNCATE TABLE paymentvouchers;
TRUNCATE TABLE notingitems;
TRUNCATE TABLE notings;

-- ---------------------------------------------------------------------------
-- Workflow engine rows (every workflow instance in this app belongs to one
-- of the request types above, all of which trace back to a Proposal/Project)
-- ---------------------------------------------------------------------------
TRUNCATE TABLE WorkflowQueries;
TRUNCATE TABLE WorkflowSteps;
TRUNCATE TABLE WorkflowInstances;

-- ---------------------------------------------------------------------------
-- Now the parent tables
-- ---------------------------------------------------------------------------
TRUNCATE TABLE Projects;

-- ---------------------------------------------------------------------------
-- Cross-cutting logs (Documents/AuditLogs are polymorphic -- OwnerType/
-- OwnerId and EntityType/EntityId respectively -- so they cannot be scoped
-- by FK; clearing them fully since every row they hold points at data wiped
-- above).
-- ---------------------------------------------------------------------------
TRUNCATE TABLE Documents;
TRUNCATE TABLE AuditLogs;

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;
