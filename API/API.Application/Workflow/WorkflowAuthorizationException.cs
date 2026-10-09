namespace API.Application.Workflow;

/// <summary>
/// The actor holds none of the roles the current stage permits.
/// </summary>
/// <remarks>
/// Distinct from <see cref="WorkflowTransitionException"/> (the route forbids
/// the action from this stage, whoever asks) and from
/// <see cref="WorkflowConfigurationException"/> (the route itself is
/// incomplete). This one means the action is legitimate but this actor may not
/// perform it, which is a 403 rather than a 400 or a 500.
/// </remarks>
public class WorkflowAuthorizationException(string message) : Exception(message);
