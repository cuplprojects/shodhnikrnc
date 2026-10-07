using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using RMS.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using RMS.Data;
using Microsoft.EntityFrameworkCore;

namespace RMS.Middleware
{
    public class LoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<LoggingMiddleware> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        public LoggingMiddleware(RequestDelegate next, ILogger<LoggingMiddleware> logger, IServiceScopeFactory serviceScopeFactory)
        {
            _next = next;
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Only log POST, PUT, PATCH requests
            if (!ShouldLogRequest(context.Request.Method))
            {
                await _next(context);
                return;
            }

            // Get user ID from Bearer token
            var userId = GetUserIdFromToken(context);
            if (userId == null)
            {
                await _next(context);
                return;
            }

            // Capture request body for logging
            var originalBodyStream = context.Response.Body;
            var requestBody = await ReadRequestBodyAsync(context.Request);

            try
            {
                // Create a new memory stream for the response
                using var responseBody = new MemoryStream();
                context.Response.Body = responseBody;

                // Continue to the next middleware
                await _next(context);

                // Read response body
                var responseBodyText = await ReadResponseBodyAsync(responseBody);

                // Log successful event
                await LogEventAsync(context, userId.Value, requestBody, responseBodyText, context.Response.StatusCode);

                // Copy the response back to the original stream
                responseBody.Seek(0, SeekOrigin.Begin);
                await responseBody.CopyToAsync(originalBodyStream);
            }
            catch (Exception ex)
            {
                // Log error
                await LogErrorAsync(context, ex);

                // Restore the original response body stream
                context.Response.Body = originalBodyStream;
                throw;
            }
            finally
            {
                context.Response.Body = originalBodyStream;
            }
        }

        private static bool ShouldLogRequest(string method)
        {
            return method.Equals("POST", StringComparison.OrdinalIgnoreCase) ||
                   method.Equals("PUT", StringComparison.OrdinalIgnoreCase) ||
                   method.Equals("PATCH", StringComparison.OrdinalIgnoreCase);
        }

        private static int? GetUserIdFromToken(HttpContext context)
        {
            try
            {
                var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
                if (authHeader == null || !authHeader.StartsWith("Bearer "))
                    return null;

                var token = authHeader.Substring("Bearer ".Length).Trim();
                var handler = new JwtSecurityTokenHandler();

                if (!handler.CanReadToken(token))
                    return null;

                var jsonToken = handler.ReadJwtToken(token);
                
                // Try to get user ID from different possible claim types
                var userIdClaim = jsonToken.Claims.FirstOrDefault(c => 
                    c.Type == ClaimTypes.NameIdentifier || 
                    c.Type == "sub" || 
                    c.Type == "userId" || 
                    c.Type == "id" ||
                    c.Type == ClaimTypes.Name);

                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId))
                {
                    return userId;
                }

                return null;
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static async Task<string> ReadRequestBodyAsync(HttpRequest request)
        {
            try
            {
                request.EnableBuffering();
                var buffer = new byte[Convert.ToInt32(request.ContentLength ?? 0)];
                await request.Body.ReadAsync(buffer, 0, buffer.Length);
                var bodyAsText = Encoding.UTF8.GetString(buffer);
                request.Body.Position = 0;
                return bodyAsText;
            }
            catch
            {
                return string.Empty;
            }
        }

        private static async Task<string> ReadResponseBodyAsync(MemoryStream responseBody)
        {
            try
            {
                responseBody.Seek(0, SeekOrigin.Begin);
                var responseBodyText = await new StreamReader(responseBody).ReadToEndAsync();
                responseBody.Seek(0, SeekOrigin.Begin);
                return responseBodyText;
            }
            catch
            {
                return string.Empty;
            }
        }

        private async Task LogEventAsync(HttpContext context, int userId, string requestBody, string responseBody, int statusCode)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var loggerService = scope.ServiceProvider.GetRequiredService<ILoggerService>();

                var controllerName = GetControllerName(context);
                var actionName = GetActionName(context);
                var method = context.Request.Method;
                var path = context.Request.Path;

                var eventMessage = $"{method} {path} - {controllerName}.{actionName}";
                var category = $"{controllerName}Controller";

