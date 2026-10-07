using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class Viva_voceExaminer
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int Sid { get; set; }
        public int AddedBy { get; set; }
        public int? RecommendedBy { get; set; }
        public int Status { get; set; }
        public int? ExaminerId { get; set; }
        public int ExaminerStatus { get; set; }
        public bool IsAddedBySupervisor { get; set; }
        public string? Remarks { get; set; }
        public string? Examiner1Remarks { get; set; }
        public string ? UploadReport { get; set; }
        public int? Examiner1Report {  get; set; } = 0;
        public int ? SupId { get; set; }
       
    }
}
