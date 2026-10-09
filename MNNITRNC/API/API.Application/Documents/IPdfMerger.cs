namespace API.Application.Documents;

public interface IPdfMerger
{
    byte[] Merge(IReadOnlyList<byte[]> pdfDocuments);
}
