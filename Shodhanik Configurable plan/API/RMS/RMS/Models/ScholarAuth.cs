using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ScholarAuth
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int SAID { get; set; }

        public int SID { get; set; }

        public string? TempPassword { get; set; }

        public bool isTempAutoGen { get; set; }

        public string? PermUserName { get; set; }

        public string? PermPassword { get; set; }

        public bool? isPermAutoGen { get; set; }

    }
}
