using API.Application.Access;
using API.Application.Audit;
using API.Application.Dashboard;
using API.Authorization;
using API.Application.Announcements;
using API.Application.Auth;
using API.Application.Common;
using API.Application.Documents;
using API.Application.Departments;
using API.Application.FacultyUsers;
using API.Application.FundingAgencies;
using API.Application.NewsEvents;
using API.Application.Projects;
using API.Application.Reporting;
using API.Application.Workflow;
using API.Domain.Entities;
using API.Infrastructure.Auth;
using API.Application.Fellowship;
using API.Application.Proposals;
using API.Application.Notifications;
using API.Application.Procurement;
using API.Application.Recruitment;
using API.Application.Travel;
using API.Infrastructure.Notifications;
using API.Infrastructure.Recruitment;
using API.Infrastructure.DocumentGeneration;
using API.Infrastructure.Access;
using API.Infrastructure.Reporting;
using API.Infrastructure.Workflow;
using API.Infrastructure.Documents;
using API.Infrastructure.Procurement;
using API.Infrastructure.Persistence;
using API.Middleware;
using API.Seed;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddHttpContextAccessor();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.CustomSchemaIds(type => (type.FullName ?? type.Name).Replace("+", "."));
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter a valid JWT with the 'Bearer ' prefix.",
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var activeConnectionStringName = builder.Environment.IsDevelopment() ? "DefaultConnection" : "DefaultConnection2";
var activeConnectionString = builder.Configuration.GetConnectionString(activeConnectionStringName);

// Printed unconditionally (not behind a log level) so it's visible on a bare
// console run and in IIS's stdout log -- the two connection strings point at
// different databases on the same server, and picking the wrong one at a
// glance is exactly the mistake this line exists to catch early.
var activeDatabaseName = activeConnectionString?
    .Split(';')
    .Select(part => part.Split('=', 2))
    .FirstOrDefault(kv => kv.Length == 2 && kv[0].Trim().Equals("Database", StringComparison.OrdinalIgnoreCase))
    ?.ElementAtOrDefault(1)?.Trim();
Console.WriteLine($"[DB] Environment={builder.Environment.EnvironmentName}, using {activeConnectionStringName} -> Database={activeDatabaseName ?? "(unknown)"}");

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseMySql(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            new MySqlServerVersion(new Version(8, 0, 39))));
}
else
{
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseMySql(
            builder.Configuration.GetConnectionString("DefaultConnection2"),
            new MySqlServerVersion(new Version(8, 0, 39))));
}
builder.Services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());

builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.Password.RequiredLength = 8;

        // Applicant registration keys off the email address: RegisterAsync looks
        // one up to decide between creating an account and recognising a
        // reapplicant. Allowing duplicates would make that lookup ambiguous.
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    // Supplies the email-confirmation token provider. Without it
    // GenerateEmailConfirmationTokenAsync throws "No IUserTwoFactorTokenProvider
    // named 'Default' is registered" at runtime.
    .AddDefaultTokenProviders();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<DocumentStorageOptions>(builder.Configuration.GetSection("DocumentStorage"));

builder.Services.AddScoped<IWorkflowEngineService, WorkflowEngineService>();
// Scoped so its route cache spans one request: long enough that a single
// transition does not re-query per stage lookup, short enough that a
// SuperAdmin's edit takes effect on the next request rather than on recycle.
builder.Services.AddScoped<IWorkflowDefinitionService, WorkflowDefinitionService>();
builder.Services.AddScoped<IWorkflowPendingQueryService, WorkflowPendingQueryService>();
builder.Services.AddScoped<IWorkflowRoleCatalogue, WorkflowRoleCatalogue>();
builder.Services.AddScoped<IWorkflowDefinitionValidator, WorkflowDefinitionValidator>();
builder.Services.AddScoped<IWorkflowRequesterResolver, WorkflowRequesterResolver>();
// Scoped so the page cache spans one request: a request checks access several
// times (sidebar, route guard, policy), but a permission change still takes
// effect on the next request rather than at recycle.
builder.Services.AddScoped<IUserRoleProvider, UserRoleProvider>();
builder.Services.AddScoped<IUserDepartmentProvider, UserDepartmentProvider>();
builder.Services.AddScoped<IStaffDirectory, StaffDirectory>();
builder.Services.AddScoped<IInstituteWideScopeResolver, InstituteWideScopeResolver>();
builder.Services.AddScoped<IPageAccessService, PageAccessService>();
builder.Services.AddScoped<PageAccessDecision>();
builder.Services.AddScoped<RoleDeletionGuard>();
builder.Services.AddScoped<IDocumentStorageService, LocalDiskDocumentStorageService>();
builder.Services.AddScoped<IDocumentChecklistService, DocumentChecklistService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IProjectYearCalculator, ProjectYearCalculator>();
builder.Services.AddScoped<IOverheadSplitValidator, OverheadSplitValidator>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IBudgetSummaryService, BudgetSummaryService>();
builder.Services.AddScoped<IRefundService, RefundService>();
builder.Services.AddScoped<IHistoricalEntryService, HistoricalEntryService>();
builder.Services.AddScoped<IReportingService, ReportingService>();
builder.Services.AddScoped<IExcelExportService, ExcelExportService>();
builder.Services.AddScoped<IReportPdfExportService, ReportPdfExportService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IHtmlPdfRenderer, PuppeteerHtmlPdfRenderer>();
builder.Services.AddScoped<IPdfMerger, PdfSharpPdfMerger>();
builder.Services.AddScoped<IDocumentGenerationService, DocumentGenerationService>();
builder.Services.AddScoped<IProcurementTierCalculator, ProcurementTierCalculator>();
builder.Services.AddScoped<IIndentBudgetValidator, IndentBudgetValidator>();
builder.Services.AddScoped<IFacultyProfileProvider, IdentityFacultyProfileProvider>();
builder.Services.AddScoped<ConsumableIndentService>();
builder.Services.AddScoped<ContingencyIndentService>();
builder.Services.AddScoped<EquipmentIndentService>();
builder.Services.AddScoped<IIndentPendingQueryService, IndentPendingQueryService>();
builder.Services.AddScoped<IDynamicIndentService, DynamicIndentService>();
builder.Services.AddScoped<IIndentDetailQueryService, IndentDetailQueryService>();
builder.Services.AddScoped<IDynamicIndentDocumentGenerationService, DynamicIndentDocumentGenerationService>();
builder.Services.AddScoped<ITravelDocumentGenerationService, TravelDocumentGenerationService>();
builder.Services.AddScoped<ITravelRequestService, TravelRequestService>();
builder.Services.AddScoped<IFacultyUserService, FacultyUserService>();
builder.Services.AddScoped<IMyProfileService, MyProfileService>();
builder.Services.AddScoped<IAdminUsersService, AdminUsersService>();
builder.Services.AddScoped<INewsEventService, NewsEventService>();
builder.Services.AddScoped<IAnnouncementService, AnnouncementService>();
builder.Services.AddScoped<IFundingAgencyService, FundingAgencyService>();
builder.Services.AddScoped<IDepartmentService, DepartmentService>();

builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection(EmailOptions.SectionName));
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<IApprovalNotificationService, ApprovalNotificationService>();
builder.Services.AddScoped<IApplicantAccountService, ApplicantAccountService>();
builder.Services.AddScoped<IApplicantRoleService, ApplicantRoleService>();
builder.Services.AddScoped<IFacultyRegistrationService, FacultyRegistrationService>();
builder.Services.AddScoped<IRecruitmentService, RecruitmentService>();
builder.Services.AddScoped<IRecruitmentDocumentGenerationService, RecruitmentDocumentGenerationService>();
builder.Services.AddScoped<IAdvertisementTemplateService, AdvertisementTemplateService>();
builder.Services.AddScoped<IAdvertisementBodyTemplateService, AdvertisementBodyTemplateService>();
builder.Services.AddScoped<IFellowContextService, FellowContextService>();
builder.Services.AddScoped<IFellowshipService, FellowshipService>();
builder.Services.AddScoped<ILeaveService, LeaveService>();
builder.Services.AddScoped<IFellowshipDocumentGenerationService, FellowshipDocumentGenerationService>();
builder.Services.AddScoped<IResearchProposalService, ResearchProposalService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();

var jwtSection = builder.Configuration.GetSection("Jwt");
// Shodhanik is the only external issuer RNC trusts today -- see the
// Shodhanik-x-RNC integration plan, Phase 2. Its signing key differs from
// RNC's own, so a single IssuerSigningKey won't do; IssuerSigningKeyResolver
// below picks the right key by matching the token's own issuer claim.
var shodhanikSection = builder.Configuration.GetSection("Shodhanik:Jwt");
var rncSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["SigningKey"]!));
var shodhanikSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(shodhanikSection["SigningKey"]!));

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuers = [jwtSection["Issuer"], shodhanikSection["Issuer"]],
            ValidAudiences = [jwtSection["Audience"], shodhanikSection["Audience"]],
            IssuerSigningKeyResolver = (token, securityToken, kid, parameters) =>
                securityToken is JwtSecurityToken jwt && jwt.Issuer == shodhanikSection["Issuer"]
                    ? [shodhanikSigningKey]
                    : [rncSigningKey],
        };
    });

builder.Services.AddAuthorization();
// Builds a "page:{key}" policy on demand, so adding a page needs no change
// here -- and a page added through the admin UI can still be gated.
builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationPolicyProvider, PageAccessPolicyProvider>();
builder.Services.AddScoped<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, PageAccessHandler>();

const string DevelopmentCorsPolicy = "DevelopmentCors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevelopmentCorsPolicy, policy =>
    {
        // 5174 is what Vite falls back to when 5173 is already taken.
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseCors(DevelopmentCorsPolicy);
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseMiddleware<WorkflowExceptionMiddleware>();
// Outside ProjectExceptionMiddleware so procurement types are matched before its
// broad ArgumentException catch.
app.UseMiddleware<ProcurementExceptionMiddleware>();
app.UseMiddleware<ProjectExceptionMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

if (app.Environment.IsDevelopment())
{
    try
    {
        using var scope = app.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await dbContext.Database.MigrateAsync();
        await DbSeeder.SeedAsync(scope.ServiceProvider);
    }
    catch (DbUpdateConcurrencyException ex)
    {
        var logger = app.Services.GetRequiredService<ILogger<Program>>();
        logger.LogWarning("Database seeding encountered a concurrency issue. Clearing entity cache and retrying: {Message}", ex.Message);
        
        try
        {
            using var scope = app.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            dbContext.ChangeTracker.Clear();
            await DbSeeder.SeedAsync(scope.ServiceProvider);
        }
        catch (Exception retryEx)
        {
            logger = app.Services.GetRequiredService<ILogger<Program>>();
            logger.LogWarning("Database seeding skipped on startup: {Message}", retryEx.GetBaseException().Message);
        }
    }
    catch (Exception ex)
    {
        var logger = app.Services.GetRequiredService<ILogger<Program>>();
        logger.LogWarning("Database seeding skipped on startup: {Message}", ex.GetBaseException().Message);
    }
}

app.Run();
