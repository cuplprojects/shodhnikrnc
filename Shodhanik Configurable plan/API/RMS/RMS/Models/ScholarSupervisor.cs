using MimeKit.Tnef;
using RMS.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ScholarSupervisor
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int SCSUID { get; set; }

        public int SID { get; set; }

        public int SUPID1 { get; set; }

        public string SUP1ConsentFilePath { get; set; }

        public int? SUPID2 { get; set; }
        public string? SUP2ConsentFilePath { get; set; }

        public string? NOCFilePath { get; set; }

        public int? COSUPID { get; set; }

        public string? COSUPConsentFilePath { get; set; }

        public ScholarSupervisorDecision? Decision1 { get; set; }

        public ScholarSupervisorDecision? Decision2 { get; set; }

        public string? Decision1Remark { get; set; }

        public string? Decision2Remark { get; set; }
        public DateTime? RequestedAt { get; set; }

        public DateTime? SecondRequestAt { get; set; }

        public DateTime? ApprovedAt { get; set; }

        public DateTime? SecondApprovedAt { get; set; }

        public int? ApprovedBy { get; set; }
    }
}
