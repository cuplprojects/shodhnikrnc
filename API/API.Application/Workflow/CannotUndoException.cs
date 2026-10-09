namespace API.Application.Workflow;

public class CannotUndoException(string reason) : InvalidOperationException(reason);
