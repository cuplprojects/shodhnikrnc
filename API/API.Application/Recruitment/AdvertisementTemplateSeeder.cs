using API.Application.Common;
using API.Domain.Entities;
using API.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace API.Application.Recruitment;

/// <summary>
/// Seeds the single system-default advertisement template (Task 1 of the
/// advertisement template engine), adapted from the reference institutional
/// application form. Content carries <c>{{Token}}</c> placeholders resolved
/// at generation time by AdvertisementTokenResolver (Task 2).
/// </summary>
public static class AdvertisementTemplateSeeder
{
    /// <summary>
    /// Inserts the system-default template only if none exists yet.
    /// Idempotent on <c>IsSystemDefault</c> rather than a well-known id --
    /// there is only ever one such template, and any operator customization
    /// of individual section content is never overwritten on restart.
    /// </summary>
    public static async Task SeedAsync(IApplicationDbContext db, CancellationToken ct = default)
    {
        if (await db.AdvertisementTemplates.AnyAsync(t => t.IsSystemDefault, ct))
        {
            return;
        }

        var templateId = Guid.NewGuid();
        var template = new AdvertisementTemplate
        {
            Id = templateId,
            OwnerUserId = null,
            Name = "System Default Advertisement Template",
            IsSystemDefault = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            Sections =
            [
                new AdvertisementTemplateSection
                {
                    Id = Guid.NewGuid(),
                    TemplateId = templateId,
                    Key = AdvertisementSectionKey.EssentialQualifications,
                    Content = "PG degree with minimum 60% marks or 6.5 CGPA for GN/OBC (55% for SC/ST/PH) from UGC recognized University/Institute including autonomous bodies. GATE/CSIR-UGC NET/GPAT qualified.",
                    IsIncluded = true,
                    SortOrder = 1,
                },
                new AdvertisementTemplateSection
                {
                    Id = Guid.NewGuid(),
                    TemplateId = templateId,
                    Key = AdvertisementSectionKey.Salary,
                    Content = "As per {{FundingAgency}} norms: {{SalaryJrf}} per month (JRF, if GATE/CSIR-UGC NET/GPAT qualified) or {{SalaryProjectAssociate}} per month (Project Associate-I, if not qualified).",
                    IsIncluded = true,
                    SortOrder = 2,
                },
                new AdvertisementTemplateSection
                {
                    Id = Guid.NewGuid(),
                    TemplateId = templateId,
                    Key = AdvertisementSectionKey.OtherBenefits,
                    Content = "Candidate selected for the Junior Research Fellow may register for Ph.D. if eligibility conditions as set by institute is met by him/her.",
                    IsIncluded = true,
                    SortOrder = 3,
                },
                new AdvertisementTemplateSection
                {
                    Id = Guid.NewGuid(),
                    TemplateId = templateId,
                    Key = AdvertisementSectionKey.AgeLimit,
                    Content = "28 years on the last date of application (The upper age limit is relaxable up to 5 years in the case of candidates belonging to SC/ST/OBC/PH and women candidates).",
                    IsIncluded = true,
                    SortOrder = 4,
                },
                new AdvertisementTemplateSection
                {
                    Id = Guid.NewGuid(),
                    TemplateId = templateId,
                    Key = AdvertisementSectionKey.TenureOfAppointment,
                    Content = "One year. Extendable on performance basis up to 3 years.",
                    IsIncluded = true,
                    SortOrder = 5,
                },
                new AdvertisementTemplateSection
                {
                    Id = Guid.NewGuid(),
                    TemplateId = templateId,
                    Key = AdvertisementSectionKey.DesirableQualifications,
                    Content = "Highly motivated towards research with a strong eagerness to learn new techniques. Prior experience with relevant research area is desirable.",
                    IsIncluded = true,
                    SortOrder = 6,
                },
                new AdvertisementTemplateSection
                {
                    Id = Guid.NewGuid(),
                    TemplateId = templateId,
                    Key = AdvertisementSectionKey.HowToApply,
                    Content = "The duly completed application on prescribed format along with copies of supporting documents must reach the Research & Consultancy Cell, MNNIT Allahabad, Prayagraj-211004 on or before the closing date. A soft copy should also be sent to {{PiName}} through email.",
                    IsIncluded = true,
                    SortOrder = 7,
                },
                new AdvertisementTemplateSection
                {
                    Id = Guid.NewGuid(),
                    TemplateId = templateId,
                    Key = AdvertisementSectionKey.Notes,
                    Content = "The applicant will be responsible for the authenticity of information submitted. The institute reserves the right to reject any application at any time. Mere possession of the prescribed qualification does not ensure an interview call. No TA/DA will be paid for appearing in the interview.",
                    IsIncluded = true,
                    SortOrder = 8,
                },
            ],
        };

        db.AdvertisementTemplates.Add(template);
        await db.SaveChangesAsync(ct);
    }
}
