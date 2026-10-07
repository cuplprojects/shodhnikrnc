using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace API.Application.Common;

public interface IApplicationDbContext
{
    DatabaseFacade Database { get; }
    DbSet<WorkflowInstance> WorkflowInstances { get; }
    DbSet<WorkflowStep> WorkflowSteps { get; }
    DbSet<WorkflowQuery> WorkflowQueries { get; }
    DbSet<WorkflowDefinition> WorkflowDefinitions { get; }
    DbSet<ResearchProposal> ResearchProposals { get; }
    DbSet<ProposalBudgetLine> ProposalBudgetLines { get; }
    DbSet<ProposalEquipment> ProposalEquipment { get; }
    DbSet<ProposalManpowerPosition> ProposalManpowerPositions { get; }
    DbSet<ProposalCoPi> ProposalCoPis { get; }
    DbSet<WorkflowStageDefinition> WorkflowStageDefinitions { get; }
    DbSet<Module> Modules { get; }
    DbSet<Page> Pages { get; }
    DbSet<RolePageAccess> RolePageAccess { get; }
    DbSet<UserPageGrant> UserPageGrants { get; }
    DbSet<Department> Departments { get; }
    DbSet<Document> Documents { get; }
    DbSet<Project> Projects { get; }
    DbSet<Collaborator> Collaborators { get; }
    DbSet<BudgetHead> BudgetHeads { get; }
    DbSet<SanctionedEquipment> SanctionedEquipment { get; }
    DbSet<SanctionedManpowerPosition> SanctionedManpowerPositions { get; }
    DbSet<GrantReceipt> GrantReceipts { get; }
    DbSet<Expenditure> Expenditure { get; }
    DbSet<Refund> Refunds { get; }
    DbSet<HistoricalExpenditure> HistoricalExpenditures { get; }
    DbSet<HistoricalGrantReceipt> HistoricalGrantReceipts { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<ConsumableIndent> ConsumableIndents { get; }
    DbSet<ContingencyIndent> ContingencyIndents { get; }
    DbSet<EquipmentIndent> EquipmentIndents { get; }
    DbSet<Indent> Indents { get; }
    DbSet<IndentBudgetHeadAllocation> IndentBudgetHeadAllocations { get; }
    DbSet<IndentItem> IndentItems { get; }
    DbSet<ProcurementCommittee> ProcurementCommittees { get; }
    DbSet<MarketCommitteeProcess> MarketCommitteeProcesses { get; }
    DbSet<ProcurementCommitteeMember> ProcurementCommitteeMembers { get; }
    DbSet<DocumentChecklistItem> DocumentChecklistItems { get; }
    DbSet<TravelRequest> TravelRequests { get; }
    DbSet<TravelRequestBudgetHeadAllocation> TravelRequestBudgetHeadAllocations { get; }
    DbSet<TravelJourneyLeg> TravelJourneyLegs { get; }
    DbSet<RecruitmentRequest> RecruitmentRequests { get; }
    DbSet<Advertisement> Advertisements { get; }
    DbSet<Candidate> Candidates { get; }
    DbSet<CandidateEducation> CandidateEducations { get; }
    DbSet<CandidateExperience> CandidateExperiences { get; }
    DbSet<CommitteeMember> CommitteeMembers { get; }
    DbSet<ManpowerSelection> ManpowerSelections { get; }
    DbSet<FellowshipClaim> FellowshipClaims { get; }
    DbSet<LeaveRequest> LeaveRequests { get; }
    DbSet<LeaveCancellationRequest> LeaveCancellationRequests { get; }
    DbSet<LeaveEntitlement> LeaveEntitlements { get; }
    DbSet<FacultyProfile> FacultyProfiles { get; }
    DbSet<FacultyUser> FacultyUsers { get; }
    DbSet<NewsEvent> NewsEvents { get; }
    DbSet<NewsImage> NewsImages { get; }
    DbSet<Announcement> Announcements { get; }
    DbSet<OfferLetter> OfferLetters { get; }
    DbSet<NocRequest> NocRequests { get; }
    DbSet<ExperienceCertificateRequest> ExperienceCertificateRequests { get; }
    DbSet<MedicalFacilityRequest> MedicalFacilityRequests { get; }
    DbSet<IdCardRequest> IdCardRequests { get; }
    DbSet<PaymentVoucher> PaymentVouchers { get; }
    DbSet<PaymentVoucherItem> PaymentVoucherItems { get; }
    DbSet<PaymentVoucherAccountDetails> PaymentVoucherAccountDetails { get; }
    DbSet<Noting> Notings { get; }
    DbSet<NotingItem> NotingItems { get; }
    DbSet<BudgetReappropriationLog> BudgetReappropriationLogs { get; }
    DbSet<ProjectDaAssignmentLog> ProjectDaAssignmentLogs { get; }
    DbSet<ReappropriationRequest> ReappropriationRequests { get; }
    DbSet<ReappropriationSourceLine> ReappropriationSourceLines { get; }
    DbSet<ReappropriationDestinationLine> ReappropriationDestinationLines { get; }
    DbSet<FundingAgency> FundingAgencies { get; }
    DbSet<ApplicationUser> Users { get; }
    DbSet<AdvertisementTemplate> AdvertisementTemplates { get; }
    DbSet<AdvertisementTemplateSection> AdvertisementTemplateSections { get; }
    DbSet<AdvertisementBodyTemplate> AdvertisementBodyTemplates { get; }
    DbSet<EmailTemplate> EmailTemplates { get; }
    DbSet<EmailLog> EmailLogs { get; }



    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
