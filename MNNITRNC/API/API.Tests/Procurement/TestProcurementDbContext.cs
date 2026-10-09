using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using DomainNoting = API.Domain.Entities.Noting;

namespace API.Tests.Procurement;

public class TestProcurementDbContext(DbContextOptions<TestProcurementDbContext> options)
    : DbContext(options), IApplicationDbContext
{
    public DbSet<WorkflowInstance> WorkflowInstances => Set<WorkflowInstance>();
    public DbSet<WorkflowStep> WorkflowSteps => Set<WorkflowStep>();
    public DbSet<WorkflowQuery> WorkflowQueries => Set<WorkflowQuery>();
    public DbSet<WorkflowDefinition> WorkflowDefinitions => Set<WorkflowDefinition>();
    public DbSet<ResearchProposal> ResearchProposals => Set<ResearchProposal>();
    public DbSet<ProposalBudgetLine> ProposalBudgetLines => Set<ProposalBudgetLine>();
    public DbSet<ProposalEquipment> ProposalEquipment => Set<ProposalEquipment>();
    public DbSet<ProposalManpowerPosition> ProposalManpowerPositions => Set<ProposalManpowerPosition>();
    public DbSet<ProposalCoPi> ProposalCoPis => Set<ProposalCoPi>();
    public DbSet<WorkflowStageDefinition> WorkflowStageDefinitions => Set<WorkflowStageDefinition>();
    public DbSet<Module> Modules => Set<Module>();
    public DbSet<Page> Pages => Set<Page>();
    public DbSet<RolePageAccess> RolePageAccess => Set<RolePageAccess>();
    public DbSet<UserPageGrant> UserPageGrants => Set<UserPageGrant>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Collaborator> Collaborators => Set<Collaborator>();
    public DbSet<BudgetHead> BudgetHeads => Set<BudgetHead>();
    public DbSet<SanctionedEquipment> SanctionedEquipment => Set<SanctionedEquipment>();
    public DbSet<SanctionedManpowerPosition> SanctionedManpowerPositions => Set<SanctionedManpowerPosition>();
    public DbSet<GrantReceipt> GrantReceipts => Set<GrantReceipt>();
    public DbSet<Expenditure> Expenditure => Set<Expenditure>();
    public DbSet<Refund> Refunds => Set<Refund>();
    public DbSet<HistoricalExpenditure> HistoricalExpenditures => Set<HistoricalExpenditure>();
    public DbSet<HistoricalGrantReceipt> HistoricalGrantReceipts => Set<HistoricalGrantReceipt>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ConsumableIndent> ConsumableIndents => Set<ConsumableIndent>();
    public DbSet<ContingencyIndent> ContingencyIndents => Set<ContingencyIndent>();
    public DbSet<EquipmentIndent> EquipmentIndents => Set<EquipmentIndent>();
    public DbSet<Indent> Indents => Set<Indent>();
    public DbSet<IndentBudgetHeadAllocation> IndentBudgetHeadAllocations => Set<IndentBudgetHeadAllocation>();
    public DbSet<IndentItem> IndentItems => Set<IndentItem>();
    public DbSet<ProcurementCommittee> ProcurementCommittees => Set<ProcurementCommittee>();
    public DbSet<MarketCommitteeProcess> MarketCommitteeProcesses => Set<MarketCommitteeProcess>();
    public DbSet<ProcurementCommitteeMember> ProcurementCommitteeMembers => Set<ProcurementCommitteeMember>();
    public DbSet<DocumentChecklistItem> DocumentChecklistItems => Set<DocumentChecklistItem>();
    public DbSet<TravelRequest> TravelRequests => Set<TravelRequest>();
    public DbSet<TravelRequestBudgetHeadAllocation> TravelRequestBudgetHeadAllocations => Set<TravelRequestBudgetHeadAllocation>();
    public DbSet<TravelJourneyLeg> TravelJourneyLegs => Set<TravelJourneyLeg>();
    public DbSet<RecruitmentRequest> RecruitmentRequests => Set<RecruitmentRequest>();
    public DbSet<Advertisement> Advertisements => Set<Advertisement>();
    public DbSet<Candidate> Candidates => Set<Candidate>();
    public DbSet<CandidateEducation> CandidateEducations => Set<CandidateEducation>();
    public DbSet<CandidateExperience> CandidateExperiences => Set<CandidateExperience>();
    public DbSet<CommitteeMember> CommitteeMembers => Set<CommitteeMember>();
    public DbSet<ManpowerSelection> ManpowerSelections => Set<ManpowerSelection>();
    public DbSet<OfferLetter> OfferLetters => Set<OfferLetter>();
    public DbSet<FacultyProfile> FacultyProfiles => Set<FacultyProfile>();
    public DbSet<FacultyUser> FacultyUsers => Set<FacultyUser>();
    public DbSet<NewsEvent> NewsEvents => Set<NewsEvent>();
    public DbSet<NewsImage> NewsImages => Set<NewsImage>();
    public DbSet<FellowshipClaim> FellowshipClaims => Set<FellowshipClaim>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<LeaveCancellationRequest> LeaveCancellationRequests => Set<LeaveCancellationRequest>();
    public DbSet<LeaveEntitlement> LeaveEntitlements => Set<LeaveEntitlement>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<NocRequest> NocRequests => Set<NocRequest>();
    public DbSet<ExperienceCertificateRequest> ExperienceCertificateRequests => Set<ExperienceCertificateRequest>();
    public DbSet<MedicalFacilityRequest> MedicalFacilityRequests => Set<MedicalFacilityRequest>();
    public DbSet<IdCardRequest> IdCardRequests => Set<IdCardRequest>();
    public DbSet<PaymentVoucher> PaymentVouchers => Set<PaymentVoucher>();
    public DbSet<PaymentVoucherItem> PaymentVoucherItems => Set<PaymentVoucherItem>();
    public DbSet<PaymentVoucherAccountDetails> PaymentVoucherAccountDetails => Set<PaymentVoucherAccountDetails>();
    public DbSet<DomainNoting> Notings => Set<DomainNoting>();
    public DbSet<NotingItem> NotingItems => Set<NotingItem>();
    public DbSet<BudgetReappropriationLog> BudgetReappropriationLogs => Set<BudgetReappropriationLog>();
    public DbSet<ProjectDaAssignmentLog> ProjectDaAssignmentLogs => Set<ProjectDaAssignmentLog>();
    public DbSet<ReappropriationRequest> ReappropriationRequests => Set<ReappropriationRequest>();
    public DbSet<ReappropriationSourceLine> ReappropriationSourceLines => Set<ReappropriationSourceLine>();
    public DbSet<ReappropriationDestinationLine> ReappropriationDestinationLines => Set<ReappropriationDestinationLine>();
    public DbSet<FundingAgency> FundingAgencies => Set<FundingAgency>();
    public DbSet<ApplicationUser> Users => Set<ApplicationUser>();
    public DbSet<AdvertisementTemplate> AdvertisementTemplates => Set<AdvertisementTemplate>();
    public DbSet<AdvertisementTemplateSection> AdvertisementTemplateSections => Set<AdvertisementTemplateSection>();
    public DbSet<AdvertisementBodyTemplate> AdvertisementBodyTemplates => Set<AdvertisementBodyTemplate>();
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();
    public DbSet<EmailLog> EmailLogs => Set<EmailLog>();


    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<WorkflowInstance>(entity =>
        {
            entity.HasKey(w => w.Id);
            entity.HasMany(w => w.Steps).WithOne().HasForeignKey(s => s.WorkflowInstanceId);
        });
        builder.Entity<WorkflowStep>().HasKey(s => s.Id);
        builder.Entity<Document>().HasKey(d => d.Id);

        builder.Entity<Project>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasMany(p => p.Collaborators).WithOne().HasForeignKey(c => c.ProjectId);
            entity.HasMany(p => p.BudgetHeads).WithOne().HasForeignKey(b => b.ProjectId);
            entity.HasMany(p => p.SanctionedEquipment).WithOne().HasForeignKey(e => e.ProjectId);
            entity.HasMany(p => p.SanctionedManpowerPositions).WithOne().HasForeignKey(m => m.ProjectId);
            entity.HasMany(p => p.GrantReceipts).WithOne().HasForeignKey(g => g.ProjectId);
            entity.HasMany(p => p.HistoricalGrantReceipts).WithOne().HasForeignKey(h => h.ProjectId);
        });

        builder.Entity<ResearchProposal>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasMany(p => p.BudgetLines).WithOne().HasForeignKey(b => b.ResearchProposalId);
        });
        builder.Entity<ProposalBudgetLine>().HasKey(b => b.Id);
        builder.Entity<Collaborator>().HasKey(c => c.Id);
        builder.Entity<BudgetHead>().HasKey(b => b.Id);
        builder.Entity<SanctionedEquipment>().HasKey(e => e.Id);
        builder.Entity<SanctionedManpowerPosition>().HasKey(m => m.Id);
        builder.Entity<GrantReceipt>().HasKey(g => g.Id);
        builder.Entity<Expenditure>().HasKey(e => e.Id);
        builder.Entity<Refund>().HasKey(r => r.Id);
        builder.Entity<HistoricalExpenditure>().HasKey(h => h.Id);
        builder.Entity<AuditLog>().HasKey(a => a.Id);
        builder.Entity<ProjectDaAssignmentLog>().HasKey(l => l.Id);

        builder.Entity<ConsumableIndent>().HasKey(i => i.Id);
        builder.Entity<ContingencyIndent>().HasKey(i => i.Id);
        builder.Entity<EquipmentIndent>().HasKey(i => i.Id);
        builder.Entity<IndentBudgetHeadAllocation>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.HasIndex(a => new { a.IndentId, a.BudgetHeadId, a.SubHead }).IsUnique();
        });
        builder.Entity<ProcurementCommittee>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.HasMany(c => c.Members).WithOne().HasForeignKey(m => m.ProcurementCommitteeId);
        });
        builder.Entity<MarketCommitteeProcess>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.HasIndex(m => new { m.IndentType, m.IndentId }).IsUnique();
        });
        builder.Entity<ProcurementCommitteeMember>().HasKey(m => m.Id);
        builder.Entity<DocumentChecklistItem>().HasKey(i => i.Id);

        builder.Entity<TravelRequest>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.HasMany(t => t.Journeys).WithOne(l => l.TravelRequest!).HasForeignKey(l => l.TravelRequestId);
        });
        builder.Entity<TravelJourneyLeg>().HasKey(l => l.Id);
        builder.Entity<TravelRequestBudgetHeadAllocation>()
            .HasKey(a => new { a.TravelRequestId, a.BudgetHeadId });

        builder.Entity<RecruitmentRequest>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.HasMany(r => r.Advertisements).WithOne(a => a.RecruitmentRequest!)
                .HasForeignKey(a => a.RecruitmentRequestId);
            entity.HasMany(r => r.Candidates).WithOne(c => c.RecruitmentRequest!)
                .HasForeignKey(c => c.RecruitmentRequestId);
            entity.HasMany(r => r.CommitteeMembers).WithOne(m => m.RecruitmentRequest!)
                .HasForeignKey(m => m.RecruitmentRequestId);
        });
        builder.Entity<Advertisement>().HasKey(a => a.Id);
        builder.Entity<Candidate>().HasKey(c => c.Id);
        builder.Entity<CommitteeMember>().HasKey(m => m.Id);
        builder.Entity<ManpowerSelection>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.HasOne(s => s.Candidate).WithMany().HasForeignKey(s => s.CandidateId);
        });

        // FacultyProfile is keyed on UserId, not a conventional Id, so EF cannot
        // infer it. The other three follow the convention.
        builder.Entity<FacultyProfile>().HasKey(p => p.UserId);

        builder.Entity<FellowshipClaim>().HasKey(c => c.Id);
        builder.Entity<LeaveRequest>().HasKey(l => l.Id);
        builder.Entity<LeaveEntitlement>().HasKey(e => e.Id);

        // Composite keys, and Page's relationships. The test contexts declare
        // their own model rather than inheriting ApplicationDbContext's, so
        // anything EF cannot infer has to be repeated here.
        builder.Entity<Department>().HasKey(d => d.Id);
        builder.Entity<Module>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.HasMany(m => m.Pages).WithOne(p => p.Module).HasForeignKey(p => p.ModuleId);
        });
        builder.Entity<Page>().HasKey(p => p.Id);
        builder.Entity<RolePageAccess>().HasKey(a => new { a.RoleId, a.PageId });
        builder.Entity<UserPageGrant>().HasKey(g => new { g.UserId, g.PageId });
        builder.Entity<EmailTemplate>().HasKey(t => t.Id);
        builder.Entity<EmailLog>().HasKey(l => l.Id);

    }
}
