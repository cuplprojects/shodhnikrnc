using System.ComponentModel.DataAnnotations;

namespace RMS.Models
{
    public class SupervisorAward
    {
        public int Id { get; set; }
        public int SupId { get; set; }
        public string Fellowship { get; set; }
        public string Agency { get; set; }
        [StringLength(4)]
        public string Year { get; set; }
    }
}
