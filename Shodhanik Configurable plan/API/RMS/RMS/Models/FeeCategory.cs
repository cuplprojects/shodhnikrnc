using DocumentFormat.OpenXml.Presentation;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class FeeCategory
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int FCID { get; set; }

        public string CategoryName { get; set; }


        public decimal Amount { get; set; }
    }
}
