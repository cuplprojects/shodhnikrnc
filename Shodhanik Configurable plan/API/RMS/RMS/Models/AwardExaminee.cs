using NPOI.SS.Formula.Functions;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using RMS.Models.Enums;

namespace RMS.Models
{
    public class AwardExaminee
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int SId { get; set; }
        public string? AwardFilePath { get; set; }
        public string? UploadRemark { get; set; }
        public AwardExamieeDecision uploadDecision { get; set; }
        public int? Level1ApprovalStatus { get; set; }
        public string? Level1Remark { get; set; }
        public int? Level1Approvedby {  get; set; }
        public int? Level2ApprovalStatus { get;set; }
        public string? Level2Remark { get; set; }
        public int? Level2Approvedby {  get; set; }
        public int? Level3ApprovalStatus { get; set; }
        public string? Level3Remark { get; set; }
        public int? Level3Approvedby {  get; set; }
        public int? Level4ApprovalStatus { get; set; }
        public string? Level4Remark { get; set; }
        public int? Level4Approvedby {  get; set; }
        public int? Level5ApprovalStatus { get; set; }
        public string? Level5Remark { get; set; }
        public int? Level5Approvedby {  get; set; }
    }
}
