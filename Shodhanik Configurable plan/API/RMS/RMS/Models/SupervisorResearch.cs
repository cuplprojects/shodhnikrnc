using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class SupervisorResearch
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int SupId { get; set; }
        public string TitleOfPaper { get; set; }
        public string JournalName { get; set; }
        public string AuthorName { get; set; }
        public string PubYear { get; set; }
        public string IssNo { get; set; }
        public string Volume { get; set; }
        public int Page { get; set; }
        public decimal? Citations { get; set; }
        public decimal? ImpactFactor { get; set; }
        public string WebUrl { get; set; }
        public string ListedIn {  get; set; }
        public string UGCListNo { get; set; }
        public string? UploadPaper { get; set; }
    }
}
