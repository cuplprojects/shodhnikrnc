using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class BannerAnnouncement
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? Title { get; set; }
        public string? Category { get; set; }
        public string? Language { get; set; }
        public string? Status { get; set; }
        public DateTime Date { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
    }
}