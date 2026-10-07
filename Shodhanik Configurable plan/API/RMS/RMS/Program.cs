using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using RMS.Data;
using RMS.Services;
using RMS.Middleware;
using System;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// -------------------- SERVICES --------------------

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddAuthorization();

builder.Services.AddSingleton<OtpService>();
builder.Services.AddScoped<ISecurityService, SecurityService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IEncryptionService, EncryptionService>();
builder.Services.AddScoped<IFileService, FileService>();
builder.Services.AddScoped<IFileStorageService, FileStorageService>();
builder.Services.AddScoped<IEmailTemplateService, EmailTemplateService>();
builder.Services.AddScoped<ILoggerService, LoggerService>();
builder.Services.AddScoped<IWorkflowService, WorkflowService>();


builder.Services.AddCors(options => {
    options.AddDefaultPolicy(policy => {
        policy.AllowAnyOrigin()
          .AllowAnyMethod()
          .AllowAnyHeader();
    });
});

// -------------------- DATABASE --------------------

builder.Services.AddDbContext<RMSDbContext>(options =>
  options.UseMySql(
    builder.Configuration.GetConnectionString("Database"),
    new MySqlServerVersion(new Version(8, 0, 2)),
    mysqlOptions => {
        mysqlOptions.CommandTimeout(180);
    }
  )
);

// -------------------- AUTH --------------------

builder.Services.AddAuthentication(options => {
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
  .AddJwtBearer(options => {
      options.TokenValidationParameters = new TokenValidationParameters
      {
          ValidateIssuer = true,
          ValidateAudience = true,
          ValidateLifetime = true,
          ValidateIssuerSigningKey = true,
          ValidIssuer = builder.Configuration["Jwt:Issuer"],
          ValidAudience = builder.Configuration["Jwt:Audience"],
          IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"])
          )
      };
  });

var app = builder.Build();

// -------------------- STATIC FILES --------------------

// Enables wwwroot (Swagger custom JS / CSS)
app.UseStaticFiles();

// Configure file storage static path from appsettings
var filePath = builder.Configuration["FilePath"];
if (!string.IsNullOrWhiteSpace(filePath))
{
    if (!Directory.Exists(filePath))
    {
        Directory.CreateDirectory(filePath);
    }

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(filePath),
        RequestPath = ""
    });
}

// -------------------- SWAGGER --------------------

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();

    app.UseSwaggerUI(c => {
        // Start collapsed (optional)
        c.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.None);

        // Inject custom JS (Collapse / Expand All)
        c.InjectJavascript("/swagger-ui/custom.js");
    });
}

// -------------------- MIDDLEWARE PIPELINE --------------------

app.UseHttpsRedirection();

app.UseCors();

// Encryption middleware BEFORE auth
app.UseMiddleware<EncryptionMiddleware>();

// Logging middleware AFTER auth to get user info from token
app.UseAuthentication();
app.UseAuthorization();

app.UseLoggingMiddleware();

// app.UseMiddleware<RoleBasedAuthorizationMiddleware>();

app.MapControllers();

app.Run();
