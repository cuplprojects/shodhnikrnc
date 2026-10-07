using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class SupervisorEducation
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int SupId { get; set; }
        public int UniversityId { get; set; }
        public string CollegeType { get; set; }
        public string? UniversityName { get; set; }
        public string? CollegeName { get; set; }
        public int CollegeId { get; set; }
        public string ResearchExp { get; set; }
        [StringLength(4)]
        public string DeptEst { get; set; }
        public string? ResearchCenter { get; set; }
        public string PhdSubject { get; set; }
        public string MonthAndYear { get; set; }
        public string SupervisorName { get; set; }
        public string AreaOfSpec { get; set; }
        public string ThesisTitle { get; set; }
  public string Description { get; set; }
        public string PhdUniversity { get; set; }
    }
}