                // For successful requests, log the event
                if (statusCode >= 200 && statusCode < 300)
                {
                    // For POST requests, log request in OldValue and response in NewValue
                    // For PUT/PATCH requests, get old value from database and log request in NewValue
                    string oldValue = null;
                    string newValue = null;

                    if (method.Equals("POST", StringComparison.OrdinalIgnoreCase))
                    {
                        // POST: No old value exists
                        oldValue = null;
                        newValue = SanitizeRequestBody(responseBody);
                    }
                    else if (
                        method.Equals("PUT", StringComparison.OrdinalIgnoreCase) ||
                        method.Equals("PATCH", StringComparison.OrdinalIgnoreCase))
                    {
                        // PUT/PATCH: get old value from database before update, log request as new value
                        oldValue = await GetOldValueFromDatabase(scope, controllerName, context.Request.Path);
                        newValue = SanitizeRequestBody(requestBody);
                    }

                    loggerService.LogEvent(
                        message: eventMessage,
                        category: category,
                        triggeredBy: userId,
                        oldValue: oldValue,
                        newValue: newValue
                    );
                }

                _logger.LogInformation("Event logged: {EventMessage} by user {UserId}", eventMessage, userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log event for user {UserId}", userId);
            }
        }

        private async Task LogErrorAsync(HttpContext context, Exception exception)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var loggerService = scope.ServiceProvider.GetRequiredService<ILoggerService>();

                var controllerName = GetControllerName(context);
                var actionName = GetActionName(context);
                var method = context.Request.Method;
                var path = context.Request.Path;

                var errorLocation = $"{controllerName}Controller.{actionName}";
                var errorMessage = $"{method} {path} - {exception.Message}";

                loggerService.LogError(
                    error: exception.GetType().Name,
                    errorMsg: errorMessage,
                    controller: errorLocation
                );

                _logger.LogError(exception, "Error logged in {ErrorLocation}", errorLocation);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log error");
            }
        }

        private static string GetControllerName(HttpContext context)
        {
            try
            {
                var routeData = context.GetRouteData();
                return routeData?.Values["controller"]?.ToString() ?? "Unknown";
            }
            catch
            {
                return "Unknown";
            }
        }

        private static string GetActionName(HttpContext context)
        {
            try
            {
                var routeData = context.GetRouteData();
                return routeData?.Values["action"]?.ToString() ?? "Unknown";
            }
            catch
            {
                return "Unknown";
            }
        }

        private static string SanitizeRequestBody(string requestBody)
        {
            try
            {
                if (string.IsNullOrEmpty(requestBody))
                    return null;

                // Limit the size of logged request body
                if (requestBody.Length > 1000)
                {
                    requestBody = requestBody.Substring(0, 1000) + "... [truncated]";
                }

                // Try to parse as JSON and remove sensitive fields
                try
                {
                    var jsonDoc = JsonDocument.Parse(requestBody);
                    var sanitized = SanitizeJsonElement(jsonDoc.RootElement);
                    return JsonSerializer.Serialize(sanitized);
                }
                catch
                {
                    // If not JSON, return as is (but truncated)
                    return requestBody;
                }
            }
            catch
            {
                return "[Error reading request body]";
            }
        }

        private static object SanitizeJsonElement(JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    var obj = new Dictionary<string, object>();
                    foreach (var property in element.EnumerateObject())
                    {
                        // Hide sensitive fields
                        if (IsSensitiveField(property.Name))
                        {
                            obj[property.Name] = "[HIDDEN]";
                        }
                        else
                        {
                            obj[property.Name] = SanitizeJsonElement(property.Value);
                        }
                    }
                    return obj;

                case JsonValueKind.Array:
                    return element.EnumerateArray().Select(SanitizeJsonElement).ToArray();

                case JsonValueKind.String:
                    return element.GetString();

                case JsonValueKind.Number:
                    return element.TryGetInt32(out int intValue) ? intValue : element.GetDouble();

                case JsonValueKind.True:
                case JsonValueKind.False:
                    return element.GetBoolean();

                case JsonValueKind.Null:
                    return null;

                default:
                    return element.ToString();
            }
        }

        private static bool IsSensitiveField(string fieldName)
        {
            var sensitiveFields = new[]
            {
                "password", "pwd", "pass", "secret", "token", "key", "auth",
                "temppassword", "permpassword", "hashedotp", "otp"
            };

            return sensitiveFields.Any(field => 
                fieldName.Contains(field, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Gets the old value from database for PUT/PATCH operations before the update occurs.
        /// This method extracts the entity ID from the request path, queries the database for the current state,
        /// and returns it as a serialized JSON string for logging purposes.
        /// </summary>
        /// <param name="scope">Service scope for dependency injection</param>
        /// <param name="controllerName">Name of the controller handling the request</param>
        /// <param name="requestPath">The request path containing the entity ID</param>
        /// <returns>Serialized JSON string of the entity before update, or null if not found</returns>
        private async Task<string> GetOldValueFromDatabase(IServiceScope scope, string controllerName, PathString requestPath)
        {
            try
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<RMSDbContext>();
                
                // Extract ID from the request path (assuming format like /api/Controller/123)
                var pathSegments = requestPath.Value?.Split('/', StringSplitOptions.RemoveEmptyEntries);
                if (pathSegments == null || pathSegments.Length < 3)
                    return null;

                var idString = pathSegments.Last();
                
                // Handle cases where the last segment might not be an ID (e.g., /api/Controller/123/action)
                // Try to find the ID in the path segments
                int id = 0;
                bool idFound = false;
                
                for (int i = pathSegments.Length - 1; i >= 0; i--)
                {
                    if (int.TryParse(pathSegments[i], out id))
                    {
                        idFound = true;
                        break;
                    }
                }
                
                if (!idFound)
                    return null;

                // Get the entity based on controller name
                object entity = await GetEntityByControllerAndId(dbContext, controllerName, id);
                
                if (entity == null)
                    return null;

                // Serialize the entity to JSON
                var options = new JsonSerializerOptions
                {
                    WriteIndented = false,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles
                };

                var serializedEntity = JsonSerializer.Serialize(entity, options);
                return SanitizeRequestBody(serializedEntity);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get old value from database for controller {ControllerName}", controllerName);
                return null;
            }
        }

        private async Task<object> GetEntityByControllerAndId(RMSDbContext dbContext, string controllerName, int id)
        {
            // Map controller names to their corresponding entities (case-insensitive)
            var normalizedControllerName = controllerName.ToLowerInvariant();
            
            return normalizedControllerName switch
            {
                "scholars" => await dbContext.Scholars.AsNoTracking().FirstOrDefaultAsync(x => x.SID == id),
                "supervisorregistration" => await dbContext.SupervisorRegistrations.AsNoTracking().FirstOrDefaultAsync(x => x.SupId == id),
                "admin" => await dbContext.Admins.AsNoTracking().FirstOrDefaultAsync(x => x.AID == id),
                "scholarauths" => await dbContext.ScholarAuths.AsNoTracking().FirstOrDefaultAsync(x => x.SAID == id),
                "supervisorauths" => await dbContext.SupervisorAuths.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "scholarpersonaldetails" => await dbContext.ScholarPersonalDetails.AsNoTracking().FirstOrDefaultAsync(x => x.SPDID == id),
                "supervisorpersonals" => await dbContext.SupervisorPersonal.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "scholaracademicqualifications" => await dbContext.ScholarAcademicQualifications.AsNoTracking().FirstOrDefaultAsync(x => x.AQID == id),
                "supervisorqualifications" => await dbContext.SupervisorQualifications.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "supervisoreducation" => await dbContext.SupervisorEducations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "supervisorexperience" => await dbContext.SupervisorExperiences.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "supervisorawards" => await dbContext.SupervisorAwards.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "supervisorresearches" => await dbContext.SupervisorResearches.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "supervisorresearch" => await dbContext.SupervisorResearch.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "supervisorseatavailability" => await dbContext.SupervisorSeatAvailabilities.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "supervisorcategories" => await dbContext.SupervisorCategories.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "supervisoruploads" => await dbContext.SupervisorUploads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "scholaruploads" => await dbContext.ScholarUploads.AsNoTracking().FirstOrDefaultAsync(x => x.ScholarUploadID == id),
                "scholarresearch" => await dbContext.ScholarResearchPaper.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "scholarconferences" => await dbContext.ScholarConferences.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "scholarsupervisor" => await dbContext.ScholarSupervisors.AsNoTracking().FirstOrDefaultAsync(x => x.SCSUID == id),
                "scholarapplicationstatus" => await dbContext.ScholarApplicationStatuses.AsNoTracking().FirstOrDefaultAsync(x => x.SASID == id),
                "supervisorapplicationstatus" => await dbContext.SupervisorApplicationStatuses.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "progressreports" => await dbContext.ProgressReports.AsNoTracking().FirstOrDefaultAsync(x => x.PRID == id),
                "scholarpayments" => await dbContext.ScholarPayments.AsNoTracking().FirstOrDefaultAsync(x => x.SPID == id),
                "supervisortransaction" => await dbContext.SupervisorTransactions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "coursework" => await dbContext.CourseWorks.AsNoTracking().FirstOrDefaultAsync(x => x.CWID == id),
                "courseworkmarks" => await dbContext.CourseWorkMarks.AsNoTracking().FirstOrDefaultAsync(x => x.CWMID == id),
                "synopsisrdc" => await dbContext.SynopsisRDCs.AsNoTracking().FirstOrDefaultAsync(x => x.SYNID == id),
                "supervisorscreening" => await dbContext.SupervisorScreenings.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "thesis" => await dbContext.Thesis.AsNoTracking().FirstOrDefaultAsync(x => x.ThesisID == id),
                "universities" => await dbContext.Universities.AsNoTracking().FirstOrDefaultAsync(x => x.UniversityId == id),
                "states" => await dbContext.States.AsNoTracking().FirstOrDefaultAsync(x => x.StateID == id),
                "department" => await dbContext.Departments.AsNoTracking().FirstOrDefaultAsync(x => x.DepartmentID == id),
                "designations" => await dbContext.Designations.AsNoTracking().FirstOrDefaultAsync(x => x.DesignationID == id),
                "categories" => await dbContext.Categories.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "feecategory" => await dbContext.FeeCategories.AsNoTracking().FirstOrDefaultAsync(x => x.FCID == id),
                "documentmaster" => await dbContext.DocumentMasters.AsNoTracking().FirstOrDefaultAsync(x => x.DocumentMasterID == id),
                "role" => await dbContext.Roles.AsNoTracking().FirstOrDefaultAsync(x => x.RoleID == id),
                "dor" => await dbContext.RmsDors.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "awardexaminee" => await dbContext.AwardExaminees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "regtypes" => await dbContext.RegTypes.AsNoTracking().FirstOrDefaultAsync(x => x.RegTypeID == id),
                // Website Settings
                "headersettings" => await dbContext.HeaderSettings.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "newsannouncements" => await dbContext.NewsAnnouncements.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "noticeboardnotices" => await dbContext.NoticeboardNotices.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "carouselslides" => await dbContext.CarouselSlides.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "leadershipteammembers" => await dbContext.LeadershipTeamMembers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "universitystatistics" => await dbContext.UniversityStatistics.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "bannerannouncements" => await dbContext.BannerAnnouncements.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "welcomesections" => await dbContext.WelcomeSections.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "contactsettings" => await dbContext.ContactSettings.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "programevents" => await dbContext.ProgramEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "externallinks" => await dbContext.ExternalLinks.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "researchprojects" => await dbContext.ResearchProjects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "ordinances" => await dbContext.Ordinances.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "mous" => await dbContext.MoUs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "researchcompendium" => await dbContext.ResearchCompendiums.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "vicechancellormessages" => await dbContext.ViceChancellorMessages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "visionmissions" => await dbContext.VisionMissions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "phdsyllabus" => await dbContext.PhdSyllabuses.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "directormessages" => await dbContext.DirectorMessages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "associatedirectors" => await dbContext.AssociateDirectors.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "assistantdirectors" => await dbContext.AssistantDirectors.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "additionaldirectors" => await dbContext.AdditionalDirectors.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "officestaffs" => await dbContext.OfficeStaffs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "supportingstaffs" => await dbContext.SupportingStaffs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "coordinators" => await dbContext.CoOrdinators.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "emailtemplates" => await dbContext.EmailTemplates.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "meritlistdocs" => await dbContext.MeritListDocs.AsNoTracking().FirstOrDefaultAsync(x => x.MLDID == id),
                "scholarattendance" => await dbContext.ScholarAttendances.AsNoTracking().FirstOrDefaultAsync(x => x.ScholarAttenId == id),
                "querycomplaints" => await dbContext.QueryComplaints.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                "researchpolicies" => await dbContext.ResearchPolicies.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id),
                _ => null
            };
        }
    }
}