namespace API.Application.Procurement;

public class InsufficientBudgetException(decimal requested, IndentBudgetSnapshot snapshot)
    : Exception($"Requested {requested:F2} exceeds available budget {snapshot.Available:F2} " +
                $"(sanctioned {snapshot.Sanctioned:F2}, committed {snapshot.Committed:F2}, paid {snapshot.Paid:F2}).");
