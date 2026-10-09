namespace API.Application.Projects;

public class ProjectAccessDeniedException(Guid projectId) : Exception($"Access to project '{projectId}' is denied.");
