namespace API.Application.Workflow;

/// <summary>
/// A query can only be addressed to someone who has already acted on this
/// specific workflow instance -- not an arbitrary role or a person who
/// hasn't touched this proposal yet.
/// </summary>
public class QueryTargetNotAnActorException(Guid workflowInstanceId, Guid askedOfUserId)
    : InvalidOperationException(
        $"User '{askedOfUserId}' has not acted on workflow instance '{workflowInstanceId}' and cannot be asked a query.");
