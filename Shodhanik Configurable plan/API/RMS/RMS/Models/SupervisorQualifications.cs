using Microsoft.Identity.Client;
using System.ComponentModel.DataAnnotations;

namespace RMS.Models
{
    public class SupervisorQualifications
    {
        public int Id { get; set; }
        public int SupId { get; set; }
        public string Course { get; set; }
        [StringLength(4)]
        public string Year { get; set; }
        public string Institution {  get; set; }
        public string Details { get; set; }
    }
}
