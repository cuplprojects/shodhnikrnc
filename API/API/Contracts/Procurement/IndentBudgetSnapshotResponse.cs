namespace API.Contracts.Procurement;

public record IndentBudgetSnapshotResponse(
    decimal Sanctioned,
    decimal Committed,
    decimal Paid,
    decimal Available);
