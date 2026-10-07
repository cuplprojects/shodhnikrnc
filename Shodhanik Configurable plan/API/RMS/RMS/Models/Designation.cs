using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace RMS.Models
{
    public class Designation
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int DesignationID { get; set; }
        [Required]
        public string DesignationName { get; set; }
        [Required]
        public int TotalSeats { get; set; }
        [Required]
        public int TotalResearchPaper {  get; set; }
    }
}
