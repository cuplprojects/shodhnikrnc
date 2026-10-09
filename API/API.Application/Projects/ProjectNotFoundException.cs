namespace API.Application.Projects;

public class ProjectNotFoundException(Guid projectId) : Exception($"Project '{projectId}' was not found.");
