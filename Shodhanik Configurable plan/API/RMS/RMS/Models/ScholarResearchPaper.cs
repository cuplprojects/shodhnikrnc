using RMS.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ScholarResearchPaper
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int SID { get; set; }
        public string? TitleOfPaper { get; set; }
        public string? AuthorName { get; set; }
        public string? NameOfJournal { get; set; }
        public int? YearOfPb { get; set; }
        public string? Volume { get; set; }
        public string? IssNo { get; set; }
        public int? Page { get; set; }
        public string? Citations { get; set; }
        public string? ImpactFactor { get; set; }
        public string? WebUrl { get; set; }
        public string? ListedIn { get; set; }
        public string? UGCListNo { get; set; }
        public string? UploadPaper { get; set; }

        public ScholarResearchPaperDecision? Status { get; set; }

        public string? Remarks { get; set; }

        public DateTime? CreatedAt { get; set; }
    }
}
