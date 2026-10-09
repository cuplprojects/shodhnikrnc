namespace API.Application.Projects;

public class GrantReceivedBeforeSubmissionException(DateOnly receivedDate, DateOnly submittedToAgencyOn)
    : InvalidOperationException(
        $"A grant cannot be recorded as received on {receivedDate:yyyy-MM-dd}, before this project's " +
        $"proposal was submitted to the funding agency on {submittedToAgencyOn:yyyy-MM-dd}.");
