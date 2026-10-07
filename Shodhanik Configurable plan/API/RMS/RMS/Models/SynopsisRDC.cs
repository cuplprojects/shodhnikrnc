using RMS.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class SynopsisRDC
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int SYNID { get; set; }

        public int SID { get; set; }

        public int AttemptNumber { get; set; } = 1;

        public string? Title { get; set; }

        public string? FilePath { get; set; }

        public DateTime? SubmissionDate { get; set; }

        public string? ReceiptNumber { get; set; }

        public string? FeeAmount { get; set; }

        public DateTime? RDCDate { get; set; }

        public string? RDCRemark { get; set; }

        public string? ProceedingFilePath { get; set; }

        public string? DecisionFilePath { get; set; }

        // Navigation property to Scholar
        [ForeignKey("SID")]
        public Scholar? Scholar { get; set; }

        #region Legacy Columns (To be removed after full refactoring)
        public DateTime? Synopsis1LastDate { get; set; }
        public string? Synopsis1Title { get; set; }
        public string? Synopsis1FilePath { get; set; }
        public DateTime? Synopsis1Date { get; set; }
        public string? Synopsis1Receipt { get; set; }
        public string? Synopsis1FeeAmt { get; set; }
        public SynopsisDecisions? Synopsis1Decision { get; set; }
        public DateTime? Synopsis1RDCDate { get; set; }
        public string? Synopsis1RDCRemark { get; set; }
        public DateTime? Synopsis1ApprovedDate { get; set; }
        public int? Synopsis1ApprovedBy { get; set; }
        public string? Syn1RDC1ProceedingRemark { get; set; }
        public string? Syn1RDC1ProceedingFilePath { get; set; }
        public RDCProceedingDecisions? Syn1RDC1ProceedingStatus { get; set; }
        public DateTime? Syn1RDC1ProceedingTime { get; set; }
        public int? Syn1RDC1ProceedingBy { get; set; }
        public string? Syn1RDC1ProceedingApprovalRemark { get; set; }
        public DateTime? Syn1RDC1ProceedingApprovalTime { get; set; }
        public int? Syn1RDC1ProceedingApprovalBy { get; set; }
        public string? Syn1RDC1ProceedingApproval2Remark { get; set; }
        public RDCProceedingDecisions? Syn1RDC1Proceeding2Status { get; set; }
        public string? Syn1RDC1Proceeding2Remark { get; set; }
        public RDCProceedingDecisions? Syn1RDC1Proceeding3Status { get; set; }
        public string? Syn1RDC1Proceeding3Remark { get; set; }
        public DateTime? Syn1RDC1ProceedingApproval2Time { get; set; }
        public int? Syn1RDC1ProceedingApproval2By { get; set; }
        public string? Syn1RDC1ProceedingApproval3Remark { get; set; }
        public DateTime? Syn1RDC1ProceedingApproval3Time { get; set; }
        public int? Syn1RDC1ProceedingApproval3By { get; set; }
        public string? Syn1RDC1DecisionFilePath { get; set; }
        public string? Syn1RDC1DecisionRemark { get; set; }
        public RDCDecisions? Syn1RDC1Decision { get; set; }
        public string? Syn1RDC1Edit { get; set; }
        public DateTime? Syn1RDC1EditTime { get; set; }
        public int? Syn1RDC1BY { get; set; }
        public DateTime? Syn1RDC1SubmitTime { get; set; }
        public RDCApproval1Decisions? Syn1RDC1Approval1Decision { get; set; }
        public string? Syn1RDC1ApprovalRemark { get; set; }
        public DateTime? Syn1RDC1ApprovalTime { get; set; }
        public int? Syn1RDC1ApprovalBy { get; set; }
        public RDCApproval2Decisions? Syn1RDC1Approval2Decision { get; set; }
        public string? Syn1RDC1Approval2Remark { get; set; }
        public string? Syn1RDC1Approval2By { get; set; }
        public DateTime? Syn1RDC1Approval2Date { get; set; }
        public RDCApproval2Decisions? Syn1RDC1Approval3Decision { get; set; }
        public string? Syn1RDC1Approval3Remark { get; set; }
        public string? Syn1RDC1Approval3By { get; set; }
        public DateTime? Syn1RDC1Approval3Date { get; set; }
        public DateTime? Synopsis2LastDate { get; set; }
        public string? Synopsis2Title { get; set; }
        public string? Synopsis2FilePath { get; set; }
        public DateTime? Synopsis2Date { get; set; }
        public string? Synopsis2Receipt { get; set; }
        public string? Synopsis2FeeAmt { get; set; }
        public SynopsisDecisions? Synopsis2Decision { get; set; }
        public DateTime? Synopsis2RDCDate { get; set; }
        public string? Synopsis2RDCRemark { get; set; }
        public DateTime? Synopsis2ApprovedDate { get; set; }
        public int? Synopsis2ApprovedBy { get; set; }
        public string? Syn2RDC1ProceedingRemark { get; set; }
        public string? Syn2RDC1ProceedingFilePath { get; set; }
        public RDCProceedingDecisions? Syn2RDC1ProceedingStatus { get; set; }
        public RDCProceedingDecisions? Syn2RDC1Proceeding3Status { get; set; }
        public DateTime? Syn2RDC1ProceedingTime { get; set; }
        public int? Syn2RDC1ProceedingBy { get; set; }
        public string? Syn2RDC1ProceedingApprovalRemark { get; set; }
        public DateTime? Syn2RDC1ProceedingApprovalTime { get; set; }
        public int? Syn2RDC1ProceedingApprovalBy { get; set; }
        public string? Syn2RDC1ProceedingApproval2Remark { get; set; }
        public DateTime? Syn2RDC1ProceedingApproval2Time { get; set; }
        public int? Syn2RDC1ProceedingApproval2By { get; set; }
        public string? Syn2RDC1ProceedingApproval3Remark { get; set; }
        public DateTime? Syn2RDC1ProceedingApproval3Time { get; set; }
        public int? Syn2RDC1ProceedingApproval3By { get; set; }
        public string? Syn2RDC1DecisionFilePath { get; set; }
        public string? Syn2RDC1DecisionRemark { get; set; }
        public RDCDecisions? Syn2RDC1Decision { get; set; }
        public string? Syn2RDC1Edit { get; set; }
        public DateTime? Syn2RDC1EditTime { get; set; }
        public int? Syn2RDC1BY { get; set; }
        public DateTime? Syn2RDC1SubmitTime { get; set; }
        public RDCApproval1Decisions? Syn2RDC1Approval1Decision { get; set; }
        public string? Syn2RDC1ApprovalRemark { get; set; }
        public DateTime? Syn2RDC1ApprovalTime { get; set; }
        public int? Syn2RDC1ApprovalBy { get; set; }
        public RDCApproval2Decisions? Syn2RDC1Approval2Decision { get; set; }
        public string? Syn2RDC1Approval2Remark { get; set; }
        public string? Syn2RDC1Approval2By { get; set; }
        public DateTime? Syn2RDC1Approval2Date { get; set; }
        public RDCApproval2Decisions? Syn2RDC1Approval3Decision { get; set; }
        public string? Syn2RDC1Approval3Remark { get; set; }
        public string? Syn2RDC1Approval3By { get; set; }
        public DateTime? Syn2RDC1Approval3Date { get; set; }
        #endregion
    }
}
