using API.Application.Common;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Documents;

/// <summary>
/// Reports which configured documents a request has and which it is missing.
/// Advisory only — this never blocks a workflow transition.
/// </summary>
public class DocumentChecklistService(IApplicationDbContext db) : IDocumentChecklistService
{
    public async Task<DocumentChecklistResult> GetChecklistAsync(
        RequestType requestType,
        WorkflowPhase phase,
        Guid requestId,
        string ownerType,
        CancellationToken ct = default)
    {
        var configured = await db.DocumentChecklistItems
            .Where(i => i.RequestType == requestType && i.Phase == phase)
            .OrderBy(i => i.DisplayOrder)
            .ToListAsync(ct);

        var documents = await db.Documents
            .Where(d => d.OwnerId == requestId && (d.OwnerType == ownerType || d.OwnerType == "DynamicIndent" || ownerType == "DynamicIndent"))
            .ToListAsync(ct);

        // Satisfaction is per DocumentKind, so items configured with the same kind
        // are satisfied together by a single upload. See the seed data notes.
        // Where more than one document of a kind exists (a re-upload), the most
        // recent is what a reviewer should be linked to. For SupportingDocument, we do NOT group them,
        // we want to list all of them individually.
        var latestByKind = documents
            .Where(d => d.Kind != DocumentKind.SupportingDocument)
            .GroupBy(d => d.Kind)
            .ToDictionary(g => g.Key, g => (Guid?)g.OrderByDescending(d => d.UploadedAt).First().Id);

        var items = configured
            .Select(i => new DocumentChecklistItemResult(
                i.Id,
                i.Name,
                i.DocumentKind,
                i.IsMandatory,
                latestByKind.ContainsKey(i.DocumentKind),
                i.DisplayOrder,
                latestByKind.GetValueOrDefault(i.DocumentKind)))
            .ToList();

        // Append any documents uploaded during indent creation (e.g. EstimatePdf, NonAvailabilityCertificate, etc.)
        // that are not explicitly present in DocumentChecklistItems
        var configuredNames = items.Select(i => i.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var configuredKinds = configured.Select(i => i.DocumentKind).ToHashSet();
        var unconfiguredDocs = documents
            .Where(d => !configuredKinds.Contains(d.Kind))
            .GroupBy(d => d.Kind)
            .SelectMany(g => g.Key == DocumentKind.SupportingDocument 
                ? (IEnumerable<Domain.Entities.Document>)g.OrderBy(d => d.UploadedAt) 
                : new[] { g.OrderByDescending(d => d.UploadedAt).First() });

        int supportingDocCounter = 1;
        foreach (var doc in unconfiguredDocs)
        {
            string name = doc.Kind switch
            {
                DocumentKind.EstimatePdf => "Estimate PDF",
                DocumentKind.NonAvailabilityCertificate => "Non-Availability Certificate",
                DocumentKind.PecCertificate => "PEC Certificate",
                DocumentKind.MacCertificate => "MAC Certificate",
                DocumentKind.PacCertificate => "PAC Certificate",
                DocumentKind.OtherSingleTenderDoc => "Single Tender Document",
                DocumentKind.GemQuotation => "GeM Quotation / Estimate",
                DocumentKind.BillDocument => "Original Bill",
                DocumentKind.SatisfactoryCertificate => "Stock Entry Proof",
                DocumentKind.EWayBill => "E-Way Bill",
                DocumentKind.SanctionLetter => "Sanction Letter",
                DocumentKind.SupportingDocument => $"Supporting Document {supportingDocCounter++}",
                _ => doc.Kind.ToString()
            };

            if (!configuredNames.Contains(name) || doc.Kind == DocumentKind.SupportingDocument)
            {
                items.Add(new DocumentChecklistItemResult(
                    doc.Id,
                    name,
                    doc.Kind,
                    false,
                    true,
                    items.Count + 1,
                    doc.Id));
            }
        }

        // Deduplicate items by Name (prefer satisfied item if duplicates exist), 
        // except for SupportingDocument which is already uniquely named with a counter.
        var deduplicatedItems = items
            .GroupBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.OrderByDescending(i => i.IsSatisfied).ThenBy(i => i.DisplayOrder).First())
            .OrderBy(i => i.DisplayOrder)
            .ToList();

        return new DocumentChecklistResult(requestType, phase, requestId, deduplicatedItems);
    }
}

