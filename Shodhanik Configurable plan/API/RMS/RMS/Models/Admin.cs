using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class Admin
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int AID { get; set; }

        public string Name { get; set; }

        public string Phone { get; set; }

        public int RoleId { get; set; }

        public string Email { get; set; }

    }
}
