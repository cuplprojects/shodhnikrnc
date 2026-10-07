namespace API.Application.Travel;

/// <summary>
/// The BRD's hard rule: taxi reimbursement is available only if the beneficiary
/// selected it when submitting the claim. Choosing it later is not permitted.
/// </summary>
public class TaxiNotOptedInException(Guid travelRequestId)
    : InvalidOperationException(
        $"Travel request '{travelRequestId}' did not opt in to taxi reimbursement at " +
        "submission, so a taxi cost cannot be claimed now.");
