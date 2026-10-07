using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class AdminAuth
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int AAID { get; set; }

        public int AID { get; set; }

        public string Username { get; set; }

        public string Password { get; set; }

        public bool isAutoGen { get; set; }
    }
}
