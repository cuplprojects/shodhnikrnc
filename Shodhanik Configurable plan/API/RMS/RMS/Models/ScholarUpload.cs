using RMS.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ScholarUpload
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int ScholarUploadID { get; set; }
        [Required]
        public int SID { get; set; }
      
       
    
        public string? Remarks { get; set; }
        [Required]
        public int DocumentMasterID { get; set; }
        [Required]
        public string Path { get; set; }

        public UploadDecisionStatus? DecisionStatus { get; set; } // should Accept 0 or 1 or 2 refer the enum for the explanation
    }
}
