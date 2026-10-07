using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ScholarPersonalDetail
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int SPDID { get; set; }
        [Required]
        public int SID { get; set; }
        public string? Mname { get; set; }
        public DateTime Dob {  get; set; }
        public string Gender { get; set; }
        public string MaritalStatus { get; set; }
        public string Country { get; set; }
        public string? PassportNo { get; set; }
        public string Domicile {  get; set; }
        public string? OtherDomicile { get; set; }
        public string Category { get; set; }
        public string? CastCertificateNo { get; set; }
        public string? IssueDate { get; set; }
        public string? IssuingAuthority { get; set; }
        public string? SubCategory { get; set; }
        public string IdentityProof { get; set; }
        public string IdentityProofNo { get; set; }
        public string CorrespondenceAddress { get; set; }
        public string? CState { get; set; }
        public string CDistrict { get; set; }
        public string CPincode { get; set; }
        public string PermanentAddress { get; set; }
        public string PState { get; set; }
        public string PDistrict { get; set; }
        public string PPinCode { get; set; }
        public string? ExPreference1 { get; set; }
        public string? ExPreference2 { get; set; }
        public string? GuardianName { get; set; }
        public bool? IsWorking { get; set; }
        public string? ApaarId { get; set; }

    }
}
