using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace RMS.Models
{
    public class MeritListDoc
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Required]
        public int MLDID { get; set; }
        [Required]
        public string path { get; set; }
        [Required]
        public string Session {  get; set; } = string.Empty;
    }
}
