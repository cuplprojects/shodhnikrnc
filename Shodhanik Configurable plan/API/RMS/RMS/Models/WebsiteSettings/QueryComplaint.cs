using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class QueryComplaint
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? ShodhanikId { get; set; }
        public string? Mobile { get; set; }
        public string? Email { get; set; }
        public string? QueryComplaintText { get; set; }
        public string? Status { get; set; }
        public DateTime? SubmittedAt { get; set; }
    }
}