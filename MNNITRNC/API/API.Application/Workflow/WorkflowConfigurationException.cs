namespace API.Application.Workflow;

/// <summary>
/// The stored route cannot answer a question the engine needs answered: no
/// definition for a (RequestType, Phase), or no stage row for the stage an
/// instance is currently sitting on.
/// </summary>
/// <remarks>
/// Distinct from <see cref="WorkflowTransitionException"/>, which means the
/// caller asked for something the route forbids. This one means the route
/// itself is wrong or incomplete -- an operator error rather than a user error,
/// so it maps to 500 rather than 409. An instance stranded on a stage a
/// SuperAdmin deleted must fail loudly here rather than stall silently.
/// </remarks>
public class WorkflowConfigurationException(string message) : Exception(message);
