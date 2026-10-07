namespace API.Application.Procurement;

public class IndentNotFoundException(Guid indentId) : Exception($"Indent '{indentId}' was not found.");
