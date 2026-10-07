using DocumentFormat.OpenXml.Office2010.Excel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Reflection;

namespace RMS.Models
{
    public class SupervisorPersonal
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int SupId { get; set; }
        public DateTime DateOfBirth { get; set; }
        public DateTime? RetirementDate { get; set; }
       
        [StringLength (15)]
        public string Gender { get; set; }
        public int Designation {  get; set; }
        [StringLength (50)]
        public string Nationality { get; set; }
        public int IdentityProofType { get; set; }
        [StringLength (50)]
        public string IdentityProofNo { get; set; }
        public string ApaarId { get; set; }
        public string CoAddress { get; set; }
        public string CoState { get; set; }
        public string CoDistrict { get; set; }
        [StringLength(6)]
        public string CoPinCode { get; set; }
        public string PeAddress { get; set; }
        public string PeState { get; set; }
        public string PeDistrict { get; set; }
        [StringLength(6)]
        public string PePinCode { get; set; }
        public string? OfficialAddress { get; set; }
        public int ? PrimarySuperviseSubject { get; set; }
        public int ? SecSuperviseSubject1 { get; set; }
        public int ? SecSuperviseSubject2 { get; set; }
        public string? AlternateMobileNo { get; set; }
        [EmailAddress]
        public string? UniversityDomainEmail { get; set; }
        public string? LinkedinID { get; set; }
    }
}
