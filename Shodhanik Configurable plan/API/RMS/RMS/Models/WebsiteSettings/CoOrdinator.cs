using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class CoOrdinator
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? AffiliationResearchCenter { get; set; }
        public string? Department { get; set; }
        public string? ContactNo { get; set; }
        public string? Email { get; set; }
        public string? PdfFile { get; set; }
        public bool Status { get; set; } = true; // true = Active, false = Archive
    }
}