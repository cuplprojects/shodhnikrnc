namespace API.Contracts.Workflow;

public record WorkflowActionRequest(string? Remarks, Guid? AssigneeUserId = null);
