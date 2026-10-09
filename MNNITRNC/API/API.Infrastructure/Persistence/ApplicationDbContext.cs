using API.Application.Common;
using API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace API.Infrastructure.Persistence;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options), IApplicationDbContext
{
    public DbSet<WorkflowInstance> WorkflowInstances => Set<WorkflowInstance>();
    public DbSet<WorkflowStep> WorkflowSteps => Set<WorkflowStep>();
    public DbSet<WorkflowQuery> WorkflowQueries => Set<WorkflowQuery>();
    public DbSet<WorkflowDefinition> WorkflowDefinitions => Set<WorkflowDefinition>();
    public DbSet<ResearchProposal> ResearchProposals => Set<ResearchProposal>();
    public DbSet<ProposalBudgetLine> ProposalBudgetLines => Set<ProposalBudgetLine>();
    public DbSet<ProposalBudgetLineYear> ProposalBudgetLineYears => Set<ProposalBudgetLineYear>();
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
    public DbSet<FellowshipClaim> FellowshipClaims => Set<FellowshipClaim>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<LeaveCancellationRequest> LeaveCancellationRequests => Set<LeaveCancellationRequest>();
    public DbSet<LeaveEntitlement> LeaveEntitlements => Set<LeaveEntitlement>();
    public DbSet<DocumentChecklistItem> DocumentChecklistItems => Set<DocumentChecklistItem>();
    public DbSet<FacultyProfile> FacultyProfiles => Set<FacultyProfile>();
    public DbSet<FacultyUser> FacultyUsers => Set<FacultyUser>();
    public DbSet<NewsEvent> NewsEvents => Set<NewsEvent>();
    public DbSet<NewsImage> NewsImages => Set<NewsImage>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<OfferLetter> OfferLetters => Set<OfferLetter>();
    public DbSet<NocRequest> NocRequests => Set<NocRequest>();
    public DbSet<ExperienceCertificateRequest> ExperienceCertificateRequests => Set<ExperienceCertificateRequest>();
    public DbSet<MedicalFacilityRequest> MedicalFacilityRequests => Set<MedicalFacilityRequest>();
    public DbSet<IdCardRequest> IdCardRequests => Set<IdCardRequest>();
    public DbSet<PaymentVoucher> PaymentVouchers => Set<PaymentVoucher>();
    public DbSet<PaymentVoucherItem> PaymentVoucherItems => Set<PaymentVoucherItem>();
    public DbSet<PaymentVoucherAccountDetails> PaymentVoucherAccountDetails => Set<PaymentVoucherAccountDetails>();
    public DbSet<Noting> Notings => Set<Noting>();
    public DbSet<NotingItem> NotingItems => Set<NotingItem>();
    public DbSet<BudgetReappropriationLog> BudgetReappropriationLogs => Set<BudgetReappropriationLog>();
    public DbSet<ProjectDaAssignmentLog> ProjectDaAssignmentLogs => Set<ProjectDaAssignmentLog>();
    public DbSet<ReappropriationRequest> ReappropriationRequests => Set<ReappropriationRequest>();
    public DbSet<ReappropriationSourceLine> ReappropriationSourceLines => Set<ReappropriationSourceLine>();
    public DbSet<ReappropriationDestinationLine> ReappropriationDestinationLines => Set<ReappropriationDestinationLine>();
    public DbSet<FundingAgency> FundingAgencies => Set<FundingAgency>();
    public DbSet<AdvertisementTemplate> AdvertisementTemplates => Set<AdvertisementTemplate>();
    public DbSet<AdvertisementTemplateSection> AdvertisementTemplateSections => Set<AdvertisementTemplateSection>();
    public DbSet<AdvertisementBodyTemplate> AdvertisementBodyTemplates => Set<AdvertisementBodyTemplate>();
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();
    public DbSet<EmailLog> EmailLogs => Set<EmailLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<PaymentVoucherAccountDetails>(entity =>
        {
            entity.ToTable("PaymentVoucherAccountDetails");
            entity.HasKey(e => e.Id);
        });

        builder.Entity<BudgetReappropriationLog>(entity =>
        {
            entity.ToTable("budgetreappropriationlogs");
            entity.HasKey(l => l.Id);
            entity.HasIndex(l => l.ProjectId);
            entity.Property(l => l.FromHeadName).HasMaxLength(255).IsRequired();
            entity.Property(l => l.ToHeadName).HasMaxLength(255).IsRequired();
            entity.Property(l => l.Amount).HasColumnType("decimal(18,2)").IsRequired();
            entity.Property(l => l.Reason).HasMaxLength(1000).IsRequired();
        });

        builder.Entity<ProjectDaAssignmentLog>(entity =>
        {
            entity.ToTable("projectdaassignmentlogs");
            entity.HasKey(l => l.Id);
            entity.HasIndex(l => l.ProjectId);
            entity.Property(l => l.FromUserName).HasMaxLength(255);
            entity.Property(l => l.ToUserName).HasMaxLength(255).IsRequired();
            entity.Property(l => l.Reason).HasMaxLength(1000).IsRequired();
        });

        builder.Entity<ReappropriationRequest>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.HasIndex(r => r.ProjectId);
            entity.HasIndex(r => r.WorkflowInstanceId);
            entity.Property(r => r.Reason).HasMaxLength(1000).IsRequired();

            entity.HasMany(r => r.SourceLines)
                .WithOne()
                .HasForeignKey(l => l.ReappropriationRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(r => r.DestinationLines)
                .WithOne()
                .HasForeignKey(l => l.ReappropriationRequestId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ReappropriationSourceLine>(entity =>
        {
            entity.HasKey(l => l.Id);
            entity.HasIndex(l => l.ReappropriationRequestId);
            entity.HasIndex(l => l.BudgetHeadId);
            entity.Property(l => l.HeadName).HasMaxLength(255).IsRequired();
            entity.Property(l => l.Amount).HasColumnType("decimal(18,2)").IsRequired();
        });

        builder.Entity<ReappropriationDestinationLine>(entity =>
        {
            entity.HasKey(l => l.Id);
            entity.HasIndex(l => l.ReappropriationRequestId);
            entity.HasIndex(l => l.BudgetHeadId);
            entity.Property(l => l.HeadName).HasMaxLength(255).IsRequired();
            entity.Property(l => l.Amount).HasColumnType("decimal(18,2)").IsRequired();
        });

        builder.Entity<Noting>(entity =>
        {
            entity.ToTable("notings");
            entity.HasKey(n => n.Id);
            entity.Property(n => n.FundedAgency).HasMaxLength(255).IsRequired();
            entity.Property(n => n.ProjectTitle).HasMaxLength(1000).IsRequired();
            entity.Property(n => n.ProjectNo).HasMaxLength(255).IsRequired();
            entity.Property(n => n.Status).HasMaxLength(50).IsRequired();

            entity.HasMany(n => n.Items)
                  .WithOne(i => i.Noting!)
                  .HasForeignKey(i => i.NotingId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<NotingItem>(entity =>
        {
            entity.ToTable("notingitems");
            entity.HasKey(i => i.Id);
            entity.Property(i => i.NameOfItem).HasMaxLength(1000).IsRequired();
            entity.Property(i => i.IndentNoAndDate).HasMaxLength(255).IsRequired();
            entity.Property(i => i.BudgetHeadAndBalance).HasMaxLength(255).IsRequired();
            entity.Property(i => i.IndentAmount).HasMaxLength(100).IsRequired();
            entity.Property(i => i.ModeOfPurchase).HasMaxLength(255).IsRequired();
        });

        builder.Entity<IdCardRequest>(entity =>
        {
            entity.ToTable("idcardrequests");
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.StudentUserId);
            entity.HasIndex(i => i.DepartmentId);
        });

        builder.Entity<NocRequest>(entity =>
        {
            entity.ToTable("nocrequests");
            entity.HasKey(n => n.Id);
            entity.HasIndex(n => n.StudentUserId);
            entity.HasIndex(n => n.DepartmentId);
        });

        builder.Entity<ExperienceCertificateRequest>(entity =>
        {
            entity.ToTable("fellow_experience_certificates");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.StudentUserId);
            entity.HasIndex(e => e.DepartmentId);
        });

        builder.Entity<MedicalFacilityRequest>(entity =>
        {
            entity.ToTable("medicalfacilityrequests");
            entity.HasKey(m => m.Id);
            entity.HasIndex(m => m.StudentUserId);
            entity.HasIndex(m => m.DepartmentId);
        });

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.ToTable("Users");

            // Explicit SQL default. The C# initializer only applies to objects
            // this process constructs, so without this a migration adding the
            // column backfills existing rows as false -- which, combined with the
            // IsActive check on login, would lock out every existing user.
            entity.Property(u => u.IsActive).HasDefaultValue(true);

            entity.Property(u => u.ExternalSourceSystem).HasMaxLength(32);
            entity.Property(u => u.ExternalUserId).HasMaxLength(64);

            // Not a unique constraint: both columns are nullable, and MySQL has
            // no native filtered/partial unique index, so "one RNC account per
            // (source, external id)" is enforced in the provisioning service
            // instead (a SELECT ... FOR UPDATE before insert). This index exists
            // to make that lookup, and the federated-login lookup, fast.
            entity.HasIndex(u => new { u.ExternalSourceSystem, u.ExternalUserId });
        });
        builder.Entity<IdentityRole<Guid>>().ToTable("Roles");
        builder.Entity<IdentityUserRole<Guid>>().ToTable("UserRoles");
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("UserClaims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("UserLogins");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("UserTokens");
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("RoleClaims");

        builder.Entity<WorkflowInstance>(entity =>
        {
            entity.HasKey(w => w.Id);
            entity.HasMany(w => w.Steps)
                .WithOne()
                .HasForeignKey(s => s.WorkflowInstanceId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(w => new { w.RequestType, w.RequestId });
        });

        builder.Entity<WorkflowStep>(entity =>
        {
            entity.HasKey(s => s.Id);
        });

        builder.Entity<WorkflowQuery>(entity =>
        {
            entity.HasKey(q => q.Id);
            entity.HasIndex(q => q.WorkflowInstanceId);
        });

        builder.Entity<WorkflowDefinition>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.Property(d => d.Name).HasMaxLength(200).IsRequired();

            // One route per request type and phase. Unique rather than merely
            // indexed: two definitions for the same pair would leave the engine
            // choosing arbitrarily between them.
            entity.HasIndex(d => new { d.RequestType, d.Phase }).IsUnique();

            entity.HasMany(d => d.Stages)
                .WithOne(s => s.Definition)
                .HasForeignKey(s => s.WorkflowDefinitionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WorkflowStageDefinition>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.AllowedRoles).HasMaxLength(400).IsRequired();

            // Forwarding resolves the next stage by Sequence + 1, so a duplicate
            // sequence within one definition would make the next step ambiguous.
            entity.HasIndex(s => new { s.WorkflowDefinitionId, s.Sequence }).IsUnique();
        });

        builder.Entity<Department>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.Property(d => d.Code).HasMaxLength(20).IsRequired();
            entity.Property(d => d.Name).HasMaxLength(200).IsRequired();
            entity.HasIndex(d => d.Code).IsUnique();
        });

        builder.Entity<Module>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Key).HasMaxLength(100).IsRequired();
            entity.Property(m => m.Name).HasMaxLength(200).IsRequired();
            entity.Property(m => m.Group).HasMaxLength(50).IsRequired();

            // Key is the identity permissions are written against, so a
            // duplicate would make "which module is this" ambiguous.
            entity.HasIndex(m => m.Key).IsUnique();

            entity.HasMany(m => m.Pages)
                .WithOne(p => p.Module)
                .HasForeignKey(p => p.ModuleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Page>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Key).HasMaxLength(100).IsRequired();
            entity.Property(p => p.Name).HasMaxLength(200).IsRequired();
            entity.Property(p => p.Route).HasMaxLength(300).IsRequired();
            entity.HasIndex(p => p.Key).IsUnique();

            // The route guard resolves a browser location to a page, so two
            // pages claiming one route would make access non-deterministic.
            entity.HasIndex(p => p.Route).IsUnique();
        });

        builder.Entity<RolePageAccess>(entity =>
        {
            // One row per (role, page): the scope lives on the row, so a second
            // row for the same pair would be two answers to one question.
            entity.HasKey(a => new { a.RoleId, a.PageId });

            entity.HasOne(a => a.Page)
                .WithMany()
                .HasForeignKey(a => a.PageId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<UserPageGrant>(entity =>
        {
            entity.HasKey(g => new { g.UserId, g.PageId });
            entity.Property(g => g.Reason).HasMaxLength(500).IsRequired();

            entity.HasOne(g => g.Page)
                .WithMany()
                .HasForeignKey(g => g.PageId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Document>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.HasIndex(d => new { d.OwnerType, d.OwnerId });
        });

        builder.Entity<Project>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasIndex(p => p.OwnerUserId);
            entity.HasIndex(p => p.WorkflowInstanceId);
            entity.HasMany(p => p.Collaborators)
                .WithOne()
                .HasForeignKey(c => c.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.BudgetHeads)
                .WithOne()
                .HasForeignKey(b => b.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.SanctionedEquipment)
                .WithOne()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.SanctionedManpowerPositions)
                .WithOne()
                .HasForeignKey(m => m.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.GrantReceipts)
                .WithOne()
                .HasForeignKey(g => g.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.BudgetReappropriationLogs)
                .WithOne()
                .HasForeignKey(l => l.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.DaAssignmentLogs)
                .WithOne()
                .HasForeignKey(l => l.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(p => p.ReappropriationRequests)
                .WithOne(r => r.Project)
                .HasForeignKey(r => r.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Collaborator>(entity =>
        {
            entity.HasKey(c => c.Id);
        });

        builder.Entity<ResearchProposal>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasIndex(p => p.OwnerUserId);
            entity.HasIndex(p => p.DepartmentId);
            entity.Property(p => p.ConcurrencyVersion).IsConcurrencyToken();

            // The FK the HOD's department-scoped queue filters on; queried by
            // every listing that shows a PI their own proposals or an HOD their
            // department's, so both need an index rather than a table scan.
            entity.HasMany(p => p.BudgetLines)
                .WithOne()
                .HasForeignKey(b => b.ResearchProposalId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(p => p.Equipment)
                .WithOne()
                .HasForeignKey(e => e.ResearchProposalId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(p => p.Manpower)
                .WithOne()
                .HasForeignKey(m => m.ResearchProposalId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(p => p.CoPis)
                .WithOne()
                .HasForeignKey(c => c.ResearchProposalId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ProposalBudgetLine>(entity =>
        {
            entity.HasKey(b => b.Id);

            // One row per (head, custom label) per proposal. Every head except
            // Other always has CustomLabel = null, so this still enforces "one
            // row per head" for them (MySQL treats NULL as distinct per row in
            // a unique index) -- but two Other rows are now valid as long as
            // their labels differ.
            entity.HasIndex(b => new { b.ResearchProposalId, b.HeadName, b.CustomLabel }).IsUnique();

            entity.HasMany(b => b.Years)
                .WithOne()
                .HasForeignKey(y => y.ProposalBudgetLineId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ProposalBudgetLineYear>(entity =>
        {
            entity.HasKey(y => y.Id);
            entity.HasIndex(y => new { y.ProposalBudgetLineId, y.Year }).IsUnique();
        });

        builder.Entity<ProposalEquipment>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        builder.Entity<ProposalManpowerPosition>(entity =>
        {
            entity.HasKey(m => m.Id);

            entity.HasMany(m => m.Years)
                .WithOne()
                .HasForeignKey(y => y.ProposalManpowerPositionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ProposalManpowerPositionYear>(entity =>
        {
            entity.HasKey(y => y.Id);
            entity.HasIndex(y => new { y.ProposalManpowerPositionId, y.Year }).IsUnique();
        });

        builder.Entity<ProposalCoPi>(entity =>
        {
            entity.HasKey(c => c.Id);
        });

        builder.Entity<BudgetHead>(entity =>
        {
            entity.HasKey(b => b.Id);

            // Same reasoning as ProposalBudgetLine above -- a Project's BudgetHead
            // rows are what a sanctioned Proposal's budget lines become
            // (ResearchProposalService.RecordSanctionAsync), so this index must
            // accept the same multi-Other shape or sanction fails for a proposal
            // that already passed its own (now-widened) check.
            entity.HasIndex(b => new { b.ProjectId, b.HeadName, b.CustomLabel }).IsUnique();
        });

        builder.Entity<SanctionedEquipment>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        builder.Entity<SanctionedManpowerPosition>(entity =>
        {
            entity.HasKey(m => m.Id);
        });

        builder.Entity<GrantReceipt>(entity =>
        {
            entity.HasKey(g => g.Id);
            entity.HasIndex(g => g.BudgetHeadId);
            entity.HasOne<GrantReceipt>()
                .WithMany()
                .HasForeignKey(g => g.ParentReceiptId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Expenditure>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.ProjectId);
            entity.HasIndex(e => e.BudgetHeadId);
        });

        builder.Entity<Refund>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.HasIndex(r => r.ProjectId);
            entity.Property(r => r.Reason).HasMaxLength(1000).IsRequired();
        });

        builder.Entity<HistoricalExpenditure>(entity =>
        {
            entity.HasKey(h => h.Id);
            entity.HasIndex(h => h.ProjectId);
            entity.HasIndex(h => h.BudgetHeadId);
            entity.Property(h => h.Description).HasMaxLength(1000).IsRequired();
        });

        builder.Entity<HistoricalGrantReceipt>(entity =>
        {
            entity.HasKey(h => h.Id);
            entity.HasIndex(h => h.ProjectId);
            entity.HasIndex(h => h.BudgetHeadId);
            entity.Property(h => h.Remarks).HasMaxLength(1000);

            entity.HasOne<Project>()
                .WithMany(p => p.HistoricalGrantReceipts)
                .HasForeignKey(h => h.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.EntityType).HasMaxLength(100).IsRequired();
            entity.Property(a => a.Action).HasMaxLength(100).IsRequired();
            entity.HasIndex(a => new { a.EntityType, a.EntityId });
            entity.HasIndex(a => a.Timestamp);
        });

        builder.Entity<ConsumableIndent>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.ProjectId);
            entity.HasIndex(i => i.BudgetHeadId);
            entity.HasIndex(i => i.WorkflowInstanceId);
            entity.Property(i => i.EstimatedCost).HasColumnType("decimal(18,2)");
            entity.Property(i => i.BillAmount).HasColumnType("decimal(18,2)");
            entity.Property(i => i.MiscellaneousExpenditure).HasColumnType("decimal(18,2)");
        });

        builder.Entity<ContingencyIndent>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.ProjectId);
            entity.HasIndex(i => i.BudgetHeadId);
            entity.HasIndex(i => i.WorkflowInstanceId);
            entity.Property(i => i.EstimatedCost).HasColumnType("decimal(18,2)");
            entity.Property(i => i.BillAmount).HasColumnType("decimal(18,2)");
            entity.Property(i => i.MiscellaneousExpenditure).HasColumnType("decimal(18,2)");
        });

        builder.Entity<EquipmentIndent>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.ProjectId);
            entity.HasIndex(i => i.BudgetHeadId);
            entity.HasIndex(i => i.WorkflowInstanceId);
            entity.HasIndex(i => i.SanctionedEquipmentId);
            entity.Property(i => i.EstimatedCost).HasColumnType("decimal(18,2)");
            entity.Property(i => i.BillAmount).HasColumnType("decimal(18,2)");
            entity.Property(i => i.MiscellaneousExpenditure).HasColumnType("decimal(18,2)");
            entity.HasOne<SanctionedEquipment>()
                .WithMany()
                .HasForeignKey(i => i.SanctionedEquipmentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // New unified dynamic indent tables.
        builder.Entity<Indent>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.IndentNumber).IsUnique();
            entity.HasIndex(i => i.ProjectId);
            entity.HasIndex(i => i.BudgetHeadId);
            entity.HasIndex(i => i.WorkflowInstanceId);
            entity.HasIndex(i => i.OwnerUserId);
            entity.Property(i => i.BillAmount).HasColumnType("decimal(18,2)");
            entity.Property(i => i.MiscellaneousExpenditure).HasColumnType("decimal(18,2)");
            entity.HasMany(i => i.Items)
                .WithOne(item => item.Indent)
                .HasForeignKey(item => item.IndentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<IndentBudgetHeadAllocation>(entity =>
        {
            entity.ToTable("IndentBudgetHeadAllocations");
            entity.HasKey(a => a.Id);
            entity.HasIndex(a => a.IndentId);
            entity.HasIndex(a => a.BudgetHeadId);
            entity.HasIndex(a => new { a.IndentId, a.BudgetHeadId, a.SubHead }).IsUnique();
            entity.Property(a => a.CommittedAmount).HasPrecision(18, 2);
            entity.HasOne(a => a.Indent)
                .WithMany(i => i.Allocations)
                .HasForeignKey(a => a.IndentId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(a => a.BudgetHead)
                .WithMany()
                .HasForeignKey(a => a.BudgetHeadId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<IndentItem>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.IndentId);
            entity.Property(i => i.EstimatedCostInclTax).HasColumnType("decimal(18,2)");
        });

        builder.Entity<ProcurementCommittee>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.HasIndex(c => new { c.IndentType, c.IndentId });
            entity.HasMany(c => c.Members)
                .WithOne()
                .HasForeignKey(m => m.ProcurementCommitteeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<MarketCommitteeProcess>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.HasIndex(m => new { m.IndentType, m.IndentId }).IsUnique();
        });

        builder.Entity<ProcurementCommitteeMember>(entity =>
        {
            entity.HasKey(m => m.Id);
        });

        builder.Entity<DocumentChecklistItem>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => new { i.RequestType, i.Phase });
        });

        builder.Entity<TravelRequest>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.HasIndex(t => t.ProjectId);
            entity.HasIndex(t => t.BudgetHeadId);
            entity.HasIndex(t => t.WorkflowInstanceId);

            // Legacy cascade-deleted the legs with their request
            // (travel_journey_details_ibfk_1, ON DELETE CASCADE).
            entity.HasMany(t => t.Journeys)
                .WithOne(l => l.TravelRequest!)
                .HasForeignKey(l => l.TravelRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(t => t.Allocations)
                .WithOne(a => a.TravelRequest!)
                .HasForeignKey(a => a.TravelRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            // Restrict, not Cascade: deleting a sanctioned position must not
            // silently erase the travel history charged against it.
            entity.HasOne<SanctionedManpowerPosition>()
                .WithMany()
                .HasForeignKey(t => t.ManpowerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<TravelRequestBudgetHeadAllocation>(entity =>
        {
            entity.ToTable("TravelRequestBudgetHeadAllocations");
            entity.HasKey(a => new { a.TravelRequestId, a.BudgetHeadId });
            entity.HasIndex(a => a.TravelRequestId);
            entity.HasIndex(a => a.BudgetHeadId);
            entity.Property(a => a.CommittedAmount).HasPrecision(18, 2);
        });

        builder.Entity<TravelJourneyLeg>(entity =>
        {
            entity.HasKey(l => l.Id);
            entity.HasIndex(l => l.TravelRequestId);
        });

        builder.Entity<RecruitmentRequest>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.HasIndex(r => r.ProjectId);
            entity.HasIndex(r => r.SanctionedManpowerPositionId);

            entity.HasMany(r => r.Advertisements)
                .WithOne(a => a.RecruitmentRequest!)
                .HasForeignKey(a => a.RecruitmentRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(r => r.Candidates)
                .WithOne(c => c.RecruitmentRequest!)
                .HasForeignKey(c => c.RecruitmentRequestId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(r => r.CommitteeMembers)
                .WithOne(m => m.RecruitmentRequest!)
                .HasForeignKey(m => m.RecruitmentRequestId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Advertisement>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.HasIndex(a => new { a.RecruitmentRequestId, a.Round }).IsUnique();
        });

        builder.Entity<Candidate>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.HasIndex(c => c.ApplicationUserId);
            // One live application per person per drive; enforced in the service
            // too, since a rejected application may legitimately be followed by a
            // fresh one on a re-advertised round.
            entity.HasIndex(c => new { c.RecruitmentRequestId, c.ApplicationUserId });

            // The application's academic and work rows are part of the
            // application, not records in their own right: an orphaned row
            // would belong to no application at all.
            entity.HasMany(c => c.Education)
                .WithOne(e => e.Candidate!)
                .HasForeignKey(e => e.CandidateId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(c => c.Experiences)
                .WithOne(e => e.Candidate!)
                .HasForeignKey(e => e.CandidateId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<CandidateEducation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.CandidateId);
        });

        builder.Entity<CandidateExperience>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.CandidateId);
        });

        builder.Entity<CommitteeMember>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.HasIndex(m => new { m.RecruitmentRequestId, m.Kind });
        });

        builder.Entity<FundingAgency>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.Name).HasMaxLength(255).IsRequired();
        });

        builder.Entity<ManpowerSelection>(entity =>
        {
            // "FellowAppointments", not the default "ManpowerSelections": MySQL on
            // Windows matches table names case-insensitively, so the default
            // collides with the legacy manpower_selections table imported into
            // this database. The name also describes the row better -- it is the
            // fellow's appointment, not the act of selecting them.
            entity.ToTable("FellowAppointments");
            entity.HasKey(s => s.Id);
            entity.HasIndex(s => s.ApplicationUserId).IsUnique();
            entity.HasIndex(s => s.CandidateId).IsUnique();
            entity.HasIndex(s => s.SanctionedManpowerPositionId);

            entity.HasOne(s => s.Candidate)
                .WithMany()
                .HasForeignKey(s => s.CandidateId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<FellowshipClaim>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.HasIndex(c => c.WorkflowInstanceId);

            // A fellow cannot claim the same month twice. Enforced in the
            // database as well as the service, since a duplicate here means
            // paying someone twice.
            entity.HasIndex(c => new { c.FellowAppointmentId, c.ClaimYear, c.ClaimMonth })
                .IsUnique();

            // ClaimPeriod and ClaimType columns are ignored in EF mapping to prevent EF Core from querying missing columns on DB
            entity.Ignore(c => c.ClaimPeriod);
            entity.Ignore(c => c.ClaimType);
        });

        builder.Entity<LeaveRequest>(entity =>
        {
            entity.HasKey(l => l.Id);
            entity.HasIndex(l => l.FellowAppointmentId);
            entity.HasIndex(l => l.WorkflowInstanceId);
        });

        builder.Entity<LeaveCancellationRequest>(entity =>
        {
            entity.HasKey(l => l.Id);
            entity.HasIndex(l => l.LeaveRequestId);
            entity.HasIndex(l => l.WorkflowInstanceId);
            entity.HasOne(l => l.LeaveRequest)
                .WithMany()
                .HasForeignKey(l => l.LeaveRequestId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<LeaveEntitlement>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.FellowAppointmentId, e.LeaveType, e.ProjectYear })
                .IsUnique();
        });

        builder.Entity<FacultyProfile>(entity =>
        {
            entity.ToTable("faculty_profiles");
            entity.HasKey(p => p.UserId);
            // Lengths mirror the raw CREATE TABLE these entities were first built
            // against, so the generated migration matches the existing tables.
            entity.Property(p => p.UserId).HasColumnName("user_id").HasMaxLength(50).ValueGeneratedNever();
            entity.Property(p => p.Name).HasColumnName("name").HasMaxLength(100);
            entity.Property(p => p.Department).HasColumnName("department").HasMaxLength(100);
            entity.Property(p => p.Designation).HasColumnName("designation").HasMaxLength(100);
            entity.Property(p => p.Gender).HasColumnName("gender").HasMaxLength(20);
            entity.Property(p => p.Qualification).HasColumnName("qualification").HasMaxLength(100);
            entity.Property(p => p.JoiningDate).HasColumnName("joining_date");
            entity.Property(p => p.ResearchArea).HasColumnName("research_area").HasColumnType("text");
            entity.Property(p => p.Photo).HasColumnName("photo").HasMaxLength(255);
            entity.Property(p => p.Email).HasColumnName("email").HasMaxLength(255);
            entity.Property(p => p.ApplicationUserId).HasColumnName("application_user_id");
            entity.HasIndex(p => p.ApplicationUserId).IsUnique();
        });

        builder.Entity<FacultyUser>(entity =>
        {
            entity.ToTable("faculty_users");
            entity.HasKey(u => u.Id);
            entity.Property(u => u.Id).HasColumnName("id").ValueGeneratedOnAdd();
            // Lengths mirror the raw CREATE TABLE these entities were first built
            // against, so the generated migration matches the existing tables.
            entity.Property(u => u.UserId).HasColumnName("user_id").HasMaxLength(50);
            entity.Property(u => u.Password).HasColumnName("password").HasMaxLength(255);
            entity.Property(u => u.Name).HasColumnName("name").HasMaxLength(100);
            entity.HasIndex(u => u.UserId).IsUnique();
        });

        builder.Entity<NewsEvent>(entity =>
        {
            entity.ToTable("news_events");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.Title).HasColumnName("title").IsRequired();
            entity.Property(e => e.Content).HasColumnName("content").IsRequired();
            entity.Property(e => e.ImagePath).HasColumnName("image_path");
            entity.Property(e => e.EventDate).HasColumnName("event_date");
            entity.Property(e => e.Type).HasColumnName("type").IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasMany(e => e.Images)
                  .WithOne(i => i.NewsEvent)
                  .HasForeignKey(i => i.NewsId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<NewsImage>(entity =>
        {
            entity.ToTable("news_images");
            entity.HasKey(i => i.Id);
            entity.Property(i => i.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(i => i.NewsId).HasColumnName("news_id");
            entity.Property(i => i.ImagePath).HasColumnName("image_path").IsRequired();
            entity.Property(i => i.IsTitle).HasColumnName("is_title");
            entity.Property(i => i.CreatedAt).HasColumnName("created_at");
        });

        builder.Entity<Announcement>(entity =>
        {
            entity.ToTable("announcements");
            entity.HasKey(a => a.Id);
            entity.Property(a => a.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(a => a.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
            entity.Property(a => a.Description).HasColumnName("description");
            entity.Property(a => a.Category).HasColumnName("category").HasMaxLength(50).IsRequired();
            entity.Property(a => a.StartDate).HasColumnName("start_date");
            entity.Property(a => a.EndDate).HasColumnName("end_date");
            entity.Property(a => a.FundingAmount).HasColumnName("funding_amount").HasColumnType("decimal(15,2)");
            entity.Property(a => a.PdfPath).HasColumnName("pdf_path").HasMaxLength(255);
            entity.Property(a => a.ExternalLink).HasColumnName("external_link").HasMaxLength(255);
            entity.Property(a => a.Status).HasColumnName("status").HasMaxLength(50).IsRequired();
            entity.Property(a => a.CreatedBy).HasColumnName("created_by");
            // Set in C# (the entity initialises both to DateTime.UtcNow, and the
            // service stamps UpdatedAt on edit). ValueGeneratedOnAdd /
            // OnAddOrUpdate said the database produces them, which made Pomelo
            // emit an identity strategy on created_at and a computed column with
            // no expression on updated_at -- and told EF to ignore the values the
            // application had just assigned.
            entity.Property(a => a.CreatedAt).HasColumnName("created_at");
            entity.Property(a => a.UpdatedAt).HasColumnName("updated_at");
        });

        builder.Entity<OfferLetter>(entity =>
        {
            entity.ToTable("offer_letters");
            entity.HasKey(o => o.Id);
            entity.Property(o => o.Id).HasColumnName("id");
            entity.Property(o => o.ProjectId).HasColumnName("project_id").IsRequired();
            entity.Property(o => o.ManpowerId).HasColumnName("manpower_id").IsRequired();
            entity.Property(o => o.CandidateName).HasColumnName("candidate_name").HasMaxLength(255).IsRequired();
            entity.Property(o => o.Gender).HasColumnName("gender").HasMaxLength(50).IsRequired();
            entity.Property(o => o.ParentName).HasColumnName("parent_name").HasMaxLength(255).IsRequired();
            entity.Property(o => o.Address).HasColumnName("address").IsRequired();
            entity.Property(o => o.City).HasColumnName("city").HasMaxLength(100).IsRequired();
            entity.Property(o => o.State).HasColumnName("state").HasMaxLength(100).IsRequired();
            entity.Property(o => o.Pincode).HasColumnName("pincode").HasMaxLength(20).IsRequired();
            entity.Property(o => o.FellowshipAmount).HasColumnName("fellowship_amount").HasColumnType("decimal(18,2)").IsRequired();
            entity.Property(o => o.HraPercentage).HasColumnName("hra_percentage").HasColumnType("decimal(5,2)").IsRequired();
            entity.Property(o => o.JoiningDate).HasColumnName("joining_date").IsRequired();
            entity.Property(o => o.FilePath).HasColumnName("file_path").HasMaxLength(500);
            entity.Property(o => o.GeneratedBy).HasColumnName("generated_by");
            entity.Property(o => o.GeneratedAt).HasColumnName("generated_at").IsRequired();
        });

        builder.Entity<PaymentVoucher>(entity =>
        {
            entity.ToTable("paymentvouchers");
            entity.HasKey(p => p.Id);
            entity.Property(p => p.VoucherNo).HasMaxLength(100).IsRequired();
            entity.Property(p => p.VoucherType).HasMaxLength(50).IsRequired();
            entity.Property(p => p.TaxableAmount).HasColumnType("decimal(18,2)");
            entity.Property(p => p.PayableAmount).HasColumnType("decimal(18,2)");
            entity.Property(p => p.Amount).HasColumnType("decimal(18,2)");
            entity.Property(p => p.TdsGstRate).HasColumnType("decimal(5,2)");
            entity.Property(p => p.TdsItRate).HasColumnType("decimal(5,2)");
            entity.Property(p => p.BankAccountNo).HasMaxLength(100).IsRequired();
            entity.Property(p => p.PayRs).HasColumnType("decimal(18,2)");
            entity.Property(p => p.Status).HasMaxLength(50).IsRequired();
            entity.Property(p => p.CurrentStage).HasMaxLength(150).IsRequired();

            entity.HasMany(p => p.Items)
                  .WithOne()
                  .HasForeignKey(i => i.PaymentVoucherId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PaymentVoucherItem>(entity =>
        {
            entity.ToTable("paymentvoucheritems");

            entity.HasKey(i => i.Id);
            entity.Property(i => i.SupplierInvoiceGoods).HasMaxLength(1000).IsRequired();
            entity.Property(i => i.HeadCategory).HasMaxLength(100).IsRequired();
            entity.Property(i => i.CurrentHeadBalance).HasColumnType("decimal(18,2)");
            entity.Property(i => i.BillAmount).HasColumnType("decimal(18,2)");
            entity.Property(i => i.TdsGst).HasColumnType("decimal(18,2)");
            entity.Property(i => i.TdsIt).HasColumnType("decimal(18,2)");
            entity.Property(i => i.BalanceAfterPayment).HasColumnType("decimal(18,2)");
        });

        builder.Entity<AdvertisementTemplate>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.HasIndex(t => t.OwnerUserId);

            entity.HasMany(t => t.Sections)
                .WithOne(s => s.Template!)
                .HasForeignKey(s => s.TemplateId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AdvertisementTemplateSection>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.HasIndex(s => new { s.TemplateId, s.SortOrder });
        });

        builder.Entity<AdvertisementBodyTemplate>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.HasIndex(t => t.OwnerUserId);
            entity.Property(t => t.HtmlBody).HasColumnType("longtext");
        });

        builder.Entity<EmailTemplate>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Key).IsUnique();
            entity.Property(e => e.HtmlBody).HasColumnType("longtext");
        });

        builder.Entity<EmailLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TemplateKey);
            entity.HasIndex(e => e.Succeeded);
            entity.Property(e => e.RenderedBody).HasColumnType("longtext");
        });
    }
}
