using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class NoticeboardNotice
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? Type { get; set; }
        public string? Title { get; set; }
        public string? Content { get; set; }
        public string? BgColor { get; set; }
        public string? Priority { get; set; }
        public bool SendPushNotification { get; set; }
        public bool IsActive { get; set; }
    }
}