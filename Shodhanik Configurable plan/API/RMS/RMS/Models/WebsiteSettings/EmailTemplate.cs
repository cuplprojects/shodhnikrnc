using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class EmailTemplate
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int TemplateId { get; set; }
        public string? TemplateName { get; set; }
        public string? Type { get; set; }
        public string? Subject { get; set; }
        public string? Content { get; set; }
    }
}