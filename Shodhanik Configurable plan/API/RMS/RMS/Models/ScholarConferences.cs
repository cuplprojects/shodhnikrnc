using Microsoft.EntityFrameworkCore.Storage.ValueConversion.Internal;
using RMS.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ScholarConferences
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int SID { get; set; }
        public string? TitleOfPaper { get; set; }
        public string? AuthorName { get; set; }
        public string? NameOfConference { get; set; }
        public string? LevelOfConference { get; set; }
        public string? SponsoringAgency { get; set; }
        public DateTime?  StartingDate { get; set; }
        public DateTime? EndingDate { get; set; }
        public string? OrganizedBy { get; set; }
        public string? PresentationCertificate { get; set; }
        public string? Place {  get; set; }

        public ScholarConferenceDecisions? ConferenceStatus { get; set; }

        public string? Remarks { get; set; }
    }
}
