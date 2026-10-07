using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace RMS.Models
{
    public class Department
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int DepartmentID { get; set; }
        [Required]
        public int SortOrder { get; set; }
        [Required]
        public int DEPT_ID { get; set; }
        [Required]
        public string Subject { get; set; }
        [Required]
        public string Faculity { get; set; }
        [Required]
        public string Status { get; set; }
        public string? OldSyllabus { get; set; }
        public string? NewSyllabus { get; set; }
        public string? Adm {  get; set; }
        public string? Adm_User { get; set; }
    }
}
