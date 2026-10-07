namespace API.Application.Procurement;

public interface IIndentDetailQueryService
{
    Task<IndentDetailModel?> GetAsync(Guid indentId, CancellationToken ct = default);
}
