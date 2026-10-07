using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class SupervisorRegistration
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int SupId { get; set; }
        [StringLength(4)]
        public string Title { get; set; }
        public string FullName { get; set; }
        public string FatherName { get; set; }
        [StringLength(15)]
        public string MobileNo { get; set; }
        [EmailAddress]
        public string Email { get; set; }
        [StringLength(8)]
        public string ApplicationNumber { get; set; }

        public string Year { get; set; } 
        public int IsAccepted { get; set; }
        public bool Active { get; set; } = true;

    }
}
