using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class UniversityStatistic
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? Count { get; set; }
        public string? Label { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
    }
}