using API.Domain.Enums;

namespace API.Contracts.Documents;

public class UploadDocumentRequest
{
    public required IFormFile File { get; set; }
    public required string OwnerType { get; set; }
    public required Guid OwnerId { get; set; }
    public required DocumentKind Kind { get; set; }
}
