using API.Application.Common;
using API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Fellowship;

public class FellowContextService(IApplicationDbContext db) : IFellowContextService
{
    public async Task<ManpowerSelection> RequireActiveFellowAsync(
        Guid userId, CancellationToken ct = default)
    {
        var appointment = await FindAppointmentAsync(userId, ct)
            ?? throw new FellowAppointmentNotFoundException(userId);

        // Phase 5 set IdCardIssuedAt; this is where that gate binds. Checked
        // server-side rather than hidden in the UI, so it holds regardless of
        // which client is calling.
        if (appointment.IdCardIssuedAt is null)
        {
            throw new IdCardNotIssuedException(appointment.Id);
        }

        return appointment;
    }

    public async Task<ManpowerSelection?> FindAppointmentAsync(
        Guid userId, CancellationToken ct = default)
    {
        // Primary lookup by ApplicationUserId (standard case)
        var appointment = await db.ManpowerSelections
            .FirstOrDefaultAsync(s => s.ApplicationUserId == userId, ct);
        
        if (appointment is not null) return appointment;
        
        // Fallback: lookup via Candidate relationship (for legacy data)
        return await db.ManpowerSelections
            .Include(s => s.Candidate)
            .Where(s => s.Candidate != null && s.Candidate.ApplicationUserId == userId)
            .FirstOrDefaultAsync(ct);
    }
}
