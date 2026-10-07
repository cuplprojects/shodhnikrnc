using API.Domain.Entities;
using API.Domain.Enums;
using API.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Tests.Recruitment;

/// <summary>
/// The mapping for the structured application data. The cascade matters
/// because an academic or work row without its application is not a partial
/// record, it is an orphan: it describes an applicant nothing points to.
/// </summary>
public class CandidateApplicationEntitiesTests
{
    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Candidate CandidateWith(
        int educationRows = 0,
        int experienceRows = 0)
    {
        var candidate = new Candidate
        {
            Id = Guid.NewGuid(),
            RecruitmentRequestId = Guid.NewGuid(),
            ApplicationUserId = Guid.NewGuid(),
            FullName = "Asha Verma",
            Mobile = "9876543210",
            AppliedAt = DateTimeOffset.UtcNow,
        };

        for (var i = 0; i < educationRows; i++)
        {
            candidate.Education.Add(new CandidateEducation
            {
                Id = Guid.NewGuid(),
                CandidateId = candidate.Id,
                Level = (EducationLevel)i,
                BoardInstituteUniv = $"Board {i}",
            });
        }

        for (var i = 0; i < experienceRows; i++)
        {
            candidate.Experiences.Add(new CandidateExperience
            {
                Id = Guid.NewGuid(),
                CandidateId = candidate.Id,
                SortOrder = i,
                Organization = $"Org {i}",
            });
        }

        return candidate;
    }

    [Fact]
    public async Task ANewCandidate_DefaultsToDraft()
    {
        var db = CreateDb();
        var candidate = CandidateWith();

        db.Candidates.Add(candidate);
        await db.SaveChangesAsync();

        var reloaded = await db.Candidates.SingleAsync();
        reloaded.ApplicationStatus.Should().Be(ApplicationStatus.Draft);
    }

    /// <summary>
    /// Pins the two enum values the migration's backfill SQL is written against:
    /// it reads "UPDATE Candidates SET ApplicationStatus = 1 WHERE
    /// ApplicationStatus = 0", so renumbering these members would quietly turn
    /// that statement into a no-op or, worse, into a statement that hides rows.
    /// </summary>
    [Fact]
    public void DraftIsZeroAndSubmittedIsOne_AsTheMigrationBackfillAssumes()
    {
        ((int)ApplicationStatus.Draft).Should().Be(0);
        ((int)ApplicationStatus.Submitted).Should().Be(1);
    }

    [Fact]
    public async Task Candidate_CascadeDelete_RemovesEducationAndExperienceRows()
    {
        var db = CreateDb();
        var candidate = CandidateWith(educationRows: 3, experienceRows: 2);
        db.Candidates.Add(candidate);
        await db.SaveChangesAsync();

        db.CandidateEducations.Should().HaveCount(3);
        db.CandidateExperiences.Should().HaveCount(2);

        db.Candidates.Remove(candidate);
        await db.SaveChangesAsync();

        db.CandidateEducations.Should().BeEmpty();
        db.CandidateExperiences.Should().BeEmpty();
    }

    // The two below assert on model metadata rather than on saved rows. The
    // in-memory provider does not enforce delete behaviour: the round-trip test
    // above passes just as happily with DeleteBehavior.Restrict configured,
    // because the provider cascades the loaded children by itself. Asserting on
    // the model is what actually fails when the mapping is wrong, and the
    // mapping is what the relational migration is generated from.
    [Theory]
    [InlineData(typeof(CandidateEducation))]
    [InlineData(typeof(CandidateExperience))]
    public void ChildRows_CascadeDeleteWithTheirCandidate(Type childType)
    {
        using var db = CreateDb();

        var foreignKey = db.Model
            .FindEntityType(childType)!
            .GetForeignKeys()
            .Single(fk => fk.PrincipalEntityType.ClrType == typeof(Candidate));

        foreignKey.DeleteBehavior.Should().Be(DeleteBehavior.Cascade);
    }

    [Theory]
    [InlineData(typeof(CandidateEducation))]
    [InlineData(typeof(CandidateExperience))]
    public void ChildRows_AreIndexedByCandidateId(Type childType)
    {
        using var db = CreateDb();

        db.Model
            .FindEntityType(childType)!
            .GetIndexes()
            .Should().Contain(i => i.Properties.Count == 1 && i.Properties[0].Name == "CandidateId");
    }

    /// <summary>
    /// The old single-shot form wrote free text into these two, and rows that
    /// predate the structured tables carry nothing else. Dropping them would
    /// erase the only surviving record of what those applicants submitted.
    /// </summary>
    [Fact]
    public async Task LegacyQualificationAndExperienceText_SurvivesARoundTrip()
    {
        var db = CreateDb();
        var candidate = CandidateWith();
        candidate.Qualification = "M.Tech, Chemical Engineering";
        candidate.Experience = "2 years at CSIR";

        db.Candidates.Add(candidate);
        await db.SaveChangesAsync();

        var reloaded = await db.Candidates.SingleAsync();
        reloaded.Qualification.Should().Be("M.Tech, Chemical Engineering");
        reloaded.Experience.Should().Be("2 years at CSIR");
    }

    [Fact]
    public async Task StructuredApplicationFields_RoundTrip()
    {
        var db = CreateDb();
        var candidate = CandidateWith();
        var photoId = Guid.NewGuid();
        var certificateId = Guid.NewGuid();

        candidate.Gender = Gender.Female;
        candidate.IsMarried = false;
        candidate.DateOfBirth = new DateOnly(1998, 4, 12);
        candidate.Category = CandidateCategory.OBC;
        candidate.CategoryCertificateDocumentId = certificateId;
        candidate.PhotoDocumentId = photoId;
        candidate.GateNetGpatQualified = true;
        candidate.GateNetGpatScore = "612";
        candidate.SciJournalCount = 3;
        candidate.WantsHigherDegreeRegistration = true;
        candidate.ApplicationStatus = ApplicationStatus.Submitted;

        db.Candidates.Add(candidate);
        await db.SaveChangesAsync();

        var reloaded = await db.Candidates.SingleAsync();
        reloaded.Gender.Should().Be(Gender.Female);
        reloaded.IsMarried.Should().BeFalse();
        reloaded.DateOfBirth.Should().Be(new DateOnly(1998, 4, 12));
        reloaded.Category.Should().Be(CandidateCategory.OBC);
        reloaded.CategoryCertificateDocumentId.Should().Be(certificateId);
        reloaded.PhotoDocumentId.Should().Be(photoId);
        reloaded.GateNetGpatQualified.Should().BeTrue();
        reloaded.SciJournalCount.Should().Be(3);
        reloaded.WantsHigherDegreeRegistration.Should().BeTrue();
        reloaded.ApplicationStatus.Should().Be(ApplicationStatus.Submitted);
    }
}
