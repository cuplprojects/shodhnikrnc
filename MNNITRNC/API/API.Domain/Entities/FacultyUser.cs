namespace API.Domain.Entities;

public class FacultyUser
{
    public int Id { get; set; }
    public required string UserId { get; set; }
    public required string Password { get; set; }
    public required string Name { get; set; }
}
