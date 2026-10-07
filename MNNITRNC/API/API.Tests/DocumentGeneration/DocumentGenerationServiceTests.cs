using System.Text;
using System.Text.RegularExpressions;
using API.Application.Documents;
using API.Infrastructure.DocumentGeneration;
using API.Infrastructure.DocumentGeneration.Templates;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class DocumentGenerationServiceTests
{
    private static DocumentGenerationService CreateService() =>
        new(new PuppeteerHtmlPdfRenderer(), new PdfSharpPdfMerger());

    private static IndentDocumentModel SampleModel() => new(
        SanctionNo: "SAN-003",
        ProjectTitle: "Precision Interferometry",
        Agency: "DRDO",
        BudgetHeadName: "Recurring: Contingency",
        FacultyName: "Dr. E Nair",
        FacultyDesignation: "Assistant Professor",
        FacultyDepartment: "Physics",
        Items: [new IndentDocumentItemModel(
            SerialNumber: 1,
            Name: "Optical Bench",
            IsConsumable: false,
            TechnicalSpecs: "1.5m granite",
            UnitOfMeasurement: "Nos",
            Quantity: 1,
            EstimatedCost: 45000m)],
        Purpose: "Interferometry setup",
        GemAvailability: "yes",
        ModeOfPurchase: "upto_50000",
        Status: "approved",
        StockBookPage: null,
        StockDescription: null,
        StockQuantity: null,
        StockActualCost: null,
        StockCondition: null,
        InstallationRequired: false,
        TrainingRequired: false,
        QualificationCriterion: null,
        NumberOfEnclosures: null,
        MaxDeliveryPeriod: null,
        PurposeOfAcquiring: null,
        PerpetualLicense: null,
        CommitteeMembers: []);

    private static int CountPages(byte[] pdf)
    {
        var content = Encoding.ASCII.GetString(pdf);
        return Regex.Matches(content, @"/Type\s*/Page[^s]").Count;
    }

    [Fact]
    public async Task GenerateIndentAsync_ProducesMultiPagePdf()
    {
        var service = CreateService();

        var pdf = await service.GenerateIndentAsync(ProcurementTier.GemUpTo50k, SampleModel());

        Encoding.ASCII.GetString(pdf, 0, 5).Should().Be("%PDF-");
        // Cover letter + page break + annexure means at least 2 pages.
        CountPages(pdf).Should().BeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task GenerateIndentAsync_WithQuotation_AppendsQuotationPages()
    {
        var service = CreateService();
        var renderer = new PuppeteerHtmlPdfRenderer();
        var quotation = await renderer.RenderAsync("<html><body><div>Quotation</div></body></html>");

        var without = await service.GenerateIndentAsync(ProcurementTier.GemUpTo50k, SampleModel());
        var with = await service.GenerateIndentAsync(ProcurementTier.GemUpTo50k, SampleModel(), quotation);

        CountPages(with).Should().Be(CountPages(without) + CountPages(quotation));
    }

    [Theory]
    [InlineData(ProcurementTier.GemUpTo50k)]
    [InlineData(ProcurementTier.Gem50kTo1Lakh)]
    [InlineData(ProcurementTier.GemAbove1Lakh)]
    [InlineData(ProcurementTier.NonGemUpTo1Lakh)]
    [InlineData(ProcurementTier.NonGem1LakhTo2Lakh)]
    [InlineData(ProcurementTier.NonGem2LakhTo25Lakh)]
    public async Task GenerateIndentAsync_EveryTier_ProducesAValidPdf(ProcurementTier tier)
    {
        var service = CreateService();

        var pdf = await service.GenerateIndentAsync(tier, SampleModel());

        Encoding.ASCII.GetString(pdf, 0, 5).Should().Be("%PDF-");
        CountPages(pdf).Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task GenerateBillCoverLetterAsync_ProducesValidPdf()
    {
        var service = CreateService();

        var pdf = await service.GenerateBillCoverLetterAsync(SampleModel());

        Encoding.ASCII.GetString(pdf, 0, 5).Should().Be("%PDF-");
    }

    [Fact]
    public void BillCoverLetter_CarriesAllFiveLegacyCertifications()
    {
        var html = BillCoverLetterTemplate.Render(SampleModel());

        // The five-point certification block is the substance of the legacy bill
        // letter (process_consumable_bill.php:151-194); dropping any point would
        // change what the faculty member is signing.
        html.Should().Contain("We certify that-");
        html.Should().Contain("stock entry has been made");
        html.Should().Contain("GeM non-availability certificate attached");
        html.Should().Contain("GeM purchase order attached");
        html.Should().Contain("verified and passed for payment");
        html.Should().Contain("GFR 2017");
        html.Should().Contain("reasonable price");
    }

    [Fact]
    public void BillCoverLetter_StatesTheItemWasProcuredNotThatItIsRequired()
    {
        var html = BillCoverLetterTemplate.Render(SampleModel());

        // The bill letter is past-tense ("has been procured") where the indent
        // cover letter is future-tense ("are required") -- they are different
        // documents and must not be confused for one another.
        html.Should().Contain("has been procured");
        html.Should().Contain("Duly signed bill is submitted for payment");
    }
}
