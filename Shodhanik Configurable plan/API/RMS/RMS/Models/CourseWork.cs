using RMS.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class CourseWork
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int CWID { get; set; }
        public int SID { get; set; }
        public string? CourseWorkFilePath { get; set; }
        public DateTime? UploadDate { get; set; }
        public CourseWorkDecisions? CourseWorkResult { get; set; }
        public string? CourseWorkRemark { get; set; }
        public string? CourseWorkStatus{ get; set; }
        public DateTime? ApprovedAt{ get; set; }
    }
}
