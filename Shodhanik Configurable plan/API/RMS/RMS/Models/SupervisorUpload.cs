using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class SupervisorUpload
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int SupId { get; set; }
        public string Photo {  get; set; }
        public string Sign {  get; set; }
        public string IdentityProof { get; set; }
        public string AppLetter { get; set; }
        public string ApaarId { get; set; }
    }
}
