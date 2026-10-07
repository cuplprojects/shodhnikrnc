using API.Application.Documents;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;

namespace API.Infrastructure.DocumentGeneration;

public class PdfSharpPdfMerger : IPdfMerger
{
    public byte[] Merge(IReadOnlyList<byte[]> pdfDocuments)
    {
        if (pdfDocuments.Count == 0)
        {
            throw new ArgumentException("At least one PDF document is required to merge.", nameof(pdfDocuments));
        }

        using var output = new PdfDocument();

        foreach (var pdfBytes in pdfDocuments)
        {
            using var inputStream = new MemoryStream(pdfBytes);
            using var input = PdfReader.Open(inputStream, PdfDocumentOpenMode.Import);

            for (var pageIndex = 0; pageIndex < input.PageCount; pageIndex++)
            {
                output.AddPage(input.Pages[pageIndex]);
            }
        }

        using var outputStream = new MemoryStream();
        output.Save(outputStream);
        return outputStream.ToArray();
    }
}
