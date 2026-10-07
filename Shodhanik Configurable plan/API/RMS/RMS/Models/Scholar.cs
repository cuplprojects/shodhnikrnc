using RMS.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class Scholar
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int SID { get; set; }

        public string Name { get; set; }


        public string FName { get; set; }

        [Phone]
        public string PhoneNumber { get; set; }

        [EmailAddress]
        public string Email { get; set; }

        public int Subject_ID { get; set; }

        public int RegType { get; set; }

        public int? ExemptionType { get; set; }

        public DecisionStatus DecisionStatus { get; set; }

        public DateTime? DecisionUpdateTime { get; set; }

        public string? ApplicationNo { get; set; }

        public string? Year { get; set; }

        public string? RejectReason { get; set; }

        public CourseWorkDecisions? CourseWorkStatus { get; set; }

        public string? CourseWorkRejectReason { get; set; }

        public bool? isPartTime { get; set; }

        public string? RollNumber { get; set; }
        public int? PTPID { get; set; }

        public DateTime? InterviewDate { get; set; }
        public decimal? InterviewMarks { get; set; }
        
    }
}
