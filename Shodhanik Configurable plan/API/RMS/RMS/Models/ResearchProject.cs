using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ResearchProject
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        public string Title { get; set; }

        public string FundingAgency { get; set; }

        public string PrincipalInvestigator { get; set; }

        public string Department { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime ExpectedCompletionDate { get; set; }

        public decimal Amount { get; set; }

        public string? AttachmentPath { get; set; }

        public string? AttachmentFileName { get; set; }

        public string Status { get; set; } = "Active";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}