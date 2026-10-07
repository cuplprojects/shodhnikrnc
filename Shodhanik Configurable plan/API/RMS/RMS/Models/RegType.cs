using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class RegType
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int RegTypeID { get; set; }
        public string RegTypeName { get; set; }

        public string? ExemptCategory { get; set; }
    }
}
