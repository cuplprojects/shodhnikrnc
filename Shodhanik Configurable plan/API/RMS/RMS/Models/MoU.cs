using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class MoU
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        public string InstitutionName { get; set; }

        public string CountryOfInstitution { get; set; }

        public string Department { get; set; }

        public string NatureOfMoU { get; set; }

        public int Year { get; set; }

        public string? PdfFilePath { get; set; }

        public string? PdfFileName { get; set; }

        public string Status { get; set; } = "Active";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}