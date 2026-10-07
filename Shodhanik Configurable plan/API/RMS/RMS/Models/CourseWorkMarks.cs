using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class CourseWorkMarks
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int CWMID { get; set; }
        public int SID { get; set; }
        public string? Subject1PaperName { get; set; }
        public string? Subject1PaperCode { get; set; }
        public string? Subject1TheoryOBT { get; set; }
        public string? Subject1INTOBT { get; set; }
        public string? Subject1PROBT { get; set; }
        public string? Subject1TOTAL { get; set; }
        public string? Subject1GRADE { get; set; }
        public string? Subject1GRADEPOINT { get; set; }
        public string? Subject1SUBJECTGRADE { get; set; }
        public string? Subject1SCGP { get; set; }
        public string? Subject2PaperName { get; set; }
        public string? Subject2PaperCode { get; set; }
        public string? Subject2TheoryOBT { get; set; }
        public string? Subject2INTOBT { get; set; }
        public string? Subject2PROBT { get; set; }
        public string? Subject2TOTAL { get; set; }
        public string? Subject2GRADE { get; set; }
        public string? Subject2GRADEPOINT { get; set; }
        public string? Subject2SUBJECTGRADE { get; set; }
        public string? Subject2SCGP { get; set; }
        public string? Subject3PaperName { get; set; }
        public string? Subject3PaperCode { get; set; }
        public string? Subject3TheoryOBT { get; set; }
        public string? Subject3INTOBT { get; set; }
        public string? Subject3PROBT { get; set; }
        public string? Subject3TOTAL { get; set; }
        public string? Subject3GRADE { get; set; }
        public string? Subject3GRADEPOINT { get; set; }
        public string? Subject3SUBJECTGRADE { get; set; }
        public string? Subject3SCGP { get; set; }
        public string? Remarks { get; set; }
    }
}
