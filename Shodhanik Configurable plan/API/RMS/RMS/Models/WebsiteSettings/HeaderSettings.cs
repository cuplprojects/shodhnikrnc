using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class HeaderSettings
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? UniversityNameHindi { get; set; }
        public string? UniversityNameEnglish { get; set; }
        public string? UniversityFullNameHindi { get; set; }
        public string? UniversityFullNameEnglish { get; set; }
        public string? ApprovalText { get; set; }
        public string? WebsiteTitle { get; set; }
        public string? Helpline { get; set; }
        public string? Email { get; set; }
        public string? WorkingHours { get; set; }
        public string? Logo { get; set; }
        public string? RmsLogo { get; set; }
        public string? TopBarColor { get; set; }
        public string? NavBarColor { get; set; }
        public bool IsActive { get; set; }
    }
}