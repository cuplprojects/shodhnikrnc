using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Seed;

public static class FundingAgencySeeder
{
    private static readonly string[] DefaultAgencies =
    [
        "AICTE",
        "CSIR",
        "DBT",
        "DST",
        "ICMR",
        "ISRO",
        "SERB"
    ];

    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        if (await db.FundingAgencies.AnyAsync(ct))
        {
            return;
        }

        foreach (var name in DefaultAgencies)
        {
            db.FundingAgencies.Add(new FundingAgency
            {
                Id = Guid.NewGuid(),
                Name = name,
                IsActive = true
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
