using API.Domain.Enums;

namespace API.Application.Proposals;

/// <summary>
/// SubmitForApprovalAsync's real enforcement of the mandatory-document rule
/// -- the first place in this app a document checklist actually blocks a
/// transition rather than merely displaying a warning. Only SignedCopy and
/// EndorsementCertificate are mandatory for a research proposal.
/// </summary>
public class MandatoryDocumentMissingException(Guid proposalId, IReadOnlyList<DocumentKind> missingKinds)
    : InvalidOperationException(
        $"Proposal '{proposalId}' cannot be submitted for approval: missing mandatory document(s) " +
        $"{string.Join(", ", missingKinds)}.");
