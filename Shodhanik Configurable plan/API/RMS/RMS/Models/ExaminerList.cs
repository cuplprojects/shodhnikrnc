using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ExaminerList
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Institution { get; set; }
        public string ContactNo { get; set; }
        public string Address { get; set; }
        public int Designation { get; set; }
        public string State { get; set; }
        public int DepartmentId { get; set; }
    }
}
