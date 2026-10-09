using API.Application.Documents;
using API.Infrastructure.DocumentGeneration.Templates;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class GemAnnexureTemplateTests
{
    private static IndentDocumentModel SampleModel() => new(
        SanctionNo: "SAN-001",
        ProjectTitle: "Advanced Materials Characterisation",
        Agency: "DST",
        BudgetHeadName: "Recurring: Consumable",
        FacultyName: "Dr. A Sharma",
        FacultyDesignation: "Professor",
        FacultyDepartment: "Computer Science",
        Items: [new IndentDocumentItemModel(
            SerialNumber: 1,
            Name: "Test Reagent Kit",
            IsConsumable: true,
            TechnicalSpecs: "High purity, 500ml",
            UnitOfMeasurement: "Nos",
            Quantity: 4,
            EstimatedCost: 42000m)],
        Purpose: "Required for sample analysis",
        GemAvailability: "yes",
        ModeOfPurchase: "upto_50000",
        Status: "indent_raised",
        StockBookPage: "12",
        StockDescription: "Prior kit",
        StockQuantity: "2",
        StockActualCost: "38000",
        StockCondition: "Consumed",
        InstallationRequired: false,
        TrainingRequired: false,
        QualificationCriterion: null,
        NumberOfEnclosures: null,
        MaxDeliveryPeriod: null,
        PurposeOfAcquiring: null,
        PerpetualLicense: null,
        CommitteeMembers: []);

    [Fact]
    public void Annexure6_RendersItemAndFacultyFields()
    {
        var html = Annexure6Template.Render(SampleModel());

        html.Should().Contain("Test Reagent Kit");
        html.Should().Contain("Dr. A Sharma");
        html.Should().Contain("Computer Science");
        html.Should().Contain("SAN-001");
        html.Should().Contain("42,000.00");
    }

    [Fact]
    public void Annexure6_IdentifiesItselfAsTheUpTo50kGemForm()
    {
        var html = Annexure6Template.Render(SampleModel());

        // Legacy Annexure 6 carries the PR-3A code and the GFR Rule 149(i) citation.
        html.Should().Contain("PR-3A");
        html.Should().Contain("149");
    }

    [Fact]
    public void Annexure7_IdentifiesItselfAsThe50kTo1LakhGemForm()
    {
        var html = Annexure7Template.Render(SampleModel());

        html.Should().Contain("PR-3B");
    }

    [Fact]
    public void Annexure8_IncludesBidEvaluationCommitteeSection()
    {
        var html = Annexure8Template.Render(SampleModel());

        // Legacy Annexure 8 (GeM >1L) adds a bid-evaluation committee block.
        html.Should().Contain("Committee");
    }

    [Fact]
    public void AllGemAnnexures_RenderStockRegisterFields()
    {
        foreach (var html in new[]
                 {
                     Annexure6Template.Render(SampleModel()),
                     Annexure7Template.Render(SampleModel()),
                     Annexure8Template.Render(SampleModel()),
                 })
        {
            html.Should().Contain("Prior kit");
            html.Should().Contain("38000");
        }
    }

    [Fact]
    public void AllGemAnnexures_EmbedTheInstituteLogo()
    {
        foreach (var html in new[]
                 {
                     Annexure6Template.Render(SampleModel()),
                     Annexure7Template.Render(SampleModel()),
                     Annexure8Template.Render(SampleModel()),
                 })
        {
            html.Should().Contain("data:image/jpeg;base64,");
        }
    }

    [Fact]
    public void AllGemAnnexures_RetainLegacyHindiGlyphText()
    {
        // "ek¡x i=" is Kruti Dev glyph-mapped Latin that renders as "मांग पत्र".
        // Its presence proves the Hindi was carried over rather than dropped or
        // "corrected" to Unicode during porting.
        foreach (var html in new[]
                 {
                     Annexure6Template.Render(SampleModel()),
                     Annexure7Template.Render(SampleModel()),
                     Annexure8Template.Render(SampleModel()),
                 })
        {
            html.Should().Contain("hindi-text");
            html.Should().Contain("ek¡x i=");
        }
    }
}
