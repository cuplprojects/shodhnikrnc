using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models.WebsiteSettings
{
    public class CarouselSlide
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string? Image { get; set; }
        public string? Caption { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
    }
}