using Microsoft.EntityFrameworkCore;
using RMS.Models;
using RMS.Models.NonDbModels;
using RMS.Models.WebsiteSettings;



namespace RMS.Data
{
    public class RMSDbContext : DbContext
    {

        public RMSDbContext(DbContextOptions<RMSDbContext> options) : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<Scholar>().HasIndex(s=> new {s.Email, s.Year }).IsUnique();
            modelBuilder.Entity<Scholar>().HasIndex(s=>s.PhoneNumber).IsUnique();
            modelBuilder.Entity<SupervisorRegistration>().HasIndex(s => new { s.Email, s.Year }).IsUnique();
            modelBuilder.Entity<SupervisorRegistration>().HasIndex(s => new { s.MobileNo, s.Year }).IsUnique();
            modelBuilder.Entity<SupervisorResearch>().HasIndex(s => new { s.SupId, s.IssNo }).IsUnique();
            modelBuilder.Entity<SupervisorResearch>().HasIndex(s => new { s.WebUrl, s.SupId }).IsUnique();
          modelBuilder.Entity<RmsDor>().HasIndex(s => new { s.DepartmentId,s.Email}).IsUnique();
            modelBuilder.Entity<RmsDor>().HasIndex(s => new { s.DepartmentId, s.ContactNo }).IsUnique();
            modelBuilder.Entity<SuperAdmin>().HasIndex(s => s.Email).IsUnique();
            modelBuilder.Entity<SuperAdmin>().HasIndex(s => s.PhoneNumber).IsUnique();
            modelBuilder.Entity<ExaminerList>().HasIndex(s => s.Email).IsUnique();  
            modelBuilder.Entity<ExaminerList>().HasIndex(s=>s.ContactNo).IsUnique();
        }
        public DbSet<RegType> RegTypes { get; set; }
        public DbSet<ExaminerConsentLink> ExaminerConsentLinks { get; set; }
        public DbSet<AwardExaminee> AwardExaminees { get; set; }
        public DbSet<VerificationRequest> VerificationRequests { get; set; }
        public DbSet<Viva_voceExaminer> Viva_VoceExaminers { get; set; }
        public DbSet<ExaminerList> ExaminerLists { get; set; }
        public DbSet<SuplicationApplicationStatus> SupervisorApplicationStatuses { get; set; }
        public DbSet<SupervisorUpload> SupervisorUploads { get; set; }
        public DbSet<SupervisorEducation> SupervisorEducations { get; set; }
        public DbSet<SupervisorPersonal> SupervisorPersonal { get; set; }
        public DbSet<SupervisorResearch> SupervisorResearches { get; set; }
        public DbSet<SupervisorAuth> SupervisorAuths { get; set; }
        public DbSet<SupervisorTransaction> SupervisorTransactions { get; set; }
        public DbSet<Scholar> Scholars { get; set; }
        public DbSet<ScholarAuth> ScholarAuths { get; set; }
        public DbSet<ScholarPersonalDetail> ScholarPersonalDetails { get; set; }
        public DbSet<CollegeList> CollegeLists { get; set; }
        public DbSet<University> Universities { get; set; }
        public DbSet<ErrorLog> ErrorLogs { get; set; }
        public DbSet<EventLog> EventLogs { get; set; }
        public DbSet<RmsDor> RmsDors { get; set; }
        public DbSet<ScholarResearchPaper> ScholarResearchPaper { get; set; }
        public DbSet<ScholarConferences> ScholarConferences { get; set; }
        public DbSet<ScholarAcademicQualification> ScholarAcademicQualifications { get; set; }
        public DbSet<State> States { get; set; }
        public DbSet<Designation> Designations { get; set; }

        public DbSet<Subject> Subjects { get; set; }
        public DbSet<ScholarUpload> ScholarUploads { get;set; }
        public DbSet<SupervisorRegistration> SupervisorRegistrations { get; set; } = default!;

