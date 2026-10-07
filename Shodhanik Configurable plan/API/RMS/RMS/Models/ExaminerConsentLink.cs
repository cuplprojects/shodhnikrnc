using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ExaminerConsentLink
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int VivaId { get; set; }
        public string Token1 { get; set; }
        public string? Token2 { get; set; }
        public DateTime ExpiryTime1 { get; set; }
        public DateTime? ExpiryTime2 { get; set; }
        public DateTime CreatedAt1 { get; set; }
        public DateTime? CreatedAt2 { get; set; }
    }
}
