namespace API.Application.Procurement;

public class BiddingTierNotSupportedException(decimal estimatedCost)
    : Exception($"Indents above Rs. 25,00,000 (requested: {estimatedCost:F2}) must go through the bidding process, which is not supported.");
