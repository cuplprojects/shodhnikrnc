using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RMS.Models
{
    public class SupervisorSeatAvailability
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int SupId { get; set; }
        public int Pri_Seat {  get; set; }
        public int? Sec_Seat1 { get; set; }
        public int? Sec_Seat2 { get; set; }
        public int AvailableSeat { get; set; }
    }
}
