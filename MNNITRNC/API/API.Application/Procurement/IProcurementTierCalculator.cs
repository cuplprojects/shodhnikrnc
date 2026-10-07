using API.Application.Documents;
using API.Domain.Enums;

namespace API.Application.Procurement;

public interface IProcurementTierCalculator
{
    ProcurementTier DetermineTier(GemAvailability gemAvailability, decimal estimatedCost);
}
