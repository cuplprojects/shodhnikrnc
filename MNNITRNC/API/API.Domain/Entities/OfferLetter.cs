namespace API.Domain.Entities;

public class OfferLetter
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid ManpowerId { get; set; }
    public required string CandidateName { get; set; }
    public required string Gender { get; set; }
    public required string ParentName { get; set; }
    public required string Address { get; set; }
    public required string City { get; set; }
    public required string State { get; set; }
    public required string Pincode { get; set; }
    public decimal FellowshipAmount { get; set; }
    public decimal HraPercentage { get; set; }
    public DateOnly JoiningDate { get; set; }
    public string? FilePath { get; set; }
    public Guid? GeneratedBy { get; set; }
    public DateTimeOffset GeneratedAt { get; set; }
}
