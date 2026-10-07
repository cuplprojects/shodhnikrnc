using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ScholarAttendance
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Required]
        public int ScholarAttenId { get; set; }
        public string? PermUserName { get; set; }
        public int? TotalDays { get; set; }
        public int? WorkingDays { get; set; }
        public int? NoOfDaysPresent { get; set; }
        public List<string>? Month {  get; set; }
        public string? Year { get; set; }
    }
}
