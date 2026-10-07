using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace RMS.Models
{
    public class ScholarAcademicQualification
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int AQID { get; set; }
       
        public string? NameOfExamination { get; set; }
        
        public string? BoardUniversityName { get; set; }
       
        public string? Stream {  get; set; }
        
        public string? Subject {  get; set; }
       
        public int? MarksObitained { get; set; }
        
        public int? MaxMarks {  get; set; }
        
        public string? MarkingRule { get; set; }
       
        public double? PercentageOrCGPA { get; set; }
       
        public string? Division { get; set; }
        
        public int? PassingYear { get; set; }
       
        [Required]
        public int SID { get; set; }
        public bool IsAppearing { get; set; }
    }
}
