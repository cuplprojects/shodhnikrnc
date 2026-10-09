using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.FundingAgencies;

public class FundingAgencyService(IApplicationDbContext db) : IFundingAgencyService
{
    public async Task<IReadOnlyList<FundingAgencyResponse>> ListActiveAsync(CancellationToken ct = default) =>
        await db.FundingAgencies
            .AsNoTracking()
            .Where(a => a.IsActive)
            .OrderBy(a => a.Name)
            .Select(a => new FundingAgencyResponse(a.Id, a.Name, a.IsActive))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<FundingAgencyResponse>> ListAllAsync(CancellationToken ct = default) =>
        await db.FundingAgencies
            .AsNoTracking()
            .OrderBy(a => a.Name)
            .Select(a => new FundingAgencyResponse(a.Id, a.Name, a.IsActive))
            .ToListAsync(ct);

    public async Task<FundingAgencyResponse> CreateAsync(
        CreateFundingAgencyRequest request, CancellationToken ct = default)
    {
        var name = RequireName(request.Name);
        await EnsureNameIsUniqueAsync(name, excludingId: null, ct);

        var agency = new FundingAgency { Id = Guid.NewGuid(), Name = name, IsActive = true };
        db.FundingAgencies.Add(agency);
        await db.SaveChangesAsync(ct);

        return new FundingAgencyResponse(agency.Id, agency.Name, agency.IsActive);
    }

    public async Task<FundingAgencyResponse> UpdateAsync(
        Guid id, UpdateFundingAgencyRequest request, CancellationToken ct = default)
    {
        var agency = await db.FundingAgencies.FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw new FundingAgencyNotFoundException(id);

        var name = RequireName(request.Name);
        await EnsureNameIsUniqueAsync(name, excludingId: id, ct);

        agency.Name = name;
        agency.IsActive = request.IsActive;
        await db.SaveChangesAsync(ct);

        return new FundingAgencyResponse(agency.Id, agency.Name, agency.IsActive);
    }

    private static string RequireName(string name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            throw new ArgumentException("A funding agency name is required.", nameof(name));
        }

        return trimmed;
    }

    private async Task EnsureNameIsUniqueAsync(string name, Guid? excludingId, CancellationToken ct)
    {
        var exists = await db.FundingAgencies
            .Where(a => a.Id != excludingId)
            .AnyAsync(a => a.Name.ToLower() == name.ToLower(), ct);

        if (exists)
        {
            throw new FundingAgencyNameAlreadyExistsException(name);
        }
    }
}
