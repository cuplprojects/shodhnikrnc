
using RMS.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;



namespace RMS.Models
{
    public class Thesis
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int ThesisID { get; set; }
        public int SID { get; set; }
        public string? Thesis_Title {  get; set; }
        public string? Thesis_File { get; set; }
        public string? Thesis_Summary_File { get; set; }
        public string? No_Dues_Cretificate_File { get; set; } //No Dues Certificate from Related Department / Research Centre
        public string? Pre_PhD_Notice_File { get; set; } //Pre. Ph.D. Presentation Notice
        public string? Pre_PhD_Certificate_File { get; set; } //Pre. Ph.D. Presentation Certificate issued by HoD/Principal
        public string? Time_Extension_Letter_File { get; set; } //Time Extension Letter (If Applicable)
        public int? Fee {  get; set; }
        public string? TxnID { get; set; }
        public DateTime? Txn_Date { get; set; }
        public string? Thesis_No { get; set; }
        public string? Thesis_File_No { get; set; }
        public DateTime? UploadDate { get; set; }
        public ThesisStatus? Status { get; set; }
        public DateTime? StatusApprovedDate { get; set; }
        public string? Remarks { get; set; }
        public int? Verified_By { get; set; }
        public DateTime? Verified_At { get; set; }
        public ThesisStatus? PlagCheck { get; set; }
        public string? PlagRemarks { get; set; }
        public string? PlagReportFile { get; set; }
        public int? PlagVerifiedBy { get; set; }
        public DateTime? PlagVerifiedAt { get; set; }

        public DateTime? VivaDate { get; set; }
        public bool? ForwardToVor {  get; set; }
        public bool? VivaDateAccepted { get; set; }
        public DateTime? vivaDateAcceptedAt { get; set; }
        public string? VenueDetails {  get; set; }

    }
}
