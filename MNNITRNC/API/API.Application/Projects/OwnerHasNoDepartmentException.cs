namespace API.Application.Projects;

public class OwnerHasNoDepartmentException(Guid ownerUserId)
    : Exception($"User '{ownerUserId}' has no department and cannot own a project.");
