using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class WelcomeSection
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? WelcomeTitle { get; set; }
        public string? WelcomeText { get; set; }
        public bool IsActive { get; set; }
    }
}