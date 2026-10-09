using API.Application.Documents;
using API.Infrastructure.DocumentGeneration.Templates;
using FluentAssertions;
using Xunit;

namespace API.Tests.DocumentGeneration;

public class NonGemAnnexureTemplateTests
{
    private static IndentDocumentModel SampleModel(IReadOnlyList<IndentCommitteeMemberModel>? committee = null) => new(
        SanctionNo: "SAN-002",
        ProjectTitle: "Vacuum Systems Research",
        Agency: "SERB",
        BudgetHeadName: "Equipment/Non-recurring",
        FacultyName: "Dr. B Kumar",
        FacultyDesignation: "Associate Professor",
        FacultyDepartment: "Mechanical Engineering",
        Items: [new IndentDocumentItemModel(
            SerialNumber: 1,
            Name: "Vacuum Pump",
            IsConsumable: false,
            TechnicalSpecs: "Two-stage rotary vane",
            UnitOfMeasurement: "Nos",
            Quantity: 1,
            EstimatedCost: 350000m)],
        Purpose: "Vacuum chamber experiments",
        GemAvailability: "no",
        ModeOfPurchase: "2lakh_to_25lakh",
        Status: "indent_raised",
        StockBookPage: "45",
        StockDescription: "Older pump",
        StockQuantity: "1",
        StockActualCost: "180000",
        StockCondition: "Unserviceable",
        InstallationRequired: false,
        TrainingRequired: false,
        QualificationCriterion: null,
        NumberOfEnclosures: null,
        MaxDeliveryPeriod: null,
        PurposeOfAcquiring: null,
        PerpetualLicense: null,
        CommitteeMembers: committee ?? []);

    [Fact]
    public void Annexure9_RendersItemAndFacultyFields()
    {
        var html = Annexure9Template.Render(SampleModel());

        html.Should().Contain("Vacuum Pump");
        html.Should().Contain("Dr. B Kumar");
        html.Should().Contain("3,50,000.00");
    }

    [Fact]
    public void NonGemAnnexures_CiteTheirRespectiveGfrRules()
    {
        // Verified against the legacy source: Annexures 9 and 10 cite GFR 2017
        // Rule 154 (the lower-value purchase route), and only Annexure 11 — the
        // Rs.2L-25L tier — cites Rule 155, the market-survey/quotation-evaluation
        // committee route. Asserting 155 across all three would be asserting a
        // rule citation the printed forms do not actually carry.
        Annexure9Template.Render(SampleModel()).Should().Contain("Rule 154");
        Annexure10Template.Render(SampleModel()).Should().Contain("Rule 154");
        Annexure11Template.Render(SampleModel()).Should().Contain("Rule 155");
    }

    [Fact]
    public void Annexure9_HasNoCommitteeRoster()
    {
        // Legacy Annexure 9 (non-GeM, up to Rs.1L) has no committee block at all —
        // its Section D is a single Rule 154 line. Only Annexures 10 and 11 carry
        // the 6-role roster, so CommitteeMembers is deliberately ignored here.
        var committee = new List<IndentCommitteeMemberModel>
        {
            new("Prof. C Rao", "Chairperson"),
        };

        var html = Annexure9Template.Render(SampleModel(committee));

        html.Should().NotContain("Prof. C Rao");
    }

    [Fact]
    public void CommitteeBearingAnnexures_RenderEachMemberByNameAndRole()
    {
        var committee = new List<IndentCommitteeMemberModel>
        {
            new("Prof. C Rao", "Chairperson"),
            new("Dr. D Singh", "FacultyMember"),
        };

        // Annexures 10 and 11 both carry the roster; Annexure 9 does not.
        foreach (var html in new[]
                 {
                     Annexure10Template.Render(SampleModel(committee)),
                     Annexure11Template.Render(SampleModel(committee)),
                 })
        {
            html.Should().Contain("Prof. C Rao");
            html.Should().Contain("Dr. D Singh");
        }
    }

    [Fact]
    public void Annexure11_WithNoCommitteeMembers_StillRendersWithoutError()
    {
        var html = Annexure11Template.Render(SampleModel());

        html.Should().NotBeNullOrEmpty();
        html.Should().Contain("Vacuum Pump");
    }

    [Fact]
    public void AllNonGemAnnexures_RenderStockRegisterFields()
    {
        foreach (var html in new[]
                 {
                     Annexure9Template.Render(SampleModel()),
                     Annexure10Template.Render(SampleModel()),
                     Annexure11Template.Render(SampleModel()),
                 })
        {
            html.Should().Contain("Older pump");
            html.Should().Contain("180000");
        }
    }

    [Fact]
    public void AllNonGemAnnexures_EmbedTheInstituteLogo()
    {
        foreach (var html in new[]
                 {
                     Annexure9Template.Render(SampleModel()),
                     Annexure10Template.Render(SampleModel()),
                     Annexure11Template.Render(SampleModel()),
                 })
        {
            html.Should().Contain("data:image/jpeg;base64,");
        }
    }

    [Fact]
    public void Annexure11_RendersEnglishCertificationTextInTheEnglishFont()
    {
        // Legacy save_consumable.php:3303 tags this English phrase as hindi-text,
        // so Kruti Dev renders it as Devanagari gibberish on the printed form. The
        // other five occurrences of the phrase in that file use english-text, so it
        // is an isolated typo and we correct it. This test pins the correction.
        var html = Annexure11Template.Render(SampleModel());

        html.Should().Contain("""<span class="english-text">Suggested method of procurement:</span>""");
        html.Should().NotContain("""'Kruti Dev 010';">Suggested method of procurement:""");
    }

    [Fact]
    public void AllNonGemAnnexures_RetainLegacyHindiGlyphText()
    {
        // "ek¡x i=" is Kruti Dev glyph-mapped Latin that renders as "मांग पत्र".
        // Its presence proves the Hindi was carried over rather than dropped or
        // "corrected" to Unicode during porting.
        foreach (var html in new[]
                 {
                     Annexure9Template.Render(SampleModel()),
                     Annexure10Template.Render(SampleModel()),
                     Annexure11Template.Render(SampleModel()),
                 })
        {
            html.Should().Contain("hindi-text");
            html.Should().Contain("ek¡x i=");
        }
    }
}
