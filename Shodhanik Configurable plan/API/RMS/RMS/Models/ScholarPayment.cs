using RMS.Models.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class ScholarPayment
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int SPID { get; set; }

        public int SID { get; set; }

        public string? Token { get; set; }

        public string? TransactionID { get; set; }

        public PaymentStatus? PaymentStatus { get; set; }

        public PaymentCategory? PaymentCategory { get; set; }

        public string? HashReturn { get; set; }

        public string? Discription { get; set; }

        public DateTime? PaymentDate { get; set; }

        public string? IPAddress { get; set; }

        public DateTime? Created { get; set; }

        public DateTime? Modified { get; set; }

        public string? Remark { get; set; }

        public DateTime? Transfer { get; set; }
        public string? Category { get; set; }
    }
}
