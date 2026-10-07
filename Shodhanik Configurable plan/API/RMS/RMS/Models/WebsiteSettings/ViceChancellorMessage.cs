using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class ViceChancellorMessage
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? Designation { get; set; }
        public string? Message { get; set; }
        public string? Image { get; set; }
    }
}