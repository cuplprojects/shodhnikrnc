namespace API.Application.Procurement;

public interface IDynamicIndentService
{
    Task<Guid> RaiseAsync(RaiseDynamicIndentInput input, Guid requestingUserId, CancellationToken ct = default);
}
