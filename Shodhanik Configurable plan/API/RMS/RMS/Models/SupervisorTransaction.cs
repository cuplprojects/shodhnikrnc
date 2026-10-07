using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class SupervisorTransaction
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int SupId { get; set; }
        public int TxnNo { get; set; }
        public string TotalAmt { get; set; }
        public string TotalFee { get; set; }

        public string BankingCharge { get; set; }
        public string ResponseCode { get; set; }
        public string Hash_Code { get; set; }
        public string Status { get; set; }
        public string IPAddress { get; set; }


        public DateTime TxnDate { get; set; }

    }
}
