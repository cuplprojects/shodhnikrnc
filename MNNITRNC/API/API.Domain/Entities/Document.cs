using API.Domain.Enums;

namespace API.Domain.Entities;

public class Document
{
    public Guid Id { get; set; }
    public required string OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public DocumentKind Kind { get; set; }
    public int Version { get; set; }
    public DocumentStatus Status { get; set; }
    public required string StoragePath { get; set; }
    public Guid UploadedByUserId { get; set; }
    public DateTimeOffset UploadedAt { get; set; }
}
