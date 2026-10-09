namespace API.Application.Procurement;

public record IndentBudgetSnapshot(decimal Sanctioned, decimal Committed, decimal Paid, decimal Available);