        public DbSet<ScholarApplicationStatus> ScholarApplicationStatuses { get; set; }
        public DbSet<Department> Departments { get; set; }
        public DbSet<SupervisorQualifications> SupervisorQualifications { get; set; }
        public DbSet<SupervisorAward> SupervisorAwards { get; set; }
        public DbSet <SupervisorResearches> SupervisorResearch { get; set; }
        public DbSet<SupervisorSeatAvailability> SupervisorSeatAvailabilities { get; set; }
        public DbSet<SupervisorCategories> SupervisorCategories { get; set; }
        public DbSet<SupervisorExperience> SupervisorExperiences { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<Admin> Admins { get; set; }
        public DbSet<SuperAdmin> SuperAdmins { get; set; }
        public DbSet<DocumentMaster> DocumentMasters { get; set; }
        public DbSet <Categories> Categories { get; set; }
        public DbSet<AdminAuth> AdminAuths { get; set; }
        public DbSet<FeeCategory> FeeCategories { get; set; }
        public DbSet <ScholarSupervisor> ScholarSupervisors { get; set; }
        public DbSet <ProgressReport> ProgressReports { get; set; }
        public DbSet <ScholarPayment> ScholarPayments{ get; set; }
        //public DbSet <PartTimePosition> PartTimePositions { get; set; }
        public DbSet <CourseWork> CourseWorks{ get; set; }
        public DbSet <CourseWorkMarks> CourseWorkMarks{ get; set; }
        public DbSet <SynopsisRDC> SynopsisRDCs{ get; set; }
        public DbSet<SupervisorScreening> SupervisorScreenings{ get; set; }
        public DbSet<Thesis> Thesis { get; set; }
        // Website Settings
        public DbSet<HeaderSettings> HeaderSettings { get; set; }
        public DbSet<NewsAnnouncement> NewsAnnouncements { get; set; }
        public DbSet<NoticeboardNotice> NoticeboardNotices { get; set; }
        public DbSet<CarouselSlide> CarouselSlides { get; set; }
        public DbSet<LeadershipTeamMember> LeadershipTeamMembers { get; set; }
        public DbSet<UniversityStatistic> UniversityStatistics { get; set; }
        public DbSet<BannerAnnouncement> BannerAnnouncements { get; set; }
        public DbSet<WelcomeSection> WelcomeSections { get; set; }
        public DbSet<ContactSettings> ContactSettings { get; set; }
        public DbSet<ProgramEvent> ProgramEvents { get; set; }
        public DbSet<ExternalLink> ExternalLinks { get; set; }
        public DbSet<ResearchProject> ResearchProjects { get; set; }
        public DbSet<Ordinance> Ordinances { get; set; }
        public DbSet<MoU> MoUs { get; set; }
        public DbSet<ResearchCompendium> ResearchCompendiums { get; set; }
        public DbSet<ViceChancellorMessage> ViceChancellorMessages { get; set; }
        public DbSet<VisionMission> VisionMissions { get; set; }
        public DbSet<PhdSyllabus> PhdSyllabuses { get; set; }
        public DbSet<DirectorMessage> DirectorMessages { get; set; }
        public DbSet<AssociateDirector> AssociateDirectors { get; set; }
        public DbSet<AssistantDirector> AssistantDirectors { get; set; }
        public DbSet<AdditionalDirector> AdditionalDirectors { get; set; }
        public DbSet<OfficeStaff> OfficeStaffs { get; set; }
        public DbSet<SupportingStaff> SupportingStaffs { get; set; }
        public DbSet<CoOrdinator> CoOrdinators { get; set; }
        public DbSet<EmailTemplate> EmailTemplates { get; set; }
        public DbSet<MeritListDoc> MeritListDocs { get; set; }
        public DbSet<ScholarAttendance> ScholarAttendances { get; set; }
        public DbSet<QueryComplaint> QueryComplaints { get; set; }
        public DbSet<ResearchPolicy> ResearchPolicies { get; set; }

         // Workflow Engine
        public DbSet<WorkflowDefinition> WorkflowDefinitions { get; set; }
        public DbSet<WorkflowStep> WorkflowSteps { get; set; }
        public DbSet<WorkflowInstance> WorkflowInstances { get; set; }
        public DbSet<WorkflowLog> WorkflowLogs { get; set; }
        public DbSet<WorkflowAction> WorkflowActions { get; set; }
    }
}
